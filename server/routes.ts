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

  // Simple password-only login for single-therapist practice - PASSWORD REMOVED FOR DIRECT ACCESS
  app.post("/api/auth/simple-login", async (req, res) => {
    try {
      // PASSWORD AUTHENTICATION REMOVED - Direct access granted

      // Get the first/only therapist user
      const therapist = await storage.getUserByUsername("jonathan.procter@gmail.com");
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

  app.post("/api/clients", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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

  app.put("/api/clients/:id", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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

  app.delete("/api/clients/:id", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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

  app.post("/api/documents/upload", validateCSRF, requireAuth, upload.array("files", 10), async (req: AuthenticatedRequest, res) => {
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

  app.delete("/api/documents/:id", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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
  app.post("/api/documents/:id/link-session", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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
  app.post("/api/documents/:id/unlink-session", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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
  app.post("/api/documents/:id/analyze-session-matches", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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
            notes: session.notes || undefined,
            sessionType: session.sessionType || undefined
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
  app.post("/api/documents/:id/extract-calendar-context", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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
  app.post("/api/documents/bulk-reanalyze", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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

  // GET /api/sessions/:id - Get session details with AI tags
  app.get("/api/sessions/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getSessionById(id, req.userId!);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Get AI tags for this session
      const aiTags = await storage.getSessionAITags(session.id, req.userId!);
      
      // Get linked documents
      const linkedDocuments = await storage.getDocumentsBySession(session.id, req.userId!);
      
      // Return enhanced session with AI tags and document info
      const enhancedSession = {
        ...session,
        aiTags,
        linkedDocuments: linkedDocuments.map(doc => ({
          id: doc.id,
          fileName: doc.fileName,
          fileType: doc.fileType,
          uploadDate: doc.uploadDate,
          analysis: doc.analysis
        })),
        documentCount: linkedDocuments.length,
        hasAITags: aiTags && Object.keys(aiTags).length > 0,
        hasLinkedDocuments: linkedDocuments.length > 0
      };
      
      res.json(enhancedSession);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ message: "Failed to fetch session" });
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

  app.post("/api/sessions", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const sessionData = insertSessionSchema.parse({
        ...req.body,
        therapistId: req.userId,
      });
      
      const session = await storage.createSession(sessionData);
      
      // Automatic AI Tagging Trigger for new sessions
      try {
        if (session.notes && session.notes.trim().length > 0) {
          // Generate session AI tags asynchronously (don't block response)
          setImmediate(async () => {
            try {
              const { sessionTagger } = await import('./sessionTagger');
              const sessionTags = await sessionTagger.generateSessionTags(session.id, req.userId!);
              await storage.updateSessionAITags(session.id, sessionTags, req.userId!);
              
              // Update client tags based on new session
              const { clientTagger } = await import('./clientTagger');
              await clientTagger.updateClientTagsForNewSession(session.clientId, req.userId!, session.id);
              
              console.log(`[AutoTrigger] AI tags generated for new session ${session.id}`);
            } catch (aiError) {
              console.error(`[AutoTrigger] Failed to generate AI tags for session ${session.id}:`, aiError);
            }
          });
        }
      } catch (triggerError) {
        console.error("Auto-trigger setup failed (non-blocking):", triggerError);
      }
      
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid session data", errors: error.errors });
      }
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  // Session update endpoint with automatic AI tagging triggers
  app.put("/api/sessions/:id", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const sessionData = insertSessionSchema.partial().parse(req.body);
      
      const updatedSession = await storage.updateSession(id, sessionData, req.userId!);
      
      if (!updatedSession) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Automatic AI Tagging Trigger for updated sessions
      try {
        if (sessionData.notes !== undefined && updatedSession.notes && updatedSession.notes.trim().length > 0) {
          // Regenerate session AI tags asynchronously (don't block response)
          setImmediate(async () => {
            try {
              const { sessionTagger } = await import('./sessionTagger');
              const sessionTags = await sessionTagger.regenerateSessionTags(updatedSession.id, req.userId!);
              
              // CRITICAL FIX: Explicit persistence call to ensure tags are saved to database
              await storage.updateSessionAITags(updatedSession.id, sessionTags, req.userId!);
              console.log(`[AutoTrigger] [PERSISTENCE] Session AI tags explicitly persisted for session ${updatedSession.id}`);
              
              // Update client tags based on session changes
              const { clientTagger } = await import('./clientTagger');
              await clientTagger.updateClientTagsForNewSession(updatedSession.clientId, req.userId!, updatedSession.id);
              
              console.log(`[AutoTrigger] AI tags regenerated and persisted for updated session ${updatedSession.id}`);
            } catch (aiError) {
              console.error(`[AutoTrigger] [CRITICAL] Failed to regenerate and persist AI tags for session ${updatedSession.id}:`, aiError);
              
              // Additional error context for debugging
              console.error(`[AutoTrigger] [CRITICAL] Session ID: ${updatedSession.id}, User ID: ${req.userId}, Error details:`, {
                message: aiError instanceof Error ? aiError.message : String(aiError),
                stack: aiError instanceof Error ? aiError.stack : undefined,
                timestamp: new Date().toISOString()
              });
            }
          });
        }
      } catch (triggerError) {
        console.error("Auto-trigger setup failed (non-blocking):", triggerError);
      }
      
      res.json(updatedSession);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid session data", errors: error.errors });
      }
      console.error("Error updating session:", error);
      res.status(500).json({ message: "Failed to update session" });
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

  app.post("/api/calendar/sync", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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

  // GET /api/calendar/stats - Calendar sync statistics for dashboard
  app.get("/api/calendar/stats", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const calendarModule = await import("./calendar-sync");
      const stats = await calendarModule.calendarSync.getSyncStatus(req.userId!);
      
      // Transform status into stats format expected by UI
      const calendarStats = {
        isConnected: stats.isAuthenticated,
        lastSync: stats.lastSync,
        eventsProcessed: stats.eventsProcessed || 0,
        sessionsMatched: stats.matchesFound || 0,
        errors: stats.errors || [],
        nextSync: stats.nextSync,
        syncHealth: stats.errors && stats.errors.length > 0 ? "error" : 
                   stats.isAuthenticated ? "healthy" : "disconnected",
        rateLimitRemaining: stats.rateLimitRemaining,
        quotaUsed: stats.quotaUsed,
        totalEvents: stats.eventsProcessed || 0,
        successRate: stats.eventsProcessed > 0 ? 
          Math.round(((stats.eventsProcessed - (stats.errors?.length || 0)) / stats.eventsProcessed) * 100) : 0
      };
      
      res.json(calendarStats);
    } catch (error) {
      console.error("Error getting calendar stats:", error);
      res.status(500).json({ 
        message: "Failed to get calendar stats",
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.delete("/api/calendar/disconnect", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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

  app.post("/api/assessments", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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

  app.post("/api/treatment-plans", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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
  app.post("/api/ai/case-conceptualization/:clientId", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const conceptualization = await generateCaseConceptualization(req.params.clientId, req.userId!);
      res.json(conceptualization);
    } catch (error) {
      console.error("Error generating case conceptualization:", error);
      res.status(500).json({ message: "Failed to generate case conceptualization" });
    }
  });

  // System maintenance routes
  app.post("/api/system/repair-documents", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
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

  app.post("/api/system/cleanup-files", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await cleanupOrphanedFiles();
      res.json(result);
    } catch (error) {
      console.error("Error cleaning up files:", error);
      res.status(500).json({ message: "Failed to cleanup files" });
    }
  });

  // ==========================================
  // AI TAGGING SYSTEM ENDPOINTS
  // ==========================================

  // Session AI Tagging Endpoints
  app.post("/api/sessions/:sessionId/ai-tags/generate", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const therapistId = req.user.id;

      const tags = await storage.generateSessionAITags(sessionId, therapistId);
      await storage.updateSessionAITags(sessionId, tags, therapistId);

      res.json({
        success: true,
        sessionId,
        tags,
        message: "Session AI tags generated successfully"
      });
    } catch (error) {
      console.error("Error generating session AI tags:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to generate session AI tags",
        error: (error as any)?.message 
      });
    }
  });

  app.get("/api/sessions/:sessionId/ai-tags", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const therapistId = req.user.id;

      const tags = await storage.getSessionAITags(sessionId, therapistId);
      
      res.json({
        success: true,
        sessionId,
        tags,
        hasAITags: !!tags
      });
    } catch (error) {
      console.error("Error getting session AI tags:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to get session AI tags" 
      });
    }
  });

  app.put("/api/sessions/:sessionId/ai-tags", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { tags } = req.body;
      const therapistId = req.user.id;

      const updatedSession = await storage.updateSessionAITags(sessionId, tags, therapistId);
      
      if (!updatedSession) {
        return res.status(404).json({ 
          success: false,
          message: "Session not found" 
        });
      }

      res.json({
        success: true,
        sessionId,
        tags: updatedSession.aiTags,
        message: "Session AI tags updated successfully"
      });
    } catch (error) {
      console.error("Error updating session AI tags:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to update session AI tags" 
      });
    }
  });

  app.post("/api/sessions/:sessionId/ai-tags/regenerate", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const therapistId = req.user.id;

      const { sessionTagger } = await import('./sessionTagger');
      const tags = await sessionTagger.regenerateSessionTags(sessionId, therapistId);

      res.json({
        success: true,
        sessionId,
        tags,
        message: "Session AI tags regenerated successfully"
      });
    } catch (error) {
      console.error("Error regenerating session AI tags:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to regenerate session AI tags" 
      });
    }
  });

  // Client AI Tagging Endpoints
  app.post("/api/clients/:clientId/ai-tags/generate", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = req.user.id;

      const tags = await storage.generateClientAITags(clientId, therapistId);
      await storage.updateClientAITags(clientId, tags, therapistId);

      res.json({
        success: true,
        clientId,
        tags,
        message: "Client AI tags generated successfully"
      });
    } catch (error) {
      console.error("Error generating client AI tags:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to generate client AI tags",
        error: (error as any)?.message 
      });
    }
  });

  app.get("/api/clients/:clientId/ai-tags", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = req.user.id;

      const tags = await storage.getClientAITags(clientId, therapistId);
      
      res.json({
        success: true,
        clientId,
        tags,
        hasAITags: !!tags
      });
    } catch (error) {
      console.error("Error getting client AI tags:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to get client AI tags" 
      });
    }
  });

  app.put("/api/clients/:clientId/ai-tags", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { clientId } = req.params;
      const { tags } = req.body;
      const therapistId = req.user.id;

      const updatedClient = await storage.updateClientAITags(clientId, tags, therapistId);
      
      if (!updatedClient) {
        return res.status(404).json({ 
          success: false,
          message: "Client not found" 
        });
      }

      res.json({
        success: true,
        clientId,
        tags: updatedClient.aiTags,
        message: "Client AI tags updated successfully"
      });
    } catch (error) {
      console.error("Error updating client AI tags:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to update client AI tags" 
      });
    }
  });

  app.post("/api/clients/:clientId/ai-tags/regenerate", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = req.user.id;

      const { clientTagger } = await import('./clientTagger');
      const tags = await clientTagger.regenerateClientTags(clientId, therapistId);

      res.json({
        success: true,
        clientId,
        tags,
        message: "Client AI tags regenerated successfully"
      });
    } catch (error) {
      console.error("Error regenerating client AI tags:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to regenerate client AI tags" 
      });
    }
  });

  // Bulk AI Tagging Operations
  app.post("/api/ai-tags/bulk/sessions", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionIds } = req.body;
      const therapistId = req.user.id;

      if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: "sessionIds array is required" 
        });
      }

      const results = await storage.bulkGenerateSessionTags(sessionIds, therapistId);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        processed: results.length,
        successCount,
        failureCount,
        results,
        message: `Bulk session tagging completed: ${successCount} successful, ${failureCount} failed`
      });
    } catch (error) {
      console.error("Error in bulk session tagging:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to perform bulk session tagging" 
      });
    }
  });

  app.post("/api/ai-tags/bulk/clients", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { clientIds } = req.body;
      const therapistId = req.user.id;

      if (!Array.isArray(clientIds) || clientIds.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: "clientIds array is required" 
        });
      }

      const results = await storage.bulkGenerateClientTags(clientIds, therapistId);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        processed: results.length,
        successCount,
        failureCount,
        results,
        message: `Bulk client tagging completed: ${successCount} successful, ${failureCount} failed`
      });
    } catch (error) {
      console.error("Error in bulk client tagging:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to perform bulk client tagging" 
      });
    }
  });

  // Search and Filtering Endpoints
  app.get("/api/search/sessions-by-tags", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { tags } = req.query;
      const therapistId = req.user.id;

      if (!tags) {
        return res.status(400).json({ 
          success: false,
          message: "tags parameter is required" 
        });
      }

      const tagArray = Array.isArray(tags) ? tags as string[] : [tags as string];
      const sessions = await storage.searchSessionsByTags(tagArray, therapistId);

      res.json({
        success: true,
        tags: tagArray,
        sessionCount: sessions.length,
        sessions
      });
    } catch (error) {
      console.error("Error searching sessions by tags:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to search sessions by tags" 
      });
    }
  });

  app.get("/api/search/clients-by-tags", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { tags } = req.query;
      const therapistId = req.user.id;

      if (!tags) {
        return res.status(400).json({ 
          success: false,
          message: "tags parameter is required" 
        });
      }

      const tagArray = Array.isArray(tags) ? tags as string[] : [tags as string];
      const clients = await storage.searchClientsByTags(tagArray, therapistId);

      res.json({
        success: true,
        tags: tagArray,
        clientCount: clients.length,
        clients
      });
    } catch (error) {
      console.error("Error searching clients by tags:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to search clients by tags" 
      });
    }
  });

  // AI Insights and Analytics Endpoints
  app.get("/api/clients/:clientId/session-trends", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { clientId } = req.params;
      const { startDate, endDate } = req.query;
      const therapistId = req.user.id;

      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }

      const trends = await storage.getSessionTagTrends(clientId, therapistId, timeRange);

      res.json({
        success: true,
        clientId,
        timeRange,
        trends
      });
    } catch (error) {
      console.error("Error getting session trends:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to get session trends" 
      });
    }
  });

  app.get("/api/clients/:clientId/progress-insights", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = req.user.id;

      const insights = await storage.getClientProgressInsights(clientId, therapistId);

      res.json({
        success: true,
        clientId,
        insights
      });
    } catch (error) {
      console.error("Error getting client progress insights:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to get client progress insights" 
      });
    }
  });

  app.get("/api/ai-insights/clinical-summary", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const therapistId = req.user.id;

      const summary = await storage.getClinicalInsightsSummary(therapistId);

      res.json({
        success: true,
        summary
      });
    } catch (error) {
      console.error("Error getting clinical insights summary:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to get clinical insights summary" 
      });
    }
  });

  app.get("/api/clients/:clientId/comprehensive-report", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = req.user.id;

      const { clientTagger } = await import('./clientTagger');
      const report = await clientTagger.getClientProgressReport(clientId, therapistId);

      res.json({
        success: true,
        clientId,
        report
      });
    } catch (error) {
      console.error("Error getting comprehensive client report:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to get comprehensive client report" 
      });
    }
  });

  // Enhanced Case Conceptualization Endpoint
  app.post("/api/clients/:clientId/case-conceptualization", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = req.user.id;

      const conceptualization = await generateCaseConceptualization(clientId, therapistId);

      res.json({
        success: true,
        clientId,
        conceptualization,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating enhanced case conceptualization:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to generate enhanced case conceptualization",
        error: (error as any)?.message 
      });
    }
  });

  // Session Trend Analysis Endpoint
  app.get("/api/clients/:clientId/session-analysis", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = req.user.id;

      const { sessionTagger } = await import('./sessionTagger');
      const analysis = await sessionTagger.analyzeSessionTrends(clientId, therapistId);

      res.json({
        success: true,
        clientId,
        analysis
      });
    } catch (error) {
      console.error("Error analyzing session trends:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to analyze session trends" 
      });
    }
  });

  // Automatic Tag Generation Trigger Endpoint (for when sessions are updated)
  app.post("/api/sessions/:sessionId/trigger-ai-update", validateCSRF, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const therapistId = req.user.id;

      // Get session to find client ID
      const session = await storage.getSessionById(sessionId, therapistId);
      if (!session) {
        return res.status(404).json({ 
          success: false,
          message: "Session not found" 
        });
      }

      // Regenerate session tags
      const { sessionTagger } = await import('./sessionTagger');
      const sessionTags = await sessionTagger.regenerateSessionTags(sessionId, therapistId);

      // Update client tags based on new session data
      const { clientTagger } = await import('./clientTagger');
      await clientTagger.updateClientTagsForNewSession(session.clientId, therapistId, sessionId);

      res.json({
        success: true,
        sessionId,
        clientId: session.clientId,
        sessionTags,
        message: "AI tags updated for session and client"
      });
    } catch (error) {
      console.error("Error triggering AI update:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to trigger AI update" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
