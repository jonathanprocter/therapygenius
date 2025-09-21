import {
  users,
  clients,
  documents,
  sessions,
  assessments,
  treatmentPlans,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, like, or, sql } from "drizzle-orm";
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
  getSessionsByClient(clientId: string, therapistId: string): Promise<Session[]>;
  getSessionsByTherapist(therapistId: string, limit?: number): Promise<Session[]>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, session: Partial<Session>, therapistId: string): Promise<Session | undefined>;

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
    return result.rowCount > 0;
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
    return result.rowCount > 0;
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

  async updateSession(id: string, session: Partial<Session>, therapistId: string): Promise<Session | undefined> {
    const [updatedSession] = await db
      .update(sessions)
      .set({ ...session, updatedAt: new Date() })
      .where(and(eq(sessions.id, id), eq(sessions.therapistId, therapistId)))
      .returning();
    return updatedSession;
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
}

export const storage = new DatabaseStorage();
