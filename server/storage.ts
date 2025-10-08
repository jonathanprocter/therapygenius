import {
  users,
  clients,
  documents,
  sessions,
  assessments,
  treatmentPlans,
  auditLogs,
  rateLimitCounters,
  calendarSyncHistory,
  calendarEventReviews,
  calendarEventAliases,
  type User,
  type InsertUser,
  type Client,
  type InsertClient,
  type Document,
  type InsertDocument,
  type Session,
  type InsertSession,
  type Assessment,
  type InsertAssessment,
  type TreatmentPlan,
  type InsertTreatmentPlan,
  type AuditLog,
  type InsertAuditLog,
  type RateLimitCounter,
  type InsertRateLimitCounter,
  type CalendarSyncHistory,
  type InsertCalendarSyncHistory,
  type CalendarEventReview,
  type InsertCalendarEventReview,
  type CalendarEventAlias,
  type InsertCalendarEventAlias,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, like, or, sql, gte, lte, isNull } from "drizzle-orm";
import { encryptionService, EncryptionAuditLogger } from "./encryption";
import bcrypt from "bcrypt";

export interface IStorage {
  // User operations
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean>;

  // Client operations
  getClientsByTherapist(therapistId: string): Promise<Client[]>;
  getClientById(id: string, therapistId: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<Client>, therapistId: string): Promise<Client | undefined>;
  deleteClient(id: string, therapistId: string): Promise<boolean>;

  // Document operations
  getDocumentsByTherapist(therapistId: string, limit?: number): Promise<Document[]>;
  getDocumentsByClient(clientId: string, therapistId: string): Promise<Document[]>;
  getDocumentById(id: string, therapistId: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, document: Partial<Document>, therapistId: string): Promise<Document | undefined>;
  deleteDocument(id: string, therapistId: string): Promise<boolean>;
  searchDocuments(query: string, therapistId: string): Promise<Document[]>;
  linkDocumentToClient(documentId: string, clientId: string, therapistId: string): Promise<Document | undefined>;

  // Session operations
  getSessionById(id: string, therapistId: string): Promise<Session | undefined>;
  getSessionsByClient(clientId: string, therapistId: string): Promise<Session[]>;
  getSessionsByTherapist(therapistId: string, limit?: number): Promise<Session[]>;
  getTodaysSessions(therapistId: string): Promise<Array<Session & { clientName: string }>>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, session: Partial<Session>, therapistId: string): Promise<Session | undefined>;
  upsertSessionByExternalId(session: InsertSession & { externalEventId: string }): Promise<Session>;
  softDeleteSession(id: string, therapistId: string): Promise<boolean>;

  // Assessment operations
  getAssessmentsByClient(clientId: string, therapistId: string): Promise<Assessment[]>;
  createAssessment(assessment: InsertAssessment): Promise<Assessment>;

  // Treatment Plan operations
  getTreatmentPlansByClient(clientId: string, therapistId: string): Promise<TreatmentPlan[]>;
  createTreatmentPlan(plan: InsertTreatmentPlan): Promise<TreatmentPlan>;
  updateTreatmentPlan(id: string, plan: Partial<TreatmentPlan>, therapistId: string): Promise<TreatmentPlan | undefined>;

  // Dashboard stats
  getDashboardStats(therapistId: string): Promise<{
    activeClients: number;
    weekSessions: number;
    documentsProcessed: number;
    completedGoals: { completed: number; total: number };
  }>;

  // Calendar integration methods
  storeOAuthTokens(therapistId: string, tokens: {
    access_token: string;
    refresh_token?: string | null;
    expiry_date?: number | null;
    token_type?: string | null;
    scope?: string | null;
  }): Promise<void>;
  getOAuthTokens(therapistId: string): Promise<{
    access_token: string;
    refresh_token?: string | null;
    expiry_date?: number | null;
    token_type?: string | null;
    scope?: string | null;
  } | null>;
  deleteOAuthTokens(therapistId: string): Promise<void>;
  getLastSyncTime(therapistId: string): Promise<Date | null>;
  getCalendarSyncStats(therapistId: string): Promise<{
    eventsProcessed?: number;
    matchesFound?: number;
    errors?: string[];
  }>;
  updateSyncStats(therapistId: string, stats: {
    lastSync: Date;
    eventsProcessed: number;
    matchesFound: number;
    errors: string[];
  }): Promise<void>;
  getSessionByExternalEventId(externalEventId: string, therapistId: string): Promise<Session | null>;
  
  // Calendar Sync Preferences methods - Configurable sync frequency
  getSyncPreferences(therapistId: string): Promise<{
    syncIntervalMinutes: number;
    enableSmartSync: boolean;
    businessHoursOnly: boolean;
    businessHoursStart: number;
    businessHoursEnd: number;
    peakHoursStart: number;
    peakHoursEnd: number;
    peakHoursIntervalMinutes: number;
    weekendIntervalMinutes: number;
    nightlyIntervalMinutes: number;
    activityBasedSync: boolean;
    lastUserActivity: Date | null;
    maxDailyApiCalls: number;
    smartSyncSettings: any;
  } | null>;
  updateSyncPreferences(therapistId: string, preferences: {
    syncIntervalMinutes?: number;
    enableSmartSync?: boolean;
    businessHoursOnly?: boolean;
    businessHoursStart?: number;
    businessHoursEnd?: number;
    peakHoursStart?: number;
    peakHoursEnd?: number;
    peakHoursIntervalMinutes?: number;
    weekendIntervalMinutes?: number;
    nightlyIntervalMinutes?: number;
    activityBasedSync?: boolean;
    maxDailyApiCalls?: number;
    smartSyncSettings?: any;
  }): Promise<boolean>;
  updateUserActivity(therapistId: string): Promise<boolean>;
  getNextSyncTime(therapistId: string): Promise<Date | null>;
  shouldSync(therapistId: string): Promise<{ shouldSync: boolean; reason: string; nextSyncTime: Date | null }>;
  
  // Calendar Sync History methods - Detailed sync outcome tracking
  createCalendarSyncHistory(syncHistory: InsertCalendarSyncHistory): Promise<CalendarSyncHistory>;
  updateCalendarSyncHistory(id: string, updates: Partial<CalendarSyncHistory>, therapistId: string): Promise<CalendarSyncHistory | null>;
  getCalendarSyncHistoryById(id: string, therapistId: string): Promise<CalendarSyncHistory | null>;
  getCalendarSyncHistory(therapistId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
    syncType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<CalendarSyncHistory[]>;
  getLatestSyncStatus(therapistId: string): Promise<CalendarSyncHistory | null>;
  getCurrentRunningSyncs(therapistId: string): Promise<CalendarSyncHistory[]>;
  getSyncStatistics(therapistId: string, options?: {
    timeRange?: { start: Date; end: Date };
    syncType?: string;
  }): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    avgProcessingTime: number;
    totalEventsProcessed: number;
    totalEventsMatched: number;
    totalEventsRejected: number;
    lastSuccessfulSync: Date | null;
    recentErrors: string[];
  }>;
  deleteOldSyncHistory(therapistId: string, olderThanDays: number): Promise<number>;

  // Calendar Event Review methods - Manual review system for rejected calendar events
  createCalendarEventReview(review: InsertCalendarEventReview): Promise<CalendarEventReview>;
  getPendingCalendarEventReviews(therapistId: string): Promise<Array<CalendarEventReview & { suggestedClient: Client | null }>>;
  getCalendarEventReviewById(id: string, therapistId: string): Promise<CalendarEventReview | null>;
  getCalendarEventReviewByEventId(eventId: string, therapistId: string): Promise<CalendarEventReview | null>;
  updateCalendarEventReview(id: string, updates: Partial<CalendarEventReview>, therapistId: string): Promise<CalendarEventReview | null>;
  deleteCalendarEventReview(id: string, therapistId: string): Promise<boolean>;
  getPendingReviewCount(therapistId: string): Promise<number>;
  
  // Calendar Event Alias methods - Persistent patterns for automatic event-to-client matching
  getCalendarEventAliases(therapistId: string): Promise<Array<CalendarEventAlias & { client: Client }>>;
  getCalendarEventAliasById(id: string, therapistId: string): Promise<CalendarEventAlias | null>;
  createCalendarEventAlias(alias: InsertCalendarEventAlias): Promise<CalendarEventAlias>;
  updateCalendarEventAlias(id: string, updates: Partial<CalendarEventAlias>, therapistId: string): Promise<CalendarEventAlias | null>;
  deleteCalendarEventAlias(id: string, therapistId: string): Promise<boolean>;
  testAliasPattern(pattern: string, matchType: string, testText: string): Promise<boolean>;
  findMatchingAlias(eventTitle: string, therapistId: string): Promise<CalendarEventAlias | null>;
  
  // HIPAA Audit logging methods
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(therapistId?: string, limit?: number): Promise<AuditLog[]>;
  
  // Rate limiting methods
  getRateLimitCounter(therapistId: string, endpoint: string): Promise<RateLimitCounter | null>;
  updateRateLimitCounter(therapistId: string, endpoint: string, requests: number, resetTime: Date): Promise<void>;
  
  // Document-Session Linking methods
  findSessionsInTimeRange(therapistId: string, startDate: Date, endDate: Date, clientId?: string): Promise<Session[]>;
  linkDocumentToSession(documentId: string, sessionId: string, therapistId: string, confidence?: number): Promise<Document | undefined>;
  getDocumentsBySession(sessionId: string, therapistId: string): Promise<Document[]>;
  updateDocumentAnalysis(documentId: string, analysis: any, tags: any, therapistId: string): Promise<Document | undefined>;
  findPotentialSessionMatches(documentId: string, therapistId: string, timeWindowHours?: number): Promise<Array<{
    session: Session;
    confidence: number;
    matchReason: string;
  }>>;
  unlinkDocumentFromSession(documentId: string, therapistId: string): Promise<Document | undefined>;
  getUnlinkedDocuments(therapistId: string, limit?: number): Promise<Document[]>;
  
  // AI Tagging methods for sessions
  generateSessionAITags(sessionId: string, therapistId: string): Promise<any>;
  updateSessionAITags(sessionId: string, aiTags: any, therapistId: string): Promise<Session | undefined>;
  getSessionAITags(sessionId: string, therapistId: string): Promise<any | null>;
  searchSessionsByTags(tags: string[], therapistId: string): Promise<Session[]>;
  
  // AI Tagging methods for clients
  generateClientAITags(clientId: string, therapistId: string): Promise<any>;
  updateClientAITags(clientId: string, aiTags: any, therapistId: string): Promise<Client | undefined>;
  getClientAITags(clientId: string, therapistId: string): Promise<any | null>;
  searchClientsByTags(tags: string[], therapistId: string): Promise<Client[]>;
  
  // Bulk AI tagging operations
  bulkGenerateSessionTags(sessionIds: string[], therapistId: string): Promise<{ sessionId: string; tags: any; success: boolean }[]>;
  bulkGenerateClientTags(clientIds: string[], therapistId: string): Promise<{ clientId: string; tags: any; success: boolean }[]>;
  
  // AI insights and analytics
  getSessionTagTrends(clientId: string, therapistId: string, timeRange?: { start: Date; end: Date }): Promise<any>;
  getClientProgressInsights(clientId: string, therapistId: string): Promise<any>;
  getClinicalInsightsSummary(therapistId: string): Promise<any>;

  // Assessment extraction and AI analysis methods
  getAssessmentsByDocument(documentId: string, therapistId: string): Promise<Assessment[]>;
  updateAssessmentMetadata(assessmentId: string, metadata: any, therapistId: string): Promise<Assessment | undefined>;
  getAssessmentsByType(assessmentType: string, clientId: string, therapistId: string): Promise<Assessment[]>;
  getLatestAssessments(clientId: string, therapistId: string, limit?: number): Promise<Assessment[]>;
  
  // Enhanced insights and recommendations storage
  storeClientInsights(clientId: string, insights: any, therapistId: string): Promise<void>;
  getStoredClientInsights(clientId: string, therapistId: string): Promise<any | null>;
  storeRecommendations(clientId: string, recommendations: any, therapistId: string): Promise<void>;
  getStoredRecommendations(clientId: string, therapistId: string): Promise<any | null>;
  
  // Report generation and storage
  getReportsByClient(clientId: string, therapistId: string, reportType?: string): Promise<Document[]>;
  getReportsByTherapist(therapistId: string, reportType?: string, limit?: number): Promise<Document[]>;
  updateReportMetadata(reportId: string, metadata: any, therapistId: string): Promise<Document | undefined>;
  
  // Batch operations for AI processing
  getClientIdsForBatchProcessing(therapistId: string, options?: { 
    hasUnprocessedDocuments?: boolean; 
    needsInsightsUpdate?: boolean;
    limit?: number;
  }): Promise<string[]>;
  getDocumentIdsForAssessmentExtraction(therapistId: string, options?: {
    clientId?: string;
    unprocessedOnly?: boolean;
    hasAssessmentContent?: boolean;
    limit?: number;
  }): Promise<string[]>;
  markDocumentAsProcessedForAssessments(documentId: string, therapistId: string): Promise<void>;
  
  // Analytics and dashboard methods
  getAssessmentStatistics(therapistId: string, timeRange?: { start: Date; end: Date }): Promise<{
    totalAssessments: number;
    assessmentsByType: Record<string, number>;
    averageScores: Record<string, number>;
    trendsAnalysis: any;
  }>;
  getClientRiskSummary(therapistId: string): Promise<{
    clientId: string;
    clientName: string;
    riskLevel: string;
    latestAssessment: any;
  }[]>;
  getInsightsGenerationQueue(therapistId: string): Promise<{
    clientId: string;
    priority: string;
    lastUpdate: Date | null;
  }[]>;
}

