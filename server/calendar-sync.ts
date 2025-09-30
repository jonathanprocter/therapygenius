import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { storage } from './storage';
import { aiRouter } from './ai';
import { encryptionService, EncryptionAuditLogger } from './encryption';
import { z } from 'zod';

// Background sync scheduler for managing per-user sync schedules
class CalendarSyncScheduler {
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly SCHEDULER_CHECK_INTERVAL = 2 * 60 * 1000; // Check every 2 minutes
  private readonly MAX_CONCURRENT_SYNCS = 3; // Limit concurrent syncs to prevent overwhelming the system
  private activeSyncs = new Set<string>();

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔄 Calendar Sync Scheduler started - checking for due syncs every 2 minutes');
    
    // Immediate first check
    this.checkAndExecuteScheduledSyncs();
    
    // Set up periodic checks
    this.schedulerInterval = setInterval(() => {
      this.checkAndExecuteScheduledSyncs();
    }, this.SCHEDULER_CHECK_INTERVAL);
  }

  stop() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Calendar Sync Scheduler stopped');
  }

  private async checkAndExecuteScheduledSyncs() {
    try {
      // For now, we only have one therapist (THERAPIST_ID)
      // In a multi-tenant system, this would query all active users
      const THERAPIST_ID = "59ea3867-0b4f-47b6-8a95-6484c4a52ef7";
      
      if (this.activeSyncs.has(THERAPIST_ID)) {
        console.log(`⏭️ Sync already in progress for ${THERAPIST_ID}, skipping`);
        return;
      }

      // Check if this user needs syncing
      const shouldSyncInfo = await storage.shouldSync(THERAPIST_ID);
      
      if (shouldSyncInfo.shouldSync) {
        console.log(`📅 Triggering scheduled sync for ${THERAPIST_ID}: ${shouldSyncInfo.reason}`);
        await this.executeScheduledSync(THERAPIST_ID);
      } else {
        const nextSyncTime = shouldSyncInfo.nextSyncTime;
        if (nextSyncTime) {
          const timeUntilNext = nextSyncTime.getTime() - new Date().getTime();
          const minutesUntilNext = Math.round(timeUntilNext / (1000 * 60));
          console.log(`⏰ Next sync for ${THERAPIST_ID} in ${minutesUntilNext} minutes (${shouldSyncInfo.reason})`);
        }
      }
    } catch (error) {
      console.error('❌ Error in scheduled sync checker:', error);
    }
  }

  private async executeScheduledSync(therapistId: string) {
    if (this.activeSyncs.size >= this.MAX_CONCURRENT_SYNCS) {
      console.log(`⚠️ Maximum concurrent syncs reached (${this.MAX_CONCURRENT_SYNCS}), deferring sync for ${therapistId}`);
      return;
    }

    this.activeSyncs.add(therapistId);
    
    try {
      console.log(`🚀 Starting automatic sync for ${therapistId}`);
      // Use the calendarSync instance that will be available after this module loads
      const syncResult = await calendarSync.syncCalendarWithDetailedTracking(
        therapistId, 
        'system_scheduled', 
        false // not a force full sync
      );
      
      if (syncResult.success) {
        console.log(`✅ Scheduled sync completed for ${therapistId} in ${Math.round(syncResult.processingTimeMs / 1000)}s - Events: ${syncResult.eventsTotal}, Sessions: ${syncResult.sessionsCreated + syncResult.sessionsUpdated}`);
      } else {
        console.log(`❌ Scheduled sync failed for ${therapistId}: ${syncResult.errors.join(', ')}`);
      }
    } catch (error) {
      console.error(`💥 Error during scheduled sync for ${therapistId}:`, error);
    } finally {
      this.activeSyncs.delete(therapistId);
    }
  }

  // Get scheduler status for API/debugging
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkIntervalMs: this.SCHEDULER_CHECK_INTERVAL,
      activeSyncs: Array.from(this.activeSyncs),
      maxConcurrentSyncs: this.MAX_CONCURRENT_SYNCS,
    };
  }
}

