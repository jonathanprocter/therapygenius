import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, generateToken, type AuthenticatedRequest } from "./auth";
import { upload, extractTextFromFile, getFileMimeType, ensureUploadDir, processDocumentWithAutoLinking, DocumentUploadContext } from "./document-processor";
import { analyzeDocument, generateCaseConceptualization, analyzeDocumentForSessionMatching, extractCalendarContext, generateAutoLinkingMetadata } from "./documentTagger";
import { repairDocumentSystem, verifyDocumentIntegrity, cleanupOrphanedFiles } from "./document-fix";
import { insertClientSchema, insertSessionSchema, insertAssessmentSchema, insertTreatmentPlanSchema } from "@shared/schema";
import { z } from "zod";
import cookieParser from "cookie-parser";
import { randomBytes } from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cookieParser());
  
  // Modern CSRF Protection using double-submit cookies
  const generateCSRFToken = () => randomBytes(32).toString('hex');
  
  // CSRF token endpoint
  app.get("/api/csrf-token", (req, res) => {
    const token = generateCSRFToken();
    res.cookie('csrf-token', token, {
      httpOnly: false, // Needs to be readable by frontend
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000 // 1 hour
    });
    res.json({ csrfToken: token });
  });
  
  // CSRF validation middleware
  const validateCSRF = (req: any, res: any, next: any) => {
    const tokenFromHeader = req.headers['x-csrf-token'];
    const tokenFromCookie = req.cookies['csrf-token'];
    
    if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
      return res.status(403).json({ message: "CSRF token validation failed" });
    }
    next();
  };
  
  // Ensure upload directory exists
  await ensureUploadDir();

  // Legacy auth routes - DISABLED for security (single-therapist practice uses simple-login)
  /*
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
  */

  app.post("/api/auth/logout", validateCSRF, (req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
  });

  // Simple password-only login for single-therapist practice
  app.post("/api/auth/simple-login", validateCSRF, async (req, res) => {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password required" });
      }

      // SECURITY FIX: Require strong practice password from environment
      const practicePassword = process.env.PRACTICE_PASSWORD;
      if (!practicePassword) {
        console.error('[SECURITY] PRACTICE_PASSWORD environment variable not set');
        return res.status(500).json({ message: "Server configuration error" });
      }
      
      if (practicePassword.length < 12) {
        console.error('[SECURITY] PRACTICE_PASSWORD is too weak (minimum 12 characters required)');
        return res.status(500).json({ message: "Server configuration error" });
      }
      
      if (password !== practicePassword) {
        return res.status(401).json({ message: "Invalid password" });
      }

      // Get the first/only therapist user
      const therapist = await storage.getUserByUsername("sjohnson_test");
      if (!therapist) {
        return res.status(500).json({ message: "System error: No therapist account found" });
      }

      // Generate token using existing auth helper
      const token = generateToken(therapist.id);

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        message: "Access granted",
        user: {
          id: therapist.id,
          username: therapist.username,
          email: therapist.email,
          firstName: therapist.firstName,
          lastName: therapist.lastName,
        },
      });
    } catch (error) {
      console.error("Simple login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
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

      // Pre-validate image uploads when HIPAA AI is disabled
      const isHIPAACompliant = process.env.HIPAA_SAFE_AI === 'true';
      if (!isHIPAACompliant) {
        const imageFiles = files.filter(file => {
          const mimeType = getFileMimeType(file.originalname);
          return mimeType.startsWith("image/");
        });
        
        if (imageFiles.length > 0) {
          const imageFileNames = imageFiles.map(f => f.originalname).join(", ");
          console.warn(`[Upload] Rejected image uploads due to HIPAA compliance: ${imageFileNames}`);
          return res.status(422).json({ 
            message: "Image uploads are not supported when HIPAA-safe AI is disabled. Please enable HIPAA_SAFE_AI=true to process image documents, or convert your images to text format.",
            rejectedFiles: imageFileNames,
            code: "HIPAA_IMAGE_UPLOAD_BLOCKED"
          });
        }
      }

      const clientId = req.body.clientId || null;
      const sessionId = req.body.sessionId || null;
      const sourceEventId = req.body.sourceEventId || null;
      const manualClientOverride = req.body.manualClientOverride === 'true';
      const results = [];

      for (const file of files) {
        try {
          console.log(`[Upload] Processing file: ${file.originalname}`);
          
          // Create document record
          const document = await storage.createDocument({
            therapistId: req.userId!,
            clientId,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            filePath: file.path,
          });

          // Process document synchronously to return full AutoLinkingResult
          try {
            const mimeType = getFileMimeType(file.originalname);
            const processed = await extractTextFromFile(file.path, mimeType);
            
            // Update document with extracted content first
            const updatedDocument = await storage.updateDocument(document.id, {
              content: processed.content,
              metadata: processed.metadata,
              isProcessed: true,
            }, req.userId!);

            if (updatedDocument) {
              // Perform intelligent auto-linking and return full result
              const context: DocumentUploadContext = {
                therapistId: req.userId!,
                clientId,
                sessionId,
                sourceEventId,
                manualClientOverride
              };

              const autoLinkingResult = await processDocumentWithAutoLinking(updatedDocument, context);
              
              console.log(`[Upload] Document ${document.fileName} processed with auto-linking:`, {
                status: autoLinkingResult.processingStatus,
                sessionMatch: autoLinkingResult.sessionMatch ? `Session ${autoLinkingResult.sessionMatch.sessionId} (${autoLinkingResult.sessionMatch.confidence})` : 'No match',
                potentialMatches: autoLinkingResult.potentialMatches.length
              });

              // Return full AutoLinkingResult payload as required
              results.push({
                id: document.id,
                fileName: document.fileName,
                status: "success",
                autoLinkingResult: {
                  documentId: autoLinkingResult.documentId,
                  sessionMatch: autoLinkingResult.sessionMatch,
                  analysisResults: autoLinkingResult.analysisResults,
                  potentialMatches: autoLinkingResult.potentialMatches,
                  processingStatus: autoLinkingResult.processingStatus,
                  errors: autoLinkingResult.errors
                }
              });
            } else {
              throw new Error('Failed to update document with extracted content');
            }
          } catch (processingError) {
            console.error(`Failed to process document ${document.fileName}:`, processingError);
            
            // Update document with processing error
            await storage.updateDocument(document.id, {
              processingError: processingError instanceof Error ? processingError.message : String(processingError),
            }, req.userId!);

            // Return partial result with error details
            results.push({
              id: document.id,
              fileName: document.fileName,
              status: "failed",
              autoLinkingResult: {
                documentId: document.id,
                potentialMatches: [],
                processingStatus: "failed",
                errors: [processingError instanceof Error ? processingError.message : String(processingError)]
              }
            });
          }
        } catch (error) {
          console.error(`Failed to create document record for ${file.originalname}:`, error);
          results.push({
            fileName: file.originalname,
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Return appropriate HTTP status based on results
      const hasErrors = results.some(r => r.status === "error");
      const hasFailed = results.some(r => r.status === "failed");
      
      if (hasErrors && results.length === 1) {
        // Single file with creation error - return 400
        res.status(400).json({ results });
      } else if (hasFailed || hasErrors) {
        // Some files failed processing - return 207 (Multi-Status)
        res.status(207).json({ results });
      } else {
        // All successful - return 200
        res.json({ results });
      }
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

  // Enhanced Document-Session Linking Endpoints

  // Get potential session matches for a document
  app.get("/api/documents/:id/potential-matches", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const timeWindowHours = req.query.timeWindowHours ? parseInt(req.query.timeWindowHours as string) : 48;
      const potentialMatches = await storage.findPotentialSessionMatches(req.params.id, req.userId!, timeWindowHours);
      res.json({ potentialMatches });
    } catch (error) {
      console.error("Error finding potential session matches:", error);
      res.status(500).json({ message: "Failed to find potential session matches" });
    }
  });

  // Manually link a document to a session
  app.post("/api/documents/:id/link-session", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId, confidence } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      const linkedDocument = await storage.linkDocumentToSession(
        req.params.id,
        sessionId,
        req.userId!,
        confidence
      );

      if (!linkedDocument) {
        return res.status(404).json({ message: "Document or session not found" });
      }

      res.json({ 
        message: "Document linked to session successfully", 
        document: linkedDocument 
      });
    } catch (error) {
      console.error("Error linking document to session:", error);
      res.status(500).json({ message: "Failed to link document to session" });
    }
  });

  // Unlink a document from its session
  app.post("/api/documents/:id/unlink-session", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const unlinkedDocument = await storage.unlinkDocumentFromSession(req.params.id, req.userId!);

      if (!unlinkedDocument) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json({ 
        message: "Document unlinked from session successfully", 
        document: unlinkedDocument 
      });
    } catch (error) {
      console.error("Error unlinking document from session:", error);
      res.status(500).json({ message: "Failed to unlink document from session" });
    }
  });

  // Get documents by session
  app.get("/api/sessions/:sessionId/documents", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const documents = await storage.getDocumentsBySession(req.params.sessionId, req.userId!);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching session documents:", error);
      res.status(500).json({ message: "Failed to fetch session documents" });
    }
  });

  // Get unlinked documents (for manual linking interface)
  app.get("/api/documents/unlinked", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const unlinkedDocuments = await storage.getUnlinkedDocuments(req.userId!, limit);
      res.json(unlinkedDocuments);
    } catch (error) {
      console.error("Error fetching unlinked documents:", error);
      res.status(500).json({ message: "Failed to fetch unlinked documents" });
    }
  });

  // Enhanced AI analysis for document-session matching
  app.post("/api/documents/:id/analyze-session-matches", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { potentialSessionIds } = req.body;
      
      if (!potentialSessionIds || !Array.isArray(potentialSessionIds)) {
        return res.status(400).json({ message: "Array of potential session IDs is required" });
      }

      const document = await storage.getDocumentById(req.params.id, req.userId!);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Get session details for analysis
      const potentialSessions = [];
      for (const sessionId of potentialSessionIds) {
        const sessionData = await storage.getSessionsByClient('', req.userId!); // Will be filtered by session ID logic
        const session = sessionData.find(s => s.id === sessionId);
        if (session) {
          potentialSessions.push({
            id: session.id,
            sessionDate: session.sessionDate,
            notes: session.notes,
            sessionType: session.sessionType
          });
        }
      }

      const analysisResults = await analyzeDocumentForSessionMatching(
        document,
        potentialSessions,
        req.userId!
      );

      res.json({ analysisResults });
    } catch (error) {
      console.error("Error analyzing session matches:", error);
      res.status(500).json({ message: "Failed to analyze session matches" });
    }
  });

  // Extract calendar context from document
  app.post("/api/documents/:id/extract-calendar-context", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const document = await storage.getDocumentById(req.params.id, req.userId!);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const calendarContext = await extractCalendarContext(document, req.userId!);
      res.json({ calendarContext });
    } catch (error) {
      console.error("Error extracting calendar context:", error);
      res.status(500).json({ message: "Failed to extract calendar context" });
    }
  });

  // Generate auto-linking metadata and recommendations
  app.get("/api/documents/:id/auto-linking-metadata", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const document = await storage.getDocumentById(req.params.id, req.userId!);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!document.analysis) {
        return res.status(400).json({ message: "Document has not been analyzed yet" });
      }

      const autoLinkingMetadata = await generateAutoLinkingMetadata(
        document,
        document.analysis as any,
        req.userId!
      );

      res.json({ autoLinkingMetadata });
    } catch (error) {
      console.error("Error generating auto-linking metadata:", error);
      res.status(500).json({ message: "Failed to generate auto-linking metadata" });
    }
  });

  // Bulk re-analyze documents for auto-linking
  app.post("/api/documents/bulk-reanalyze", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { documentIds, includeLinked } = req.body;
      
      if (!documentIds || !Array.isArray(documentIds)) {
        return res.status(400).json({ message: "Array of document IDs is required" });
      }

      const results = [];
      
      for (const documentId of documentIds) {
        try {
          const document = await storage.getDocumentById(documentId, req.userId!);
          if (!document) {
            results.push({ documentId, status: 'not_found' });
            continue;
          }

          // Skip already linked documents unless specifically requested
          if (document.sessionId && !includeLinked) {
            results.push({ documentId, status: 'skipped_linked' });
            continue;
          }

          // Re-analyze with auto-linking
          const context: DocumentUploadContext = {
            therapistId: req.userId!,
            clientId: document.clientId || undefined
          };

          const autoLinkingResult = await processDocumentWithAutoLinking(document, context);
          results.push({ 
            documentId, 
            status: autoLinkingResult.processingStatus,
            sessionMatch: autoLinkingResult.sessionMatch,
            potentialMatches: autoLinkingResult.potentialMatches.length
          });
        } catch (error) {
          results.push({ 
            documentId, 
            status: 'error', 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error bulk re-analyzing documents:", error);
      res.status(500).json({ message: "Failed to bulk re-analyze documents" });
    }
  });

  // Session routes
  app.get("/api/sessions/client/:clientId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const includeDocuments = req.query.includeDocuments === 'true';
      const sessions = await storage.getSessionsByClient(req.params.clientId, req.userId!);
      
      if (includeDocuments) {
        // Enhance sessions with linked document information
        const enhancedSessions = await Promise.all(
          sessions.map(async (session) => {
            const documents = await storage.getDocumentsBySession(session.id, req.userId!);
            return {
              ...session,
              linkedDocuments: documents,
              documentCount: documents.length
            };
          })
        );
        res.json(enhancedSessions);
      } else {
        res.json(sessions);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/recent", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const includeDocuments = req.query.includeDocuments === 'true';
      const sessions = await storage.getSessionsByTherapist(req.userId!, limit);
      
      if (includeDocuments) {
        // Enhance sessions with linked document counts
        const enhancedSessions = await Promise.all(
          sessions.map(async (session) => {
            const documents = await storage.getDocumentsBySession(session.id, req.userId!);
            return {
              ...session,
              documentCount: documents.length,
              hasLinkedDocuments: documents.length > 0
            };
          })
        );
        res.json(enhancedSessions);
      } else {
        res.json(sessions);
      }
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

  // Calendar integration routes
  app.get("/api/calendar/auth", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const calendarModule = await import("./calendar-sync");
      const authUrl = calendarModule.calendarSync.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating calendar auth URL:", error);
      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  app.get("/api/calendar/callback", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { code } = req.query;
      
      if (!code || typeof code !== "string") {
        return res.status(400).json({ message: "Authorization code required" });
      }

      const calendarModule = await import("./calendar-sync");
      await calendarModule.calendarSync.exchangeCodeForTokens(code, req.userId!);
      
      res.json({ 
        message: "Google Calendar successfully connected",
        success: true 
      });
    } catch (error) {
      console.error("Error handling calendar OAuth callback:", error);
      res.status(500).json({ 
        message: "Failed to connect Google Calendar",
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.post("/api/calendar/sync", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const calendarModule = await import("./calendar-sync");
      const syncStatus = await calendarModule.calendarSync.syncCalendar(req.userId!);
      res.json(syncStatus);
    } catch (error) {
      console.error("Error syncing calendar:", error);
      res.status(500).json({ 
        message: "Calendar sync failed",
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.get("/api/calendar/status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const calendarModule = await import("./calendar-sync");
      const status = await calendarModule.calendarSync.getSyncStatus(req.userId!);
      res.json(status);
    } catch (error) {
      console.error("Error getting calendar status:", error);
      res.status(500).json({ 
        message: "Failed to get calendar status",
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.delete("/api/calendar/disconnect", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const calendarModule = await import("./calendar-sync");
      await calendarModule.calendarSync.revokeAccess(req.userId!);
      res.json({ message: "Google Calendar disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
      res.status(500).json({ 
        message: "Failed to disconnect calendar",
        error: error instanceof Error ? error.message : String(error) 
      });
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
