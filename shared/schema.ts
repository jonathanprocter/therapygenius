import { sql } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  timestamp, 
  uuid, 
  integer, 
  boolean, 
  jsonb,
  decimal
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users/Therapists table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  licenseNumber: varchar("license_number", { length: 50 }),
  // Google Calendar OAuth integration - ENCRYPTED storage
  encryptedOAuthTokens: text("encrypted_oauth_tokens"), // AES-256-GCM encrypted token storage
  // Calendar sync tracking
  lastCalendarSync: timestamp("last_calendar_sync"),
  calendarSyncStats: jsonb("calendar_sync_stats"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Clients table
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  therapistId: uuid("therapist_id").notNull().references(() => users.id),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: timestamp("date_of_birth"),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  // Additional demographic fields
  sex: varchar("sex", { length: 20 }),
  genderIdentity: varchar("gender_identity", { length: 50 }),
  race: varchar("race", { length: 50 }),
  relationshipStatus: varchar("relationship_status", { length: 50 }),
  employment: varchar("employment", { length: 50 }),
  language: varchar("language", { length: 50 }),
  location: varchar("location", { length: 200 }),
  emergencyContact: jsonb("emergency_contact"),
  insuranceInfo: jsonb("insurance_info"),
  // AI integration field
  aiTags: jsonb("ai_tags"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Documents table
// HIPAA Audit Logs table - tamper-evident, persistent logging
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  operation: varchar("operation", { length: 100 }).notNull(),
  therapistId: uuid("therapist_id").references(() => users.id),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  provider: varchar("provider", { length: 50 }), // ai, calendar, auth
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Rate limiting counters table - persistent rate limiting
export const rateLimitCounters = pgTable("rate_limit_counters", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  therapistId: uuid("therapist_id").notNull().references(() => users.id),
  endpoint: varchar("endpoint", { length: 100 }).notNull(),
  requests: integer("requests").notNull().default(0),
  resetTime: timestamp("reset_time").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  therapistId: uuid("therapist_id").notNull().references(() => users.id),
  clientId: uuid("client_id").references(() => clients.id),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  uploadDate: timestamp("upload_date").defaultNow(),
  content: text("content"),
  metadata: jsonb("metadata"),
  isProcessed: boolean("is_processed").default(false),
  processingError: text("processing_error"),
  // AI integration and session linking fields
  sessionId: uuid("session_id").references(() => sessions.id),
  analysis: jsonb("analysis"),
  tags: jsonb("tags"),
  sourceEventId: text("source_event_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sessions table
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  therapistId: uuid("therapist_id").notNull().references(() => users.id),
  sessionDate: timestamp("session_date").notNull(),
  duration: integer("duration"), // minutes
  sessionType: varchar("session_type", { length: 50 }), // individual, group, family
  notes: text("notes"),
  interventionsUsed: jsonb("interventions_used"),
  homework: text("homework"),
  nextSessionPlan: text("next_session_plan"),
  // Calendar integration and AI fields
  externalEventId: text("external_event_id"),
  sourceCalendar: text("source_calendar"),
  aiTags: jsonb("ai_tags"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Assessments table
export const assessments = pgTable("assessments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  therapistId: uuid("therapist_id").notNull().references(() => users.id),
  assessmentType: varchar("assessment_type", { length: 100 }).notNull(),
  assessmentDate: timestamp("assessment_date").notNull(),
  scores: jsonb("scores").notNull(),
  interpretation: text("interpretation"),
  recommendations: text("recommendations"),
  // AI assessment metadata for provenance tracking
  metadata: jsonb("metadata"), // { sourceDocumentId, model, confidence, instrument, version, extractionMethod }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Treatment Plans table
export const treatmentPlans = pgTable("treatment_plans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  therapistId: uuid("therapist_id").notNull().references(() => users.id),
  startDate: timestamp("start_date").notNull(),
  reviewDate: timestamp("review_date"),
  diagnosis: jsonb("diagnosis"),
  goals: jsonb("goals"),
  interventions: jsonb("interventions"),
  progressMetrics: jsonb("progress_metrics"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  clients: many(clients),
  documents: many(documents),
  sessions: many(sessions),
  assessments: many(assessments),
  treatmentPlans: many(treatmentPlans),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  therapist: one(users, {
    fields: [clients.therapistId],
    references: [users.id],
  }),
  documents: many(documents),
  sessions: many(sessions),
  assessments: many(assessments),
  treatmentPlans: many(treatmentPlans),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  therapist: one(users, {
    fields: [documents.therapistId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [documents.clientId],
    references: [clients.id],
  }),
  session: one(sessions, {
    fields: [documents.sessionId],
    references: [sessions.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  client: one(clients, {
    fields: [sessions.clientId],
    references: [clients.id],
  }),
  therapist: one(users, {
    fields: [sessions.therapistId],
    references: [users.id],
  }),
  documents: many(documents),
}));

export const assessmentsRelations = relations(assessments, ({ one }) => ({
  client: one(clients, {
    fields: [assessments.clientId],
    references: [clients.id],
  }),
  therapist: one(users, {
    fields: [assessments.therapistId],
    references: [users.id],
  }),
}));

export const treatmentPlansRelations = relations(treatmentPlans, ({ one }) => ({
  client: one(clients, {
    fields: [treatmentPlans.clientId],
    references: [clients.id],
  }),
  therapist: one(users, {
    fields: [treatmentPlans.therapistId],
    references: [users.id],
  }),
}));

// Insert schemas
// Audit logs and rate limiting insert schemas
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertRateLimitCounterSchema = createInsertSchema(rateLimitCounters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dateOfBirth: z.coerce.date().nullable(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTreatmentPlanSchema = createInsertSchema(treatmentPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;

export type TreatmentPlan = typeof treatmentPlans.$inferSelect;
export type InsertTreatmentPlan = z.infer<typeof insertTreatmentPlanSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type RateLimitCounter = typeof rateLimitCounters.$inferSelect;
export type InsertRateLimitCounter = z.infer<typeof insertRateLimitCounterSchema>;

// Dashboard stats interface
export interface DashboardStats {
  activeClients: string | number;
  weekSessions: string | number;
  documentsProcessed: string | number;
  completedGoals: {
    completed: number;
    total: number;
  } | null;
}
