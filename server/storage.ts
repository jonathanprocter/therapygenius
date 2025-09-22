import {
  users,
  clients,
  documents,
  sessions,
  assessments,
  treatmentPlans,
  auditLogs,
  rateLimitCounters,
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

  // Session operations
  getSessionById(id: string, therapistId: string): Promise<Session | undefined>;
  getSessionsByClient(clientId: string, therapistId: string): Promise<Session[]>;
  getSessionsByTherapist(therapistId: string, limit?: number): Promise<Session[]>;
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
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Active clients count
    const [activeClientsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(eq(clients.therapistId, therapistId));

    // Sessions this week
    const [weekSessionsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          sql`${sessions.sessionDate} >= ${oneWeekAgo}`
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
}

export const storage = new DatabaseStorage();
