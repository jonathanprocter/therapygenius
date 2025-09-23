import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { upload, extractTextFromFile, getFileMimeType, ensureUploadDir, processDocumentWithAutoLinking, DocumentUploadContext } from "./document-processor";
import { analyzeDocument, generateCaseConceptualization, analyzeDocumentForSessionMatching, extractCalendarContext, generateAutoLinkingMetadata } from "./documentTagger";
import { repairDocumentSystem, verifyDocumentIntegrity, cleanupOrphanedFiles } from "./document-fix";
import { insertClientSchema, insertSessionSchema, insertAssessmentSchema, insertTreatmentPlanSchema } from "@shared/schema";
import { z } from "zod";

// Dr. Jonathan Procter's therapist ID for single-therapist practice (no authentication)
const THERAPIST_ID = "59ea3867-0b4f-47b6-8a95-6484c4a52ef7";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Ensure upload directory exists
  await ensureUploadDir();

  // Dashboard routes
  app.get("/api/dashboard/stats", async (req: Request, res) => {
    try {
      const stats = await storage.getDashboardStats(THERAPIST_ID);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Client routes
  app.get("/api/clients", async (req: Request, res) => {
    try {
      const clients = await storage.getClientsByTherapist(THERAPIST_ID);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", async (req: Request, res) => {
    try {
      const client = await storage.getClientById(req.params.id, THERAPIST_ID);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", async (req: Request, res) => {
    try {
      const clientData = insertClientSchema.parse({
        ...req.body,
        therapistId: THERAPIST_ID,
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

  app.put("/api/clients/:id", async (req: Request, res) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body, THERAPIST_ID);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", async (req: Request, res) => {
    try {
      const deleted = await storage.deleteClient(req.params.id, THERAPIST_ID);
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
  app.get("/api/documents", async (req: Request, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const documents = await storage.getDocumentsByTherapist(THERAPIST_ID, limit);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/client/:clientId", async (req: Request, res) => {
    try {
      const documents = await storage.getDocumentsByClient(req.params.clientId, THERAPIST_ID);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching client documents:", error);
      res.status(500).json({ message: "Failed to fetch client documents" });
    }
  });

  app.get("/api/documents/search", async (req: Request, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Search query required" });
      }
      
      const documents = await storage.searchDocuments(query, THERAPIST_ID);
      res.json(documents);
    } catch (error) {
      console.error("Error searching documents:", error);
      res.status(500).json({ message: "Failed to search documents" });
    }
  });

  app.post("/api/documents/upload", upload.array("files", 10), async (req: Request, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Check HIPAA compliance status and provide detailed feedback
      const isHIPAACompliant = process.env.HIPAA_SAFE_AI === 'true';
      const processingCapabilities = {
        aiAnalysisEnabled: isHIPAACompliant,
        imageProcessingEnabled: isHIPAACompliant,
        supportedFileTypes: [".pdf", ".docx", ".doc", ".txt"],
        enhancedFileTypes: isHIPAACompliant ? [".pdf", ".docx", ".doc", ".txt", ".png", ".jpg", ".jpeg"] : [".pdf", ".docx", ".doc", ".txt"],
        processingMode: isHIPAACompliant ? "AI-Enhanced Analysis" : "Deterministic Analysis",
        autoLinkingCapability: isHIPAACompliant ? "Advanced AI Matching" : "Basic Heuristic Matching"
      };

      // Pre-validate image uploads when HIPAA AI is disabled
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
            code: "HIPAA_IMAGE_UPLOAD_BLOCKED",
            processingCapabilities,
            supportedAlternatives: [
              "Convert images to PDF using a PDF scanner app",
              "Manually transcribe image content to a text (.txt) file",
              "Use optical character recognition (OCR) software to extract text before uploading"
            ]
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
          const documentData = {
            therapistId: THERAPIST_ID,
            clientId,
            fileName: file.originalname,
            fileType: path.extname(file.originalname).toLowerCase(),
            fileSize: file.size,
            filePath: file.path,
          };
          
          console.log(`[Upload Debug] Document data for ${file.originalname}:`, {
            fileName: documentData.fileName,
            fileNameLength: documentData.fileName.length,
            fileType: documentData.fileType,
            fileTypeLength: documentData.fileType.length,
            filePath: documentData.filePath,
            filePathLength: documentData.filePath.length
          });
          
          const document = await storage.createDocument(documentData);

          // Process document synchronously to return full AutoLinkingResult
          try {
            const mimeType = getFileMimeType(file.originalname);
            const processed = await extractTextFromFile(file.path, mimeType);
            
            // Update document with extracted content first
            const updatedDocument = await storage.updateDocument(document.id, {
              content: processed.content,
              metadata: processed.metadata,
              isProcessed: true,
            }, THERAPIST_ID);

            if (updatedDocument) {
              // Perform intelligent auto-linking and return full result
              const context: DocumentUploadContext = {
                therapistId: THERAPIST_ID,
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
            }, THERAPIST_ID);

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
      
      // Include processing capabilities and HIPAA status in response
      const responsePayload = {
        results,
        processingCapabilities,
        processingInfo: {
          hipaaCompliant: isHIPAACompliant,
          totalFilesProcessed: results.length,
          successfulUploads: results.filter(r => r.status === "success").length,
          failedProcessing: results.filter(r => r.status === "failed").length,
          errors: results.filter(r => r.status === "error").length,
          analysisType: isHIPAACompliant ? "AI-Enhanced" : "Deterministic",
          autoLinkingPerformed: results.filter(r => r.autoLinkingResult?.sessionMatch).length,
          potentialMatchesFound: results.reduce((sum, r) => sum + (r.autoLinkingResult?.potentialMatches?.length || 0), 0)
        },
        ...(isHIPAACompliant ? {} : {
          notice: "HIPAA-safe AI is disabled. Documents processed using deterministic analysis with basic categorization and heuristic-based session matching. Enable HIPAA_SAFE_AI=true for enhanced AI analysis and auto-categorization."
        })
      };
      
      if (hasErrors && results.length === 1) {
        // Single file with creation error - return 400
        res.status(400).json(responsePayload);
      } else if (hasFailed || hasErrors) {
        // Some files failed processing - return 207 (Multi-Status)
        res.status(207).json(responsePayload);
      } else {
        // All successful - return 200
        res.json(responsePayload);
      }
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ message: "Failed to upload documents" });
    }
  });

  app.delete("/api/documents/:id", async (req: Request, res) => {
    try {
      const deleted = await storage.deleteDocument(req.params.id, THERAPIST_ID);
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
  app.get("/api/documents/:id/potential-matches", async (req: Request, res) => {
    try {
      const timeWindowHours = req.query.timeWindowHours ? parseInt(req.query.timeWindowHours as string) : 48;
      const potentialMatches = await storage.findPotentialSessionMatches(req.params.id, THERAPIST_ID, timeWindowHours);
      res.json({ potentialMatches });
    } catch (error) {
      console.error("Error finding potential session matches:", error);
      res.status(500).json({ message: "Failed to find potential session matches" });
    }
  });

  // Manually link a document to a session
  app.post("/api/documents/:id/link-session", async (req: Request, res) => {
    try {
      const { sessionId, confidence } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      const linkedDocument = await storage.linkDocumentToSession(
        req.params.id,
        sessionId,
        THERAPIST_ID,
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
  app.post("/api/documents/:id/unlink-session", async (req: Request, res) => {
    try {
      const unlinkedDocument = await storage.unlinkDocumentFromSession(req.params.id, THERAPIST_ID);

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
  app.get("/api/sessions/:sessionId/documents", async (req: Request, res) => {
    try {
      const documents = await storage.getDocumentsBySession(req.params.sessionId, THERAPIST_ID);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching session documents:", error);
      res.status(500).json({ message: "Failed to fetch session documents" });
    }
  });

  // Get unlinked documents (for manual linking interface)
  app.get("/api/documents/unlinked", async (req: Request, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const unlinkedDocuments = await storage.getUnlinkedDocuments(THERAPIST_ID, limit);
      res.json(unlinkedDocuments);
    } catch (error) {
      console.error("Error fetching unlinked documents:", error);
      res.status(500).json({ message: "Failed to fetch unlinked documents" });
    }
  });

  // Enhanced AI analysis for document-session matching
  app.post("/api/documents/:id/analyze-session-matches", async (req: Request, res) => {
    try {
      const { potentialSessionIds } = req.body;
      
      if (!potentialSessionIds || !Array.isArray(potentialSessionIds)) {
        return res.status(400).json({ message: "Array of potential session IDs is required" });
      }

      const document = await storage.getDocumentById(req.params.id, THERAPIST_ID);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Get session details for analysis
      const potentialSessions = [];
      for (const sessionId of potentialSessionIds) {
        const sessionData = await storage.getSessionsByClient('', THERAPIST_ID); // Will be filtered by session ID logic
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
        THERAPIST_ID
      );

      res.json({ analysisResults });
    } catch (error) {
      console.error("Error analyzing session matches:", error);
      res.status(500).json({ message: "Failed to analyze session matches" });
    }
  });

  // Extract calendar context from document
  app.post("/api/documents/:id/extract-calendar-context", async (req: Request, res) => {
    try {
      const document = await storage.getDocumentById(req.params.id, THERAPIST_ID);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const calendarContext = await extractCalendarContext(document, THERAPIST_ID);
      res.json({ calendarContext });
    } catch (error) {
      console.error("Error extracting calendar context:", error);
      res.status(500).json({ message: "Failed to extract calendar context" });
    }
  });

  // Generate auto-linking metadata and recommendations
  app.get("/api/documents/:id/auto-linking-metadata", async (req: Request, res) => {
    try {
      const document = await storage.getDocumentById(req.params.id, THERAPIST_ID);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (!document.analysis) {
        return res.status(400).json({ message: "Document has not been analyzed yet" });
      }

      const autoLinkingMetadata = await generateAutoLinkingMetadata(
        document,
        document.analysis as any,
        THERAPIST_ID
      );

      res.json({ autoLinkingMetadata });
    } catch (error) {
      console.error("Error generating auto-linking metadata:", error);
      res.status(500).json({ message: "Failed to generate auto-linking metadata" });
    }
  });

  // Bulk re-analyze documents for auto-linking
  app.post("/api/documents/bulk-reanalyze", async (req: Request, res) => {
    try {
      const { documentIds, includeLinked } = req.body;
      
      if (!documentIds || !Array.isArray(documentIds)) {
        return res.status(400).json({ message: "Array of document IDs is required" });
      }

      const results = [];
      
      for (const documentId of documentIds) {
        try {
          const document = await storage.getDocumentById(documentId, THERAPIST_ID);
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
            therapistId: THERAPIST_ID,
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
  app.get("/api/sessions/client/:clientId", async (req: Request, res) => {
    try {
      const includeDocuments = req.query.includeDocuments === 'true';
      const sessions = await storage.getSessionsByClient(req.params.clientId, THERAPIST_ID);
      
      if (includeDocuments) {
        // Enhance sessions with linked document information
        const enhancedSessions = await Promise.all(
          sessions.map(async (session) => {
            const documents = await storage.getDocumentsBySession(session.id, THERAPIST_ID);
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

  // GET /api/sessions/today - Get today's sessions (must come before :id route)
  app.get("/api/sessions/today", async (req: Request, res) => {
    try {
      const todaysSessions = await storage.getTodaysSessions(THERAPIST_ID);
      res.json(todaysSessions);
    } catch (error) {
      console.error("Error fetching today's sessions:", error);
      res.status(500).json({ message: "Failed to fetch today's sessions" });
    }
  });

  // GET /api/sessions/:id - Get session details with AI tags
  app.get("/api/sessions/:id", async (req: Request, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getSessionById(id, THERAPIST_ID);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Get AI tags for this session
      const aiTags = await storage.getSessionAITags(session.id, THERAPIST_ID);
      
      // Get linked documents
      const linkedDocuments = await storage.getDocumentsBySession(session.id, THERAPIST_ID);
      
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

  app.get("/api/sessions/recent", async (req: Request, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const includeDocuments = req.query.includeDocuments === 'true';
      const sessions = await storage.getSessionsByTherapist(THERAPIST_ID, limit);
      
      if (includeDocuments) {
        // Enhance sessions with linked document counts
        const enhancedSessions = await Promise.all(
          sessions.map(async (session) => {
            const documents = await storage.getDocumentsBySession(session.id, THERAPIST_ID);
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

  app.post("/api/sessions", async (req: Request, res) => {
    try {
      const sessionData = insertSessionSchema.parse({
        ...req.body,
        therapistId: THERAPIST_ID,
      });
      
      const session = await storage.createSession(sessionData);
      
      // Automatic AI Tagging Trigger for new sessions
      try {
        if (session.notes && session.notes.trim().length > 0) {
          // Generate session AI tags asynchronously (don't block response)
          setImmediate(async () => {
            try {
              const { sessionTagger } = await import('./sessionTagger');
              const sessionTags = await sessionTagger.generateSessionTags(session.id, THERAPIST_ID);
              await storage.updateSessionAITags(session.id, sessionTags, THERAPIST_ID);
              
              // Update client tags based on new session
              const { clientTagger } = await import('./clientTagger');
              await clientTagger.updateClientTagsForNewSession(session.clientId, THERAPIST_ID, session.id);
              
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
  app.put("/api/sessions/:id", async (req: Request, res) => {
    try {
      const { id } = req.params;
      const sessionData = insertSessionSchema.partial().parse(req.body);
      
      const updatedSession = await storage.updateSession(id, sessionData, THERAPIST_ID);
      
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
              const sessionTags = await sessionTagger.regenerateSessionTags(updatedSession.id, THERAPIST_ID);
              
              // CRITICAL FIX: Explicit persistence call to ensure tags are saved to database
              await storage.updateSessionAITags(updatedSession.id, sessionTags, THERAPIST_ID);
              console.log(`[AutoTrigger] [PERSISTENCE] Session AI tags explicitly persisted for session ${updatedSession.id}`);
              
              // Update client tags based on session changes
              const { clientTagger } = await import('./clientTagger');
              await clientTagger.updateClientTagsForNewSession(updatedSession.clientId, THERAPIST_ID, updatedSession.id);
              
              console.log(`[AutoTrigger] AI tags regenerated and persisted for updated session ${updatedSession.id}`);
            } catch (aiError) {
              console.error(`[AutoTrigger] [CRITICAL] Failed to regenerate and persist AI tags for session ${updatedSession.id}:`, aiError);
              
              // Additional error context for debugging
              console.error(`[AutoTrigger] [CRITICAL] Session ID: ${updatedSession.id}, User ID: ${THERAPIST_ID}, Error details:`, {
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
  app.get("/api/calendar/auth", async (req: Request, res) => {
    try {
      const calendarModule = await import("./calendar-sync");
      const authUrl = calendarModule.calendarSync.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating calendar auth URL:", error);
      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  app.get("/api/calendar/callback", async (req: Request, res) => {
    try {
      const { code } = req.query;
      
      if (!code || typeof code !== "string") {
        return res.status(400).json({ message: "Authorization code required" });
      }

      const calendarModule = await import("./calendar-sync");
      await calendarModule.calendarSync.exchangeCodeForTokens(code, THERAPIST_ID);
      
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

  app.post("/api/calendar/sync", async (req: Request, res) => {
    try {
      const calendarModule = await import("./calendar-sync");
      const syncStatus = await calendarModule.calendarSync.syncCalendar(THERAPIST_ID);
      res.json(syncStatus);
    } catch (error) {
      console.error("Error syncing calendar:", error);
      res.status(500).json({ 
        message: "Calendar sync failed",
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.get("/api/calendar/status", async (req: Request, res) => {
    try {
      const calendarModule = await import("./calendar-sync");
      const status = await calendarModule.calendarSync.getSyncStatus(THERAPIST_ID);
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
  app.get("/api/calendar/stats", async (req: Request, res) => {
    try {
      const calendarModule = await import("./calendar-sync");
      const stats = await calendarModule.calendarSync.getSyncStatus(THERAPIST_ID);
      
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

  app.delete("/api/calendar/disconnect", async (req: Request, res) => {
    try {
      const calendarModule = await import("./calendar-sync");
      await calendarModule.calendarSync.revokeAccess(THERAPIST_ID);
      res.json({ message: "Google Calendar disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
      res.status(500).json({ 
        message: "Failed to disconnect calendar",
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.post("/api/calendar/reconcile", async (req: Request, res) => {
    try {
      const calendarModule = await import("./calendar-sync");
      const result = await calendarModule.calendarSync.reconcileOrphanedSessions(THERAPIST_ID);
      res.json({
        success: true,
        message: "Calendar session reconciliation completed",
        ...result
      });
    } catch (error) {
      console.error("Error reconciling calendar sessions:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to reconcile calendar sessions",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Assessment routes
  app.get("/api/assessments/client/:clientId", async (req: Request, res) => {
    try {
      const assessments = await storage.getAssessmentsByClient(req.params.clientId, THERAPIST_ID);
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      res.status(500).json({ message: "Failed to fetch assessments" });
    }
  });

  app.post("/api/assessments", async (req: Request, res) => {
    try {
      const assessmentData = insertAssessmentSchema.parse({
        ...req.body,
        therapistId: THERAPIST_ID,
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
  app.get("/api/treatment-plans/client/:clientId", async (req: Request, res) => {
    try {
      const plans = await storage.getTreatmentPlansByClient(req.params.clientId, THERAPIST_ID);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching treatment plans:", error);
      res.status(500).json({ message: "Failed to fetch treatment plans" });
    }
  });

  app.post("/api/treatment-plans", async (req: Request, res) => {
    try {
      const planData = insertTreatmentPlanSchema.parse({
        ...req.body,
        therapistId: THERAPIST_ID,
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
  app.post("/api/ai/case-conceptualization/:clientId", async (req: Request, res) => {
    try {
      const conceptualization = await generateCaseConceptualization(req.params.clientId, THERAPIST_ID);
      res.json(conceptualization);
    } catch (error) {
      console.error("Error generating case conceptualization:", error);
      res.status(500).json({ message: "Failed to generate case conceptualization" });
    }
  });

  // System maintenance routes
  app.post("/api/system/repair-documents", async (req: Request, res) => {
    try {
      const result = await repairDocumentSystem();
      res.json(result);
    } catch (error) {
      console.error("Error repairing document system:", error);
      res.status(500).json({ message: "Failed to repair document system" });
    }
  });

  app.get("/api/system/verify-integrity", async (req: Request, res) => {
    try {
      const result = await verifyDocumentIntegrity();
      res.json(result);
    } catch (error) {
      console.error("Error verifying document integrity:", error);
      res.status(500).json({ message: "Failed to verify document integrity" });
    }
  });

  app.post("/api/system/cleanup-files", async (req: Request, res) => {
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
  app.post("/api/sessions/:sessionId/ai-tags/generate", async (req: Request, res) => {
    try {
      const { sessionId } = req.params;
      const therapistId = THERAPIST_ID;

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

  app.get("/api/sessions/:sessionId/ai-tags", async (req: Request, res) => {
    try {
      const { sessionId } = req.params;
      const therapistId = THERAPIST_ID;

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

  app.put("/api/sessions/:sessionId/ai-tags", async (req: Request, res) => {
    try {
      const { sessionId } = req.params;
      const { tags } = req.body;
      const therapistId = THERAPIST_ID;

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

  app.post("/api/sessions/:sessionId/ai-tags/regenerate", async (req: Request, res) => {
    try {
      const { sessionId } = req.params;
      const therapistId = THERAPIST_ID;

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
  app.post("/api/clients/:clientId/ai-tags/generate", async (req: Request, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = THERAPIST_ID;

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

  app.get("/api/clients/:clientId/ai-tags", async (req: Request, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = THERAPIST_ID;

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

  app.put("/api/clients/:clientId/ai-tags", async (req: Request, res) => {
    try {
      const { clientId } = req.params;
      const { tags } = req.body;
      const therapistId = THERAPIST_ID;

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

  app.post("/api/clients/:clientId/ai-tags/regenerate", async (req: Request, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = THERAPIST_ID;

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
  app.post("/api/ai-tags/bulk/sessions", async (req: Request, res) => {
    try {
      const { sessionIds } = req.body;
      const therapistId = THERAPIST_ID;

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

  app.post("/api/ai-tags/bulk/clients", async (req: Request, res) => {
    try {
      const { clientIds } = req.body;
      const therapistId = THERAPIST_ID;

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
  app.get("/api/search/sessions-by-tags", async (req: Request, res) => {
    try {
      const { tags } = req.query;
      const therapistId = THERAPIST_ID;

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

  app.get("/api/search/clients-by-tags", async (req: Request, res) => {
    try {
      const { tags } = req.query;
      const therapistId = THERAPIST_ID;

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
  app.get("/api/clients/:clientId/session-trends", async (req: Request, res) => {
    try {
      const { clientId } = req.params;
      const { startDate, endDate } = req.query;
      const therapistId = THERAPIST_ID;

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

  app.get("/api/clients/:clientId/progress-insights", async (req: Request, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = THERAPIST_ID;

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

  app.get("/api/ai-insights/clinical-summary", async (req: Request, res) => {
    try {
      const therapistId = THERAPIST_ID;

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

  app.get("/api/clients/:clientId/comprehensive-report", async (req: Request, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = THERAPIST_ID;

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
  app.post("/api/clients/:clientId/case-conceptualization", async (req: Request, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = THERAPIST_ID;

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
  app.get("/api/clients/:clientId/session-analysis", async (req: Request, res) => {
    try {
      const { clientId } = req.params;
      const therapistId = THERAPIST_ID;

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
  app.post("/api/sessions/:sessionId/trigger-ai-update", async (req: Request, res) => {
    try {
      const { sessionId } = req.params;
      const therapistId = THERAPIST_ID;

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

  // =====================================================
  // NEW AI-POWERED ASSESSMENT AND REPORTING ENDPOINTS
  // =====================================================

  // Assessment generation endpoints
  app.post("/api/documents/:id/generate-assessments", async (req: Request, res) => {
    try {
      const { id: documentId } = req.params;
      const therapistId = THERAPIST_ID;

      // Import the assessment extractor service
      const { assessmentExtractor } = await import('./assessment-extractor');
      
      // Extract assessments from the document
      const result = await assessmentExtractor.extractAssessmentsFromDocument(
        documentId,
        therapistId
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Failed to extract assessments",
          errors: result.errors
        });
      }

      res.json({
        success: true,
        documentId,
        assessments: result.assessments,
        metadata: result.metadata
      });

    } catch (error) {
      console.error("Error generating assessments from document:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate assessments from document"
      });
    }
  });

  app.post("/api/clients/:id/generate-assessments", async (req: Request, res) => {
    try {
      const { id: clientId } = req.params;
      const therapistId = THERAPIST_ID;
      const { documentIds, reprocessExisting = false } = req.body;

      // Import the assessment extractor service
      const { assessmentExtractor } = await import('./assessment-extractor');
      
      // Extract assessments for all client documents or specified documents
      const result = await assessmentExtractor.extractAssessmentsForClient(
        clientId,
        therapistId,
        {
          documentIds,
          reprocessExisting,
          includeAIAnalysis: true
        }
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Failed to extract assessments for client",
          errors: result.errors
        });
      }

      res.json({
        success: true,
        clientId,
        assessments: result.assessments,
        metadata: result.metadata
      });

    } catch (error) {
      console.error("Error generating assessments for client:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate assessments for client"
      });
    }
  });

  // Insights endpoints
  app.get("/api/clients/:id/insights", async (req: Request, res) => {
    try {
      const { id: clientId } = req.params;
      const therapistId = THERAPIST_ID;

      // Get cached insights from storage
      const cachedInsights = await storage.getStoredClientInsights(clientId, therapistId);
      
      if (cachedInsights) {
        res.json({
          success: true,
          clientId,
          insights: cachedInsights,
          cached: true,
          lastUpdated: cachedInsights.metadata?.generatedDate || null
        });
      } else {
        // No cached insights available, suggest recomputation
        res.json({
          success: true,
          clientId,
          insights: null,
          cached: false,
          message: "No insights available. Use /insights/recompute to generate new insights."
        });
      }

    } catch (error) {
      console.error("Error fetching client insights:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch client insights"
      });
    }
  });

  app.post("/api/clients/:id/insights/recompute", async (req: Request, res) => {
    try {
      const { id: clientId } = req.params;
      const therapistId = THERAPIST_ID;
      const { forceRecompute = false, includeRecommendations = true } = req.body;

      // Import the insights aggregator service
      const { insightsAggregator } = await import('./insights-aggregator');
      
      // Compute fresh insights for the client
      const result = await insightsAggregator.computeClientInsights(
        clientId,
        therapistId,
        {
          forceRecompute,
          includeProgressAnalysis: true,
          includeRiskAssessment: true,
          includeTreatmentResponse: true
        }
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Failed to recompute client insights",
          errors: result.errors
        });
      }

      // Store the computed insights
      await storage.storeClientInsights(clientId, result.insights, therapistId);

      res.json({
        success: true,
        clientId,
        insights: result.insights,
        metadata: result.metadata,
        recomputed: true
      });

    } catch (error) {
      console.error("Error recomputing client insights:", error);
      res.status(500).json({
        success: false,
        message: "Failed to recompute client insights"
      });
    }
  });

  // Recommendations endpoint
  app.post("/api/clients/:id/recommendations", async (req: Request, res) => {
    try {
      const { id: clientId } = req.params;
      const therapistId = THERAPIST_ID;
      const { 
        focusAreas = [], 
        includeMedication = true, 
        includeRiskManagement = true, 
        urgentOnly = false 
      } = req.body;

      // Import the recommendation engine service
      const { recommendationEngine } = await import('./recommendation-engine');
      
      // Generate treatment recommendations
      const result = await recommendationEngine.generateRecommendations(
        clientId,
        therapistId,
        {
          focusAreas,
          includeMedication,
          includeRiskManagement,
          urgentOnly
        }
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Failed to generate recommendations",
          errors: result.errors
        });
      }

      // Store the recommendations for audit trail
      await storage.storeRecommendations(clientId, result.recommendations, therapistId);

      res.json({
        success: true,
        clientId,
        recommendations: result.recommendations,
        metadata: result.metadata
      });

    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate recommendations"
      });
    }
  });

  // Report generation and retrieval endpoints
  app.post("/api/clients/:id/reports/generate", async (req: Request, res) => {
    try {
      const { id: clientId } = req.params;
      const therapistId = THERAPIST_ID;
      const { 
        reportType = "progress_report",
        dateRange,
        includeAIAnalysis = true,
        includeRecommendations = true,
        includeProgressCharts = false,
        confidentialityLevel = "standard"
      } = req.body;

      // Import the report composer service
      const { reportComposer } = await import('./report-composer');
      
      // Generate the comprehensive report
      const result = await reportComposer.generateReport(
        clientId,
        therapistId,
        reportType,
        {
          dateRange: dateRange ? {
            startDate: new Date(dateRange.startDate),
            endDate: new Date(dateRange.endDate)
          } : undefined,
          includeAIAnalysis,
          includeRecommendations,
          includeProgressCharts,
          confidentialityLevel
        }
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Failed to generate report",
          errors: result.errors
        });
      }

      res.json({
        success: true,
        clientId,
        reportType,
        report: result.report,
        reportDocument: result.reportDocument,
        metadata: result.metadata
      });

    } catch (error) {
      console.error("Error generating client report:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate client report"
      });
    }
  });

  app.get("/api/clients/:id/reports", async (req: Request, res) => {
    try {
      const { id: clientId } = req.params;
      const therapistId = THERAPIST_ID;
      const { reportType, limit = 20 } = req.query;

      // Get reports for the client
      const reports = await storage.getReportsByClient(
        clientId, 
        therapistId, 
        reportType as string
      );

      // Limit the results
      const limitedReports = reports.slice(0, parseInt(limit as string));

      res.json({
        success: true,
        clientId,
        reports: limitedReports,
        total: reports.length,
        filtered: reportType ? true : false
      });

    } catch (error) {
      console.error("Error fetching client reports:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch client reports"
      });
    }
  });

  // Additional utility endpoints for the AI pipeline
  app.get("/api/assessments/statistics", async (req: Request, res) => {
    try {
      const therapistId = THERAPIST_ID;
      const { startDate, endDate } = req.query;

      const timeRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;

      const statistics = await storage.getAssessmentStatistics(therapistId, timeRange);

      res.json({
        success: true,
        statistics,
        timeRange
      });

    } catch (error) {
      console.error("Error fetching assessment statistics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch assessment statistics"
      });
    }
  });

  app.get("/api/clients/risk-summary", async (req: Request, res) => {
    try {
      const therapistId = THERAPIST_ID;

      const riskSummary = await storage.getClientRiskSummary(therapistId);

      res.json({
        success: true,
        riskSummary,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error("Error fetching client risk summary:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch client risk summary"
      });
    }
  });

  app.get("/api/insights/generation-queue", async (req: Request, res) => {
    try {
      const therapistId = THERAPIST_ID;

      const queue = await storage.getInsightsGenerationQueue(therapistId);

      res.json({
        success: true,
        queue,
        totalClients: queue.length
      });

    } catch (error) {
      console.error("Error fetching insights generation queue:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch insights generation queue"
      });
    }
  });

  // Batch processing endpoints for efficiency
  app.post("/api/batch/generate-assessments", async (req: Request, res) => {
    try {
      const therapistId = THERAPIST_ID;
      const { clientIds, documentIds, limit = 50 } = req.body;

      // Import the assessment extractor service
      const { assessmentExtractor } = await import('./assessment-extractor');
      
      // Process batch assessment generation
      const results = [];
      const targetIds = clientIds || await storage.getClientIdsForBatchProcessing(
        therapistId, 
        { hasUnprocessedDocuments: true, limit }
      );

      for (const clientId of targetIds.slice(0, limit)) {
        try {
          const result = await assessmentExtractor.extractAssessmentsForClient(
            clientId,
            therapistId,
            { documentIds: documentIds?.[clientId] }
          );
          
          results.push({
            clientId,
            success: result.success,
            assessments: result.assessments?.length || 0,
            errors: result.errors
          });
        } catch (error) {
          results.push({
            clientId,
            success: false,
            assessments: 0,
            errors: [error instanceof Error ? error.message : String(error)]
          });
        }
      }

      res.json({
        success: true,
        batchResults: results,
        totalProcessed: results.length,
        successCount: results.filter(r => r.success).length
      });

    } catch (error) {
      console.error("Error in batch assessment generation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process batch assessment generation"
      });
    }
  });

  app.post("/api/batch/recompute-insights", async (req: Request, res) => {
    try {
      const therapistId = THERAPIST_ID;
      const { clientIds, limit = 25 } = req.body;

      // Import the insights aggregator service
      const { insightsAggregator } = await import('./insights-aggregator');
      
      // Process batch insights recomputation
      const results = [];
      const targetIds = clientIds || await storage.getClientIdsForBatchProcessing(
        therapistId, 
        { needsInsightsUpdate: true, limit }
      );

      for (const clientId of targetIds.slice(0, limit)) {
        try {
          const result = await insightsAggregator.computeClientInsights(
            clientId,
            therapistId,
            { forceRecompute: true }
          );
          
          if (result.success) {
            await storage.storeClientInsights(clientId, result.insights, therapistId);
          }
          
          results.push({
            clientId,
            success: result.success,
            errors: result.errors
          });
        } catch (error) {
          results.push({
            clientId,
            success: false,
            errors: [error instanceof Error ? error.message : String(error)]
          });
        }
      }

      res.json({
        success: true,
        batchResults: results,
        totalProcessed: results.length,
        successCount: results.filter(r => r.success).length
      });

    } catch (error) {
      console.error("Error in batch insights recomputation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process batch insights recomputation"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
