import { Document, Assessment, InsertAssessment } from "@shared/schema";
import { storage } from "./storage";
import { aiRouter } from "./ai";
import { z } from "zod";

// Supported clinical assessment instruments
export enum AssessmentInstrument {
  PHQ9 = "PHQ-9",
  GAD7 = "GAD-7",
  PCL5 = "PCL-5",
  BDI2 = "BDI-II",
  BAI = "BAI",
  DASS21 = "DASS-21",
  MDQ = "MDQ",
  MADRS = "MADRS",
  HAM_D = "HAM-D",
  HAM_A = "HAM-A",
  MINI = "MINI",
  SCID = "SCID",
  CUSTOM = "Custom"
}

// Assessment extraction validation schema
const assessmentExtractionSchema = z.object({
  assessmentsFound: z.array(z.object({
    instrument: z.nativeEnum(AssessmentInstrument),
    version: z.string().optional(),
    dateAdministered: z.string().optional(),
    scores: z.object({
      totalScore: z.number(),
      subscaleScores: z.record(z.number()).optional(),
      items: z.array(z.object({
        itemNumber: z.number(),
        response: z.union([z.number(), z.string()]),
        score: z.number().optional()
      })).optional(),
      interpretation: z.string().optional(),
      severity: z.enum(["minimal", "mild", "moderate", "moderately severe", "severe", "unknown"]).optional(),
      cutoffMet: z.boolean().optional()
    }),
    metadata: z.object({
      extractionConfidence: z.number().min(0).max(1),
      extractionMethod: z.enum(["ai_parsing", "structured_form", "manual_review"]),
      documentSection: z.string().optional(),
      administeredBy: z.string().optional(),
      notes: z.string().optional(),
      qualityFlags: z.array(z.string()).optional()
    })
  })),
  documentAnalysis: z.object({
    hasAssessmentContent: z.boolean(),
    confidence: z.number().min(0).max(1),
    suggestedInstruments: z.array(z.string()).optional(),
    extractionChallenges: z.array(z.string()).optional()
  })
});

export type AssessmentExtraction = z.infer<typeof assessmentExtractionSchema>;

export interface AssessmentExtractionResult {
  success: boolean;
  assessmentsCreated: Assessment[];
  extractionResults: AssessmentExtraction;
  errors?: string[];
  metadata: {
    documentId: string;
    processingTime: number;
    aiModel: string;
    extractionDate: Date;
  };
}

export class AssessmentExtractor {
  
  /**
   * Extract assessments from a document using AI parsing
   */
  async extractAssessmentsFromDocument(
    document: Document,
    therapistId: string,
    clientId?: string
  ): Promise<AssessmentExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[Assessment Extractor] Processing document ${document.id} for assessments`);
      
      if (!document.content) {
        throw new Error("Document has no content to analyze");
      }

      // Use AI to extract assessment data
      const extractionResults = await this.parseAssessmentContent(document.content, document.fileName);
      
      const assessmentsCreated: Assessment[] = [];
      const errors: string[] = [];

      // Create assessments from extraction results
      for (const assessmentData of extractionResults.assessmentsFound) {
        try {
          const assessment = await this.createAssessmentFromExtraction(
            assessmentData,
            document,
            therapistId,
            clientId
          );
          assessmentsCreated.push(assessment);
        } catch (error) {
          const errorMsg = `Failed to create assessment for ${assessmentData.instrument}: ${error}`;
          console.error(`[Assessment Extractor] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      const processingTime = Date.now() - startTime;
      
      console.log(`[Assessment Extractor] Extracted ${assessmentsCreated.length} assessments from document ${document.id} in ${processingTime}ms`);

