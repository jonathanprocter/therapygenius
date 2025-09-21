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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Documents table
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
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  client: one(clients, {
    fields: [sessions.clientId],
    references: [clients.id],
  }),
  therapist: one(users, {
    fields: [sessions.therapistId],
    references: [users.id],
  }),
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
