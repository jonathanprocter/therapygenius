import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { Request } from "express";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { aiRouter } from "./ai";
import { storage } from "./storage";
import { analyzeDocument, extractCalendarContext, analyzeDocumentForSessionMatching, createDeterministicAnalysis } from "./documentTagger";
import { Document, Session } from "@shared/schema";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
export const ensureUploadDir = async () => {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
};

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadDir();
    const therapistDir = path.join(UPLOAD_DIR, (req as any).userId || "unknown");
    try {
      await fs.access(therapistDir);
    } catch {
      await fs.mkdir(therapistDir, { recursive: true });
    }
    cb(null, therapistDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [".pdf", ".docx", ".doc", ".txt", ".md", ".png", ".jpg", ".jpeg"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} not allowed. Allowed types: ${allowedTypes.join(", ")}`));
  }
};

export const upload = multer({
  storage: multerStorage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

export interface ProcessedDocument {
  content: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    extractionMethod: "pdf-parse" | "mammoth" | "ocr" | "text";
  };
}

export interface AutoLinkingResult {
  documentId: string;
  sessionMatch?: {
    sessionId: string;
    confidence: number;
    matchReason: string;
    session: Session;
  };
  analysisResults?: {
    category: string;
    tags: string[];
    keyInsights: string[];
    clientMatch?: {
      clientId: string;
      confidence: number;
    };
  };
  potentialMatches: Array<{
    sessionId: string;
    confidence: number;
    matchReason: string;
  }>;
  processingStatus: "success" | "partial" | "failed";
  errors?: string[];
}

export interface DocumentUploadContext {
  therapistId: string;
  clientId?: string;
  sessionId?: string;
  sourceEventId?: string;
  manualClientOverride?: boolean;
}

export const extractTextFromFile = async (filePath: string, mimeType: string): Promise<ProcessedDocument> => {
  try {
    const buffer = await fs.readFile(filePath);
    
    if (mimeType === "application/pdf") {
      return await extractFromPDF(buffer);
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return await extractFromDocx(buffer);
    } else if (mimeType === "application/msword") {
      return await extractFromDoc(buffer);
    } else if (mimeType === "text/plain") {
      return await extractFromText(buffer);
    } else if (mimeType.startsWith("image/")) {
      return await extractFromImage(buffer);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error("Error extracting text from file:", error);
    throw new Error(`Failed to extract text: ${(error as any)?.message || error}`);
  }
};

const extractFromPDF = async (buffer: Buffer): Promise<ProcessedDocument> => {
  const data = await pdfParse(buffer);
  return {
    content: data.text,
    metadata: {
      pageCount: data.numpages,
      wordCount: data.text.split(/\s+/).length,
      extractionMethod: "pdf-parse",
    },
  };
};

const extractFromDocx = async (buffer: Buffer): Promise<ProcessedDocument> => {
  const result = await mammoth.extractRawText({ buffer });
  return {
    content: result.value,
    metadata: {
      wordCount: result.value.split(/\s+/).length,
      extractionMethod: "mammoth",
    },
  };
};

const extractFromDoc = async (buffer: Buffer): Promise<ProcessedDocument> => {
  // For older .doc files, we'll use mammoth as well
  // In a production environment, you might want to use a more specialized library
  const result = await mammoth.extractRawText({ buffer });
  return {
    content: result.value,
    metadata: {
      wordCount: result.value.split(/\s+/).length,
      extractionMethod: "mammoth",
    },
  };
};

const extractFromText = async (buffer: Buffer): Promise<ProcessedDocument> => {
  const content = buffer.toString("utf-8");
  return {
    content,
    metadata: {
      wordCount: content.split(/\s+/).length,
      extractionMethod: "text",
    },
  };
};

const extractFromImage = async (buffer: Buffer): Promise<ProcessedDocument> => {
  const isHIPAACompliant = process.env.HIPAA_SAFE_AI === 'true';
  
  if (!isHIPAACompliant) {
    // HIPAA Compliance: Reject image uploads when external AI is disabled
    console.error('[Document Processor] Image OCR blocked: HIPAA_SAFE_AI is disabled. Image uploads require external AI for OCR processing.');
    throw new Error('Image uploads are not supported when HIPAA-safe AI is disabled. Please enable HIPAA_SAFE_AI=true to process image documents, or convert your image to text format.');
  }

  try {
    console.log('[Document Processor] Processing image with AI OCR (HIPAA_SAFE_AI enabled)');
    const content = await aiRouter.ocrImage(buffer);
    
    return {
      content,
      metadata: {
        wordCount: content.split(/\s+/).length,
        extractionMethod: "ocr",
      },
    };
  } catch (error) {
    console.error("Error performing OCR:", error);
    throw new Error(`OCR failed: ${(error as any)?.message || error}`);
  }
};

export const getFileMimeType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".txt": "text/plain",
    ".md": "text/plain", // Treat markdown as plain text
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };

  return mimeTypes[ext] || "application/octet-stream";
};

/**
 * Main function to process a document with intelligent auto-linking
 * Integrates document processing, AI analysis, and session matching
 */
export const processDocumentWithAutoLinking = async (
  document: Document,
  context: DocumentUploadContext
): Promise<AutoLinkingResult> => {
  const result: AutoLinkingResult = {
    documentId: document.id,
    potentialMatches: [],
    processingStatus: "success",
    errors: []
  };

  try {
    console.log(`[Document Processor] Starting auto-linking for document ${document.id}`);

    // Step 1: Enhanced AI Analysis with HIPAA fallback
    let analysisResults;
    try {
      const isHIPAACompliant = process.env.HIPAA_SAFE_AI === 'true';
      
      if (isHIPAACompliant) {
        // Use AI analysis when HIPAA compliant
        analysisResults = await analyzeDocument(document, context.therapistId);
      } else {
        // Fallback to deterministic analysis when HIPAA AI is disabled
        console.log('[Document Processor] Using deterministic fallback analysis (HIPAA AI disabled)');
        analysisResults = createDeterministicAnalysis(document, context);
      }
      
      result.analysisResults = analysisResults;

      // Update document with analysis results including processing status
      await storage.updateDocumentAnalysis(
        document.id,
        analysisResults,
        {
          category: analysisResults.category,
          tags: analysisResults.tags,
          keyInsights: analysisResults.keyInsights,
          documentFormat: analysisResults.documentFormat,
          needsProcessing: analysisResults.documentFormat?.needsProcessing
        },
        context.therapistId
      );

      // Log processing status for transparency
      console.log(`[Document Processor] Document ${document.id} format analysis:`, {
        category: analysisResults.category,
        format: analysisResults.documentFormat?.type,
        needsProcessing: analysisResults.documentFormat?.needsProcessing,
        reason: analysisResults.documentFormat?.processingNotes
      });

      // Step 1.5: Assessment Generation (NEW)
      await triggerAssessmentGeneration(document, analysisResults, context);
    } catch (error) {
      console.error('[Document Processor] Analysis failed:', error);
      result.errors?.push(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      result.processingStatus = "partial";
      
      // Fallback to basic analysis on error
      try {
        console.log('[Document Processor] Attempting fallback analysis after error');
        analysisResults = createDeterministicAnalysis(document, context);
        result.analysisResults = analysisResults;
      } catch (fallbackError) {
        console.error('[Document Processor] Fallback analysis also failed:', fallbackError);
      }
    }

    // Step 2: Session Matching
    try {
      // Use explicit session if provided
      if (context.sessionId) {
        const targetSession = await storage.getSessionById(context.sessionId, context.therapistId);
        
        if (targetSession) {
          await storage.linkDocumentToSession(document.id, context.sessionId, context.therapistId, 1.0);
          result.sessionMatch = {
            sessionId: context.sessionId,
            confidence: 1.0,
            matchReason: 'Manual session specification',
            session: targetSession
          };
        } else {
          result.errors?.push(`Session ${context.sessionId} not found or does not belong to therapist`);
          result.processingStatus = "partial";
        }
      } else {
        // Perform intelligent session matching using exported function
        const potentialSessions = await storage.findPotentialSessionMatches(
          document.id,
          context.therapistId,
          48
        );
        let sessionMatches;
        const isHIPAACompliant = process.env.HIPAA_SAFE_AI === 'true';
        
        if (isHIPAACompliant) {
          // Use AI-enhanced session matching when HIPAA compliant
          sessionMatches = await analyzeDocumentForSessionMatching(
            document,
            potentialSessions.map(m => ({
              id: m.session.id,
              sessionDate: m.session.sessionDate,
              notes: m.session.notes,
              sessionType: m.session.sessionType
            })),
            context.therapistId
          );
        } else {
          // Fallback to deterministic session matching when HIPAA AI is disabled
          console.log('[Document Processor] Using deterministic session matching (HIPAA AI disabled)');
          sessionMatches = createDeterministicSessionMatching(document, potentialSessions, context);
        }
        const matches = sessionMatches.map(match => {
          const originalSession = potentialSessions.find(p => p.session.id === match.sessionId);
          return {
            session: originalSession!.session,
            confidence: match.confidence,
            matchReason: match.matchReason
          };
        }).filter(m => m.session); // Filter out any null sessions
        result.potentialMatches = matches.map(m => ({
          sessionId: m.session.id,
          confidence: m.confidence,
          matchReason: m.matchReason
        }));

        // Auto-link if high confidence match (>= 0.8)
        const bestMatch = matches[0];
        if (bestMatch && bestMatch.confidence >= 0.8) {
          await storage.linkDocumentToSession(
            document.id,
            bestMatch.session.id,
            context.therapistId,
            bestMatch.confidence
          );
          result.sessionMatch = {
            sessionId: bestMatch.session.id,
            confidence: bestMatch.confidence,
            matchReason: bestMatch.matchReason,
            session: bestMatch.session
          };
          console.log(`[Document Processor] Auto-linked to session ${bestMatch.session.id} with confidence ${bestMatch.confidence}`);
        }
      }
    } catch (error) {
      console.error('[Document Processor] Session matching failed:', error);
      result.errors?.push(`Session matching failed: ${error instanceof Error ? error.message : String(error)}`);
      result.processingStatus = "partial";
    }

    // Step 3: Calendar Context Integration
    try {
      if (context.sourceEventId) {
        const calendarContext = await extractCalendarContext(context.sourceEventId, context.therapistId);
        if (calendarContext) {
          // Update document with calendar context
          await storage.updateDocument(document.id, {
            sourceEventId: context.sourceEventId,
            analysis: {
              ...(result.analysisResults || {}),
              calendarContext
            }
          }, context.therapistId);
        }
      }
    } catch (error) {
      console.error('[Document Processor] Calendar context extraction failed:', error);
      result.errors?.push(`Calendar context failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log(`[Document Processor] Auto-linking completed for document ${document.id} with status: ${result.processingStatus}`);
    return result;

  } catch (error) {
    console.error('[Document Processor] Critical error in auto-linking:', error);
    result.processingStatus = "failed";
    result.errors?.push(`Critical error: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
};

/**
 * DEPRECATED: Use analyzeDocumentForSessionMatching from documentTagger.ts instead
 * This function is kept for backward compatibility but should not be used in new code
 */
export const performIntelligentSessionMatching = async (
  document: Document,
  context: DocumentUploadContext,
  timeWindowHours: number = 48
): Promise<Array<{
  session: Session;
  confidence: number;
  matchReason: string;
}>> => {
  console.warn('[Document Processor] Using deprecated performIntelligentSessionMatching. Use analyzeDocumentForSessionMatching instead.');
  
  try {
    // Get potential matches from storage
    const potentialMatches = await storage.findPotentialSessionMatches(
      document.id,
      context.therapistId,
      timeWindowHours
    );

    // Use the exported function from documentTagger.ts
    const sessionMatches = await analyzeDocumentForSessionMatching(
      document,
      potentialMatches.map(m => ({
        id: m.session.id,
        sessionDate: m.session.sessionDate,
        notes: m.session.notes,
        sessionType: m.session.sessionType
      })),
      context.therapistId
    );

    // Convert back to expected format
    return sessionMatches.map(match => {
      const originalSession = potentialMatches.find(p => p.session.id === match.sessionId);
      return {
        session: originalSession!.session,
        confidence: match.confidence,
        matchReason: match.matchReason
      };
    }).filter(m => m.session);
  } catch (error) {
    console.error('[Document Processor] Error in session matching:', error);
    return [];
  }
};

/**
 * AI-enhanced session matching using document content analysis
 */
const performAIEnhancedMatching = async (
  document: Document,
  potentialMatches: Array<{
    session: Session;
    confidence: number;
    matchReason: string;
  }>,
  therapistId: string
): Promise<Array<{
  session: Session;
  confidence: number;
  matchReason: string;
}>> => {
  try {
    if (potentialMatches.length === 0) return [];

    // Use AI to analyze document content and match against session notes
    const sessionAnalysisPrompt = `
You are analyzing a therapy document to match it with potential therapy sessions. 

Document content (first 2000 chars): ${document.content?.substring(0, 2000)}

Potential sessions:
${potentialMatches.map((match, idx) => `
${idx + 1}. Session Date: ${match.session.sessionDate.toLocaleDateString()}
   Session Type: ${match.session.sessionType || 'Not specified'}
   Notes: ${match.session.notes?.substring(0, 500) || 'No notes'}
   Current confidence: ${match.confidence}
`).join('\n')}

Analyze the document content and provide confidence scores (0-1) for each potential session match.
Consider:
1. Topic alignment between document and session notes
2. Therapy concepts and interventions mentioned
3. Timeline and context clues
4. Client-specific information

Respond with JSON array of confidence adjustments:
[
  {
    "sessionIndex": 0,
    "adjustedConfidence": 0.95,
    "reasoning": "Strong topic alignment with CBT techniques mentioned in both"
  }
]
`;

    const aiAnalysis = await aiRouter.chatJSON(
      [{ role: "user", content: sessionAnalysisPrompt }],
      {
        type: "array",
        items: {
          type: "object",
          properties: {
            sessionIndex: { type: "number" },
            adjustedConfidence: { type: "number", minimum: 0, maximum: 1 },
            reasoning: { type: "string" }
          },
          required: ["sessionIndex", "adjustedConfidence", "reasoning"]
        }
      } as any,
      {
        systemPrompt: "You are a specialized AI for matching therapy documents to sessions. Always respond with valid JSON.",
        maxTokens: 1000
      }
    );

    // Apply AI adjustments to confidence scores
    const enhancedMatches = potentialMatches.map((match, idx) => {
      const aiAdjustment = (aiAnalysis as any[]).find(adj => adj.sessionIndex === idx);
      if (aiAdjustment) {
        return {
          ...match,
          confidence: Math.min(1.0, aiAdjustment.adjustedConfidence),
          matchReason: `${match.matchReason}, AI: ${aiAdjustment.reasoning}`
        };
      }
      return match;
    });

    return enhancedMatches.sort((a, b) => b.confidence - a.confidence);

  } catch (error) {
    console.error('[Document Processor] AI-enhanced matching failed:', error);
    return potentialMatches; // Fall back to original matches
  }
};

/**
 * Extract calendar context from source event
 */
const extractCalendarContext = async (sourceEventId: string, therapistId: string) => {
  try {
    const session = await storage.getSessionByExternalEventId(sourceEventId, therapistId);
    if (session) {
      return {
        calendarEventId: sourceEventId,
        linkedSessionId: session.id,
        sessionDate: session.sessionDate,
        sourceCalendar: session.sourceCalendar,
        extractedAt: new Date().toISOString()
      };
    }
    return null;
  } catch (error) {
    console.error('[Document Processor] Error extracting calendar context:', error);
    return null;
  }
};

/**
 * Enhanced document analysis specifically for linking purposes
 */
const analyzeDocumentForLinking = async (document: Document, therapistId: string) => {
  try {
    // Use existing document analysis but enhance with linking-specific analysis
    const analysis = await analyzeDocument(document, therapistId);
    
    // Add linking-specific enhancements
    return {
      ...analysis,
      linkingMetadata: {
        processedAt: new Date().toISOString(),
        processingVersion: "1.0.0",
        confidence: 0.8, // Default confidence for AI analysis
        method: "ai-enhanced"
      }
    };
  } catch (error) {
    console.error('[Document Processor] Error in document analysis for linking:', error);
    throw error;
  }
};


/**
 * Create deterministic session matching when AI is disabled
 * Uses basic heuristics for session matching without external AI
 */
const createDeterministicSessionMatching = (
  document: Document,
  potentialSessions: Array<{ session: any; confidence: number; matchReason: string }>,
  context: DocumentUploadContext
) => {
  if (potentialSessions.length === 0) return [];
  
  return potentialSessions.map(match => {
    let confidence = match.confidence;
    let matchReason = match.matchReason;
    const matchingFactors = [];
    
    // Boost confidence for temporal proximity
    const uploadDate = document.uploadDate || document.createdAt;
    const sessionDate = match.session.sessionDate;
    const timeDiffHours = Math.abs(uploadDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60);
    
    if (timeDiffHours <= 24) {
      confidence += 0.3;
      matchingFactors.push('Recent temporal proximity (within 24 hours)');
    } else if (timeDiffHours <= 48) {
      confidence += 0.2;
      matchingFactors.push('Temporal proximity (within 48 hours)');
    }
    
    // Boost confidence for client match
    if (context.clientId && match.session.clientId === context.clientId) {
      confidence += 0.2;
      matchingFactors.push('Client ID match');
    }
    
    // Basic content-based matching if document has content
    if (document.content && match.session.notes) {
      const contentWords = document.content.toLowerCase().split(/\W+/);
      const sessionWords = match.session.notes.toLowerCase().split(/\W+/);
      const commonWords = contentWords.filter(word => 
        word.length > 3 && sessionWords.includes(word)
      );
      
      if (commonWords.length >= 3) {
        confidence += 0.1;
        matchingFactors.push(`Content similarity (${commonWords.length} common terms)`);
      }
    }
    
    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);
    
    return {
      sessionId: match.session.id,
      confidence,
      matchReason: matchingFactors.length > 0 
        ? `Deterministic matching: ${matchingFactors.join(', ')}`
        : 'Basic heuristic matching',
      matchingFactors
    };
  }).filter(match => match.confidence > 0.3)
    .sort((a, b) => b.confidence - a.confidence);
};

/**
 * Trigger assessment generation from uploaded documents when appropriate
 * This function is called during document processing to automatically extract assessments
 */
const triggerAssessmentGeneration = async (
  document: Document,
  analysisResults: any,
  context: DocumentUploadContext
): Promise<void> => {
  try {
    console.log(`[Document Processor] Checking document ${document.id} for assessment content`);

    // Only proceed if document has a client ID and content
    if (!context.clientId || !document.content) {
      console.log('[Document Processor] Skipping assessment generation - no client ID or content');
      return;
    }

    // Check if document likely contains assessment content
    const hasAssessmentContent = detectAssessmentContent(document, analysisResults);
    
    if (!hasAssessmentContent) {
      console.log('[Document Processor] No assessment content detected, skipping extraction');
      return;
    }

    console.log(`[Document Processor] Assessment content detected in document ${document.id}, triggering extraction`);

    // Import and use the assessment extractor service
    const { assessmentExtractor } = await import('./assessment-extractor');
    
    // Extract assessments from the document (non-blocking)
    const extractionResult = await assessmentExtractor.extractAssessmentsFromDocument(
      document,
      context.therapistId,
      context.clientId
    );

    if (extractionResult.success && extractionResult.assessments && extractionResult.assessments.length > 0) {
      console.log(`[Document Processor] Successfully extracted ${extractionResult.assessments.length} assessments from document ${document.id}`);

      // Trigger insights recomputation for the client (async, non-blocking)
      // This will update client insights with the new assessment data
      triggerInsightsRecomputation(context.clientId!, context.therapistId)
        .catch(error => {
          console.error('[Document Processor] Error in async insights recomputation:', error);
        });

      // Mark document as processed for assessments
      await storage.markDocumentAsProcessedForAssessments(document.id, context.therapistId);
      
    } else {
      console.log(`[Document Processor] No assessments extracted from document ${document.id}`);
      if (extractionResult.errors && extractionResult.errors.length > 0) {
        console.log('[Document Processor] Assessment extraction errors:', extractionResult.errors);
      }
    }

  } catch (error) {
    // Log error but don't throw - we don't want assessment generation failures to break document processing
    console.error(`[Document Processor] Error in assessment generation for document ${document.id}:`, error);
  }
};

/**
 * Detect if a document likely contains assessment content
 */
const detectAssessmentContent = (document: Document, analysisResults: any): boolean => {
  const content = document.content?.toLowerCase() || '';
  const fileName = document.fileName.toLowerCase();
  
  // Common assessment instrument indicators
  const assessmentIndicators = [
    // Specific assessment names
    'phq-9', 'phq9', 'patient health questionnaire',
    'gad-7', 'gad7', 'generalized anxiety disorder',
    'beck depression inventory', 'bdi-ii', 'bdi',
    'pcl-5', 'ptsd checklist',
    'ham-d', 'hamilton depression',
    'madrs', 'montgomery',
    'y-bocs', 'yale-brown',
    'dass-21', 'dass21',
    'whodas', 'who disability',
    
    // Assessment-related terms
    'assessment score', 'questionnaire score', 'scale score',
    'total score', 'severity score', 'rating scale',
    'clinical assessment', 'psychological assessment',
    'screening tool', 'diagnostic tool',
    
    // Scoring patterns
    'score:', 'scored', 'points', 'out of', 
    'mild', 'moderate', 'severe', 'minimal',
    'interpretation:', 'result:', 'findings:',
    
    // Item response patterns (common in assessments)
    'not at all', 'several days', 'more than half', 'nearly every day',
    'strongly disagree', 'strongly agree',
    'never', 'sometimes', 'often', 'always'
  ];

  // Check filename for assessment indicators
  // Sanitize both filename and indicator to handle hyphens, underscores, etc.
  const fileNameSanitized = fileName.replace(/[^a-z0-9]/g, '');
  const fileNameHasAssessment = assessmentIndicators.some(indicator => 
    fileNameSanitized.includes(indicator.replace(/[^a-z0-9]/g, ''))
  );

  // Check content for assessment indicators
  const contentHasAssessment = assessmentIndicators.some(indicator => 
    content.includes(indicator)
  );

  // Check for assessment-specific numerical scoring patterns
  // Avoid matching dates (10/15/2024), times (3:30 PM), or appointment numbers
  const scoringPatterns = [
    /\bscore[:\s]+\d+/i,           // "score: 15" or "score 15"
    /\btotal[:\s]+\d+/i,           // "total: 8" or "total 8"  
    /\d+\s*\/\s*\d+\s*(?:points|score)/i,  // "15/27 points" or "15/27 score"
    /\d+\s*out\s*of\s*\d+/i,       // "15 out of 27"
    /severity[:\s]+\w+/i,          // "severity: moderate"
    /\bphq-?\d+[:\s]+\d+/i,        // "PHQ-9: 15" or "PHQ9: 15"
    /\bgad-?\d+[:\s]+\d+/i,        // "GAD-7: 8" or "GAD7: 8"
  ];
  
  const hasNumericalScoring = scoringPatterns.some(pattern => pattern.test(content));

  // Check analysis results for assessment-related tags/categories
  const analysisHasAssessment = analysisResults && (
    (analysisResults.tags && analysisResults.tags.some((tag: string) => 
      tag.toLowerCase().includes('assessment') || 
      tag.toLowerCase().includes('questionnaire') ||
      tag.toLowerCase().includes('scale') ||
      tag.toLowerCase().includes('score')
    )) ||
    (analysisResults.category && 
      ['assessment', 'questionnaire', 'screening', 'evaluation'].includes(analysisResults.category.toLowerCase())
    )
  );

  // Document likely contains assessment content if:
  // 1. Filename clearly indicates it's an assessment, OR
  // 2. Content has assessment indicators AND (numerical scoring OR AI confirms it)
  // This catches both scored assessments and narrative assessments identified by AI
  const likelyHasAssessment = fileNameHasAssessment || 
    (contentHasAssessment && (hasNumericalScoring || analysisHasAssessment));

  if (likelyHasAssessment) {
    console.log(`[Document Processor] Assessment content detected in ${document.fileName}:`, {
      fileNameMatch: fileNameHasAssessment,
      contentMatch: contentHasAssessment,
      numericalScoring: hasNumericalScoring,
      analysisMatch: analysisHasAssessment
    });
  }

  return likelyHasAssessment;
};

/**
 * Trigger insights recomputation for a client (async)
 * This is called after new assessments are generated to update client insights
 */
const triggerInsightsRecomputation = async (clientId: string, therapistId: string): Promise<void> => {
  try {
    console.log(`[Document Processor] Triggering insights recomputation for client ${clientId}`);

    // Import the insights aggregator service
    const { insightsAggregator } = await import('./insights-aggregator');
    
    // Compute fresh insights for the client
    const result = await insightsAggregator.computeClientInsights(
      clientId,
      therapistId,
      {
        forceRecompute: true,
        includeProgressAnalysis: true,
        includeRiskAssessment: true,
        includeTreatmentResponse: true
      }
    );

    if (result.success && result.insights) {
      // Store the computed insights
      await storage.storeClientInsights(clientId, result.insights, therapistId);
      console.log(`[Document Processor] Successfully updated insights for client ${clientId}`);
    } else {
      console.log(`[Document Processor] Failed to recompute insights for client ${clientId}:`, result.errors);
    }

  } catch (error) {
    console.error(`[Document Processor] Error recomputing insights for client ${clientId}:`, error);
    // Don't throw - this is a background process
  }
};