// Global scheduler instance
export const syncScheduler = new CalendarSyncScheduler();

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
  private readonly DATE_RANGE_START = process.env.CALENDAR_SYNC_START_DATE || '2019-01-01T00:00:00-05:00';
  private readonly DATE_RANGE_END = process.env.CALENDAR_SYNC_END_DATE || '2026-12-31T23:59:59-05:00';
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
        nextSync: await this.calculateNextSync(therapistId, lastSync || undefined),
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
   * Enhanced manual sync with detailed tracking and real-time progress reporting
   */
  async syncCalendarWithDetailedTracking(
    therapistId: string, 
    triggerSource: 'user_manual' | 'scheduled' | 'api_webhook' = 'user_manual',
    forceFullSync: boolean = false,
    progressCallback?: (progress: {
      phase: string;
      eventsProcessed: number;
      eventsTotal: number;
      matchesFound: number;
      errors: string[];
    }) => void
  ): Promise<{
    success: boolean;
    syncHistoryId: string;
    processingTimeMs: number;
    eventsTotal: number;
    eventsMatched: number;
    eventsRejected: number;
    eventsError: number;
    sessionsCreated: number;
    sessionsUpdated: number;
    errors: string[];
    syncDetails: any;
  }> {
    const startTime = new Date();
    let syncHistoryId = '';
    
    // Create initial sync history record
    const syncHistory = await storage.createCalendarSyncHistory({
      therapistId,
      syncType: forceFullSync ? 'full' : 'incremental',
      status: 'running',
      startTime,
      triggerSource,
      eventsTotal: 0,
      eventsMatched: 0,
      eventsRejected: 0,
      eventsError: 0,
      sessionsCreated: 0,
      sessionsUpdated: 0,
      errors: [],
      syncDetails: {
        forceFullSync,
        startedBy: triggerSource,
        calendarIds: ['primary', '6ac7ac649a345a77fa617a926a67b4e1028f6a8ade0bdf1e7cca8f2b62310423@group.calendar.google.com']
      },
      apiCalls: 0
    });
    
    syncHistoryId = syncHistory.id;
    
    try {
      // Perform the actual sync using existing robust method
      const syncResult = await this.syncCalendar(therapistId, forceFullSync);
      
      const endTime = new Date();
      const processingTimeMs = endTime.getTime() - startTime.getTime();
      
      // Create comprehensive sync details
      const syncDetails = {
        forceFullSync,
        startedBy: triggerSource,
        calendarIds: ['primary', '6ac7ac649a345a77fa617a926a67b4e1028f6a8ade0bdf1e7cca8f2b62310423@group.calendar.google.com'],
        syncType: syncResult.syncType,
        rateLimitRemaining: syncResult.rateLimitRemaining,
        quotaUsed: syncResult.quotaUsed,
        completedAt: endTime.toISOString()
      };
      
      // Update sync history with final results
      await storage.updateCalendarSyncHistory(syncHistoryId, {
        status: 'completed',
        endTime,
        processingTimeMs,
        eventsTotal: syncResult.eventsProcessed,
        eventsMatched: syncResult.matchesFound,
        eventsRejected: syncResult.eventsProcessed - syncResult.matchesFound,
        eventsError: 0,
        errors: syncResult.errors,
        syncDetails,
        rateLimitRemaining: syncResult.rateLimitRemaining,
        nextSyncToken: syncResult.syncToken,
        apiCalls: syncResult.quotaUsed || 0
      }, therapistId);
      
      this.logAuditEvent('manual_sync_completed', therapistId, true, `${syncResult.eventsProcessed} events processed, ${syncResult.matchesFound} matches`);
      
      return {
        success: true,
        syncHistoryId,
        processingTimeMs,
        eventsTotal: syncResult.eventsProcessed,
        eventsMatched: syncResult.matchesFound,
        eventsRejected: syncResult.eventsProcessed - syncResult.matchesFound,
        eventsError: 0,
        sessionsCreated: 0, // These would need to be tracked in the sync method
        sessionsUpdated: 0,
        errors: syncResult.errors,
        syncDetails
      };
      
    } catch (error) {
      const endTime = new Date();
      const processingTimeMs = endTime.getTime() - startTime.getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update sync history with failure
      await storage.updateCalendarSyncHistory(syncHistoryId, {
        status: 'failed',
        endTime,
        processingTimeMs,
        errors: [errorMessage],
        syncDetails: {
          forceFullSync,
          startedBy: triggerSource,
          error: errorMessage,
          failedAt: endTime.toISOString()
        }
      }, therapistId);
      
      this.logAuditEvent('manual_sync_failed', therapistId, false, errorMessage);
      
      return {
        success: false,
        syncHistoryId,
        processingTimeMs,
        eventsTotal: 0,
        eventsMatched: 0,
        eventsRejected: 0,
        eventsError: 1,
        sessionsCreated: 0,
        sessionsUpdated: 0,
        errors: [errorMessage],
        syncDetails: { error: errorMessage }
      };
    }
  }

  /**
   * Get detailed sync status with history and statistics
   */
  async getDetailedSyncStatus(therapistId: string): Promise<{
    currentStatus: 'running' | 'idle' | 'error';
    lastSync: Date | null;
    runningSyncs: any[];
    recentHistory: any[];
    statistics: any;
    isAuthenticated: boolean;
  }> {
    const isAuthenticated = await this.loadTokens(therapistId);
    const latestSync = await storage.getLatestSyncStatus(therapistId);
    const runningSyncs = await storage.getCurrentRunningSyncs(therapistId);
    const recentHistory = await storage.getCalendarSyncHistory(therapistId, { limit: 10 });
    const statistics = await storage.getSyncStatistics(therapistId);
    
    let currentStatus: 'running' | 'idle' | 'error' = 'idle';
    if (runningSyncs.length > 0) {
      currentStatus = 'running';
    } else if (latestSync?.status === 'failed') {
      currentStatus = 'error';
    }
    
    return {
      currentStatus,
      lastSync: latestSync?.endTime || latestSync?.startTime || null,
      runningSyncs,
      recentHistory,
      statistics,
      isAuthenticated
    };
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
      if (!(await this.checkRateLimit(therapistId))) {
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
            // No client match found - create review record for manual assignment
            await this.createEventReviewRecord(event, therapistId, 'no_match', null);
            console.log(`[Calendar Sync] No client match found for event: ${event.summary} - Added to review queue`);
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
        nextSync: await this.calculateNextSync(therapistId, startTime),
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
   * Check aliases for automatic matching
   */
  private async checkAliases(eventTitle: string, therapistId: string): Promise<ClientMatch | null> {
    try {
      const allAliases = await storage.getCalendarEventAliases(therapistId);
      const aliases = allAliases.filter(alias => alias.isActive); // Only active aliases
      
      for (const alias of aliases) {
        const isMatch = this.testAliasPattern(eventTitle, alias.aliasPattern, alias.matchType);
        
        if (isMatch) {
          // Client information is already joined in the alias result
          const client = alias.client;
          if (!client) {
            console.warn(`[Calendar Sync] [ALIAS] Alias ${alias.id} references non-existent client ${alias.clientId}`);
            continue;
          }
          
          console.log(`[Calendar Sync] [ALIAS] Event "${eventTitle}" matched alias "${alias.aliasPattern}" (${alias.matchType}) for client ${client.firstName} ${client.lastName}`);
          this.logAuditEvent('alias_match_found', therapistId, true, `Alias: ${alias.aliasPattern}, Client: ${client.firstName} ${client.lastName}`);
          
          return {
            clientId: alias.clientId,
            confidence: 1.0, // Aliases have highest confidence
            matchReason: `alias_${alias.matchType}`,
            client: {
              id: client.id,
              firstName: client.firstName,
              lastName: client.lastName,
              email: client.email || undefined
            }
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('[Calendar Sync] [ALIAS] Error checking aliases:', error);
      this.logAuditEvent('alias_check_error', therapistId, false, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Test if an event title matches an alias pattern
   */
  private testAliasPattern(eventTitle: string, pattern: string, matchType: string): boolean {
    const title = eventTitle.toLowerCase().trim();
    const testPattern = pattern.toLowerCase().trim();
    
    switch (matchType) {
      case 'exact':
        return title === testPattern;
      
      case 'contains':
        return title.includes(testPattern);
      
      case 'starts_with':
        return title.startsWith(testPattern);
      
      case 'ends_with':
        return title.endsWith(testPattern);
      
      case 'regex':
        try {
          const regex = new RegExp(pattern, 'i'); // Case-insensitive by default
          return regex.test(title);
        } catch (error) {
          console.error(`[Calendar Sync] [ALIAS] Invalid regex pattern: ${pattern}`, error);
          return false;
        }
      
      default:
        console.warn(`[Calendar Sync] [ALIAS] Unknown match type: ${matchType}`);
        return false;
    }
  }

  /**
   * Use aliases first, then AI to match calendar event to existing client
   */
  private async matchEventToClient(event: CalendarEvent, therapistId: string): Promise<ClientMatch | null> {
    try {
      const eventTitle = event.summary || '';
      
      // STEP 1: Check aliases FIRST (deterministic, highest priority)
      const aliasMatch = await this.checkAliases(eventTitle, therapistId);
      if (aliasMatch) {
        this.logAuditEvent('match_method_used', therapistId, true, `alias_match: ${aliasMatch.matchReason}`);
        return aliasMatch;
      }

      // Get all clients for enhanced matching
      const clients = await storage.getClientsByTherapist(therapistId);
      
      if (clients.length === 0) {
        return null;
      }

      // Extract relevant information from calendar event
      const eventInfo = {
        title: eventTitle,
        description: event.description || '',
        attendees: event.attendees?.map(a => ({
          email: a.email,
          name: a.displayName
        })) || [],
        location: event.location || '',
        start: event.start,
        end: event.end
      };

      // STEP 2: Enhanced keyword-based matching
      const keywordMatch = this.findKeywordBasedMatch(eventInfo, clients);
      if (keywordMatch) {
        this.logAuditEvent('match_method_used', therapistId, true, `keyword_match: ${keywordMatch.matchReason}`);
        return keywordMatch;
      }

      // STEP 3: Enhanced pattern recognition
      const patternMatch = this.findEnhancedPatternMatch(eventInfo, clients);
      if (patternMatch) {
        this.logAuditEvent('match_method_used', therapistId, true, `pattern_match: ${patternMatch.matchReason}`);
        return patternMatch;
      }

      // STEP 4: Enhanced fuzzy name matching
      const fuzzyMatch = this.findFuzzyNameMatch(eventInfo, clients);
      if (fuzzyMatch) {
        this.logAuditEvent('match_method_used', therapistId, true, `fuzzy_match: ${fuzzyMatch.matchReason}`);
        return fuzzyMatch;
      }

      // STEP 5: Original direct name matching (existing patterns)
      const directMatch = this.findDirectMatch(eventInfo, clients);
      if (directMatch) {
        this.logAuditEvent('match_method_used', therapistId, true, `direct_match: ${directMatch.matchReason}`);
        return directMatch;
      }

      // STEP 6: Use AI for intelligent matching (lowest priority)
      const aiMatch = await this.findAIMatch(eventInfo, clients, therapistId);
      if (aiMatch) {
        this.logAuditEvent('match_method_used', therapistId, true, `ai_match: ${aiMatch.matchReason}`);
        return aiMatch;
      }

      this.logAuditEvent('match_method_used', therapistId, false, 'no_match_found');
      return null;
    } catch (error) {
      console.error('[Calendar Sync] Error matching event to client:', error);
      this.logAuditEvent('match_error', therapistId, false, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Direct string matching for client names
   */
  private findDirectMatch(eventInfo: any, clients: any[]): ClientMatch | null {
    const eventTitle = eventInfo.title.toLowerCase();
    
    for (const client of clients) {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const firstName = client.firstName.toLowerCase();
      const lastName = client.lastName.toLowerCase();
      
      // SECURITY FIX: Prevent over-matching on ambiguous names like "J K"
      // Require minimum name lengths and more precise matching for short names
      const MIN_NAME_LENGTH = 2;
      const isAmbiguousName = firstName.length <= MIN_NAME_LENGTH || lastName.length <= MIN_NAME_LENGTH;
      
      if (isAmbiguousName) {
        // For very short names (like "J K"), require exact word boundary matches
        // This prevents "JK Mom's Card" from matching client "J K"
        const firstNamePattern = new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        const lastNamePattern = new RegExp(`\\b${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        const fullNamePattern = new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        
        // Only match if we find the exact full name pattern or very specific formats
        if (fullNamePattern.test(eventTitle)) {
          return {
            clientId: client.id,
            confidence: 0.9,
            matchReason: 'Exact name pattern match (ambiguous name protection)',
            client
          };
        }
        
        // Skip individual letter matching for ambiguous names but create review record
        console.log(`[Calendar Sync] [SECURITY] Skipping ambiguous name match for "${firstName} ${lastName}" in event "${eventTitle.substring(0, 50)}..." - Creating review record`);
        // Note: We'll create the review record in the calling function with ambiguous reason
        
      } else {
        // Standard check for longer names: both first and last name appear in event title
        if (eventTitle.includes(firstName) && eventTitle.includes(lastName)) {
          return {
            clientId: client.id,
            confidence: 0.9,
            matchReason: 'Direct name match in event title',
            client
          };
        }
      }

      // SimplePractice format: "My Bookable Calendar w/ [Name]"
      const simplePracticeMatch = eventTitle.match(/my bookable calendar w\/ (.+)/);
      if (simplePracticeMatch) {
        const extractedName = simplePracticeMatch[1].trim();
        
        // Check if extracted name matches client's full name
        if (extractedName === fullName) {
          return {
            clientId: client.id,
            confidence: 0.9,
            matchReason: 'SimplePractice calendar format match',
            client
          };
        }
        
        // SECURITY FIX: Apply same ambiguous name protection to SimplePractice matching
        if (isAmbiguousName) {
          // For ambiguous names, require exact match only
          if (extractedName === fullName) {
            return {
              clientId: client.id,
              confidence: 0.85,
              matchReason: 'SimplePractice exact name match (ambiguous name protection)',
              client
            };
          }
        } else {
          // Check if extracted name contains both first and last name
          if (extractedName.includes(firstName) && extractedName.includes(lastName)) {
            return {
              clientId: client.id,
              confidence: 0.85,
              matchReason: 'SimplePractice partial name match',
              client
            };
          }
        }

        // Check if extracted name matches just first name (for single-name clients)
        if (extractedName === firstName || extractedName === lastName) {
          return {
            clientId: client.id,
            confidence: 0.75,
            matchReason: 'SimplePractice single name match',
            client
          };
        }
      }

      // SimplePractice specific patterns from actual usage
      const simplePracticePatterns = [
        /dr procter\/(.+)$/,           // "Dr Procter/ClientName"
        /^(.+) evaluation meeting$/,    // "ClientName Evaluation Meeting"
        /^(.+) social work evaluation$/, // "ClientName social work evaluation"
        /^(.+) therapy$/,              // "ClientName therapy" 
        /^(.+) session$/,              // "ClientName session"
        /^(.+) appointment$/,          // "ClientName appointment"
        /^(.+) meeting$/               // "ClientName meeting"
      ];

      for (const pattern of simplePracticePatterns) {
        const match = eventTitle.match(pattern);
        if (match) {
          const extractedName = match[1].trim().toLowerCase();
          
          // CRITICAL FIX: Check for exact full name match FIRST to prevent Nancy/David Grossman mix-ups
          if (extractedName === fullName) {
            return {
              clientId: client.id,
              confidence: 0.95,
              matchReason: 'SimplePractice exact full name match',
              client
            };
          }
          
          // SECURITY FIX: Apply ambiguous name protection to pattern matching
          if (isAmbiguousName) {
            // For ambiguous names, only allow exact matches
            if (extractedName === firstName || extractedName === lastName) {
              return {
                clientId: client.id,
                confidence: 0.85,
                matchReason: 'SimplePractice exact name pattern match (ambiguous name protection)',
                client
              };
            }
          } else {
            // Check for exact first name or last name match
            if (extractedName === firstName || extractedName === lastName) {
              return {
                clientId: client.id,
                confidence: 0.85,
                matchReason: 'SimplePractice name pattern match',
                client
              };
            }
            
            // CRITICAL FIX: Only allow partial matches if both first AND last name are present to avoid mix-ups
            // This prevents "nancy grossman" from matching just "grossman" for David
            if (extractedName.includes(firstName) && extractedName.includes(lastName)) {
              return {
                clientId: client.id,
                confidence: 0.8,
                matchReason: 'SimplePractice partial name match (both names)',
                client
              };
            }
          }
        }
      }

      // Alternative calendar formats: check for patterns like "Session with [Name]", "[Name] - Therapy", etc.
      const namePatterns = [
        /session with (.+)/,
        /appointment with (.+)/,
        /therapy.+with (.+)/,
        /(.+) - therapy/,
        /(.+) - session/,
        /(.+) appointment/
      ];

      for (const pattern of namePatterns) {
        const match = eventTitle.match(pattern);
        if (match) {
          const extractedName = match[1].trim().toLowerCase();
          
          // SECURITY FIX: Apply ambiguous name protection to alternative patterns
          if (isAmbiguousName) {
            // For ambiguous names, require exact full name match
            if (extractedName === fullName) {
              return {
                clientId: client.id,
                confidence: 0.8,
                matchReason: 'Pattern-based exact name match (ambiguous name protection)',
                client
              };
            }
          } else {
            if (extractedName.includes(firstName) && extractedName.includes(lastName)) {
              return {
                clientId: client.id,
                confidence: 0.8,
                matchReason: 'Pattern-based name match',
                client
              };
            }
          }
        }
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
   * Enhanced keyword-based matching for therapy sessions
   * Combines therapy-related keywords with partial client name matching
   */
  private findKeywordBasedMatch(eventInfo: any, clients: any[]): ClientMatch | null {
    const eventTitle = eventInfo.title.toLowerCase();
    const eventDescription = eventInfo.description?.toLowerCase() || '';
    const eventLocation = eventInfo.location?.toLowerCase() || '';
    
    // Therapy session keywords
    const therapyKeywords = [
      'session', 'therapy', 'appointment', 'consultation', 'meeting', 'check-in',
      'counseling', 'psychotherapy', 'individual', 'assessment', 'intake',
      'follow-up', 'followup', 'visit', 'treatment', 'clinical'
    ];
    
    // Session type patterns
    const sessionTypePatterns = [
      'individual session', 'group session', 'family session', 'couples session',
      'intake session', 'assessment session', 'therapy session', 'counseling session',
      'initial consultation', 'follow up', 'check in', 'treatment session'
    ];
    
    // Office location indicators
    const officePatterns = [
      'office', 'clinic', 'suite', 'room', 'building', 'center', 'practice',
      'telehealth', 'virtual', 'video call', 'zoom', 'online'
    ];
    
    // Check if event contains therapy-related keywords
    const hasTherapyKeyword = therapyKeywords.some(keyword => 
      eventTitle.includes(keyword) || eventDescription.includes(keyword)
    );
    
    const hasSessionType = sessionTypePatterns.some(pattern => 
      eventTitle.includes(pattern) || eventDescription.includes(pattern)
    );
    
    const hasOfficeIndicator = officePatterns.some(pattern => 
      eventTitle.includes(pattern) || eventDescription.includes(pattern) || eventLocation.includes(pattern)
    );
    
    if (hasTherapyKeyword || hasSessionType || hasOfficeIndicator) {
      // Now look for client name matches within the therapy context
      for (const client of clients) {
        const firstName = client.firstName.toLowerCase();
        const lastName = client.lastName.toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        
        // Higher confidence matches when therapy keywords are present
        let confidence = 0.75;
        let matchDetails = [];
        
        if (hasTherapyKeyword) {
          confidence += 0.1;
          matchDetails.push('therapy keyword');
        }
        if (hasSessionType) {
          confidence += 0.1;
          matchDetails.push('session type');
        }
        if (hasOfficeIndicator) {
          confidence += 0.05;
          matchDetails.push('office location');
        }
        
        // Check for partial name matches in therapy context
        if (eventTitle.includes(fullName)) {
          return {
            clientId: client.id,
            confidence: Math.min(confidence + 0.15, 0.95),
            matchReason: `Keyword-based full name match with ${matchDetails.join(', ')}`,
            client
          };
        }
        
        if (eventTitle.includes(firstName) && eventTitle.includes(lastName)) {
          return {
            clientId: client.id,
            confidence: Math.min(confidence + 0.1, 0.9),
            matchReason: `Keyword-based name parts match with ${matchDetails.join(', ')}`,
            client
          };
        }
        
        // Check for first name match in strong therapy context
        if ((hasTherapyKeyword || hasSessionType) && eventTitle.includes(firstName) && firstName.length > 2) {
          return {
            clientId: client.id,
            confidence: Math.min(confidence, 0.8),
            matchReason: `Keyword-based first name match with ${matchDetails.join(', ')}`,
            client
          };
        }
        
        // Check for last name match in strong therapy context
        if ((hasTherapyKeyword || hasSessionType) && eventTitle.includes(lastName) && lastName.length > 2) {
          return {
            clientId: client.id,
            confidence: Math.min(confidence, 0.8),
            matchReason: `Keyword-based last name match with ${matchDetails.join(', ')}`,
            client
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Enhanced pattern recognition for calendar events
   * Includes time-based patterns, email/domain matching, phone patterns, recurring patterns
   */
  private findEnhancedPatternMatch(eventInfo: any, clients: any[]): ClientMatch | null {
    const eventTitle = eventInfo.title.toLowerCase();
    const eventDescription = eventInfo.description?.toLowerCase() || '';
    const fullEventText = `${eventTitle} ${eventDescription}`.trim();
    
    // Extract email patterns from event text
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = fullEventText.match(emailRegex) || [];
    
    // Extract phone number patterns
    const phoneRegex = /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/g;
    const phoneMatches = fullEventText.match(phoneRegex) || [];
    
    // Check email-based matching
    if (emailMatches.length > 0) {
      for (const client of clients) {
        if (client.email) {
          const clientEmail = client.email.toLowerCase();
          for (const eventEmail of emailMatches) {
            if (eventEmail.toLowerCase() === clientEmail) {
              return {
                clientId: client.id,
                confidence: 0.95,
                matchReason: 'Email address pattern match',
                client
              };
            }
            
            // Check domain matching for corporate/clinic emails
            const eventDomain = eventEmail.split('@')[1];
            const clientDomain = clientEmail.split('@')[1];
            if (eventDomain === clientDomain && eventDomain && clientDomain) {
              // Additional validation - check if name parts appear in event
              const firstName = client.firstName.toLowerCase();
              const lastName = client.lastName.toLowerCase();
              if (eventTitle.includes(firstName) || eventTitle.includes(lastName)) {
                return {
                  clientId: client.id,
                  confidence: 0.85,
                  matchReason: 'Email domain match with name presence',
                  client
                };
              }
            }
          }
        }
      }
    }
    
    // Time-based pattern recognition (regular appointment slots)
    if (eventInfo.start?.dateTime) {
      const eventStart = new Date(eventInfo.start.dateTime);
      const dayOfWeek = eventStart.getDay();
      const hour = eventStart.getHours();
      const minute = eventStart.getMinutes();
      
      // Check for recurring appointment patterns (same time slot)
      const timeSlotPattern = `${dayOfWeek}-${hour}:${minute.toString().padStart(2, '0')}`;
      
      // If event has typical therapy session duration (45-60 minutes)
      if (eventInfo.end?.dateTime) {
        const eventEnd = new Date(eventInfo.end.dateTime);
        const duration = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60);
        
        if (duration >= 45 && duration <= 75) {
          // Look for client names in therapy-duration events
          for (const client of clients) {
            const firstName = client.firstName.toLowerCase();
            const lastName = client.lastName.toLowerCase();
            
            if (eventTitle.includes(firstName) || eventTitle.includes(lastName)) {
              return {
                clientId: client.id,
                confidence: 0.8,
                matchReason: 'Time-based pattern match (therapy duration + name)',
                client
              };
            }
          }
        }
      }
    }
    
    // Phone number pattern matching
    if (phoneMatches.length > 0) {
      // Note: This is a placeholder for future phone number matching
      // Would require client phone numbers to be stored and compared
      // Commenting out for now as client phone numbers aren't in the current schema
      /*
      for (const client of clients) {
        if (client.phone) {
          for (const eventPhone of phoneMatches) {
            if (normalizePhoneNumber(eventPhone) === normalizePhoneNumber(client.phone)) {
              return {
                clientId: client.id,
                confidence: 0.9,
                matchReason: 'Phone number pattern match',
                client
              };
            }
          }
        }
      }
      */
    }
    
    // Recurring appointment pattern recognition
    const recurringPatterns = [
      /weekly.*with/i,
      /every.*week/i,
      /recurring.*appointment/i,
      /standing.*appointment/i,
      /regular.*session/i
    ];
    
    const hasRecurringPattern = recurringPatterns.some(pattern => 
      pattern.test(eventTitle) || pattern.test(eventDescription)
    );
    
    if (hasRecurringPattern) {
      for (const client of clients) {
        const firstName = client.firstName.toLowerCase();
        const lastName = client.lastName.toLowerCase();
        
        if (eventTitle.includes(firstName) || eventTitle.includes(lastName)) {
          return {
            clientId: client.id,
            confidence: 0.85,
            matchReason: 'Recurring appointment pattern with name match',
            client
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Enhanced fuzzy name matching with nickname, initial, and variation handling
   */
  private findFuzzyNameMatch(eventInfo: any, clients: any[]): ClientMatch | null {
    const eventTitle = eventInfo.title.toLowerCase();
    
    // Common nickname mappings
    const nicknameMap: { [key: string]: string[] } = {
      'bob': ['robert', 'rob', 'bobby'],
      'bill': ['william', 'will', 'billy'],
      'jim': ['james', 'jimmy'],
      'mike': ['michael', 'mick', 'mickey'],
      'dave': ['david', 'davy'],
      'joe': ['joseph', 'joey'],
      'tom': ['thomas', 'tommy'],
      'dan': ['daniel', 'danny'],
      'chris': ['christopher', 'christian'],
      'matt': ['matthew', 'matty'],
      'rick': ['richard', 'ricky'],
      'steve': ['stephen', 'steven'],
      'jeff': ['jeffrey', 'geoffrey'],
      'nick': ['nicholas', 'nicolas'],
      'sam': ['samuel', 'samantha'],
      'alex': ['alexander', 'alexandra', 'alexis'],
      'beth': ['elizabeth', 'betsy', 'betty'],
      'sue': ['susan', 'suzanne'],
      'liz': ['elizabeth', 'lisa'],
      'kate': ['katherine', 'kathryn', 'katie'],
      'jen': ['jennifer', 'jenny'],
      'jess': ['jessica', 'jessie']
    };
    
    // Reverse mapping for lookup
    const reverseNicknameMap: { [key: string]: string[] } = {};
    Object.entries(nicknameMap).forEach(([nickname, fullNames]) => {
      fullNames.forEach(fullName => {
        if (!reverseNicknameMap[fullName]) {
          reverseNicknameMap[fullName] = [];
        }
        reverseNicknameMap[fullName].push(nickname);
      });
    });
    
    for (const client of clients) {
      const firstName = client.firstName.toLowerCase();
      const lastName = client.lastName.toLowerCase();
      
      // 1. Check nickname variations
      const possibleNicknames = reverseNicknameMap[firstName] || [];
      for (const nickname of possibleNicknames) {
        if (eventTitle.includes(nickname)) {
          return {
            clientId: client.id,
            confidence: 0.85,
            matchReason: `Fuzzy match: nickname '${nickname}' for '${firstName}'`,
            client
          };
        }
      }
      
      // Check if event contains a nickname that maps to client's name
      Object.entries(nicknameMap).forEach(([nickname, possibleNames]) => {
        if (eventTitle.includes(nickname) && possibleNames.includes(firstName)) {
          return {
            clientId: client.id,
            confidence: 0.85,
            matchReason: `Fuzzy match: '${nickname}' matches '${firstName}'`,
            client
          };
        }
      });
      
      // 2. Initial-based matching (e.g., "J.K." for "John Kennedy")
      const initials = `${firstName.charAt(0)}.${lastName.charAt(0)}.`;
      const initialsNoDots = `${firstName.charAt(0)}${lastName.charAt(0)}`;
      const initialsSpaced = `${firstName.charAt(0)}. ${lastName.charAt(0)}.`;
      
      if (eventTitle.includes(initials) || eventTitle.includes(initialsNoDots) || eventTitle.includes(initialsSpaced)) {
        return {
          clientId: client.id,
          confidence: 0.8,
          matchReason: `Fuzzy match: initials '${initials}' for '${firstName} ${lastName}'`,
          client
        };
      }
      
      // 3. Common misspelling patterns
      const commonMisspellings = [
        // Remove/add common letters
        firstName.replace('ph', 'f'),  // Stephen -> Stefen
        firstName.replace('f', 'ph'),   // Stefen -> Stephen
        firstName.replace('c', 'k'),    // Catherine -> Katherine
        firstName.replace('k', 'c'),    // Katherine -> Catherine
        firstName.replace('y', 'ie'),   // Tony -> Tonie
        firstName.replace('ie', 'y'),   // Tonie -> Tony
        // Double letters
        firstName.replace(/([a-z])\1/, '$1'), // Remove double letters
        firstName.replace(/([aeiou])/, '$1$1'), // Add double vowels (limited)
      ];
      
      for (const variant of commonMisspellings) {
        if (variant !== firstName && variant.length > 2 && eventTitle.includes(variant)) {
          return {
            clientId: client.id,
            confidence: 0.75,
            matchReason: `Fuzzy match: spelling variant '${variant}' for '${firstName}'`,
            client
          };
        }
      }
      
      // 4. Middle name handling - check if event contains parts that could be middle names
      const eventWords = eventTitle.split(/\s+/);
      const clientNameParts = [firstName, lastName];
      
      // Look for patterns like "FirstName MiddleName LastName" where we only have "FirstName LastName"
      for (let i = 0; i < eventWords.length - 1; i++) {
        if (eventWords[i] === firstName && eventWords[i + 2] === lastName) {
          // Potential middle name at i+1
          return {
            clientId: client.id,
            confidence: 0.8,
            matchReason: `Fuzzy match: potential middle name pattern '${eventWords[i]} ${eventWords[i+1]} ${eventWords[i+2]}'`,
            client
          };
        }
      }
      
      // 5. Partial name matching with higher tolerance
      const levenshteinDistance = (a: string, b: string): number => {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
          matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
          matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }
        return matrix[b.length][a.length];
      };
      
      // Check for close matches using edit distance
      for (const word of eventWords) {
        if (word.length > 3) {
          const firstNameDistance = levenshteinDistance(word, firstName);
          const lastNameDistance = levenshteinDistance(word, lastName);
          
          // Allow 1-2 character differences for names > 4 characters
          const maxDistance = Math.max(1, Math.floor(firstName.length * 0.3));
          
          if (firstNameDistance <= maxDistance && firstNameDistance > 0) {
            return {
              clientId: client.id,
              confidence: 0.7,
              matchReason: `Fuzzy match: '${word}' close to '${firstName}' (distance: ${firstNameDistance})`,
              client
            };
          }
          
          if (lastNameDistance <= maxDistance && lastNameDistance > 0) {
            return {
              clientId: client.id,
              confidence: 0.7,
              matchReason: `Fuzzy match: '${word}' close to '${lastName}' (distance: ${lastNameDistance})`,
              client
            };
          }
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
  private async calculateNextSync(therapistId: string, lastSync?: Date): Promise<Date> {
    const now = new Date();
    
    // Get user sync preferences from storage
    const preferences = await storage.getSyncPreferences(therapistId);
    if (!preferences) {
      // Fallback to default 2-hour interval (more reasonable than 6 hours)
      const defaultInterval = 2 * 60 * 60 * 1000; // 2 hours default
      return new Date(now.getTime() + defaultInterval);
    }

    let baseIntervalMs: number;

    // Use smart scheduling if enabled
    if (preferences.enableSmartSync) {
      baseIntervalMs = this.calculateSmartInterval(preferences, now) * 60 * 1000; // Convert minutes to milliseconds
    } else {
      baseIntervalMs = preferences.syncIntervalMinutes * 60 * 1000; // Convert minutes to milliseconds
    }
    
    // Adaptive interval based on recent failures (but cap it to prevent excessive delays)
    const circuitBreakerState = this.circuitBreakerState.get(therapistId);
    const failures = circuitBreakerState?.failures || 0;
    
    const multiplier = Math.min(1 + (failures * 0.3), 3); // Max 3x interval (reduced from 4x)
    const finalIntervalMs = baseIntervalMs * multiplier;
    
    const nextSync = new Date(now.getTime() + finalIntervalMs);
    
    const hours = Math.round(finalIntervalMs / (1000 * 60 * 60) * 10) / 10; // Round to 1 decimal
    console.log(`[Calendar Sync] [CONFIGURABLE] Next sync scheduled in ${hours} hours for therapist ${therapistId} (Smart Sync: ${preferences.enableSmartSync})`);
    
    return nextSync;
  }

  private calculateSmartInterval(preferences: any, now: Date): number {
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = currentDay === 0 || currentDay === 6;

    // Business hours only restriction
    if (preferences.businessHoursOnly) {
      if (currentHour < preferences.businessHoursStart || currentHour >= preferences.businessHoursEnd) {
        return preferences.nightlyIntervalMinutes;
      }
    }

    // Peak hours (more frequent syncing during busy therapy times)
    if (currentHour >= preferences.peakHoursStart && currentHour < preferences.peakHoursEnd && !isWeekend) {
      return preferences.peakHoursIntervalMinutes;
    }

    // Weekend scheduling (reduced frequency)
    if (isWeekend) {
      return preferences.weekendIntervalMinutes;
    }

    // Outside business hours but not restricted to business hours only
    if (currentHour < preferences.businessHoursStart || currentHour >= preferences.businessHoursEnd) {
      return preferences.nightlyIntervalMinutes;
    }

    // Regular business hours
    return preferences.syncIntervalMinutes;
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
  private async checkRateLimit(therapistId: string): Promise<boolean> {
    const now = new Date();
    const counter = this.rateLimitCounters.get(therapistId);
    
    // Get user's API call preferences
    const preferences = await storage.getSyncPreferences(therapistId);
    const maxDailyApiCalls = preferences?.maxDailyApiCalls || 500; // Conservative default
    const maxRequestsPerHour = Math.min(Math.floor(maxDailyApiCalls / 24), parseInt(process.env.MAX_SYNC_REQUESTS_PER_HOUR || '20')); // Distribute daily limit across hours
    
    if (!counter || now > counter.resetTime) {
      // Reset counter every hour
      this.rateLimitCounters.set(therapistId, {
        requests: 1,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000)
      });
      return true;
    }
    
    if (counter.requests >= maxRequestsPerHour) {
      console.warn(`[Calendar Sync] [CONFIGURABLE] Rate limit exceeded for therapist ${therapistId}: ${counter.requests}/${maxRequestsPerHour} (Daily limit: ${maxDailyApiCalls})`);
      this.logAuditEvent('rate_limit_exceeded', therapistId, false, `Requests: ${counter.requests}/${maxRequestsPerHour}, Daily: ${maxDailyApiCalls}`);
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

  /**
   * Create a calendar event review record for manual processing (with idempotency check)
   */
  private async createEventReviewRecord(
    event: CalendarEvent, 
    therapistId: string, 
    rejectionReason: 'no_match' | 'ambiguous' | 'non_therapy', 
    suggestedClientId?: string | null,
    aiMatchData?: any
  ): Promise<void> {
    try {
      // IDEMPOTENCY: Check if a review record already exists for this event
      const existingReview = await storage.getCalendarEventReviewByEventId(event.id, therapistId);
      
      if (existingReview) {
        // If review already exists and is still pending or approved, skip creating a new one
        if (existingReview.status === 'pending' || existingReview.status === 'approved') {
          console.log(`[Calendar Sync] [REVIEW] Skipping duplicate review for event: ${event.summary} (status: ${existingReview.status})`);
          return;
        }
        
        // If it was rejected but now has a different reason, we could optionally update it
        // For now, we'll skip to avoid spam
        console.log(`[Calendar Sync] [REVIEW] Skipping previously rejected event: ${event.summary} (status: ${existingReview.status})`);
        return;
      }

      const eventDate = event.start?.dateTime 
        ? new Date(event.start.dateTime) 
        : event.start?.date 
        ? new Date(event.start.date) 
        : new Date();

      const duration = this.calculateEventDuration(event);

      await storage.createCalendarEventReview({
        therapistId,
        eventId: event.id,
        eventTitle: event.summary || 'Untitled Event',
        eventDate,
        eventDescription: event.description || null,
        eventLocation: event.location || null,
        eventDuration: duration,
        suggestedClientId: suggestedClientId || null,
        status: 'pending',
        rejectionReason,
        aiMatchData: aiMatchData || null,
        therapistNotes: null
      });

      console.log(`[Calendar Sync] [REVIEW] Created review record for event: ${event.summary} (reason: ${rejectionReason})`);
    } catch (error) {
      console.error('[Calendar Sync] [REVIEW] Failed to create review record:', error);
      // Don't throw - we don't want this to break the sync process
    }
  }

  /**
   * Calculate event duration in minutes
   */
  private calculateEventDuration(event: CalendarEvent): number | null {
    if (!event.start || !event.end) return null;

    const startTime = event.start.dateTime 
      ? new Date(event.start.dateTime) 
      : event.start.date 
      ? new Date(event.start.date) 
      : null;

    const endTime = event.end.dateTime 
      ? new Date(event.end.dateTime) 
      : event.end.date 
      ? new Date(event.end.date) 
      : null;

    if (!startTime || !endTime) return null;

    return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
  }

  /**
   * Fetch ALL calendar events for a date range (for full calendar view)
   * This method does NOT filter events and returns everything including meetings, personal events, etc.
   */
  async fetchAllCalendarEvents(
    therapistId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    events: Array<{
      id: string;
      title: string;
      start: Date;
      end: Date;
      description?: string;
      location?: string;
      attendees?: string[];
      isTherapySession: boolean;
      clientName?: string;
    }>;
    error?: string;
  }> {
    try {
      // Load authentication tokens
      const isAuthenticated = await this.loadTokens(therapistId);
      if (!isAuthenticated) {
        return {
          events: [],
          error: 'Not authenticated with Google Calendar'
        };
      }

      console.log(`[Calendar View] Fetching all events from ${startDate} to ${endDate}`);

      // Fetch all events from both calendars without filtering
      const calendarIds = [
        'primary', 
        '6ac7ac649a345a77fa617a926a67b4e1028f6a8ade0bdf1e7cca8f2b62310423@group.calendar.google.com'
      ];
      
      const allEvents: CalendarEvent[] = [];

      for (const calendarId of calendarIds) {
        try {
          // Add 1 day to endDate to make it inclusive (timeMax is exclusive in Google Calendar API)
          const endDateTime = new Date(endDate);
          endDateTime.setDate(endDateTime.getDate() + 1);
          
          const response = await this.calendar.events.list({
            calendarId,
            timeMin: new Date(startDate).toISOString(),
            timeMax: endDateTime.toISOString(),
            maxResults: 2500,
            singleEvents: true,
            orderBy: 'startTime',
          });

          const events = response.data.items || [];
          
          // Filter only valid events (not cancelled)
          const validEvents = events.filter((event: any) => 
            event.id && 
            event.start && 
            (event.start.dateTime || event.start.date) &&
            event.status !== 'cancelled'
          );
          
          allEvents.push(...validEvents);
          console.log(`[Calendar View] Fetched ${validEvents.length} events from ${calendarId}`);
        } catch (calendarError) {
          console.error(`[Calendar View] Error fetching from calendar ${calendarId}:`, calendarError);
        }
      }

      // Get all sessions for this therapist to identify therapy sessions
      const sessions = await storage.getSessionsByTherapist(therapistId, 10000);
      const sessionsByEventId = new Map(
        sessions
          .filter(s => s.externalEventId)
          .map(s => [s.externalEventId, s])
      );

      // Get all clients for name lookup
      const clients = await storage.getClientsByTherapist(therapistId);
      const clientsById = new Map(clients.map(c => [c.id, c]));

      // Transform events to the required format
      const transformedEvents = allEvents.map(event => {
        const eventId = event.id;
        const session = sessionsByEventId.get(eventId);
        const isTherapySession = !!session;
        
        let clientName: string | undefined;
        if (session && session.clientId) {
          const client = clientsById.get(session.clientId);
          if (client) {
            clientName = `${client.firstName} ${client.lastName}`;
          }
        }

        // Parse start and end times
        const start = event.start?.dateTime 
          ? new Date(event.start.dateTime)
          : event.start?.date
          ? new Date(event.start.date)
          : new Date();

        const end = event.end?.dateTime 
          ? new Date(event.end.dateTime)
          : event.end?.date
          ? new Date(event.end.date)
          : new Date();

        return {
          id: eventId,
          title: event.summary || 'Untitled Event',
          start,
          end,
          description: event.description || undefined,
          location: event.location || undefined,
          attendees: event.attendees?.map(a => a.email || a.displayName || '').filter(Boolean) || undefined,
          isTherapySession,
          clientName
        };
      });

      // Sort by start time
      transformedEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

      console.log(`[Calendar View] Returning ${transformedEvents.length} total events (${transformedEvents.filter(e => e.isTherapySession).length} therapy sessions)`);

      return {
        events: transformedEvents
      };

    } catch (error) {
      console.error('[Calendar View] Error fetching calendar events:', error);
      return {
        events: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export const calendarSync = new CalendarSyncService();
export type { CalendarEvent, SyncStatus, ClientMatch };