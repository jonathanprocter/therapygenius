import { Document, Client } from "@shared/schema";
import { storage } from "./storage";
import { aiRouter } from "./ai";
import { z } from "zod";

// Enhanced Zod schema for document analysis validation with auto-linking support
const documentAnalysisSchema = z.object({
  category: z.enum(["Assessment", "Session Note", "Treatment Plan", "Correspondence", "Legal", "Insurance", "Other"]),
  tags: z.array(z.string()),
  entities: z.object({
    medications: z.array(z.string()).optional(),
    diagnoses: z.array(z.string()).optional(),
    dates: z.array(z.string()).optional(),
    symptoms: z.array(z.string()).optional(),
    interventions: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional(),
    assessmentTypes: z.array(z.string()).optional()
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
  keyInsights: z.array(z.string()),
  // Enhanced fields for auto-linking
  sessionContext: z.object({
    likelySessionType: z.enum(["individual", "group", "family", "assessment", "unknown"]).optional(),
    suggestedSessionDate: z.string().optional(),
    sessionKeywords: z.array(z.string()).optional(),
    therapyPhase: z.enum(["intake", "ongoing", "termination", "unknown"]).optional(),
    urgencyLevel: z.enum(["low", "medium", "high", "crisis"]).optional()
  }).optional(),
  linkingHints: z.object({
    timeReferences: z.array(z.string()).optional(),
    appointmentMentions: z.array(z.string()).optional(),
    sessionNumbers: z.array(z.string()).optional(),
    followUpReferences: z.array(z.string()).optional()
  }).optional(),
  therapyConcepts: z.object({
    therapeuticApproaches: z.array(z.string()).optional(),
    clinicalTerms: z.array(z.string()).optional(),
    progressIndicators: z.array(z.string()).optional(),
    riskFactors: z.array(z.string()).optional(),
    strengthsIdentified: z.array(z.string()).optional()
  }).optional()
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
You are an AI assistant specialized in analyzing therapy practice documents for intelligent auto-linking to sessions and calendar appointments. 

Document filename: ${document.fileName}
Document content: ${document.content.substring(0, 4000)}...

Available clients: ${clientNames.join(", ")}

Please provide a comprehensive analysis in the following JSON format:
{
  "category": "Assessment|Session Note|Treatment Plan|Correspondence|Legal|Insurance|Other",
  "tags": ["tag1", "tag2", "tag3"],
  "entities": {
    "medications": ["medication names if any"],
    "diagnoses": ["diagnostic terms if any"],
    "dates": ["important dates if any"],
    "symptoms": ["symptoms mentioned if any"],
    "interventions": ["CBT", "DBT", "mindfulness techniques"],
    "goals": ["treatment goals mentioned"],
    "assessmentTypes": ["PHQ-9", "GAD-7", "assessment tools used"]
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
  "keyInsights": ["insight1", "insight2", "insight3"],
  "sessionContext": {
    "likelySessionType": "individual|group|family|assessment|unknown",
    "suggestedSessionDate": "YYYY-MM-DD if mentioned or can be inferred",
    "sessionKeywords": ["session-specific terms found"],
    "therapyPhase": "intake|ongoing|termination|unknown",
    "urgencyLevel": "low|medium|high|crisis"
  },
  "linkingHints": {
    "timeReferences": ["today", "last week", "next appointment"],
    "appointmentMentions": ["scheduled for", "follow-up appointment"],
    "sessionNumbers": ["session 3", "third session"],
    "followUpReferences": ["homework for next time", "follow up"]
  },
  "therapyConcepts": {
    "therapeuticApproaches": ["CBT", "DBT", "psychodynamic", "humanistic"],
    "clinicalTerms": ["transference", "cognitive restructuring", "exposure"],
    "progressIndicators": ["improved mood", "decreased anxiety", "better coping"],
    "riskFactors": ["suicide ideation", "substance use", "social isolation"],
    "strengthsIdentified": ["good insight", "motivated", "strong support system"]
  }
}

ENHANCED ANALYSIS GUIDELINES:
1. **Category Classification**: Determine the primary document type based on content structure and purpose
2. **Entity Extraction**: Extract ALL relevant clinical entities including medications, diagnoses, symptoms, interventions, goals, and assessment types
3. **Client Matching**: Use names, demographic info, and context clues to match clients with confidence scores
4. **Session Context Analysis**: 
   - Determine likely session type from content (individual therapy vs group vs family)
   - Extract any mentioned or implied session dates
   - Identify therapy phase (intake assessment vs ongoing treatment vs termination)
   - Assess urgency level based on content and tone
5. **Linking Hints Extraction**: Find specific references that help link to sessions:
   - Time references (relative dates, appointment times)
   - Direct appointment mentions
   - Session numbering or sequencing
   - Follow-up references
6. **Therapy Concepts**: Extract sophisticated clinical concepts:
   - Therapeutic approaches and modalities used
   - Clinical terminology and techniques
   - Progress indicators and outcomes
   - Risk factors requiring attention
   - Client strengths and resources
7. **Auto-Linking Optimization**: Focus on extracting information that will help the system automatically link this document to the correct therapy session within a ±48 hour window

Prioritize accuracy and completeness for auto-linking functionality.
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

/**
 * Enhanced session matching analysis using AI and document content
 */
export const analyzeDocumentForSessionMatching = async (
  document: Document,
  potentialSessions: Array<{ id: string; sessionDate: Date; notes?: string; sessionType?: string }>,
  therapistId: string
): Promise<Array<{
  sessionId: string;
  confidence: number;
  matchReason: string;
  matchingFactors: string[];
}>> => {
  try {
    if (!document.content || potentialSessions.length === 0) {
      return [];
    }

    const sessionMatchingPrompt = `
You are an AI specialist in matching therapy documents to specific therapy sessions. Analyze the document content and determine which sessions it most likely relates to.

Document Content: ${document.content.substring(0, 3000)}

Potential Sessions:
${potentialSessions.map((session, idx) => `
Session ${idx + 1}:
- ID: ${session.id}
- Date: ${session.sessionDate.toLocaleDateString()}
- Type: ${session.sessionType || 'Not specified'}
- Notes: ${session.notes?.substring(0, 800) || 'No notes available'}
`).join('\n')}

For each session, analyze the likelihood that this document relates to that specific session. Consider:
1. Temporal proximity (documents are usually created within 48 hours of sessions)
2. Content alignment (topics, interventions, assessments mentioned)
3. Session type compatibility (individual notes for individual sessions, etc.)
4. Specific references to session events or homework
5. Clinical terminology and intervention continuity

Respond with JSON array:
[
  {
    "sessionId": "session-id",
    "confidence": 0.85,
    "matchReason": "Strong content alignment with CBT techniques and homework mentioned",
    "matchingFactors": ["CBT terminology", "homework reference", "temporal proximity"]
  }
]

Only include sessions with confidence > 0.3. Sort by confidence (highest first).
`;

    const matchingResults = await aiRouter.chatJSON(
      [{ role: "user", content: sessionMatchingPrompt }],
      {
        type: "array",
        items: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            matchReason: { type: "string" },
            matchingFactors: { 
              type: "array", 
              items: { type: "string" }
            }
          },
          required: ["sessionId", "confidence", "matchReason", "matchingFactors"]
        }
      } as any,
      {
        systemPrompt: "You are an expert at matching therapy documents to sessions. Always respond with valid JSON.",
        maxTokens: 1500
      }
    );

    return (matchingResults as any[])
      .filter(result => result.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence);

  } catch (error) {
    console.error('[DocumentTagger] Error in session matching analysis:', error);
    return [];
  }
};

/**
 * Extract calendar and appointment context from document content
 */
export const extractCalendarContext = async (
  document: Document,
  therapistId: string
): Promise<{
  extractedDates: string[];
  appointmentReferences: string[];
  timeReferences: string[];
  calendarKeywords: string[];
  suggestedEventWindow: { start: Date; end: Date } | null;
}> => {
  try {
    if (!document.content) {
      return {
        extractedDates: [],
        appointmentReferences: [],
        timeReferences: [],
        calendarKeywords: [],
        suggestedEventWindow: null
      };
    }

    const calendarPrompt = `
Analyze this therapy document for calendar and appointment-related information that could help link it to a calendar event.

Document Content: ${document.content.substring(0, 2000)}

Extract and identify:
1. **Dates**: Any specific dates mentioned (appointments, sessions, due dates)
2. **Appointment References**: Direct mentions of appointments, sessions, or meetings
3. **Time References**: Relative time references (today, yesterday, next week, etc.)
4. **Calendar Keywords**: Terms that suggest this relates to a scheduled event

Respond with JSON:
{
  "extractedDates": ["2024-03-15", "March 15th"],
  "appointmentReferences": ["next appointment", "scheduled session"],
  "timeReferences": ["today", "last week", "tomorrow"],
  "calendarKeywords": ["appointment", "session", "meeting", "follow-up"],
  "suggestedEventWindow": {
    "start": "2024-03-14T00:00:00Z",
    "end": "2024-03-16T23:59:59Z"
  }
}

For suggestedEventWindow, provide a 48-hour window around the most likely event date if one can be determined.
`;

    const calendarAnalysis = await aiRouter.chatJSON(
      [{ role: "user", content: calendarPrompt }],
      {
        type: "object",
        properties: {
          extractedDates: { type: "array", items: { type: "string" } },
          appointmentReferences: { type: "array", items: { type: "string" } },
          timeReferences: { type: "array", items: { type: "string" } },
          calendarKeywords: { type: "array", items: { type: "string" } },
          suggestedEventWindow: {
            type: "object",
            properties: {
              start: { type: "string" },
              end: { type: "string" }
            }
          }
        },
        required: ["extractedDates", "appointmentReferences", "timeReferences", "calendarKeywords"]
      } as any,
      {
        systemPrompt: "You are an expert at extracting calendar and appointment information from documents.",
        maxTokens: 800
      }
    );

    // Convert string dates to Date objects for suggestedEventWindow
    let suggestedEventWindow = null;
    if ((calendarAnalysis as any).suggestedEventWindow) {
      const window = (calendarAnalysis as any).suggestedEventWindow;
      suggestedEventWindow = {
        start: new Date(window.start),
        end: new Date(window.end)
      };
    }

    return {
      ...(calendarAnalysis as any),
      suggestedEventWindow
    };

  } catch (error) {
    console.error('[DocumentTagger] Error extracting calendar context:', error);
    return {
      extractedDates: [],
      appointmentReferences: [],
      timeReferences: [],
      calendarKeywords: [],
      suggestedEventWindow: null
    };
  }
};

/**
 * Generate enhanced analysis with auto-linking metadata
 */
export const generateAutoLinkingMetadata = async (
  document: Document,
  analysis: DocumentAnalysis,
  therapistId: string
): Promise<{
  linkingScore: number;
  autoLinkingRecommendation: 'auto' | 'review' | 'manual';
  confidenceFactors: string[];
  potentialIssues: string[];
}> => {
  try {
    let linkingScore = 0;
    const confidenceFactors: string[] = [];
    const potentialIssues: string[] = [];

    // Score based on client match
    if (analysis.clientMatch && analysis.clientMatch.confidence > 0.7) {
      linkingScore += 0.3;
      confidenceFactors.push(`Strong client match (${Math.round(analysis.clientMatch.confidence * 100)}%)`);
    } else if (analysis.clientMatch && analysis.clientMatch.confidence > 0.4) {
      linkingScore += 0.1;
      confidenceFactors.push(`Moderate client match (${Math.round(analysis.clientMatch.confidence * 100)}%)`);
    } else {
      potentialIssues.push('No clear client identification');
    }

    // Score based on session context
    if (analysis.sessionContext?.likelySessionType && analysis.sessionContext.likelySessionType !== 'unknown') {
      linkingScore += 0.2;
      confidenceFactors.push(`Clear session type: ${analysis.sessionContext.likelySessionType}`);
    }

    if (analysis.sessionContext?.suggestedSessionDate) {
      linkingScore += 0.2;
      confidenceFactors.push('Session date mentioned in document');
    }

    // Score based on therapy concepts
    if (analysis.therapyConcepts?.therapeuticApproaches && analysis.therapyConcepts.therapeuticApproaches.length > 0) {
      linkingScore += 0.15;
      confidenceFactors.push(`Therapeutic approaches identified: ${analysis.therapyConcepts.therapeuticApproaches.join(', ')}`);
    }

    // Score based on linking hints
    if (analysis.linkingHints?.timeReferences && analysis.linkingHints.timeReferences.length > 0) {
      linkingScore += 0.1;
      confidenceFactors.push('Time references found');
    }

    if (analysis.linkingHints?.appointmentMentions && analysis.linkingHints.appointmentMentions.length > 0) {
      linkingScore += 0.15;
      confidenceFactors.push('Appointment mentions found');
    }

    // Check for potential issues
    if (analysis.sensitiveInfo.hasSensitiveContent) {
      potentialIssues.push('Contains sensitive content - review required');
    }

    if (!document.content || document.content.length < 100) {
      potentialIssues.push('Document content too short for reliable analysis');
      linkingScore -= 0.2;
    }

    // Determine recommendation
    let autoLinkingRecommendation: 'auto' | 'review' | 'manual';
    if (linkingScore >= 0.8 && potentialIssues.length === 0) {
      autoLinkingRecommendation = 'auto';
    } else if (linkingScore >= 0.5) {
      autoLinkingRecommendation = 'review';
    } else {
      autoLinkingRecommendation = 'manual';
    }

    return {
      linkingScore: Math.min(1, Math.max(0, linkingScore)),
      autoLinkingRecommendation,
      confidenceFactors,
      potentialIssues
    };

  } catch (error) {
    console.error('[DocumentTagger] Error generating auto-linking metadata:', error);
    return {
      linkingScore: 0,
      autoLinkingRecommendation: 'manual',
      confidenceFactors: [],
      potentialIssues: ['Error in analysis - manual review required']
    };
  }
};

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

/**
 * Create deterministic document analysis when AI is disabled
 * Provides basic categorization and metadata extraction without external AI
 */
export const createDeterministicAnalysis = (document: Document, context: { therapistId: string; clientId?: string; sessionId?: string; sourceEventId?: string; manualClientOverride?: boolean }) => {
  const content = document.content || '';
  const fileName = document.fileName.toLowerCase();
  
  // Deterministic category based on filename and basic content analysis
  let category = 'Other';
  if (fileName.includes('assessment') || content.includes('assessment') || content.includes('evaluation')) {
    category = 'Assessment';
  } else if (fileName.includes('session') || fileName.includes('note') || content.includes('session note')) {
    category = 'Session Note';
  } else if (fileName.includes('treatment') || fileName.includes('plan') || content.includes('treatment plan')) {
    category = 'Treatment Plan';
  } else if (fileName.includes('correspondence') || fileName.includes('letter') || fileName.includes('email')) {
    category = 'Correspondence';
  }
  
  // Basic keyword extraction
  const commonKeywords = ['therapy', 'session', 'client', 'treatment', 'assessment', 'goals', 'progress'];
  const foundKeywords = commonKeywords.filter(keyword => 
    content.toLowerCase().includes(keyword) || fileName.includes(keyword)
  );
  
  // Basic insights based on content patterns
  const keyInsights = [];
  if (content.includes('homework') || content.includes('assignment')) {
    keyInsights.push('Contains homework or assignments');
  }
  if (content.includes('goal') || content.includes('objective')) {
    keyInsights.push('References treatment goals');
  }
  if (content.length > 1000) {
    keyInsights.push('Comprehensive documentation');
  }
  
  return {
    category: category as any,
    tags: foundKeywords,
    entities: {
      medications: [],
      diagnoses: [],
      dates: [],
      symptoms: [],
      interventions: [],
      goals: [],
      assessmentTypes: []
    },
    summary: `${category} document containing ${content.length} characters`,
    sensitiveInfo: {
      hasSensitiveContent: true, // Assume all therapy documents have sensitive content
      types: ['therapy content']
    },
    keyInsights,
    sessionContext: {
      likelySessionType: 'unknown' as const,
      therapyPhase: 'unknown' as const,
      urgencyLevel: 'low' as const
    },
    linkingHints: {
      timeReferences: [],
      appointmentMentions: [],
      sessionNumbers: [],
      followUpReferences: []
    },
    therapyConcepts: {
      therapeuticApproaches: [],
      clinicalTerms: [],
      progressIndicators: [],
      riskFactors: [],
      strengthsIdentified: []
    }
  };
};
