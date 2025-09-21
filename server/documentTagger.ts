import { Document, Client } from "@shared/schema";
import { storage } from "./storage";
import { aiRouter } from "./ai";
import { z } from "zod";

// Zod schema for document analysis validation
const documentAnalysisSchema = z.object({
  category: z.enum(["Assessment", "Session Note", "Treatment Plan", "Correspondence", "Legal", "Insurance", "Other"]),
  tags: z.array(z.string()),
  entities: z.object({
    medications: z.array(z.string()).optional(),
    diagnoses: z.array(z.string()).optional(),
    dates: z.array(z.string()).optional(),
    symptoms: z.array(z.string()).optional()
  }),
  clientMatch: z.object({
    confidence: z.number(),
    suggestedClientId: z.string().optional(),
    reasoning: z.string()
  }).optional(),
  summary: z.string(),
  sensitiveInfo: z.object({
    hasSensitiveContent: z.boolean(),
    types: z.array(z.string())
  }),
  keyInsights: z.array(z.string())
});

export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;

export const analyzeDocument = async (
  document: Document,
  therapistId: string
): Promise<DocumentAnalysis> => {
  try {
    if (!document.content) {
      throw new Error("Document has no content to analyze");
    }

    // Get therapist's clients for potential matching
    const clients = await storage.getClientsByTherapist(therapistId);
    const clientNames = clients.map(c => `${c.firstName} ${c.lastName}`);

    const analysisPrompt = `
You are an AI assistant specialized in analyzing therapy practice documents. Please analyze the following document and provide a comprehensive analysis.

Document filename: ${document.fileName}
Document content: ${document.content.substring(0, 4000)}...

Available clients: ${clientNames.join(", ")}

Please provide your analysis in the following JSON format:
{
  "category": "Assessment|Session Note|Treatment Plan|Correspondence|Legal|Insurance|Other",
  "tags": ["tag1", "tag2", "tag3"],
  "entities": {
    "medications": ["medication names if any"],
    "diagnoses": ["diagnostic terms if any"],
    "dates": ["important dates if any"],
    "symptoms": ["symptoms mentioned if any"]
  },
  "clientMatch": {
    "confidence": 0.85,
    "suggestedClientId": "client-id-if-match-found",
    "reasoning": "explanation of why this client was matched"
  },
  "summary": "Brief summary of the document content",
  "sensitiveInfo": {
    "hasSensitiveContent": true,
    "types": ["suicide risk", "substance abuse", "family issues"]
  },
  "keyInsights": ["insight1", "insight2", "insight3"]
}

Guidelines:
1. Category should be the primary document type
2. Tags should be relevant therapy-related keywords (3-8 tags)
3. Extract specific medical/clinical entities mentioned
4. If you can match this document to a specific client based on names or context, provide that match with confidence
5. Identify any sensitive information that requires special handling
6. Provide 2-5 key insights about the content that would be valuable for the therapist
`;

    const analysisResult = await aiRouter.chatJSON(
      [
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      documentAnalysisSchema,
      {
        systemPrompt: "You are a specialized AI for analyzing therapy practice documents. Always respond with valid JSON.",
        maxTokens: 2048
      }
    );

    // If a client match was suggested, find the actual client ID
    if (analysisResult.clientMatch && analysisResult.clientMatch.confidence > 0.7) {
      const matchedClient = clients.find(client => 
        `${client.firstName} ${client.lastName}`.toLowerCase()
          .includes(analysisResult.clientMatch?.suggestedClientId?.toLowerCase() || "")
      );
      if (matchedClient && analysisResult.clientMatch) {
        analysisResult.clientMatch.suggestedClientId = matchedClient.id;
      }
    }

    return analysisResult as DocumentAnalysis;
  } catch (error) {
    console.error("Error analyzing document:", error);
    throw new Error(`Document analysis failed: ${(error as any)?.message || error}`);
  }
};

// Zod schema for case conceptualization validation
const caseConceptualizationSchema = z.object({
  conceptualization: z.string(),
  patterns: z.array(z.string()),
  recommendations: z.array(z.string()),
  riskFactors: z.array(z.string()),
  strengths: z.array(z.string())
});

export type CaseConceptualization = z.infer<typeof caseConceptualizationSchema>;

export const generateCaseConceptualization = async (
  clientId: string,
  therapistId: string
): Promise<CaseConceptualization> => {
  try {
    // Gather all client data
    const client = await storage.getClientById(clientId, therapistId);
    if (!client) {
      throw new Error("Client not found");
    }

    const sessions = await storage.getSessionsByClient(clientId, therapistId);
    const assessments = await storage.getAssessmentsByClient(clientId, therapistId);
    const treatmentPlans = await storage.getTreatmentPlansByClient(clientId, therapistId);
    const documents = await storage.getDocumentsByClient(clientId, therapistId);

    const conceptualizationPrompt = `
You are a licensed clinical psychologist providing case conceptualization. Analyze all available data for this client and provide comprehensive clinical insights.

Client Information:
Name: ${client.firstName} ${client.lastName}
DOB: ${client.dateOfBirth}

Recent Sessions (${sessions.length} total):
${sessions.slice(0, 5).map(s => `Date: ${s.sessionDate}, Notes: ${s.notes?.substring(0, 500) || 'No notes'}`).join('\n')}

Assessments (${assessments.length} total):
${assessments.slice(0, 3).map(a => `Type: ${a.assessmentType}, Date: ${a.assessmentDate}, Scores: ${JSON.stringify(a.scores)}`).join('\n')}

Treatment Plans (${treatmentPlans.length} total):
${treatmentPlans.slice(0, 2).map(tp => `Goals: ${JSON.stringify(tp.goals)}, Interventions: ${JSON.stringify(tp.interventions)}`).join('\n')}

Please provide a comprehensive case conceptualization in JSON format:
{
  "conceptualization": "Detailed clinical case formulation including presenting problems, precipitating factors, predisposing factors, perpetuating factors, and protective factors",
  "patterns": ["pattern1", "pattern2", "pattern3"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
  "riskFactors": ["risk1", "risk2"],
  "strengths": ["strength1", "strength2", "strength3"]
}

Focus on evidence-based insights and practical clinical recommendations.
`;

    return await aiRouter.chatJSON(
      [
        {
          role: "user",
          content: conceptualizationPrompt
        }
      ],
      caseConceptualizationSchema,
      {
        systemPrompt: "You are a licensed clinical psychologist providing evidence-based case conceptualization. Always respond with valid JSON.",
        maxTokens: 2048
      }
    );
  } catch (error) {
    console.error("Error generating case conceptualization:", error);
    throw new Error(`Case conceptualization failed: ${(error as any)?.message || error}`);
  }
};