      return {
        success: true,
        assessmentsCreated,
        extractionResults,
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          documentId: document.id,
          processingTime,
          aiModel: "openai", // This would come from the AI router
          extractionDate: new Date()
        }
      };

    } catch (error) {
      console.error(`[Assessment Extractor] Error processing document ${document.id}:`, error);
      return {
        success: false,
        assessmentsCreated: [],
        extractionResults: {
          assessmentsFound: [],
          documentAnalysis: {
            hasAssessmentContent: false,
            confidence: 0
          }
        },
        errors: [error instanceof Error ? error.message : String(error)],
        metadata: {
          documentId: document.id,
          processingTime: Date.now() - startTime,
          aiModel: "unknown",
          extractionDate: new Date()
        }
      };
    }
  }

  /**
   * Parse assessment content using AI
   */
  private async parseAssessmentContent(
    content: string,
    fileName: string
  ): Promise<AssessmentExtraction> {
    
    const assessmentPrompt = `
You are a clinical assessment extraction specialist. Analyze this document for standardized mental health assessment instruments and extract their scores.

Document: ${fileName}
Content: ${content.substring(0, 6000)}...

Look for these common instruments:
- PHQ-9 (Patient Health Questionnaire-9) - Depression screening
- GAD-7 (Generalized Anxiety Disorder-7) - Anxiety screening  
- PCL-5 (PTSD Checklist for DSM-5) - PTSD screening
- BDI-II (Beck Depression Inventory-II) - Depression assessment
- BAI (Beck Anxiety Inventory) - Anxiety assessment
- DASS-21 (Depression, Anxiety and Stress Scale) - Emotional states
- MDQ (Mood Disorder Questionnaire) - Bipolar screening
- MADRS (Montgomery-Asberg Depression Rating Scale) - Depression severity
- HAM-D (Hamilton Depression Rating Scale) - Depression rating
- HAM-A (Hamilton Anxiety Rating Scale) - Anxiety rating

For each assessment found, extract:
1. Instrument type and version
2. Total score and subscale scores
3. Individual item responses if available
4. Date administered (if mentioned)
5. Interpretation/severity level
6. Who administered it

Provide response in this JSON format:
{
  "assessmentsFound": [
    {
      "instrument": "PHQ-9",
      "version": "standard",
      "dateAdministered": "2023-10-15",
      "scores": {
        "totalScore": 12,
        "subscaleScores": {},
        "items": [
          {"itemNumber": 1, "response": 2, "score": 2},
          {"itemNumber": 2, "response": 1, "score": 1}
        ],
        "interpretation": "Moderate depression",
        "severity": "moderate",
        "cutoffMet": true
      },
      "metadata": {
        "extractionConfidence": 0.95,
        "extractionMethod": "ai_parsing",
        "documentSection": "Assessment Results",
        "administeredBy": "Dr. Smith",
        "notes": "Patient reported symptoms for 2+ weeks",
        "qualityFlags": []
      }
    }
  ],
  "documentAnalysis": {
    "hasAssessmentContent": true,
    "confidence": 0.9,
    "suggestedInstruments": ["PHQ-9", "GAD-7"],
    "extractionChallenges": ["Handwritten responses unclear"]
  }
}

If no assessments are found, return empty assessmentsFound array with hasAssessmentContent: false.
Be conservative with confidence scores - only high confidence (>0.8) for clear, complete assessments.
`;

    try {
      const result = await aiRouter.chatJSON([{ role: "user", content: assessmentPrompt }], assessmentExtractionSchema);
      return result;
    } catch (error) {
      console.error("[Assessment Extractor] AI parsing failed:", error);
      // Return empty result if AI parsing fails
      return {
        assessmentsFound: [],
        documentAnalysis: {
          hasAssessmentContent: false,
          confidence: 0,
          extractionChallenges: [`AI parsing failed: ${error}`]
        }
      };
    }
  }

  /**
   * Create assessment record from extraction data
   */
  private async createAssessmentFromExtraction(
    assessmentData: AssessmentExtraction['assessmentsFound'][0],
    document: Document,
    therapistId: string,
    clientId?: string
  ): Promise<Assessment> {
    
    // Determine client ID from document or parameter
    const finalClientId = clientId || document.clientId;
    if (!finalClientId) {
      throw new Error("Cannot create assessment without client ID");
    }

    // Determine assessment date - prefer extracted date, fallback to document date
    let assessmentDate: Date;
    if (assessmentData.dateAdministered) {
      assessmentDate = new Date(assessmentData.dateAdministered);
    } else {
      assessmentDate = document.uploadDate || new Date();
    }

    // Create assessment with full provenance metadata
    const insertData: InsertAssessment = {
      clientId: finalClientId,
      therapistId,
      assessmentType: assessmentData.instrument,
      assessmentDate,
      scores: assessmentData.scores,
      interpretation: assessmentData.scores.interpretation || null,
      recommendations: this.generateRecommendations(assessmentData),
      metadata: {
        sourceDocumentId: document.id,
        sourceDocumentName: document.fileName,
        model: "openai", // This would come from AI router metadata
        confidence: assessmentData.metadata.extractionConfidence,
        instrument: assessmentData.instrument,
        version: assessmentData.version || "unknown",
        extractionMethod: assessmentData.metadata.extractionMethod,
        extractionDate: new Date().toISOString(),
        administeredBy: assessmentData.metadata.administeredBy,
        documentSection: assessmentData.metadata.documentSection,
        qualityFlags: assessmentData.metadata.qualityFlags || [],
        notes: assessmentData.metadata.notes
      }
    };

    return await storage.createAssessment(insertData);
  }

  /**
   * Generate basic recommendations based on assessment results
   */
  private generateRecommendations(assessmentData: AssessmentExtraction['assessmentsFound'][0]): string | null {
    const { instrument, scores } = assessmentData;
    const totalScore = scores.totalScore;
    const severity = scores.severity;

    let recommendations: string[] = [];

    switch (instrument) {
      case AssessmentInstrument.PHQ9:
        if (totalScore >= 15) {
          recommendations.push("Consider immediate psychiatric evaluation for severe depression");
          recommendations.push("Assess for suicide risk");
        } else if (totalScore >= 10) {
          recommendations.push("Consider psychotherapy and/or medication for moderate depression");
        } else if (totalScore >= 5) {
          recommendations.push("Monitor symptoms, consider brief intervention");
        }
        break;

      case AssessmentInstrument.GAD7:
        if (totalScore >= 15) {
          recommendations.push("Consider treatment for severe anxiety");
        } else if (totalScore >= 10) {
          recommendations.push("Consider treatment for moderate anxiety");
        } else if (totalScore >= 5) {
          recommendations.push("Monitor anxiety symptoms");
        }
        break;

      case AssessmentInstrument.PCL5:
        if (totalScore >= 33) {
          recommendations.push("Consider PTSD evaluation and trauma-focused therapy");
        }
        break;

      default:
        if (severity === "severe") {
          recommendations.push("Consider immediate clinical attention");
        } else if (severity === "moderate" || severity === "moderately severe") {
          recommendations.push("Consider therapeutic intervention");
        }
    }

    return recommendations.length > 0 ? recommendations.join("; ") : null;
  }

  /**
   * Batch extract assessments for all documents of a client
   */
  async extractAssessmentsForClient(
    clientId: string,
    therapistId: string,
    options: {
      forceReextraction?: boolean;
      documentIds?: string[];
    } = {}
  ): Promise<{
    success: boolean;
    totalDocuments: number;
    processedDocuments: number;
    assessmentsCreated: number;
    results: AssessmentExtractionResult[];
    errors?: string[];
  }> {
    
    console.log(`[Assessment Extractor] Starting batch assessment extraction for client ${clientId}`);
    
    try {
      // Get documents for the client
      let documents: Document[];
      
      if (options.documentIds?.length) {
        // Process specific documents
        documents = [];
        for (const docId of options.documentIds) {
          const doc = await storage.getDocumentById(docId, therapistId);
          if (doc && doc.clientId === clientId) {
            documents.push(doc);
          }
        }
      } else {
        // Process all client documents
        documents = await storage.getDocumentsByClient(clientId, therapistId);
      }

      const results: AssessmentExtractionResult[] = [];
      const errors: string[] = [];
      let assessmentsCreated = 0;

      for (const document of documents) {
        try {
          // Skip if document already has assessments (unless force reextraction)
          if (!options.forceReextraction) {
            const existingAssessments = await storage.getAssessmentsByClient(clientId, therapistId);
            const hasAssessmentFromDoc = existingAssessments.some(a => 
              a.metadata && 
              typeof a.metadata === 'object' && 
              'sourceDocumentId' in a.metadata && 
              a.metadata.sourceDocumentId === document.id
            );
            
            if (hasAssessmentFromDoc) {
              console.log(`[Assessment Extractor] Skipping document ${document.id} - assessments already extracted`);
              continue;
            }
          }

          const result = await this.extractAssessmentsFromDocument(document, therapistId, clientId);
          results.push(result);
          assessmentsCreated += result.assessmentsCreated.length;
          
          if (result.errors?.length) {
            errors.push(...result.errors);
          }
        } catch (error) {
          const errorMsg = `Failed to process document ${document.id}: ${error}`;
          console.error(`[Assessment Extractor] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      console.log(`[Assessment Extractor] Batch extraction complete for client ${clientId}: ${assessmentsCreated} assessments created from ${results.length} documents`);

      return {
        success: true,
        totalDocuments: documents.length,
        processedDocuments: results.length,
        assessmentsCreated,
        results,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error(`[Assessment Extractor] Batch extraction failed for client ${clientId}:`, error);
      return {
        success: false,
        totalDocuments: 0,
        processedDocuments: 0,
        assessmentsCreated: 0,
        results: [],
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Check if document likely contains assessment data (lightweight check)
   */
  async hasAssessmentContent(document: Document): Promise<{
    hasContent: boolean;
    confidence: number;
    suggestedInstruments: string[];
  }> {
    
    if (!document.content) {
      return { hasContent: false, confidence: 0, suggestedInstruments: [] };
    }

    // Quick keyword-based detection for common instruments
    const content = document.content.toLowerCase();
    const keywords = {
      [AssessmentInstrument.PHQ9]: ['phq-9', 'phq9', 'patient health questionnaire', 'depression screening'],
      [AssessmentInstrument.GAD7]: ['gad-7', 'gad7', 'generalized anxiety disorder', 'anxiety screening'],
      [AssessmentInstrument.PCL5]: ['pcl-5', 'pcl5', 'ptsd checklist', 'trauma screening'],
      [AssessmentInstrument.BDI2]: ['bdi-ii', 'bdi2', 'beck depression inventory'],
      [AssessmentInstrument.BAI]: ['beck anxiety inventory', 'bai'],
      [AssessmentInstrument.DASS21]: ['dass-21', 'dass21', 'depression anxiety stress']
    };

    const suggestedInstruments: string[] = [];
    let maxConfidence = 0;

    for (const [instrument, instrumentKeywords] of Object.entries(keywords)) {
      const matches = instrumentKeywords.filter(keyword => content.includes(keyword));
      if (matches.length > 0) {
        suggestedInstruments.push(instrument);
        maxConfidence = Math.max(maxConfidence, matches.length * 0.3);
      }
    }

    // Look for numeric patterns that might indicate scores
    const hasScorePatterns = /(?:score|total|sum)[:\s]*(\d+)/.test(content) ||
                           /\d+\/\d+/.test(content) ||
                           /(\d+)\s*out\s*of\s*(\d+)/.test(content);

    if (hasScorePatterns) {
      maxConfidence += 0.2;
    }

    return {
      hasContent: suggestedInstruments.length > 0 || hasScorePatterns,
      confidence: Math.min(maxConfidence, 1.0),
      suggestedInstruments
    };
  }
}

// Export singleton instance
export const assessmentExtractor = new AssessmentExtractor();