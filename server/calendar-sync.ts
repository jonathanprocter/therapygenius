import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { storage } from './storage';
import { aiRouter } from './ai';
import { encryptionService, EncryptionAuditLogger } from './encryption';
import { z } from 'zod';

// Import therapist ID constant for audit logging
const THERAPIST_ID = "59ea3867-0b4f-47b6-8a95-6484c4a52ef7";

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  location?: string;
  status?: string;
  created?: string;
  updated?: string;
}

interface SyncStatus {
  isAuthenticated: boolean;
  lastSync?: Date;
  eventsProcessed: number;
  matchesFound: number;
  errors: string[];
  nextSync?: Date;
  syncType: 'full' | 'incremental';
  syncToken?: string;
  rateLimitRemaining?: number;
  quotaUsed?: number;
}

interface ClientMatch {
  clientId: string;
  confidence: number;
  matchReason: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

class CalendarSyncService {
  private oauth2Client: OAuth2Client;
  private calendar: any;
  private readonly SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
  // Configuration from environment variables for security and flexibility
  // Updated to use Eastern Time (EST/EDT) - America/New_York handles DST transitions automatically
  private readonly DATE_RANGE_START = process.env.CALENDAR_SYNC_START_DATE || '2015-01-01T00:00:00-05:00';
  private readonly DATE_RANGE_END = process.env.CALENDAR_SYNC_END_DATE || '2030-12-31T23:59:59-05:00';
  private readonly MAX_EVENTS_PER_SYNC = parseInt(process.env.MAX_EVENTS_PER_SYNC || '1000');
  private readonly SYNC_RATE_LIMIT_MS = parseInt(process.env.SYNC_RATE_LIMIT_MS || '100');
  private readonly QUOTA_LIMIT_PER_DAY = parseInt(process.env.GOOGLE_CALENDAR_QUOTA_LIMIT || '1000000');
  private readonly CIRCUIT_BREAKER_FAILURE_THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5');
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || '300000'); // 5 minutes
  // REMOVED: In-memory audit logging replaced with persistent database storage
  private readonly circuitBreakerState = new Map<string, { failures: number; lastFailure?: Date; isOpen: boolean }>(); // Per-therapist circuit breaker
  private readonly rateLimitCounters = new Map<string, { requests: number; resetTime: Date }>(); // Per-therapist rate limiting

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'https://e09c5ae1-e9b9-4ca1-ae8a-f0fe92f01d15-00-jenms9tgg513.worf.replit.dev/api/calendar/callback'
    ) as any;

    // Initialize calendar with auth - this will be properly set when tokens are loaded
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate OAuth2 authorization URL (SECURITY: No hardcoded email)
   */
  getAuthUrl(therapistEmail?: string): string {
    const authConfig: any = {
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent'
    };
    
    // Only add login hint if email is provided by authenticated therapist
    if (therapistEmail) {
      authConfig.login_hint = therapistEmail;
      this.logAuditEvent('oauth_url_generated', THERAPIST_ID, true, `Login hint: ${therapistEmail}`);
    } else {
      this.logAuditEvent('oauth_url_generated', THERAPIST_ID, true, 'No login hint provided');
    }
    
    return this.oauth2Client.generateAuthUrl(authConfig);
  }

  /**
   * Exchange authorization code for tokens (SECURITY FIXED: OAuth flow)
   */
  async exchangeCodeForTokens(code: string, therapistId: string): Promise<void> {
    try {
      // SECURITY FIX: Use getToken instead of getAccessToken for proper OAuth flow
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('Failed to obtain access token');
      }

      // SECURITY: Encrypt and securely store tokens in database
      const tokensToStore = {
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token ?? null,
        expiry_date: tokens.expiry_date ?? null,
        token_type: tokens.token_type ?? null,
        scope: tokens.scope ?? null
      };
      
      await storage.storeOAuthTokens(therapistId, tokensToStore);
      this.oauth2Client.setCredentials(tokens);
      
      // AUDIT LOG: OAuth token storage
      console.log(`[Calendar Sync] [SECURITY] OAuth tokens securely stored for therapist ${therapistId}`);
      this.logAuditEvent('oauth_token_stored', therapistId, true);
      EncryptionAuditLogger.logEncryption(true);
    } catch (error) {
      console.error('[Calendar Sync] [SECURITY] Error exchanging code for tokens:', error);
      this.logAuditEvent('oauth_token_exchange_failed', therapistId, false, error instanceof Error ? error.message : String(error));
      EncryptionAuditLogger.logEncryption(false, error instanceof Error ? error.message : String(error));
      throw new Error('Failed to authenticate with Google Calendar');
    }
  }

  /**
   * Load stored tokens and refresh if needed (PRODUCTION: With proactive refresh)
   */
  async loadTokens(therapistId: string): Promise<boolean> {
    try {
      const tokens = await storage.getOAuthTokens(therapistId);
      
      if (!tokens) {
        console.log('[Calendar Sync] [SECURITY] No stored tokens found for therapist');
        this.logAuditEvent('no_tokens_found', therapistId, false, 'Authentication required');
        return false;
      }

      this.oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? undefined,
        expiry_date: tokens.expiry_date ?? undefined,
        token_type: tokens.token_type ?? undefined,
        scope: tokens.scope ?? undefined
      });

      // PRODUCTION: Proactive token refresh (refresh 10 minutes before expiry)
      const now = Date.now();
      const refreshBuffer = 10 * 60 * 1000; // 10 minutes
      const shouldRefresh = tokens.expiry_date && tokens.expiry_date <= (now + refreshBuffer);
      
      if (shouldRefresh) {
        console.log('[Calendar Sync] [PRODUCTION] Proactively refreshing tokens before expiry');
        await this.refreshTokens(therapistId);
      }

      this.logAuditEvent('tokens_loaded', therapistId, true, shouldRefresh ? 'Tokens refreshed' : 'Tokens valid');
      return true;
      
    } catch (error) {
      console.error('[Calendar Sync] [SECURITY] Error loading tokens:', error);
      this.logAuditEvent('token_load_failed', therapistId, false, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Refresh OAuth tokens (SECURITY: With encryption, audit, and rotation)
   */
  private async refreshTokens(therapistId: string): Promise<void> {
    try {
      // PRODUCTION: Token rotation with minimum scope validation
      const currentTokens = await storage.getOAuthTokens(therapistId);
      if (!currentTokens?.refresh_token) {
        throw new Error('No refresh token available - re-authentication required');
      }

      // PRODUCTION: Validate minimum required scopes
      const requiredScopes = this.SCOPES;
      const currentScopes = currentTokens.scope?.split(' ') || [];
      const missingScopes = requiredScopes.filter(scope => !currentScopes.includes(scope));
      
      if (missingScopes.length > 0) {
        console.warn(`[Calendar Sync] [SECURITY] Missing required scopes: ${missingScopes.join(', ')} - re-authentication required`);
        this.logAuditEvent('insufficient_scopes', therapistId, false, `Missing: ${missingScopes.join(', ')}`);
        throw new Error('Insufficient OAuth scopes - re-authentication required');
      }

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      // SECURITY: Store refreshed tokens with encryption
      await storage.storeOAuthTokens(therapistId, {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token ?? currentTokens.refresh_token, // Keep existing if not provided
        expiry_date: credentials.expiry_date ?? null,
        token_type: credentials.token_type ?? null,
        scope: credentials.scope ?? currentTokens.scope // Preserve existing scope
      });

      this.oauth2Client.setCredentials(credentials);
      
      console.log('[Calendar Sync] [SECURITY] Tokens refreshed, rotated, and encrypted successfully');
      this.logAuditEvent('oauth_token_refreshed', therapistId, true, 'Token rotation completed');
      EncryptionAuditLogger.logEncryption(true);
      
    } catch (error) {
      console.error('[Calendar Sync] [SECURITY] Error refreshing tokens:', error);
      this.logAuditEvent('oauth_token_refresh_failed', therapistId, false, error instanceof Error ? error.message : String(error));
      EncryptionAuditLogger.logEncryption(false, error instanceof Error ? error.message : String(error));
      
      // PRODUCTION: Clear potentially corrupted tokens on critical errors
      if (error instanceof Error && error.message.includes('invalid_grant')) {
        console.warn('[Calendar Sync] [SECURITY] Invalid grant - clearing tokens for re-authentication');
        await storage.deleteOAuthTokens(therapistId);
        this.logAuditEvent('tokens_cleared_invalid_grant', therapistId, true, 'Tokens cleared due to invalid grant');
      }
      
      throw new Error('Failed to refresh OAuth tokens');
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(therapistId: string): Promise<SyncStatus> {
    try {
      const isAuthenticated = await this.loadTokens(therapistId);
      const lastSync = await storage.getLastSyncTime(therapistId);
      const stats = await storage.getCalendarSyncStats(therapistId);

      return {
        isAuthenticated,
        lastSync: lastSync || undefined,
        eventsProcessed: stats.eventsProcessed || 0,
        matchesFound: stats.matchesFound || 0,
        errors: stats.errors || [],
        nextSync: this.calculateNextSync(lastSync || undefined),
        syncType: 'full'
      };
    } catch (error) {
      console.error('[Calendar Sync] Error getting sync status:', error);
      return {
        isAuthenticated: false,
        eventsProcessed: 0,
        matchesFound: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        syncType: 'full'
      };
    }
  }

  /**
   * Perform calendar sync (PRODUCTION READY: With circuit breaker, rate limiting, incremental sync)
   */
  async syncCalendar(therapistId: string, forceFullSync: boolean = false): Promise<SyncStatus> {
    const startTime = new Date();
    let eventsProcessed = 0;
    let matchesFound = 0;
    const errors: string[] = [];
    let syncType: 'full' | 'incremental' = 'full';
    let syncToken: string | undefined;
    let rateLimitRemaining: number | undefined;
    let quotaUsed: number | undefined;

    try {
      // PRODUCTION: Circuit breaker check
      if (this.isCircuitBreakerOpen(therapistId)) {
        throw new Error('Circuit breaker is open - too many recent failures');
      }

      // PRODUCTION: Rate limiting check
      if (!this.checkRateLimit(therapistId)) {
        throw new Error('Rate limit exceeded - please wait before next sync');
      }

      // Load authentication tokens
      const isAuthenticated = await this.loadTokens(therapistId);
      if (!isAuthenticated) {
        throw new Error('Not authenticated with Google Calendar');
      }

      console.log('[Calendar Sync] [PRODUCTION] Starting secure calendar sync...');
      this.logAuditEvent('sync_started', therapistId, true);

      // RELIABILITY: Determine sync type (incremental vs full)
      const lastSyncStats = await storage.getCalendarSyncStats(therapistId);
      const shouldUseIncremental = !forceFullSync && lastSyncStats && (lastSyncStats as any).syncToken;
      
      if (shouldUseIncremental) {
        syncType = 'incremental';
        syncToken = (lastSyncStats as any).syncToken;
        console.log('[Calendar Sync] [RELIABILITY] Using incremental sync with token');
      }

      // Fetch events with pagination and rate limiting
      const { events: allEvents, nextSyncToken, quotaInfo } = await this.fetchCalendarEventsWithPagination(
        ['primary', '6ac7ac649a345a77fa617a926a67b4e1028f6a8ade0bdf1e7cca8f2b62310423@group.calendar.google.com'], 
        syncType, 
        syncToken,
        therapistId
      );
      
      rateLimitRemaining = quotaInfo.remaining;
      quotaUsed = quotaInfo.used;
      
      console.log(`[Calendar Sync] [RELIABILITY] Found ${allEvents.length} events to process (${syncType} sync)`);

      // Process events with rate limiting
      for (const event of allEvents) {
        try {
          eventsProcessed++;
          
          // PRODUCTION: Respect rate limits
          if (eventsProcessed % 10 === 0) {
            await this.delay(this.SYNC_RATE_LIMIT_MS);
          }
          
          // THERAPY FILTER: Only process therapy-related events
          if (!this.isTherapyRelatedEvent(event)) {
            console.log(`[Calendar Sync] [FILTER] Skipping non-therapy event: ${event.summary}`);
            continue;
          }
          
          // RELIABILITY: Use upsert for session handling
          const clientMatch = await this.matchEventToClient(event, therapistId);
          
          if (clientMatch) {
            // Create or update session from calendar event
            await this.upsertSessionFromEvent(event, clientMatch, therapistId);
            matchesFound++;
            console.log(`[Calendar Sync] [RELIABILITY] Upserted session for client ${clientMatch.client.firstName} ${clientMatch.client.lastName}`);
          } else {
            console.log(`[Calendar Sync] No client match found for event: ${event.summary}`);
          }
        } catch (eventError) {
          const errorMsg = `Failed to process event ${event.id}: ${eventError instanceof Error ? eventError.message : String(eventError)}`;
          console.error(`[Calendar Sync] [PRODUCTION] ${errorMsg}`);
          errors.push(errorMsg);
          
          // PRODUCTION: Record failure for circuit breaker
          this.recordFailure(therapistId);
        }
      }

      // Update sync statistics with sync token for next incremental sync
      await storage.updateSyncStats(therapistId, {
        lastSync: startTime,
        eventsProcessed,
        matchesFound,
        errors,
        syncToken: nextSyncToken,
        syncType,
        quotaUsed
      } as any);

      // PRODUCTION: Record success for circuit breaker
      this.recordSuccess(therapistId);
      
      console.log(`[Calendar Sync] [PRODUCTION] Sync completed successfully. Processed: ${eventsProcessed}, Matches: ${matchesFound}, Type: ${syncType}`);
      this.logAuditEvent('sync_completed', therapistId, true, `${syncType} sync - ${eventsProcessed} events`);

      return {
        isAuthenticated: true,
        lastSync: startTime,
        eventsProcessed,
        matchesFound,
        errors,
        nextSync: this.calculateNextSync(startTime),
        syncType,
        syncToken: nextSyncToken,
        rateLimitRemaining,
        quotaUsed
      };

    } catch (error) {
      console.error('[Calendar Sync] [PRODUCTION] Sync failed:', error);
      errors.push(error instanceof Error ? error.message : String(error));
      
      // PRODUCTION: Record failure for circuit breaker
      this.recordFailure(therapistId);
      this.logAuditEvent('sync_failed', therapistId, false, error instanceof Error ? error.message : String(error));
      
      return {
        isAuthenticated: false,
        lastSync: startTime,
        eventsProcessed,
        matchesFound,
        errors,
        nextSync: undefined,
        syncType,
        syncToken,
        rateLimitRemaining,
        quotaUsed
      };
    }
  }

  /**
   * Fetch events from a specific calendar (LEGACY - use fetchCalendarEventsWithPagination)
   */
  private async fetchCalendarEvents(calendarId: string, required: boolean = true): Promise<CalendarEvent[]> {
    try {
      this.calendar.auth = this.oauth2Client;
      const response = await this.calendar.events.list({
        calendarId,
        timeMin: this.DATE_RANGE_START,
        timeMax: this.DATE_RANGE_END,
        maxResults: 2500,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      console.log(`[Calendar Sync] Fetched ${events.length} events from calendar: ${calendarId}`);
      
      return events.filter((event: any) => 
        event.id && 
        event.start && 
        (event.start.dateTime || event.start.date) &&
        event.status !== 'cancelled'
      );
    } catch (error) {
      if (required) {
        console.error(`[Calendar Sync] Error fetching events from ${calendarId}:`, error);
        throw error;
      } else {
        console.warn(`[Calendar Sync] Could not fetch events from ${calendarId} (optional): ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    }
  }

  /**
   * PRODUCTION: Fetch events with pagination, rate limiting, and incremental sync
   */
  private async fetchCalendarEventsWithPagination(
    calendarIds: string[], 
    syncType: 'full' | 'incremental',
    syncToken?: string,
    therapistId?: string
  ): Promise<{ events: CalendarEvent[]; nextSyncToken?: string; quotaInfo: { used: number; remaining: number } }> {
    const allEvents: CalendarEvent[] = [];
    let quotaUsed = 0;
    let quotaRemaining = this.QUOTA_LIMIT_PER_DAY;
    let nextSyncToken: string | undefined;

    try {
      // Auth is already set in constructor and updated when tokens are loaded
      
      for (const calendarId of calendarIds) {
        try {
          if (syncType === 'incremental' && syncToken) {
            // RELIABILITY: Incremental sync using sync token
            console.log(`[Calendar Sync] [RELIABILITY] Performing incremental sync for ${calendarId}`);
            
            const response = await this.calendar.events.list({
              calendarId,
              syncToken,
              maxResults: this.MAX_EVENTS_PER_SYNC,
              singleEvents: true
            });
            
            const events = response.data.items || [];
            quotaUsed += 1; // Each API call counts toward quota
            quotaRemaining -= 1;
            
            // Filter and add events
            const validEvents = events
              .filter((event: any) => event.id && event.start)
              .map((event: any) => ({
                ...event,
                _calendarSource: calendarId
              }));
              
            allEvents.push(...validEvents);
            nextSyncToken = response.data.nextSyncToken;
            
            console.log(`[Calendar Sync] [RELIABILITY] Incremental sync found ${validEvents.length} changed events from ${calendarId}`);
          } else {
            // RELIABILITY: Full sync with pagination
            console.log(`[Calendar Sync] [RELIABILITY] Performing full sync for ${calendarId}`);
            
            let pageToken: string | undefined;
            do {
              // PRODUCTION: Exponential backoff for rate limiting
              if (quotaUsed > 0 && quotaUsed % 100 === 0) {
                const backoffMs = Math.min(1000 * Math.pow(2, Math.floor(quotaUsed / 100)), 10000);
                console.log(`[Calendar Sync] [PRODUCTION] Rate limiting: backing off ${backoffMs}ms`);
                await this.delay(backoffMs);
              }
              
              const response = await this.calendar.events.list({
                calendarId,
                timeMin: this.DATE_RANGE_START,
                timeMax: this.DATE_RANGE_END,
                maxResults: Math.min(this.MAX_EVENTS_PER_SYNC, 2500),
                singleEvents: true,
                orderBy: 'startTime',
                pageToken
              });
              
              const events = response.data.items || [];
              quotaUsed += 1;
              quotaRemaining -= 1;
              
              // Filter and add events
              const validEvents = events
                .filter((event: any) => 
                  event.id && 
                  event.start && 
                  (event.start.dateTime || event.start.date) &&
                  event.status !== 'cancelled'
                )
                .map((event: any) => ({
                  ...event,
                  _calendarSource: calendarId
                }));
                
              allEvents.push(...validEvents);
              pageToken = response.data.nextPageToken;
              nextSyncToken = response.data.nextSyncToken;
              
              console.log(`[Calendar Sync] [RELIABILITY] Fetched ${validEvents.length} events from ${calendarId} (page ${pageToken || 'final'})`);
              
              // PRODUCTION: Check quota limits
              if (quotaRemaining <= 100) {
                console.warn(`[Calendar Sync] [PRODUCTION] Approaching quota limit - ${quotaRemaining} requests remaining`);
                break;
              }
              
            } while (pageToken && allEvents.length < this.MAX_EVENTS_PER_SYNC);
          }
          
          // PRODUCTION: Rate limiting between calendars
          await this.delay(this.SYNC_RATE_LIMIT_MS);
          
        } catch (calendarError) {
          console.error(`[Calendar Sync] [PRODUCTION] Error fetching from calendar ${calendarId}:`, calendarError);
          
          // PRODUCTION: Continue with other calendars on individual failures
          if (therapistId) {
            this.logAuditEvent('calendar_fetch_error', therapistId, false, `Calendar ${calendarId}: ${calendarError instanceof Error ? calendarError.message : String(calendarError)}`);
          }
        }
      }
      
      console.log(`[Calendar Sync] [PRODUCTION] Total events fetched: ${allEvents.length}, Quota used: ${quotaUsed}`);
      
      return {
        events: allEvents,
        nextSyncToken,
        quotaInfo: {
          used: quotaUsed,
          remaining: quotaRemaining
        }
      };
      
    } catch (error) {
      console.error('[Calendar Sync] [PRODUCTION] Critical error in fetchCalendarEventsWithPagination:', error);
      throw new Error(`Failed to fetch calendar events: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Use AI to match calendar event to existing client
   */
  private async matchEventToClient(event: CalendarEvent, therapistId: string): Promise<ClientMatch | null> {
    try {
      // Get all clients for fuzzy matching
      const clients = await storage.getClientsByTherapist(therapistId);
      
      if (clients.length === 0) {
        return null;
      }

      // Extract relevant information from calendar event
      const eventInfo = {
        title: event.summary || '',
        description: event.description || '',
        attendees: event.attendees?.map(a => ({
          email: a.email,
          name: a.displayName
        })) || [],
        location: event.location || ''
      };

      // Try direct name matching first
      const directMatch = this.findDirectMatch(eventInfo, clients);
      if (directMatch) {
        return directMatch;
      }

      // Use AI for intelligent matching
      const aiMatch = await this.findAIMatch(eventInfo, clients, therapistId);
      if (aiMatch) {
        return aiMatch;
      }

      return null;
    } catch (error) {
      console.error('[Calendar Sync] Error matching event to client:', error);
      return null;
    }
  }

  /**
   * Direct string matching for client names
   */
  private findDirectMatch(eventInfo: any, clients: any[]): ClientMatch | null {
    for (const client of clients) {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const eventTitle = eventInfo.title.toLowerCase();
      
      // Check if client name appears in event title
      if (eventTitle.includes(client.firstName.toLowerCase()) && 
          eventTitle.includes(client.lastName.toLowerCase())) {
        return {
          clientId: client.id,
          confidence: 0.9,
          matchReason: 'Direct name match in event title',
          client
        };
      }

      // Check attendee emails
      for (const attendee of eventInfo.attendees) {
        if (attendee.email && client.email && 
            attendee.email.toLowerCase() === client.email.toLowerCase()) {
          return {
            clientId: client.id,
            confidence: 0.95,
            matchReason: 'Email match in attendees',
            client
          };
        }
      }
    }

    return null;
  }

  /**
   * AI-powered intelligent matching (HIPAA COMPLIANT)
   */
  private async findAIMatch(eventInfo: any, clients: any[], therapistId: string): Promise<ClientMatch | null> {
    try {
      // SECURITY: HIPAA Compliance validation before AI call
      if (!this.validateHIPAACompliance('calendar_event_matching', therapistId)) {
        console.warn('[Calendar Sync] [HIPAA] Skipping AI matching - HIPAA compliance disabled');
        return null;
      }

      // SECURITY: De-identify data before sending to AI
      const deidentifiedClients = clients.map((c, i) => ({
        index: i + 1,
        firstName: this.deidentifyName(c.firstName),
        lastName: this.deidentifyName(c.lastName),
        hasEmail: !!c.email
      }));

      const deidentifiedEvent = {
        title: this.deidentifyText(eventInfo.title),
        description: this.deidentifyText(eventInfo.description),
        hasAttendees: eventInfo.attendees?.length > 0,
        location: this.deidentifyText(eventInfo.location)
      };

      const prompt = `
You are helping match calendar events to therapy clients. Given DEIDENTIFIED information, determine if there's a likely match.

DEIDENTIFIED Event Information:
- Title Pattern: "${deidentifiedEvent.title}"
- Description Pattern: "${deidentifiedEvent.description}"
- Has Attendees: ${deidentifiedEvent.hasAttendees}
- Location Pattern: "${deidentifiedEvent.location}"

DEIDENTIFIED Available Clients:
${deidentifiedClients.map((c) => `${c.index}. [NAME_${c.index}] (${c.hasEmail ? 'has_email' : 'no_email'})`).join('\n')}

Instructions:
- Look for general patterns, not specific names
- Consider therapy-related keywords (session, appointment, therapy, counseling)
- Assess confidence level (0.0 to 1.0)
- Only suggest matches with confidence >= 0.7
- Respond with JSON format:
{
  "match": true/false,
  "clientIndex": number (1-based index from list above),
  "confidence": number,
  "reason": "explanation using only deidentified terms"
}

If no confident match found, respond with: {"match": false}
`;

      // AUDIT: Log AI call for HIPAA compliance
      this.logAuditEvent('ai_calendar_matching', therapistId, true, 'HIPAA compliant deidentified matching');

      const result = await aiRouter.chatJSON([
        { role: 'system', content: 'You are a helpful assistant that matches deidentified calendar events to therapy clients with high accuracy. Never include actual names or PHI in responses.' },
        { role: 'user', content: prompt }
      ]) as any;

      if (result?.match && result?.confidence >= 0.7 && result?.clientIndex) {
        const client = clients[result.clientIndex - 1];
        if (client) {
          return {
            clientId: client.id,
            confidence: result.confidence,
            matchReason: `AI Match: ${result.reason}`,
            client
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[Calendar Sync] [HIPAA] Error in AI matching:', error);
      this.logAuditEvent('ai_calendar_matching_error', therapistId, false, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * HIPAA compliance validation for AI operations
   */
  private validateHIPAACompliance(operation: string, therapistId: string): boolean {
    const isHIPAACompliant = process.env.HIPAA_SAFE_AI === 'true';
    if (!isHIPAACompliant) {
      console.warn(`[Calendar Sync] [HIPAA] Operation '${operation}' blocked - HIPAA_SAFE_AI not enabled`);
      this.logAuditEvent('hipaa_compliance_block', therapistId, false, `Operation: ${operation}`);
    }
    return isHIPAACompliant;
  }

  /**
   * De-identify text for HIPAA compliance
   */
  private deidentifyText(text: string): string {
    if (!text) return '';
    // Replace potential names and identifiers with patterns
    return text
      .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME_PATTERN]')
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_PATTERN]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_PATTERN]')
      .replace(/\b\d{1,5}\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd)\b/gi, '[ADDRESS_PATTERN]')
      .substring(0, 100); // Limit length
  }

  /**
   * De-identify name for HIPAA compliance
   */
  private deidentifyName(name: string): string {
    if (!name) return '';
    // Replace with first letter + pattern
    return name.charAt(0) + '_PATTERN';
  }

  /**
   * HIPAA-compliant persistent audit logging for security compliance
   */
  private async logAuditEvent(operation: string, therapistId: string, success: boolean, details?: string): Promise<void> {
    try {
      // Create persistent audit log entry in database
      await storage.createAuditLog({
        operation: `calendar_${operation}`,
        therapistId,
        success,
        errorMessage: success ? undefined : details,
        metadata: success ? { details } : undefined,
        provider: 'calendar',
        ipAddress: null, // Will be populated by routes if available
        userAgent: null, // Will be populated by routes if available
      });
      
      // Log to console with security prefix
      console.log(`[Calendar Sync] [AUDIT] ${operation}: ${success ? 'SUCCESS' : 'FAILED'} for therapist ${therapistId}`);
    } catch (error) {
      // CRITICAL: Audit logging failure is a security incident
      console.error(`[Calendar Sync] [CRITICAL] Audit logging failed for ${operation}:`, error);
      // In production, this should trigger security alerts
    }
  }

  /**
   * Create therapy session from calendar event (LEGACY - use upsertSessionFromEvent)
   */
  private async createSessionFromEvent(
    event: CalendarEvent, 
    clientMatch: ClientMatch, 
    therapistId: string
  ): Promise<void> {
    return this.upsertSessionFromEvent(event, clientMatch, therapistId);
  }

  /**
   * RELIABILITY: Upsert therapy session from calendar event (handles updates and cancellations)
   */
  private async upsertSessionFromEvent(
    event: CalendarEvent, 
    clientMatch: ClientMatch, 
    therapistId: string
  ): Promise<void> {
    try {
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;
      
      if (!startTime) {
        throw new Error('Event missing start time');
      }

      const sessionDate = new Date(startTime);
      const duration = endTime ? 
        Math.round((new Date(endTime).getTime() - sessionDate.getTime()) / (1000 * 60)) : 
        50; // Default 50 minutes

      const calendarSource = (event as any)._calendarSource || 
        (event.id?.includes('6ac7ac649a345a77fa617a926a67b4e1028f6a8ade0bdf1e7cca8f2b62310423') ? 'simplepractice' : 'primary');

      // Handle cancelled events
      if (event.status === 'cancelled') {
        const existingSession = await storage.getSessionByExternalEventId(event.id, therapistId);
        if (existingSession) {
          await storage.softDeleteSession(existingSession.id, therapistId);
          console.log(`[Calendar Sync] [RELIABILITY] Soft deleted cancelled session for event ${event.id}`);
          this.logAuditEvent('session_cancelled', therapistId, true, `Event: ${event.id}`);
        }
        return;
      }

      // RELIABILITY: Upsert session data
      const sessionData = {
        clientId: clientMatch.clientId,
        therapistId,
        sessionDate,
        duration,
        sessionType: 'individual' as const,
        notes: `Imported from Google Calendar (${calendarSource}): ${event.summary || 'Untitled Event'}`,
        externalEventId: event.id,
        sourceCalendar: calendarSource,
        aiTags: {
          matchConfidence: clientMatch.confidence,
          matchReason: clientMatch.matchReason,
          originalEventTitle: event.summary,
          originalEventDescription: event.description,
          eventStatus: event.status,
          lastUpdated: event.updated,
          importedAt: new Date().toISOString(),
          calendarSource
        }
      };

      await storage.upsertSessionByExternalId(sessionData);
      this.logAuditEvent('session_upserted', therapistId, true, `Event: ${event.id}, Client: ${clientMatch.clientId}`);
      
      console.log(`[Calendar Sync] [RELIABILITY] Upserted session for event ${event.id}`);
    } catch (error) {
      console.error('[Calendar Sync] [RELIABILITY] Error upserting session from event:', error);
      this.logAuditEvent('session_upsert_failed', therapistId, false, `Event: ${event.id}, Error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Calculate next sync time (adaptive based on failures)
   */
  private calculateNextSync(lastSync?: Date): Date {
    const now = new Date();
    const baseInterval = 6 * 60 * 60 * 1000; // 6 hours
    
    // Adaptive interval based on recent failures
    const therapistFailures = Array.from(this.circuitBreakerState.values())
      .reduce((sum, state) => sum + state.failures, 0);
    
    const multiplier = Math.min(1 + (therapistFailures * 0.5), 4); // Max 4x interval
    const nextSync = new Date(now.getTime() + (baseInterval * multiplier));
    
    console.log(`[Calendar Sync] [PRODUCTION] Next sync scheduled in ${Math.round(baseInterval * multiplier / (1000 * 60 * 60))} hours`);
    return nextSync;
  }

  /**
   * PRODUCTION: Circuit breaker implementation
   */
  private isCircuitBreakerOpen(therapistId: string): boolean {
    const state = this.circuitBreakerState.get(therapistId);
    if (!state) {
      this.circuitBreakerState.set(therapistId, { failures: 0, isOpen: false });
      return false;
    }
    
    // Check if circuit breaker should be reset
    if (state.isOpen && state.lastFailure) {
      const timeSinceLastFailure = Date.now() - state.lastFailure.getTime();
      if (timeSinceLastFailure > this.CIRCUIT_BREAKER_TIMEOUT_MS) {
        console.log(`[Calendar Sync] [PRODUCTION] Circuit breaker reset for therapist ${therapistId}`);
        state.isOpen = false;
        state.failures = 0;
        state.lastFailure = undefined;
        return false;
      }
    }
    
    return state.isOpen;
  }

  /**
   * PRODUCTION: Record failure for circuit breaker
   */
  private recordFailure(therapistId: string): void {
    const state = this.circuitBreakerState.get(therapistId) || { failures: 0, isOpen: false };
    state.failures++;
    state.lastFailure = new Date();
    
    if (state.failures >= this.CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
      state.isOpen = true;
      console.warn(`[Calendar Sync] [PRODUCTION] Circuit breaker opened for therapist ${therapistId} after ${state.failures} failures`);
      this.logAuditEvent('circuit_breaker_opened', therapistId, false, `Failures: ${state.failures}`);
    }
    
    this.circuitBreakerState.set(therapistId, state);
  }

  /**
   * PRODUCTION: Record success for circuit breaker
   */
  private recordSuccess(therapistId: string): void {
    const state = this.circuitBreakerState.get(therapistId);
    if (state) {
      state.failures = Math.max(0, state.failures - 1); // Gradually reduce failure count
      if (state.failures === 0) {
        state.isOpen = false;
        state.lastFailure = undefined;
      }
      this.circuitBreakerState.set(therapistId, state);
    }
  }

  /**
   * PRODUCTION: Rate limiting implementation
   */
  private checkRateLimit(therapistId: string): boolean {
    const now = new Date();
    const counter = this.rateLimitCounters.get(therapistId);
    
    if (!counter || now > counter.resetTime) {
      // Reset counter every hour
      this.rateLimitCounters.set(therapistId, {
        requests: 1,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000)
      });
      return true;
    }
    
    const maxRequestsPerHour = parseInt(process.env.MAX_SYNC_REQUESTS_PER_HOUR || '10');
    if (counter.requests >= maxRequestsPerHour) {
      console.warn(`[Calendar Sync] [PRODUCTION] Rate limit exceeded for therapist ${therapistId}: ${counter.requests}/${maxRequestsPerHour}`);
      this.logAuditEvent('rate_limit_exceeded', therapistId, false, `Requests: ${counter.requests}/${maxRequestsPerHour}`);
      return false;
    }
    
    counter.requests++;
    return true;
  }

  /**
   * PRODUCTION: Utility delay function
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Revoke OAuth access (SECURITY: Complete cleanup)
   */
  async revokeAccess(therapistId: string): Promise<void> {
    try {
      await this.oauth2Client.revokeCredentials();
      await storage.deleteOAuthTokens(therapistId);
      
      // SECURITY: Clear credentials from memory
      this.oauth2Client.setCredentials({});
      
      console.log('[Calendar Sync] [SECURITY] OAuth access revoked and credentials cleared');
      this.logAuditEvent('oauth_access_revoked', therapistId, true);
    } catch (error) {
      console.error('[Calendar Sync] [SECURITY] Error revoking access:', error);
      this.logAuditEvent('oauth_revoke_failed', therapistId, false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get audit log for security monitoring
   */
  // SECURITY: Audit logs now stored in database for HIPAA compliance
  async getAuditLog(therapistId?: string): Promise<any[]> {
    try {
      return await storage.getAuditLogs(therapistId, 1000);
    } catch (error) {
      console.error('[Calendar Sync] Failed to fetch audit logs:', error);
      return [];
    }
  }

  /**
   * Export audit log for compliance reporting
   */
  // SECURITY: Export audit logs from database for compliance reporting
  async exportAuditLog(therapistId?: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    try {
      const logs = await storage.getAuditLogs(therapistId, 10000);
      let filtered = logs;
    
      if (startDate) {
        filtered = filtered.filter(entry => entry.timestamp >= startDate);
      }
    
      if (endDate) {
        filtered = filtered.filter(entry => entry.timestamp <= endDate);
      }
    
      return filtered;
    } catch (error) {
      console.error('[Calendar Sync] Failed to export audit logs:', error);
      return [];
    }
  }

  /**
   * THERAPY FILTER: Determine if an event is therapy-related
   */
  private isTherapyRelatedEvent(event: CalendarEvent): boolean {
    const title = (event.summary || '').toLowerCase();
    const description = (event.description || '').toLowerCase();
    
    // Skip clearly non-therapy events
    const skipPatterns = [
      'flight', 'commute', 'shower', 'prep', 'walk dogs', 'spanish', 'free time',
      'tag/respond to e-mails', 'e-mail', 'phone calls', 'text messages',
      'academic writing', 'grading', 'participation', 'office hours',
      'meeting with nora', 'focus time', 'deep work', 'edc ', 'gcu ',
      'ccu ', 'liu ', 'birthday', 'vacation', 'trip', 'hotel', 'stay at'
    ];
    
    // Skip if title contains any skip patterns
    if (skipPatterns.some(pattern => title.includes(pattern))) {
      return false;
    }
    
    // Include patterns that suggest therapy sessions
    const therapyPatterns = [
      'therapy', 'session', 'appointment', 'client', 'patient',
      'counseling', 'consultation', 'assessment', 'intake',
      'follow-up', 'check-in', 'individual', 'group therapy'
    ];
    
    // Include if title or description contains therapy patterns
    if (therapyPatterns.some(pattern => 
      title.includes(pattern) || description.includes(pattern)
    )) {
      return true;
    }
    
    // Include events with attendees (excluding obvious personal events)
    if (event.attendees && event.attendees.length > 0) {
      // But skip if it's a clearly personal event
      const personalPatterns = ['birthday', 'family', 'personal', 'vacation'];
      if (!personalPatterns.some(pattern => title.includes(pattern))) {
        return true;
      }
    }
    
    // Include events that are 15-120 minutes (typical therapy session duration)
    const startTime = event.start?.dateTime || event.start?.date;
    const endTime = event.end?.dateTime || event.end?.date;
    
    if (startTime && endTime) {
      const duration = (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60);
      if (duration >= 15 && duration <= 120) {
        // If duration suggests therapy session and no obvious skip patterns
        return !skipPatterns.some(pattern => title.includes(pattern));
      }
    }
    
    // Default to false for unknown events
    return false;
  }

  /**
   * RECONCILIATION: Reassign orphaned calendar sessions to correct clients
   */
  async reconcileOrphanedSessions(therapistId: string): Promise<{
    processed: number;
    reassigned: number;
    errors: string[];
  }> {
    console.log('[Calendar Sync] [RECONCILIATION] Starting orphaned session reconciliation...');
    
    let processed = 0;
    let reassigned = 0;
    const errors: string[] = [];
    
    try {
      // Get all calendar sessions (those with externalEventId)
      const allSessions = await storage.getSessionsByTherapist(therapistId, 1000);
      const calendarSessions = allSessions.filter(session => session.externalEventId);
      
      console.log(`[Calendar Sync] [RECONCILIATION] Found ${calendarSessions.length} calendar sessions to process`);
      
      // Get all clients for matching
      const clients = await storage.getClientsByTherapist(therapistId);
      
      for (const session of calendarSessions) {
        try {
          processed++;
          
          // Extract event info from session notes and AI tags
          const eventTitle = session.aiTags?.originalEventTitle || session.notes || '';
          const eventDescription = session.aiTags?.originalEventDescription || '';
          
          const eventInfo = {
            title: eventTitle,
            description: eventDescription,
            attendees: [],
            location: ''
          };
          
          // Try to find a better client match
          const directMatch = this.findDirectMatch(eventInfo, clients);
          
          if (directMatch && directMatch.clientId !== session.clientId) {
            // Update session with correct client
            await storage.updateSession(session.id, { 
              clientId: directMatch.clientId 
            }, therapistId);
            
            reassigned++;
            console.log(`[Calendar Sync] [RECONCILIATION] Reassigned session ${session.id} to client ${directMatch.client.firstName} ${directMatch.client.lastName}`);
          }
          
        } catch (sessionError) {
          const errorMsg = `Failed to process session ${session.id}: ${sessionError instanceof Error ? sessionError.message : String(sessionError)}`;
          console.error(`[Calendar Sync] [RECONCILIATION] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
      
      console.log(`[Calendar Sync] [RECONCILIATION] Completed: ${processed} processed, ${reassigned} reassigned`);
      this.logAuditEvent('session_reconciliation_completed', therapistId, true, `${processed} processed, ${reassigned} reassigned`);
      
      return { processed, reassigned, errors };
      
    } catch (error) {
      console.error('[Calendar Sync] [RECONCILIATION] Reconciliation failed:', error);
      this.logAuditEvent('session_reconciliation_failed', therapistId, false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

export const calendarSync = new CalendarSyncService();
export type { CalendarEvent, SyncStatus, ClientMatch };