import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, generateToken, type AuthenticatedRequest } from "./auth";
import { upload, extractTextFromFile, getFileMimeType, ensureUploadDir } from "./document-processor";
import { analyzeDocument, generateCaseConceptualization } from "./documentTagger";
import { repairDocumentSystem, verifyDocumentIntegrity, cleanupOrphanedFiles } from "./document-fix";
import { insertClientSchema, insertSessionSchema, insertAssessmentSchema, insertTreatmentPlanSchema } from "@shared/schema";
import { z } from "zod";
import cookieParser from "cookie-parser";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cookieParser());
  
  // Ensure upload directory exists
  await ensureUploadDir();

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await storage.verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = generateToken(user.id);
      
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password, firstName, lastName } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ message: "Username, email, and password required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        username,
        email,
        password,
        firstName,
        lastName,
      });

      const token = generateToken(user.id);
      
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        token,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res) => {
    res.json({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
    });
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storage.getDashboardStats(req.userId!);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Client routes
  app.get("/api/clients", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const clients = await storage.getClientsByTherapist(req.userId!);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const client = await storage.getClientById(req.params.id, req.userId!);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const clientData = insertClientSchema.parse({
        ...req.body,
        therapistId: req.userId,
      });
      
      const client = await storage.createClient(clientData);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body, req.userId!);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const deleted = await storage.deleteClient(req.params.id, req.userId!);
      if (!deleted) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Document routes
  app.get("/api/documents", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const documents = await storage.getDocumentsByTherapist(req.userId!, limit);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/client/:clientId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const documents = await storage.getDocumentsByClient(req.params.clientId, req.userId!);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching client documents:", error);
      res.status(500).json({ message: "Failed to fetch client documents" });
    }
  });

  app.get("/api/documents/search", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query required" });
      }
      
      const documents = await storage.searchDocuments(query, req.userId!);
      res.json(documents);
    } catch (error) {
      console.error("Error searching documents:", error);
      res.status(500).json({ message: "Failed to search documents" });
    }
  });

  app.post("/api/documents/upload", requireAuth, upload.array("files", 10), async (req: AuthenticatedRequest, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const clientId = req.body.clientId || null;
      const results = [];

      for (const file of files) {
        try {
          // Create document record
          const document = await storage.createDocument({
            therapistId: req.userId!,
            clientId,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            filePath: file.path,
          });

          results.push({
            id: document.id,
            fileName: document.fileName,
            status: "uploaded",
          });

          // Process document asynchronously
          setImmediate(async () => {
            try {
              const mimeType = getFileMimeType(file.originalname);
              const processed = await extractTextFromFile(file.path, mimeType);
              
              const analysis = await analyzeDocument({
                ...document,
                content: processed.content,
              }, req.userId!);

              await storage.updateDocument(document.id, {
                content: processed.content,
                metadata: {
                  ...processed.metadata,
                  analysis,
                },
                isProcessed: true,
              }, req.userId!);

              console.log(`Document processed: ${document.fileName}`);
            } catch (error) {
              console.error(`Failed to process document ${document.fileName}:`, error);
              await storage.updateDocument(document.id, {
                processingError: error.message,
              }, req.userId!);
            }
          });
        } catch (error) {
          console.error(`Failed to create document record for ${file.originalname}:`, error);
          results.push({
            fileName: file.originalname,
            status: "error",
            error: error.message,
          });
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ message: "Failed to upload documents" });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const deleted = await storage.deleteDocument(req.params.id, req.userId!);
      if (!deleted) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Session routes
  app.get("/api/sessions/client/:clientId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const sessions = await storage.getSessionsByClient(req.params.clientId, req.userId!);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/recent", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const sessions = await storage.getSessionsByTherapist(req.userId!, limit);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching recent sessions:", error);
      res.status(500).json({ message: "Failed to fetch recent sessions" });
    }
  });

  app.post("/api/sessions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const sessionData = insertSessionSchema.parse({
        ...req.body,
        therapistId: req.userId,
      });
      
      const session = await storage.createSession(sessionData);
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid session data", errors: error.errors });
      }
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  // Assessment routes
  app.get("/api/assessments/client/:clientId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const assessments = await storage.getAssessmentsByClient(req.params.clientId, req.userId!);
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      res.status(500).json({ message: "Failed to fetch assessments" });
    }
  });

  app.post("/api/assessments", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const assessmentData = insertAssessmentSchema.parse({
        ...req.body,
        therapistId: req.userId,
      });
      
      const assessment = await storage.createAssessment(assessmentData);
      res.status(201).json(assessment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid assessment data", errors: error.errors });
      }
      console.error("Error creating assessment:", error);
      res.status(500).json({ message: "Failed to create assessment" });
    }
  });

  // Treatment Plan routes
  app.get("/api/treatment-plans/client/:clientId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const plans = await storage.getTreatmentPlansByClient(req.params.clientId, req.userId!);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching treatment plans:", error);
      res.status(500).json({ message: "Failed to fetch treatment plans" });
    }
  });

  app.post("/api/treatment-plans", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const planData = insertTreatmentPlanSchema.parse({
        ...req.body,
        therapistId: req.userId,
      });
      
      const plan = await storage.createTreatmentPlan(planData);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid treatment plan data", errors: error.errors });
      }
      console.error("Error creating treatment plan:", error);
      res.status(500).json({ message: "Failed to create treatment plan" });
    }
  });

  // AI features routes
  app.post("/api/ai/case-conceptualization/:clientId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const conceptualization = await generateCaseConceptualization(req.params.clientId, req.userId!);
      res.json(conceptualization);
    } catch (error) {
      console.error("Error generating case conceptualization:", error);
      res.status(500).json({ message: "Failed to generate case conceptualization" });
    }
  });

  // System maintenance routes
  app.post("/api/system/repair-documents", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await repairDocumentSystem();
      res.json(result);
    } catch (error) {
      console.error("Error repairing document system:", error);
      res.status(500).json({ message: "Failed to repair document system" });
    }
  });

  app.get("/api/system/verify-integrity", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await verifyDocumentIntegrity();
      res.json(result);
    } catch (error) {
      console.error("Error verifying document integrity:", error);
      res.status(500).json({ message: "Failed to verify document integrity" });
    }
  });

  app.post("/api/system/cleanup-files", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await cleanupOrphanedFiles();
      res.json(result);
    } catch (error) {
      console.error("Error cleaning up files:", error);
      res.status(500).json({ message: "Failed to cleanup files" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