export class DatabaseStorage implements IStorage {
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const [newUser] = await db
      .insert(users)
      .values({ ...user, password: hashedPassword })
      .returning();
    return newUser;
  }

  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async getClientsByTherapist(therapistId: string): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.therapistId, therapistId)).orderBy(desc(clients.updatedAt));
  }

  async getClientById(id: string, therapistId: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.therapistId, therapistId)));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: string, client: Partial<Client>, therapistId: string): Promise<Client | undefined> {
    const [updatedClient] = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(and(eq(clients.id, id), eq(clients.therapistId, therapistId)))
      .returning();
    return updatedClient;
  }

  async deleteClient(id: string, therapistId: string): Promise<boolean> {
    const result = await db
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.therapistId, therapistId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getDocumentsByTherapist(therapistId: string, limit = 50): Promise<Document[]> {
    return db
      .select()
      .from(documents)
      .where(eq(documents.therapistId, therapistId))
      .orderBy(desc(documents.uploadDate))
      .limit(limit);
  }

  async getDocumentsByClient(clientId: string, therapistId: string): Promise<Document[]> {
    return db
      .select()
      .from(documents)
      .where(and(eq(documents.clientId, clientId), eq(documents.therapistId, therapistId)))
      .orderBy(desc(documents.uploadDate));
  }

  async getDocumentById(id: string, therapistId: string): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.therapistId, therapistId)));
    return document;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async updateDocument(id: string, document: Partial<Document>, therapistId: string): Promise<Document | undefined> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ ...document, updatedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.therapistId, therapistId)))
      .returning();
    return updatedDocument;
  }

  async deleteDocument(id: string, therapistId: string): Promise<boolean> {
    const result = await db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.therapistId, therapistId)));
    return (result.rowCount ?? 0) > 0;
  }

  async searchDocuments(query: string, therapistId: string): Promise<Document[]> {
    return db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.therapistId, therapistId),
          or(
            like(documents.fileName, `%${query}%`),
            like(documents.content, `%${query}%`)
          )
        )
      )
      .orderBy(desc(documents.uploadDate));
  }

  async linkDocumentToClient(documentId: string, clientId: string, therapistId: string): Promise<Document | undefined> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ clientId, updatedAt: new Date() })
      .where(and(eq(documents.id, documentId), eq(documents.therapistId, therapistId)))
      .returning();
    return updatedDocument;
  }

  async getSessionsByClient(clientId: string, therapistId: string): Promise<Session[]> {
    return db
      .select()
      .from(sessions)
      .where(and(eq(sessions.clientId, clientId), eq(sessions.therapistId, therapistId)))
      .orderBy(desc(sessions.sessionDate));
  }

  async getSessionsByTherapist(therapistId: string, limit = 10): Promise<Session[]> {
    return db
      .select()
      .from(sessions)
      .where(eq(sessions.therapistId, therapistId))
      .orderBy(desc(sessions.sessionDate))
      .limit(limit);
  }

  async getSessionsWithClients(therapistId: string, limit = 100): Promise<Array<Session & { clientName: string }>> {
    const result = await db
      .select({
        // Session fields
        id: sessions.id,
        clientId: sessions.clientId,
        therapistId: sessions.therapistId,
        sessionDate: sessions.sessionDate,
        duration: sessions.duration,
        sessionType: sessions.sessionType,
        notes: sessions.notes,
        interventionsUsed: sessions.interventionsUsed,
        homework: sessions.homework,
        nextSessionPlan: sessions.nextSessionPlan,
        externalEventId: sessions.externalEventId,
        sourceCalendar: sessions.sourceCalendar,
        aiTags: sessions.aiTags,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
        // Client name
        clientName: sql<string>`CONCAT(${clients.firstName}, ' ', ${clients.lastName})`
      })
      .from(sessions)
      .innerJoin(clients, eq(sessions.clientId, clients.id))
      .where(eq(sessions.therapistId, therapistId))
      .orderBy(desc(sessions.sessionDate))
      .limit(limit);

    return result;
  }

  async getTodaysSessions(therapistId: string): Promise<Array<Session & { clientName: string }>> {
    // Get today's date in Eastern timezone
    // Use SQL to get current date in America/New_York timezone
    const result = await db
      .select({
        // Session fields
        id: sessions.id,
        clientId: sessions.clientId,
        therapistId: sessions.therapistId,
        sessionDate: sessions.sessionDate,
        duration: sessions.duration,
        sessionType: sessions.sessionType,
        notes: sessions.notes,
        interventionsUsed: sessions.interventionsUsed,
        homework: sessions.homework,
        nextSessionPlan: sessions.nextSessionPlan,
        externalEventId: sessions.externalEventId,
        sourceCalendar: sessions.sourceCalendar,
        aiTags: sessions.aiTags,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
        // Client name
        clientName: sql<string>`CONCAT(${clients.firstName}, ' ', ${clients.lastName})`
      })
      .from(sessions)
      .innerJoin(clients, eq(sessions.clientId, clients.id))
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          // Compare session date with current Eastern Time date
          // CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York' gives us current ET time
          // Then DATE() extracts just the date part
          sql`DATE(${sessions.sessionDate}) = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')`
        )
      )
      .orderBy(sessions.sessionDate);

    return result;
  }

  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db.insert(sessions).values(session).returning();
    return newSession;
  }

  async getSessionById(id: string, therapistId: string): Promise<Session | undefined> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.therapistId, therapistId)))
      .limit(1);
    return session;
  }

  async updateSession(id: string, session: Partial<Session>, therapistId: string): Promise<Session | undefined> {
    const [updatedSession] = await db
      .update(sessions)
      .set({ ...session, updatedAt: new Date() })
      .where(and(eq(sessions.id, id), eq(sessions.therapistId, therapistId)))
      .returning();
    return updatedSession;
  }

  // RELIABILITY: Upsert session by external event ID for calendar sync
  async upsertSessionByExternalId(session: InsertSession & { externalEventId: string }): Promise<Session> {
    try {
      // First try to find existing session by external event ID
      const existingSession = await this.getSessionByExternalEventId(session.externalEventId, session.therapistId);
      
      if (existingSession) {
        // Update existing session
        const updatedSession = await this.updateSession(existingSession.id, {
          clientId: session.clientId,
          sessionDate: session.sessionDate,
          duration: session.duration,
          sessionType: session.sessionType,
          notes: session.notes,
          interventionsUsed: session.interventionsUsed,
          homework: session.homework,
          nextSessionPlan: session.nextSessionPlan,
          aiTags: {
            ...(existingSession.aiTags && typeof existingSession.aiTags === 'object' ? existingSession.aiTags : {}),
            ...(session.aiTags && typeof session.aiTags === 'object' ? session.aiTags : {}),
            lastUpdated: new Date().toISOString()
          },
          updatedAt: new Date()
        }, session.therapistId);
        
        console.log(`[Storage] [RELIABILITY] Updated existing session ${existingSession.id} for event ${session.externalEventId}`);
        return updatedSession!;
      } else {
        // Create new session
        const newSession = await this.createSession(session);
        console.log(`[Storage] [RELIABILITY] Created new session ${newSession.id} for event ${session.externalEventId}`);
        return newSession;
      }
    } catch (error) {
      console.error('[Storage] [RELIABILITY] Error upserting session:', error);
      throw new Error('Failed to upsert session by external event ID');
    }
  }

  // RELIABILITY: Soft delete session (mark as cancelled, preserve data)
  async softDeleteSession(id: string, therapistId: string): Promise<boolean> {
    try {
      const result = await db
        .update(sessions)
        .set({ 
          notes: sql`CONCAT(COALESCE(notes, ''), ' [CANCELLED: Event removed from calendar]')`,
          aiTags: sql`COALESCE(ai_tags, '{}') || '{"status": "cancelled", "cancelledAt": "' || NOW() || '"}'`,
          updatedAt: new Date()
        })
        .where(and(eq(sessions.id, id), eq(sessions.therapistId, therapistId)));
        
      const wasUpdated = (result.rowCount ?? 0) > 0;
      if (wasUpdated) {
        console.log(`[Storage] [RELIABILITY] Soft deleted session ${id} - marked as cancelled`);
      }
      return wasUpdated;
    } catch (error) {
      console.error('[Storage] [RELIABILITY] Error soft deleting session:', error);
      throw new Error('Failed to soft delete session');
    }
  }

  async getAssessmentsByClient(clientId: string, therapistId: string): Promise<Assessment[]> {
    return db
      .select()
      .from(assessments)
      .where(and(eq(assessments.clientId, clientId), eq(assessments.therapistId, therapistId)))
      .orderBy(desc(assessments.assessmentDate));
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const [newAssessment] = await db.insert(assessments).values(assessment).returning();
    return newAssessment;
  }

  async getTreatmentPlansByClient(clientId: string, therapistId: string): Promise<TreatmentPlan[]> {
    return db
      .select()
      .from(treatmentPlans)
      .where(and(eq(treatmentPlans.clientId, clientId), eq(treatmentPlans.therapistId, therapistId)))
      .orderBy(desc(treatmentPlans.startDate));
  }

  async createTreatmentPlan(plan: InsertTreatmentPlan): Promise<TreatmentPlan> {
    const [newPlan] = await db.insert(treatmentPlans).values(plan).returning();
    return newPlan;
  }

  async updateTreatmentPlan(id: string, plan: Partial<TreatmentPlan>, therapistId: string): Promise<TreatmentPlan | undefined> {
    const [updatedPlan] = await db
      .update(treatmentPlans)
      .set({ ...plan, updatedAt: new Date() })
      .where(and(eq(treatmentPlans.id, id), eq(treatmentPlans.therapistId, therapistId)))
      .returning();
    return updatedPlan;
  }

  async getDashboardStats(therapistId: string): Promise<{
    activeClients: number;
    weekSessions: number;
    documentsProcessed: number;
    completedGoals: { completed: number; total: number };
  }> {
    // Calculate current week start and end in Eastern Time
    const now = new Date();
    const easternOffset = -5; // EST is UTC-5 (simplified, doesn't account for DST)
    
    // Get start of current week (Sunday) in Eastern Time
    const easternNow = new Date(now.getTime() + (easternOffset * 60 * 60 * 1000));
    const startOfWeek = new Date(easternNow);
    startOfWeek.setDate(easternNow.getDate() - easternNow.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Get end of current week (Saturday 11:59:59 PM)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Active clients count
    const [activeClientsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(eq(clients.therapistId, therapistId));

    // Sessions this week (current calendar week in Eastern Time)
    const [weekSessionsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          sql`${sessions.sessionDate} >= ${startOfWeek}`,
          sql`${sessions.sessionDate} <= ${endOfWeek}`
        )
      );

    // Processed documents
    const [documentsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(
        and(
          eq(documents.therapistId, therapistId),
          eq(documents.isProcessed, true)
        )
      );

    // Treatment goals (simplified - would need more complex logic in real app)
    const treatmentPlansResult = await db
      .select()
      .from(treatmentPlans)
      .where(eq(treatmentPlans.therapistId, therapistId));

    let totalGoals = 0;
    let completedGoals = 0;

    treatmentPlansResult.forEach(plan => {
      if (plan.goals && Array.isArray(plan.goals)) {
        totalGoals += plan.goals.length;
        completedGoals += plan.goals.filter((goal: any) => goal.completed).length;
      }
    });

    return {
      activeClients: activeClientsResult.count,
      weekSessions: weekSessionsResult.count,
      documentsProcessed: documentsResult.count,
      completedGoals: { completed: completedGoals, total: totalGoals },
    };
  }

  // Calendar integration implementations (SECURITY: With encryption)
  async storeOAuthTokens(therapistId: string, tokens: {
    access_token: string;
    refresh_token?: string | null;
    expiry_date?: number | null;
    token_type?: string | null;
    scope?: string | null;
  }): Promise<void> {
    try {
      // SECURITY: Encrypt OAuth tokens before storing
      const encryptedTokens = encryptionService.encryptOAuthTokens(tokens);
      
      await db
        .update(users)
        .set({
          encryptedOAuthTokens: encryptedTokens, // Store encrypted tokens securely
          updatedAt: new Date(),
        })
        .where(eq(users.id, therapistId));
        
      EncryptionAuditLogger.logEncryption(true);
      console.log(`[Storage] [SECURITY] OAuth tokens encrypted and stored for therapist ${therapistId}`);
    } catch (error) {
      EncryptionAuditLogger.logEncryption(false, error instanceof Error ? error.message : String(error));
      console.error('[Storage] [SECURITY] Failed to encrypt and store OAuth tokens:', error);
      throw new Error('Failed to securely store OAuth tokens');
    }
  }

  async getOAuthTokens(therapistId: string): Promise<{
    access_token: string;
    refresh_token?: string | null;
    expiry_date?: number | null;
    token_type?: string | null;
    scope?: string | null;
  } | null> {
    try {
      const [user] = await db
        .select({
          encryptedOAuthTokens: users.encryptedOAuthTokens,
        })
        .from(users)
        .where(eq(users.id, therapistId));

      if (!user || !user.encryptedOAuthTokens) {
        return null;
      }

      // SECURITY: Decrypt OAuth tokens from storage
      const decryptedTokens = encryptionService.decryptOAuthTokens(user.encryptedOAuthTokens);
      
      EncryptionAuditLogger.logDecryption(true);
      console.log(`[Storage] [SECURITY] OAuth tokens decrypted for therapist ${therapistId}`);
      
      return decryptedTokens;
    } catch (error) {
      EncryptionAuditLogger.logDecryption(false, error instanceof Error ? error.message : String(error));
      console.error('[Storage] [SECURITY] Failed to decrypt OAuth tokens:', error);
      return null; // Return null on decryption failure for security
    }
  }

  async deleteOAuthTokens(therapistId: string): Promise<void> {
    try {
      await db
        .update(users)
        .set({
          encryptedOAuthTokens: null,
          lastCalendarSync: null,
          calendarSyncStats: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, therapistId));
        
      console.log(`[Storage] [SECURITY] OAuth tokens securely deleted for therapist ${therapistId}`);
    } catch (error) {
      console.error('[Storage] [SECURITY] Failed to delete OAuth tokens:', error);
      throw error;
    }
  }

  async getLastSyncTime(therapistId: string): Promise<Date | null> {
    const [user] = await db
      .select({ lastCalendarSync: users.lastCalendarSync })
      .from(users)
      .where(eq(users.id, therapistId));

    return user?.lastCalendarSync || null;
  }

  async getCalendarSyncStats(therapistId: string): Promise<{
    eventsProcessed?: number;
    matchesFound?: number;
    errors?: string[];
  }> {
    const [user] = await db
      .select({ calendarSyncStats: users.calendarSyncStats })
      .from(users)
      .where(eq(users.id, therapistId));

    return (user?.calendarSyncStats as any) || {};
  }

  async updateSyncStats(therapistId: string, stats: {
    lastSync: Date;
    eventsProcessed: number;
    matchesFound: number;
    errors: string[];
  }): Promise<void> {
    await db
      .update(users)
      .set({
        lastCalendarSync: stats.lastSync,
        calendarSyncStats: {
          eventsProcessed: stats.eventsProcessed,
          matchesFound: stats.matchesFound,
          errors: stats.errors.slice(-10), // Keep only last 10 errors
          lastUpdated: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(users.id, therapistId));
  }

  async getSessionByExternalEventId(externalEventId: string, therapistId: string): Promise<Session | null> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.externalEventId, externalEventId),
          eq(sessions.therapistId, therapistId)
        )
      );

    return session || null;
  }

  // Calendar Sync Preferences implementations - Configurable sync frequency
  async getSyncPreferences(therapistId: string): Promise<{
    syncIntervalMinutes: number;
    enableSmartSync: boolean;
    businessHoursOnly: boolean;
    businessHoursStart: number;
    businessHoursEnd: number;
    peakHoursStart: number;
    peakHoursEnd: number;
    peakHoursIntervalMinutes: number;
    weekendIntervalMinutes: number;
    nightlyIntervalMinutes: number;
    activityBasedSync: boolean;
    lastUserActivity: Date | null;
    maxDailyApiCalls: number;
    smartSyncSettings: any;
  } | null> {
    const [user] = await db
      .select({
        syncIntervalMinutes: users.syncIntervalMinutes,
        enableSmartSync: users.enableSmartSync,
        businessHoursOnly: users.businessHoursOnly,
        businessHoursStart: users.businessHoursStart,
        businessHoursEnd: users.businessHoursEnd,
        peakHoursStart: users.peakHoursStart,
        peakHoursEnd: users.peakHoursEnd,
        peakHoursIntervalMinutes: users.peakHoursIntervalMinutes,
        weekendIntervalMinutes: users.weekendIntervalMinutes,
        nightlyIntervalMinutes: users.nightlyIntervalMinutes,
        activityBasedSync: users.activityBasedSync,
        lastUserActivity: users.lastUserActivity,
        maxDailyApiCalls: users.maxDailyApiCalls,
        smartSyncSettings: users.smartSyncSettings,
      })
      .from(users)
      .where(eq(users.id, therapistId));

    return user || null;
  }

  async updateSyncPreferences(therapistId: string, preferences: {
    syncIntervalMinutes?: number;
    enableSmartSync?: boolean;
    businessHoursOnly?: boolean;
    businessHoursStart?: number;
    businessHoursEnd?: number;
    peakHoursStart?: number;
    peakHoursEnd?: number;
    peakHoursIntervalMinutes?: number;
    weekendIntervalMinutes?: number;
    nightlyIntervalMinutes?: number;
    activityBasedSync?: boolean;
    maxDailyApiCalls?: number;
    smartSyncSettings?: any;
  }): Promise<boolean> {
    try {
      const result = await db
        .update(users)
        .set({
          ...preferences,
          updatedAt: new Date(),
        })
        .where(eq(users.id, therapistId));
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('[Storage] Failed to update sync preferences:', error);
      return false;
    }
  }

  async updateUserActivity(therapistId: string): Promise<boolean> {
    try {
      const result = await db
        .update(users)
        .set({
          lastUserActivity: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, therapistId));
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('[Storage] Failed to update user activity:', error);
      return false;
    }
  }

  async getNextSyncTime(therapistId: string): Promise<Date | null> {
    const preferences = await this.getSyncPreferences(therapistId);
    if (!preferences) return null;

    const lastSync = await this.getLastSyncTime(therapistId);
    const now = new Date();
    
    if (!lastSync) {
      // If never synced, schedule next sync immediately
      return now;
    }

    // Calculate next sync time based on smart scheduling
    if (preferences.enableSmartSync) {
      return this.calculateSmartSyncTime(preferences, lastSync, now);
    } else {
      // Simple interval-based sync
      return new Date(lastSync.getTime() + (preferences.syncIntervalMinutes * 60 * 1000));
    }
  }

  async shouldSync(therapistId: string): Promise<{ shouldSync: boolean; reason: string; nextSyncTime: Date | null }> {
    const preferences = await this.getSyncPreferences(therapistId);
    if (!preferences) {
      return { shouldSync: false, reason: 'No sync preferences found', nextSyncTime: null };
    }

    const nextSyncTime = await this.getNextSyncTime(therapistId);
    if (!nextSyncTime) {
      return { shouldSync: false, reason: 'Unable to calculate next sync time', nextSyncTime: null };
    }

    const now = new Date();
    const shouldSync = now >= nextSyncTime;

    let reason = shouldSync ? 'Scheduled sync time reached' : 'Not yet time for sync';

    // Additional checks for smart sync
    if (preferences.enableSmartSync) {
      // Check business hours restriction
      if (preferences.businessHoursOnly) {
        const currentHour = now.getHours();
        if (currentHour < preferences.businessHoursStart || currentHour >= preferences.businessHoursEnd) {
          return { shouldSync: false, reason: 'Outside business hours', nextSyncTime };
        }
      }

      // Check activity-based sync
      if (preferences.activityBasedSync && preferences.lastUserActivity) {
        const hoursSinceActivity = (now.getTime() - preferences.lastUserActivity.getTime()) / (1000 * 60 * 60);
        if (hoursSinceActivity > 24) {
          reason = shouldSync ? 'User inactive, reduced sync frequency' : 'User inactive, sync delayed';
        }
      }
    }

    return { shouldSync, reason, nextSyncTime };
  }

  private calculateSmartSyncTime(preferences: any, lastSync: Date, now: Date): Date {
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = currentDay === 0 || currentDay === 6;
    
    let intervalMinutes = preferences.syncIntervalMinutes;

    // Apply peak hours interval during business peak times
    if (currentHour >= preferences.peakHoursStart && currentHour < preferences.peakHoursEnd && !isWeekend) {
      intervalMinutes = preferences.peakHoursIntervalMinutes;
    }
    // Apply weekend interval
    else if (isWeekend) {
      intervalMinutes = preferences.weekendIntervalMinutes;
    }
    // Apply nightly interval (outside business hours)
    else if (currentHour < preferences.businessHoursStart || currentHour >= preferences.businessHoursEnd) {
      intervalMinutes = preferences.nightlyIntervalMinutes;
    }

    return new Date(lastSync.getTime() + (intervalMinutes * 60 * 1000));
  }

  // Calendar Event Review implementations - Manual review system for rejected calendar events
  async createCalendarEventReview(review: InsertCalendarEventReview): Promise<CalendarEventReview> {
    const [createdReview] = await db
      .insert(calendarEventReviews)
      .values(review)
      .returning();
    return createdReview;
  }

  async getPendingCalendarEventReviews(therapistId: string): Promise<Array<CalendarEventReview & { suggestedClient: Client | null }>> {
    const reviews = await db
      .select({
        id: calendarEventReviews.id,
        therapistId: calendarEventReviews.therapistId,
        eventId: calendarEventReviews.eventId,
        eventTitle: calendarEventReviews.eventTitle,
        eventDate: calendarEventReviews.eventDate,
        eventDescription: calendarEventReviews.eventDescription,
        eventLocation: calendarEventReviews.eventLocation,
        eventDuration: calendarEventReviews.eventDuration,
        suggestedClientId: calendarEventReviews.suggestedClientId,
        status: calendarEventReviews.status,
        therapistNotes: calendarEventReviews.therapistNotes,
        rejectionReason: calendarEventReviews.rejectionReason,
        aiMatchData: calendarEventReviews.aiMatchData,
        createdAt: calendarEventReviews.createdAt,
        updatedAt: calendarEventReviews.updatedAt,
        suggestedClient: {
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
        }
      })
      .from(calendarEventReviews)
      .leftJoin(clients, eq(calendarEventReviews.suggestedClientId, clients.id))
      .where(
        and(
          eq(calendarEventReviews.therapistId, therapistId),
          eq(calendarEventReviews.status, 'pending')
        )
      )
      .orderBy(desc(calendarEventReviews.createdAt));

    return reviews.map(review => ({
      ...review,
      suggestedClient: review.suggestedClient.id ? review.suggestedClient as Client : null
    }));
  }

  async getCalendarEventReviewById(id: string, therapistId: string): Promise<CalendarEventReview | null> {
    const [review] = await db
      .select()
      .from(calendarEventReviews)
      .where(
        and(
          eq(calendarEventReviews.id, id),
          eq(calendarEventReviews.therapistId, therapistId)
        )
      );

    return review || null;
  }

  async getCalendarEventReviewByEventId(eventId: string, therapistId: string): Promise<CalendarEventReview | null> {
    const [review] = await db
      .select()
      .from(calendarEventReviews)
      .where(
        and(
          eq(calendarEventReviews.eventId, eventId),
          eq(calendarEventReviews.therapistId, therapistId)
        )
      );

    return review || null;
  }

  async updateCalendarEventReview(id: string, updates: Partial<CalendarEventReview>, therapistId: string): Promise<CalendarEventReview | null> {
    const [updatedReview] = await db
      .update(calendarEventReviews)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(calendarEventReviews.id, id),
          eq(calendarEventReviews.therapistId, therapistId)
        )
      )
      .returning();

    return updatedReview || null;
  }

  async deleteCalendarEventReview(id: string, therapistId: string): Promise<boolean> {
    const result = await db
      .delete(calendarEventReviews)
      .where(
        and(
          eq(calendarEventReviews.id, id),
          eq(calendarEventReviews.therapistId, therapistId)
        )
      );

    return result.rowCount > 0;
  }

  async getPendingReviewCount(therapistId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(calendarEventReviews)
      .where(
        and(
          eq(calendarEventReviews.therapistId, therapistId),
          eq(calendarEventReviews.status, 'pending')
        )
      );

    return result?.count || 0;
  }

  // Calendar Event Alias implementations - Persistent patterns for automatic event-to-client matching
  async getCalendarEventAliases(therapistId: string): Promise<Array<CalendarEventAlias & { client: Client }>> {
    return db
      .select({
        id: calendarEventAliases.id,
        therapistId: calendarEventAliases.therapistId,
        aliasPattern: calendarEventAliases.aliasPattern,
        matchType: calendarEventAliases.matchType,
        clientId: calendarEventAliases.clientId,
        isActive: calendarEventAliases.isActive,
        createdFromEventId: calendarEventAliases.createdFromEventId,
        notes: calendarEventAliases.notes,
        createdAt: calendarEventAliases.createdAt,
        updatedAt: calendarEventAliases.updatedAt,
        client: clients,
      })
      .from(calendarEventAliases)
      .innerJoin(clients, eq(calendarEventAliases.clientId, clients.id))
      .where(eq(calendarEventAliases.therapistId, therapistId))
      .orderBy(desc(calendarEventAliases.updatedAt));
  }

  async getCalendarEventAliasById(id: string, therapistId: string): Promise<CalendarEventAlias | null> {
    const [alias] = await db
      .select()
      .from(calendarEventAliases)
      .where(
        and(
          eq(calendarEventAliases.id, id),
          eq(calendarEventAliases.therapistId, therapistId)
        )
      );
    return alias || null;
  }

  async createCalendarEventAlias(alias: InsertCalendarEventAlias): Promise<CalendarEventAlias> {
    const [newAlias] = await db
      .insert(calendarEventAliases)
      .values(alias)
      .returning();
    return newAlias;
  }

  async updateCalendarEventAlias(id: string, updates: Partial<CalendarEventAlias>, therapistId: string): Promise<CalendarEventAlias | null> {
    const [updatedAlias] = await db
      .update(calendarEventAliases)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(calendarEventAliases.id, id),
          eq(calendarEventAliases.therapistId, therapistId)
        )
      )
      .returning();
    return updatedAlias || null;
  }

  async deleteCalendarEventAlias(id: string, therapistId: string): Promise<boolean> {
    const result = await db
      .delete(calendarEventAliases)
      .where(
        and(
          eq(calendarEventAliases.id, id),
          eq(calendarEventAliases.therapistId, therapistId)
        )
      );
    return (result.rowCount ?? 0) > 0;
  }

  async testAliasPattern(pattern: string, matchType: string, testText: string): Promise<boolean> {
    const lowerPattern = pattern.toLowerCase();
    const lowerTestText = testText.toLowerCase();

    switch (matchType) {
      case 'exact':
        return lowerTestText === lowerPattern;
      case 'contains':
        return lowerTestText.includes(lowerPattern);
      case 'starts_with':
        return lowerTestText.startsWith(lowerPattern);
      case 'ends_with':
        return lowerTestText.endsWith(lowerPattern);
      case 'regex':
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(testText);
        } catch {
          return false; // Invalid regex
        }
      default:
        return false;
    }
  }

  async findMatchingAlias(eventTitle: string, therapistId: string): Promise<CalendarEventAlias | null> {
    const aliases = await db
      .select()
      .from(calendarEventAliases)
      .where(
        and(
          eq(calendarEventAliases.therapistId, therapistId),
          eq(calendarEventAliases.isActive, true)
        )
      )
      .orderBy(desc(calendarEventAliases.updatedAt));

    for (const alias of aliases) {
      const matches = await this.testAliasPattern(alias.aliasPattern, alias.matchType, eventTitle);
      if (matches) {
        return alias;
      }
    }

    return null;
  }

  // Calendar Sync History implementations - Detailed sync outcome tracking
  async createCalendarSyncHistory(syncHistory: InsertCalendarSyncHistory): Promise<CalendarSyncHistory> {
    const [createdHistory] = await db
      .insert(calendarSyncHistory)
      .values(syncHistory)
      .returning();
    return createdHistory;
  }

  async updateCalendarSyncHistory(id: string, updates: Partial<CalendarSyncHistory>, therapistId: string): Promise<CalendarSyncHistory | null> {
    const [updatedHistory] = await db
      .update(calendarSyncHistory)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(calendarSyncHistory.id, id),
          eq(calendarSyncHistory.therapistId, therapistId)
        )
      )
      .returning();

    return updatedHistory || null;
  }

  async getCalendarSyncHistoryById(id: string, therapistId: string): Promise<CalendarSyncHistory | null> {
    const [history] = await db
      .select()
      .from(calendarSyncHistory)
      .where(
        and(
          eq(calendarSyncHistory.id, id),
          eq(calendarSyncHistory.therapistId, therapistId)
        )
      );

    return history || null;
  }

  async getCalendarSyncHistory(therapistId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
    syncType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<CalendarSyncHistory[]> {
    let query = db
      .select()
      .from(calendarSyncHistory)
      .where(eq(calendarSyncHistory.therapistId, therapistId));

    // Apply filters
    if (options?.status) {
      query = query.where(eq(calendarSyncHistory.status, options.status));
    }
    if (options?.syncType) {
      query = query.where(eq(calendarSyncHistory.syncType, options.syncType));
    }
    if (options?.startDate) {
      query = query.where(gte(calendarSyncHistory.startTime, options.startDate));
    }
    if (options?.endDate) {
      query = query.where(lte(calendarSyncHistory.startTime, options.endDate));
    }

    // Order by newest first
    query = query.orderBy(desc(calendarSyncHistory.startTime));

    // Apply pagination
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  async getLatestSyncStatus(therapistId: string): Promise<CalendarSyncHistory | null> {
    const [latest] = await db
      .select()
      .from(calendarSyncHistory)
      .where(eq(calendarSyncHistory.therapistId, therapistId))
      .orderBy(desc(calendarSyncHistory.startTime))
      .limit(1);

    return latest || null;
  }

  async getCurrentRunningSyncs(therapistId: string): Promise<CalendarSyncHistory[]> {
    return await db
      .select()
      .from(calendarSyncHistory)
      .where(
        and(
          eq(calendarSyncHistory.therapistId, therapistId),
          eq(calendarSyncHistory.status, 'running')
        )
      )
      .orderBy(desc(calendarSyncHistory.startTime));
  }

  async getSyncStatistics(therapistId: string, options?: {
    timeRange?: { start: Date; end: Date };
    syncType?: string;
  }): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    avgProcessingTime: number;
    totalEventsProcessed: number;
    totalEventsMatched: number;
    totalEventsRejected: number;
    lastSuccessfulSync: Date | null;
    recentErrors: string[];
  }> {
    let baseQuery = db
      .select()
      .from(calendarSyncHistory)
      .where(eq(calendarSyncHistory.therapistId, therapistId));

    // Apply filters
    if (options?.timeRange) {
      baseQuery = baseQuery.where(
        and(
          gte(calendarSyncHistory.startTime, options.timeRange.start),
          lte(calendarSyncHistory.startTime, options.timeRange.end)
        )
      );
    }
    if (options?.syncType) {
      baseQuery = baseQuery.where(eq(calendarSyncHistory.syncType, options.syncType));
    }

    const allSyncs = await baseQuery;

    const totalSyncs = allSyncs.length;
    const successfulSyncs = allSyncs.filter(s => s.status === 'completed').length;
    const failedSyncs = allSyncs.filter(s => s.status === 'failed').length;
    
    const completedSyncs = allSyncs.filter(s => s.status === 'completed' && s.processingTimeMs);
    const avgProcessingTime = completedSyncs.length > 0 
      ? completedSyncs.reduce((sum, s) => sum + (s.processingTimeMs || 0), 0) / completedSyncs.length
      : 0;

    const totalEventsProcessed = allSyncs.reduce((sum, s) => sum + (s.eventsTotal || 0), 0);
    const totalEventsMatched = allSyncs.reduce((sum, s) => sum + (s.eventsMatched || 0), 0);
    const totalEventsRejected = allSyncs.reduce((sum, s) => sum + (s.eventsRejected || 0), 0);

    const lastSuccessfulSync = allSyncs
      .filter(s => s.status === 'completed')
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0]?.endTime || null;

    // Get recent errors from failed syncs
    const recentErrors = allSyncs
      .filter(s => s.status === 'failed' && s.errors)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 10)
      .flatMap(s => Array.isArray(s.errors) ? s.errors : [])
      .slice(0, 20);

    return {
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      avgProcessingTime,
      totalEventsProcessed,
      totalEventsMatched,
      totalEventsRejected,
      lastSuccessfulSync,
      recentErrors: recentErrors as string[]
    };
  }

  async deleteOldSyncHistory(therapistId: string, olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db
      .delete(calendarSyncHistory)
      .where(
        and(
          eq(calendarSyncHistory.therapistId, therapistId),
          lte(calendarSyncHistory.startTime, cutoffDate)
        )
      );

    return result.rowCount || 0;
  }

  // HIPAA Audit logging implementation - tamper-evident, persistent logging
  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    try {
      const [newAuditLog] = await db.insert(auditLogs).values(auditLog).returning();
      return newAuditLog;
    } catch (error) {
      console.error('[AUDIT] CRITICAL: Failed to create audit log entry:', error);
      // In a real HIPAA environment, this should trigger alerts
      throw new Error('Audit logging failure - operation cannot continue');
    }
  }

  async getAuditLogs(therapistId?: string, limit = 1000): Promise<AuditLog[]> {
    const query = db.select().from(auditLogs);
    
    if (therapistId) {
      query.where(eq(auditLogs.therapistId, therapistId));
    }
    
    return query.orderBy(desc(auditLogs.timestamp)).limit(limit);
  }

  // Rate limiting implementation - persistent counters
  async getRateLimitCounter(therapistId: string, endpoint: string): Promise<RateLimitCounter | null> {
    const [counter] = await db
      .select()
      .from(rateLimitCounters)
      .where(
        and(
          eq(rateLimitCounters.therapistId, therapistId),
          eq(rateLimitCounters.endpoint, endpoint)
        )
      );

    return counter || null;
  }

  async updateRateLimitCounter(therapistId: string, endpoint: string, requests: number, resetTime: Date): Promise<void> {
    const existing = await this.getRateLimitCounter(therapistId, endpoint);
    
    if (existing) {
      await db
        .update(rateLimitCounters)
        .set({
          requests,
          resetTime,
          updatedAt: new Date(),
        })
        .where(eq(rateLimitCounters.id, existing.id));
    } else {
      await db.insert(rateLimitCounters).values({
        therapistId,
        endpoint,
        requests,
        resetTime,
      });
    }
  }

  // Document-Session Linking method implementations
  async findSessionsInTimeRange(therapistId: string, startDate: Date, endDate: Date, clientId?: string): Promise<Session[]> {
    try {
      const query = db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.therapistId, therapistId),
            gte(sessions.sessionDate, startDate),
            lte(sessions.sessionDate, endDate),
            ...(clientId ? [eq(sessions.clientId, clientId)] : [])
          )
        )
        .orderBy(sessions.sessionDate);

      return await query;
    } catch (error) {
      console.error('[Storage] Error finding sessions in time range:', error);
      throw new Error('Failed to find sessions in time range');
    }
  }

  async linkDocumentToSession(documentId: string, sessionId: string, therapistId: string, confidence?: number): Promise<Document | undefined> {
    try {
      // Verify the session belongs to the therapist
      const session = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.therapistId, therapistId)))
        .limit(1);

      if (session.length === 0) {
        throw new Error('Session not found or does not belong to therapist');
      }

      // Update the document with the session link
      const [updatedDocument] = await db
        .update(documents)
        .set({
          sessionId,
          analysis: confidence !== undefined 
            ? sql`COALESCE(analysis, '{}') || ${JSON.stringify({ linkingConfidence: confidence, linkedAt: new Date().toISOString() })}`
            : sql`COALESCE(analysis, '{}') || ${JSON.stringify({ linkedAt: new Date().toISOString() })}`,
          updatedAt: new Date()
        })
        .where(and(eq(documents.id, documentId), eq(documents.therapistId, therapistId)))
        .returning();

      console.log(`[Storage] Document ${documentId} linked to session ${sessionId} with confidence ${confidence || 'N/A'}`);
      return updatedDocument;
    } catch (error) {
      console.error('[Storage] Error linking document to session:', error);
      throw new Error('Failed to link document to session');
    }
  }

  async getDocumentsBySession(sessionId: string, therapistId: string): Promise<Document[]> {
    try {
      return await db
        .select()
        .from(documents)
        .where(and(eq(documents.sessionId, sessionId), eq(documents.therapistId, therapistId)))
        .orderBy(desc(documents.uploadDate));
    } catch (error) {
      console.error('[Storage] Error getting documents by session:', error);
      throw new Error('Failed to get documents by session');
    }
  }

  async updateDocumentAnalysis(documentId: string, analysisResults: any, tags: { category?: string; tags?: string[]; keyInsights?: string[] }, therapistId: string): Promise<Document | undefined> {
    try {
      const [updatedDocument] = await db
        .update(documents)
        .set({
          analysis: analysisResults,
          tags: tags,
          isProcessed: true,
          updatedAt: new Date()
        })
        .where(and(eq(documents.id, documentId), eq(documents.therapistId, therapistId)))
        .returning();

      return updatedDocument;
    } catch (error) {
      console.error('[Storage] Error updating document analysis:', error);
      throw new Error('Failed to update document analysis');
    }
  }

  async findPotentialSessionMatches(documentId: string, therapistId: string, timeWindowHours: number = 48): Promise<Array<{
    session: Session;
    confidence: number;
    matchReason: string;
  }>> {
    try {
      // Get the document first
      const document = await this.getDocumentById(documentId, therapistId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Calculate time window around document upload
      const uploadDate = document.uploadDate || document.createdAt;
      const windowMs = timeWindowHours * 60 * 60 * 1000;
      const startRange = new Date(uploadDate.getTime() - windowMs);
      const endRange = new Date(uploadDate.getTime() + windowMs);

      // Find sessions in the time window
      const sessionsInRange = await this.findSessionsInTimeRange(
        therapistId,
        startRange,
        endRange,
        document.clientId || undefined
      );

      // Score each session for potential matches
      const matches = sessionsInRange.map(session => {
        let confidence = 0;
        const reasons: string[] = [];

        // Higher confidence if same client
        if (document.clientId && session.clientId === document.clientId) {
          confidence += 0.4;
          reasons.push('Same client');
        }

        // Time proximity scoring (closer = higher confidence)
        const timeDiff = Math.abs(session.sessionDate.getTime() - uploadDate.getTime());
        const maxTimeDiff = windowMs;
        const timeScore = Math.max(0, (maxTimeDiff - timeDiff) / maxTimeDiff) * 0.3;
        confidence += timeScore;
        reasons.push(`Time proximity: ${Math.round(timeScore * 100)}%`);

        // Content-based scoring (if document content available)
        if (document.content && session.notes) {
          // Simple keyword matching - could be enhanced with AI analysis
          const sessionKeywords = session.notes.toLowerCase();
          const docKeywords = document.content.toLowerCase();
          
          // Check for common therapy-related terms
          const commonTerms = ['session', 'therapy', 'treatment', 'progress', 'goal', 'intervention'];
          let keywordMatches = 0;
          
          commonTerms.forEach(term => {
            if (sessionKeywords.includes(term) && docKeywords.includes(term)) {
              keywordMatches++;
            }
          });
          
          if (keywordMatches > 0) {
            const contentScore = Math.min(keywordMatches / commonTerms.length, 1) * 0.2;
            confidence += contentScore;
            reasons.push(`Content keywords: ${keywordMatches}/${commonTerms.length}`);
          }
        }

        // Bonus for documents uploaded on same day as session
        const sessionDate = new Date(session.sessionDate).toDateString();
        const uploadDateStr = new Date(uploadDate).toDateString();
        if (sessionDate === uploadDateStr) {
          confidence += 0.1;
          reasons.push('Same day upload');
        }

        return {
          session,
          confidence: Math.min(confidence, 1), // Cap at 1.0
          matchReason: reasons.join(', ')
        };
      });

      // Return matches sorted by confidence (highest first)
      return matches
        .filter(match => match.confidence > 0.1) // Only return reasonable matches
        .sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      console.error('[Storage] Error finding potential session matches:', error);
      throw new Error('Failed to find potential session matches');
    }
  }

  async unlinkDocumentFromSession(documentId: string, therapistId: string): Promise<Document | undefined> {
    try {
      const [updatedDocument] = await db
        .update(documents)
        .set({
          sessionId: null,
          analysis: sql`COALESCE(analysis, '{}') || ${JSON.stringify({ unlinkedAt: new Date().toISOString() })}`,
          updatedAt: new Date()
        })
        .where(and(eq(documents.id, documentId), eq(documents.therapistId, therapistId)))
        .returning();

      console.log(`[Storage] Document ${documentId} unlinked from session`);
      return updatedDocument;
    } catch (error) {
      console.error('[Storage] Error unlinking document from session:', error);
      throw new Error('Failed to unlink document from session');
    }
  }

  async getUnlinkedDocuments(therapistId: string, limit: number = 50): Promise<Document[]> {
    try {
      return await db
        .select()
        .from(documents)
        .where(and(eq(documents.therapistId, therapistId), isNull(documents.sessionId)))
        .orderBy(desc(documents.uploadDate))
        .limit(limit);
    } catch (error) {
      console.error('[Storage] Error getting unlinked documents:', error);
      throw new Error('Failed to get unlinked documents');
    }
  }

  // AI Tagging methods for sessions
  async generateSessionAITags(sessionId: string, therapistId: string): Promise<any> {
    const { sessionTagger } = await import('./sessionTagger');
    return await sessionTagger.generateSessionTags(sessionId, therapistId);
  }

  async updateSessionAITags(sessionId: string, aiTags: any, therapistId: string): Promise<Session | undefined> {
    try {
      const [updatedSession] = await db
        .update(sessions)
        .set({
          aiTags,
          updatedAt: new Date()
        })
        .where(and(eq(sessions.id, sessionId), eq(sessions.therapistId, therapistId)))
        .returning();

      return updatedSession;
    } catch (error) {
      console.error('[Storage] Error updating session AI tags:', error);
      throw new Error('Failed to update session AI tags');
    }
  }

  async getSessionAITags(sessionId: string, therapistId: string): Promise<any | null> {
    try {
      const [session] = await db
        .select({ aiTags: sessions.aiTags })
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.therapistId, therapistId)));

      return session?.aiTags || null;
    } catch (error) {
      console.error('[Storage] Error getting session AI tags:', error);
      throw new Error('Failed to get session AI tags');
    }
  }

  async searchSessionsByTags(tags: string[], therapistId: string): Promise<Session[]> {
    try {
      // Search for sessions where aiTags contains any of the specified tags
      const tagConditions = tags.map(tag => 
        sql`${sessions.aiTags}::text ILIKE ${'%' + tag + '%'}`
      );
      
      return await db
        .select()
        .from(sessions)
        .where(and(
          eq(sessions.therapistId, therapistId),
          or(...tagConditions)
        ))
        .orderBy(desc(sessions.sessionDate));
    } catch (error) {
      console.error('[Storage] Error searching sessions by tags:', error);
      throw new Error('Failed to search sessions by tags');
    }
  }

  // AI Tagging methods for clients
  async generateClientAITags(clientId: string, therapistId: string): Promise<any> {
    const { clientTagger } = await import('./clientTagger');
    return await clientTagger.generateClientTags(clientId, therapistId);
  }

  async updateClientAITags(clientId: string, aiTags: any, therapistId: string): Promise<Client | undefined> {
    try {
      const [updatedClient] = await db
        .update(clients)
        .set({
          aiTags,
          updatedAt: new Date()
        })
        .where(and(eq(clients.id, clientId), eq(clients.therapistId, therapistId)))
        .returning();

      return updatedClient;
    } catch (error) {
      console.error('[Storage] Error updating client AI tags:', error);
      throw new Error('Failed to update client AI tags');
    }
  }

  async getClientAITags(clientId: string, therapistId: string): Promise<any | null> {
    try {
      const [client] = await db
        .select({ aiTags: clients.aiTags })
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.therapistId, therapistId)));

      return client?.aiTags || null;
    } catch (error) {
      console.error('[Storage] Error getting client AI tags:', error);
      throw new Error('Failed to get client AI tags');
    }
  }

  async searchClientsByTags(tags: string[], therapistId: string): Promise<Client[]> {
    try {
      // Search for clients where aiTags contains any of the specified tags
      const tagConditions = tags.map(tag => 
        sql`${clients.aiTags}::text ILIKE ${'%' + tag + '%'}`
      );
      
      return await db
        .select()
        .from(clients)
        .where(and(
          eq(clients.therapistId, therapistId),
          or(...tagConditions)
        ))
        .orderBy(desc(clients.updatedAt));
    } catch (error) {
      console.error('[Storage] Error searching clients by tags:', error);
      throw new Error('Failed to search clients by tags');
    }
  }

  // Bulk AI tagging operations
  async bulkGenerateSessionTags(sessionIds: string[], therapistId: string): Promise<{ sessionId: string; tags: any; success: boolean }[]> {
    const { sessionTagger } = await import('./sessionTagger');
    return await sessionTagger.bulkGenerateSessionTags(sessionIds, therapistId);
  }

  async bulkGenerateClientTags(clientIds: string[], therapistId: string): Promise<{ clientId: string; tags: any; success: boolean }[]> {
    const { clientTagger } = await import('./clientTagger');
    return await clientTagger.bulkGenerateClientTags(clientIds, therapistId);
  }

  // AI insights and analytics
  async getSessionTagTrends(clientId: string, therapistId: string, timeRange?: { start: Date; end: Date }): Promise<any> {
    try {
      let query = db
        .select()
        .from(sessions)
        .where(and(
          eq(sessions.clientId, clientId),
          eq(sessions.therapistId, therapistId)
        ));

      if (timeRange) {
        query = query.where(and(
          eq(sessions.clientId, clientId),
          eq(sessions.therapistId, therapistId),
          gte(sessions.sessionDate, timeRange.start),
          lte(sessions.sessionDate, timeRange.end)
        ));
      }

      const sessionData = await query.orderBy(sessions.sessionDate);

      // Analyze trends in AI tags over time
      const trends = sessionData
        .filter(session => session.aiTags)
        .map(session => ({
          date: session.sessionDate,
          tags: session.aiTags,
          sessionId: session.id
        }));

      return {
        totalSessions: sessionData.length,
        taggedSessions: trends.length,
        trends
      };
    } catch (error) {
      console.error('[Storage] Error getting session tag trends:', error);
      throw new Error('Failed to get session tag trends');
    }
  }

  async getClientProgressInsights(clientId: string, therapistId: string): Promise<any> {
    try {
      // Get client with AI tags
      const client = await this.getClientById(clientId, therapistId);
      if (!client) {
        throw new Error('Client not found');
      }

      // Get all sessions with AI tags
      const sessions = await db
        .select()
        .from(sessions)
        .where(and(
          eq(sessions.clientId, clientId),
          eq(sessions.therapistId, therapistId)
        ))
        .orderBy(sessions.sessionDate);

      // Get assessments
      const assessments = await this.getAssessmentsByClient(clientId, therapistId);

      return {
        client: {
          id: client.id,
          name: `${client.firstName} ${client.lastName}`,
          aiTags: client.aiTags
        },
        sessions: {
          total: sessions.length,
          withTags: sessions.filter(s => s.aiTags).length,
          recent: sessions.slice(-5).map(s => ({
            id: s.id,
            date: s.sessionDate,
            aiTags: s.aiTags
          }))
        },
        assessments: {
          total: assessments.length,
          recent: assessments.slice(-3)
        }
      };
    } catch (error) {
      console.error('[Storage] Error getting client progress insights:', error);
      throw new Error('Failed to get client progress insights');
    }
  }

  async getClinicalInsightsSummary(therapistId: string): Promise<any> {
    try {
      // Get summary statistics for AI tagging system
      const [clientStats] = await db
        .select({
          totalClients: sql<number>`count(*)`,
          taggedClients: sql<number>`count(CASE WHEN ${clients.aiTags} IS NOT NULL THEN 1 END)`
        })
        .from(clients)
        .where(eq(clients.therapistId, therapistId));

      const [sessionStats] = await db
        .select({
          totalSessions: sql<number>`count(*)`,
          taggedSessions: sql<number>`count(CASE WHEN ${sessions.aiTags} IS NOT NULL THEN 1 END)`
        })
        .from(sessions)
        .where(eq(sessions.therapistId, therapistId));

      // Get recent tagged sessions
      const recentTaggedSessions = await db
        .select({
          id: sessions.id,
          clientId: sessions.clientId,
          sessionDate: sessions.sessionDate,
          aiTags: sessions.aiTags
        })
        .from(sessions)
        .where(and(
          eq(sessions.therapistId, therapistId),
          sql`${sessions.aiTags} IS NOT NULL`
        ))
        .orderBy(desc(sessions.sessionDate))
        .limit(10);

      return {
        clients: clientStats,
        sessions: sessionStats,
        recentActivity: recentTaggedSessions,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('[Storage] Error getting clinical insights summary:', error);
      throw new Error('Failed to get clinical insights summary');
    }
  }

  // Assessment extraction and AI analysis methods
  async getAssessmentsByDocument(documentId: string, therapistId: string): Promise<Assessment[]> {
    try {
      return await db
        .select()
        .from(assessments)
        .where(and(
          eq(assessments.therapistId, therapistId),
          sql`${assessments.metadata}->>'sourceDocumentId' = ${documentId}`
        ))
        .orderBy(desc(assessments.assessmentDate));
    } catch (error) {
      console.error('[Storage] Error getting assessments by document:', error);
      throw new Error('Failed to get assessments by document');
    }
  }

  async updateAssessmentMetadata(assessmentId: string, metadata: any, therapistId: string): Promise<Assessment | undefined> {
    try {
      const [updatedAssessment] = await db
        .update(assessments)
        .set({
          metadata,
          updatedAt: new Date()
        })
        .where(and(eq(assessments.id, assessmentId), eq(assessments.therapistId, therapistId)))
        .returning();

      return updatedAssessment;
    } catch (error) {
      console.error('[Storage] Error updating assessment metadata:', error);
      throw new Error('Failed to update assessment metadata');
    }
  }

  async getAssessmentsByType(assessmentType: string, clientId: string, therapistId: string): Promise<Assessment[]> {
    try {
      return await db
        .select()
        .from(assessments)
        .where(and(
          eq(assessments.clientId, clientId),
          eq(assessments.therapistId, therapistId),
          eq(assessments.assessmentType, assessmentType)
        ))
        .orderBy(desc(assessments.assessmentDate));
    } catch (error) {
      console.error('[Storage] Error getting assessments by type:', error);
      throw new Error('Failed to get assessments by type');
    }
  }

  async getLatestAssessments(clientId: string, therapistId: string, limit: number = 5): Promise<Assessment[]> {
    try {
      return await db
        .select()
        .from(assessments)
        .where(and(
          eq(assessments.clientId, clientId),
          eq(assessments.therapistId, therapistId)
        ))
        .orderBy(desc(assessments.assessmentDate))
        .limit(limit);
    } catch (error) {
      console.error('[Storage] Error getting latest assessments:', error);
      throw new Error('Failed to get latest assessments');
    }
  }

  // Enhanced insights and recommendations storage
  async storeClientInsights(clientId: string, insights: any, therapistId: string): Promise<void> {
    try {
      await db
        .update(clients)
        .set({
          aiTags: insights,
          updatedAt: new Date()
        })
        .where(and(eq(clients.id, clientId), eq(clients.therapistId, therapistId)));
    } catch (error) {
      console.error('[Storage] Error storing client insights:', error);
      throw new Error('Failed to store client insights');
    }
  }

  async getStoredClientInsights(clientId: string, therapistId: string): Promise<any | null> {
    try {
      const [client] = await db
        .select({ aiTags: clients.aiTags })
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.therapistId, therapistId)));

      return client?.aiTags || null;
    } catch (error) {
      console.error('[Storage] Error getting stored client insights:', error);
      throw new Error('Failed to get stored client insights');
    }
  }

  async storeRecommendations(clientId: string, recommendations: any, therapistId: string): Promise<void> {
    try {
      // Store recommendations as a document for audit trail
      const fileName = `recommendations_${clientId}_${new Date().toISOString().split('T')[0]}.json`;
      
      await db.insert(documents).values({
        therapistId,
        clientId,
        fileName,
        fileType: "application/json",
        fileSize: JSON.stringify(recommendations).length,
        filePath: `/recommendations/${fileName}`,
        content: JSON.stringify(recommendations, null, 2),
        metadata: {
          type: "recommendations",
          generatedDate: new Date().toISOString(),
          category: "AI_Generated"
        },
        isProcessed: true,
        analysis: {
          category: "Recommendations",
          type: "treatment_recommendations"
        },
        tags: ["recommendations", "ai_generated", "treatment_plan"]
      });
    } catch (error) {
      console.error('[Storage] Error storing recommendations:', error);
      throw new Error('Failed to store recommendations');
    }
  }

  async getStoredRecommendations(clientId: string, therapistId: string): Promise<any | null> {
    try {
      const [document] = await db
        .select()
        .from(documents)
        .where(and(
          eq(documents.clientId, clientId),
          eq(documents.therapistId, therapistId),
          sql`${documents.metadata}->>'type' = 'recommendations'`
        ))
        .orderBy(desc(documents.uploadDate))
        .limit(1);

      if (document?.content) {
        return JSON.parse(document.content);
      }
      return null;
    } catch (error) {
      console.error('[Storage] Error getting stored recommendations:', error);
      throw new Error('Failed to get stored recommendations');
    }
  }

  // Report generation and storage
  async getReportsByClient(clientId: string, therapistId: string, reportType?: string): Promise<Document[]> {
    try {
      let query = db
        .select()
        .from(documents)
        .where(and(
          eq(documents.clientId, clientId),
          eq(documents.therapistId, therapistId),
          sql`${documents.metadata}->>'category' = 'Report'`
        ));

      if (reportType) {
        query = query.where(and(
          eq(documents.clientId, clientId),
          eq(documents.therapistId, therapistId),
          sql`${documents.metadata}->>'category' = 'Report'`,
          sql`${documents.metadata}->>'reportType' = ${reportType}`
        ));
      }

      return await query.orderBy(desc(documents.uploadDate));
    } catch (error) {
      console.error('[Storage] Error getting reports by client:', error);
      throw new Error('Failed to get reports by client');
    }
  }

  async getReportsByTherapist(therapistId: string, reportType?: string, limit: number = 50): Promise<Document[]> {
    try {
      let query = db
        .select()
        .from(documents)
        .where(and(
          eq(documents.therapistId, therapistId),
          sql`${documents.metadata}->>'category' = 'Report'`
        ));

      if (reportType) {
        query = query.where(and(
          eq(documents.therapistId, therapistId),
          sql`${documents.metadata}->>'category' = 'Report'`,
          sql`${documents.metadata}->>'reportType' = ${reportType}`
        ));
      }

      return await query.orderBy(desc(documents.uploadDate)).limit(limit);
    } catch (error) {
      console.error('[Storage] Error getting reports by therapist:', error);
      throw new Error('Failed to get reports by therapist');
    }
  }

  async updateReportMetadata(reportId: string, metadata: any, therapistId: string): Promise<Document | undefined> {
    try {
      const [updatedReport] = await db
        .update(documents)
        .set({
          metadata,
          updatedAt: new Date()
        })
        .where(and(eq(documents.id, reportId), eq(documents.therapistId, therapistId)))
        .returning();

      return updatedReport;
    } catch (error) {
      console.error('[Storage] Error updating report metadata:', error);
      throw new Error('Failed to update report metadata');
    }
  }

  // Batch operations for AI processing
  async getClientIdsForBatchProcessing(
    therapistId: string, 
    options: { 
      hasUnprocessedDocuments?: boolean; 
      needsInsightsUpdate?: boolean;
      limit?: number;
    } = {}
  ): Promise<string[]> {
    try {
      const limit = options.limit || 50;
      
      if (options.hasUnprocessedDocuments) {
        // Get clients with unprocessed documents
        const clientsWithUnprocessedDocs = await db
          .selectDistinct({ clientId: documents.clientId })
          .from(documents)
          .where(and(
            eq(documents.therapistId, therapistId),
            eq(documents.isProcessed, false),
            sql`${documents.clientId} IS NOT NULL`
          ))
          .limit(limit);
        
        return clientsWithUnprocessedDocs.map(c => c.clientId!);
      }
      
      if (options.needsInsightsUpdate) {
        // Get clients whose insights are older than 24 hours or don't exist
        const clientsNeedingUpdate = await db
          .select({ id: clients.id })
          .from(clients)
          .where(and(
            eq(clients.therapistId, therapistId),
            or(
              isNull(clients.aiTags),
              sql`${clients.updatedAt} < NOW() - INTERVAL '24 hours'`
            )
          ))
          .limit(limit);
        
        return clientsNeedingUpdate.map(c => c.id);
      }
      
      // Default: get all clients
      const allClients = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.therapistId, therapistId))
        .limit(limit);
      
      return allClients.map(c => c.id);
    } catch (error) {
      console.error('[Storage] Error getting client IDs for batch processing:', error);
      throw new Error('Failed to get client IDs for batch processing');
    }
  }

  async getDocumentIdsForAssessmentExtraction(
    therapistId: string, 
    options: {
      clientId?: string;
      unprocessedOnly?: boolean;
      hasAssessmentContent?: boolean;
      limit?: number;
    } = {}
  ): Promise<string[]> {
    try {
      const limit = options.limit || 100;
      let query = db.select({ id: documents.id }).from(documents);
      
      const conditions = [eq(documents.therapistId, therapistId)];
      
      if (options.clientId) {
        conditions.push(eq(documents.clientId, options.clientId));
      }
      
      if (options.unprocessedOnly) {
        conditions.push(eq(documents.isProcessed, false));
      }
      
      if (options.hasAssessmentContent) {
        // Look for documents that likely contain assessment content
        conditions.push(or(
          sql`LOWER(${documents.fileName}) LIKE '%phq%'`,
          sql`LOWER(${documents.fileName}) LIKE '%gad%'`,
          sql`LOWER(${documents.fileName}) LIKE '%assessment%'`,
          sql`LOWER(${documents.content}) LIKE '%phq-9%'`,
          sql`LOWER(${documents.content}) LIKE '%gad-7%'`,
          sql`LOWER(${documents.content}) LIKE '%beck%'`,
          sql`LOWER(${documents.content}) LIKE '%score%'`
        ));
      }
      
      const documentIds = await query
        .where(and(...conditions))
        .orderBy(desc(documents.uploadDate))
        .limit(limit);
      
      return documentIds.map(d => d.id);
    } catch (error) {
      console.error('[Storage] Error getting document IDs for assessment extraction:', error);
      throw new Error('Failed to get document IDs for assessment extraction');
    }
  }

  async markDocumentAsProcessedForAssessments(documentId: string, therapistId: string): Promise<void> {
    try {
      await db
        .update(documents)
        .set({
          isProcessed: true,
          updatedAt: new Date()
        })
        .where(and(eq(documents.id, documentId), eq(documents.therapistId, therapistId)));
    } catch (error) {
      console.error('[Storage] Error marking document as processed for assessments:', error);
      throw new Error('Failed to mark document as processed for assessments');
    }
  }

  // Analytics and dashboard methods
  async getAssessmentStatistics(
    therapistId: string, 
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    totalAssessments: number;
    assessmentsByType: Record<string, number>;
    averageScores: Record<string, number>;
    trendsAnalysis: any;
  }> {
    try {
      let query = db.select().from(assessments).where(eq(assessments.therapistId, therapistId));
      
      if (timeRange) {
        query = query.where(and(
          eq(assessments.therapistId, therapistId),
          gte(assessments.assessmentDate, timeRange.start),
          lte(assessments.assessmentDate, timeRange.end)
        ));
      }
      
      const assessmentData = await query.orderBy(assessments.assessmentDate);
      
      // Calculate statistics
      const totalAssessments = assessmentData.length;
      const assessmentsByType: Record<string, number> = {};
      const scoresByType: Record<string, number[]> = {};
      
      assessmentData.forEach(assessment => {
        const type = assessment.assessmentType;
        assessmentsByType[type] = (assessmentsByType[type] || 0) + 1;
        
        // Extract total score for averaging
        if (assessment.scores && typeof assessment.scores === 'object') {
          const score = (assessment.scores as any).totalScore;
          if (typeof score === 'number') {
            if (!scoresByType[type]) scoresByType[type] = [];
            scoresByType[type].push(score);
          }
        }
      });
      
      // Calculate average scores
      const averageScores: Record<string, number> = {};
      Object.entries(scoresByType).forEach(([type, scores]) => {
        averageScores[type] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      });
      
      // Simple trends analysis
      const trendsAnalysis = this.calculateAssessmentTrends(assessmentData);
      
      return {
        totalAssessments,
        assessmentsByType,
        averageScores,
        trendsAnalysis
      };
    } catch (error) {
      console.error('[Storage] Error getting assessment statistics:', error);
      throw new Error('Failed to get assessment statistics');
    }
  }

  async getClientRiskSummary(therapistId: string): Promise<{
    clientId: string;
    clientName: string;
    riskLevel: string;
    latestAssessment: any;
  }[]> {
    try {
      // Get all clients with their latest assessments
      const clientsWithAssessments = await db
        .select({
          clientId: clients.id,
          clientName: sql<string>`${clients.firstName} || ' ' || ${clients.lastName}`,
          assessmentType: assessments.assessmentType,
          assessmentDate: assessments.assessmentDate,
          scores: assessments.scores,
          interpretation: assessments.interpretation
        })
        .from(clients)
        .leftJoin(assessments, eq(clients.id, assessments.clientId))
        .where(eq(clients.therapistId, therapistId))
        .orderBy(desc(assessments.assessmentDate));
      
      // Group by client and get latest assessment for each
      const clientRiskMap = new Map();
      
      clientsWithAssessments.forEach(row => {
        if (!clientRiskMap.has(row.clientId)) {
          let riskLevel = "low";
          
          if (row.scores && typeof row.scores === 'object') {
            const score = (row.scores as any).totalScore;
            
            // Determine risk level based on assessment type and score
            if (row.assessmentType === "PHQ-9" && typeof score === 'number') {
              if (score >= 20) riskLevel = "critical";
              else if (score >= 15) riskLevel = "high";
              else if (score >= 10) riskLevel = "moderate";
            } else if (row.assessmentType === "GAD-7" && typeof score === 'number') {
              if (score >= 15) riskLevel = "high";
              else if (score >= 10) riskLevel = "moderate";
            }
          }
          
          clientRiskMap.set(row.clientId, {
            clientId: row.clientId,
            clientName: row.clientName,
            riskLevel,
            latestAssessment: row.assessmentType ? {
              type: row.assessmentType,
              date: row.assessmentDate,
              scores: row.scores,
              interpretation: row.interpretation
            } : null
          });
        }
      });
      
      return Array.from(clientRiskMap.values());
    } catch (error) {
      console.error('[Storage] Error getting client risk summary:', error);
      throw new Error('Failed to get client risk summary');
    }
  }

  async getInsightsGenerationQueue(therapistId: string): Promise<{
    clientId: string;
    priority: string;
    lastUpdate: Date | null;
  }[]> {
    try {
      const clientsQueue = await db
        .select({
          clientId: clients.id,
          lastUpdate: clients.updatedAt,
          hasRecentDocuments: sql<boolean>`EXISTS(
            SELECT 1 FROM ${documents} 
            WHERE ${documents.clientId} = ${clients.id} 
            AND ${documents.uploadDate} > NOW() - INTERVAL '7 days'
          )`,
          hasRecentSessions: sql<boolean>`EXISTS(
            SELECT 1 FROM ${sessions} 
            WHERE ${sessions.clientId} = ${clients.id} 
            AND ${sessions.sessionDate} > NOW() - INTERVAL '7 days'
          )`,
          hasRecentAssessments: sql<boolean>`EXISTS(
            SELECT 1 FROM ${assessments} 
            WHERE ${assessments.clientId} = ${clients.id} 
            AND ${assessments.assessmentDate} > NOW() - INTERVAL '7 days'
          )`
        })
        .from(clients)
        .where(eq(clients.therapistId, therapistId));
      
      // Determine priority based on recency and activity
      return clientsQueue.map(client => {
        let priority = "low";
        
        if (client.hasRecentAssessments) priority = "high";
        else if (client.hasRecentDocuments || client.hasRecentSessions) priority = "medium";
        
        // Increase priority if insights are old
        const daysSinceUpdate = client.lastUpdate ? 
          (Date.now() - client.lastUpdate.getTime()) / (1000 * 60 * 60 * 24) : 999;
        
        if (daysSinceUpdate > 7) {
          priority = priority === "low" ? "medium" : "high";
        }
        
        return {
          clientId: client.clientId,
          priority,
          lastUpdate: client.lastUpdate
        };
      }).sort((a, b) => {
        const priorityOrder = { "high": 3, "medium": 2, "low": 1 };
        return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder];
      });
    } catch (error) {
      console.error('[Storage] Error getting insights generation queue:', error);
      throw new Error('Failed to get insights generation queue');
    }
  }

  // Helper method for trends analysis
  private calculateAssessmentTrends(assessmentData: Assessment[]): any {
    const trends: Record<string, any> = {};
    
    // Group by assessment type
    const byType = assessmentData.reduce((acc, assessment) => {
      const type = assessment.assessmentType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(assessment);
      return acc;
    }, {} as Record<string, Assessment[]>);
    
    // Calculate trends for each type
    Object.entries(byType).forEach(([type, assessments]) => {
      const sorted = assessments.sort((a, b) => 
        new Date(a.assessmentDate).getTime() - new Date(b.assessmentDate).getTime()
      );
      
      if (sorted.length >= 2) {
        const scores = sorted.map(a => {
          const score = (a.scores as any)?.totalScore;
          return typeof score === 'number' ? score : 0;
        });
        
        const firstScore = scores[0];
        const lastScore = scores[scores.length - 1];
        const change = lastScore - firstScore;
        const changePercent = firstScore !== 0 ? (change / firstScore) * 100 : 0;
        
        trends[type] = {
          totalAssessments: sorted.length,
          firstScore,
          lastScore,
          change,
          changePercent,
          trend: change > 0 ? 'worsening' : change < 0 ? 'improving' : 'stable',
          timeSpan: {
            start: sorted[0].assessmentDate,
            end: sorted[sorted.length - 1].assessmentDate
          }
        };
      }
    });
    
    return trends;
  }
}

export const storage = new DatabaseStorage();
