import { Document, Client } from "@shared/schema";
import { storage } from "./storage";
import { aiRouter } from "./ai";
import { z } from "zod";

// Enhanced Zod schema for document analysis validation with auto-linking support
const documentAnalysisSchema = z.object({
  category: z.enum(["Assessment", "Session Note", "Treatment Plan", "Correspondence", "Legal", "Insurance", "Other"]),
  // New field to track document format/processing status
  documentFormat: z.object({
    type: z.enum(["transcript", "progress_note", "clinical_note", "intake_note", "discharge_summary", "unknown"]),
    needsProcessing: z.boolean(),
    processingNotes: z.string().optional()
  }),
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
    suggestedClientId: z.string().nullable().optional(),
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
    likelySessionType: z.enum(["individual", "group", "family", "assessment", "unknown"]).nullable().optional(),
    suggestedSessionDate: z.string().nullable().optional(),
    sessionKeywords: z.array(z.string()).nullable().optional(),
    therapyPhase: z.enum(["intake", "ongoing", "termination", "unknown"]).nullable().optional(),
    urgencyLevel: z.enum(["low", "medium", "high", "crisis"]).nullable().optional()
  }).optional(),
  linkingHints: z.object({
    timeReferences: z.array(z.string()).nullable().optional(),
    appointmentMentions: z.array(z.string()).nullable().optional(),
    sessionNumbers: z.array(z.string()).nullable().optional(),
    followUpReferences: z.array(z.string()).nullable().optional(),
    explicitDates: z.array(z.string()).nullable().optional()
  }).optional(),
  therapyConcepts: z.object({
    therapeuticApproaches: z.array(z.string()).nullable().optional(),
    clinicalTerms: z.array(z.string()).nullable().optional(),
    progressIndicators: z.array(z.string()).nullable().optional(),
    riskFactors: z.array(z.string()).nullable().optional(),
    strengthsIdentified: z.array(z.string()).nullable().optional()
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
  "documentFormat": {
    "type": "transcript|progress_note|clinical_note|intake_note|discharge_summary|unknown",
    "needsProcessing": true,
    "processingNotes": "Explain why this document needs or doesn't need processing"
  },
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
    "followUpReferences": ["homework for next time", "follow up"],
    "explicitDates": ["2024-07-05", "July 5 2024", "7/5/2024"]
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
   - All session-related documents should be categorized as "Session Note"

2. **Document Format Detection** (CRITICAL for processing workflow):
   - **transcript**: Raw verbatim dialogue, Q&A format, conversation-style, Speaker labels (Therapist:/Client:)
     * needsProcessing = TRUE (requires conversion to clinical note)
     * processingNotes: "Raw transcript requiring conversion to SOAP/DAP format"

   - **progress_note**: Already formatted clinical note, SOAP/DAP/BIRP format, professional clinical language
     * needsProcessing = FALSE (ready to use as-is)
     * processingNotes: "Already in clinical format, no processing needed"

   - **clinical_note**: Narrative clinical documentation, professional but not SOAP format
     * needsProcessing = FALSE (ready to use)

   - **intake_note**: Initial assessment/intake documentation
     * needsProcessing = FALSE (specialized format, ready to use)

3. **Entity Extraction**: Extract ALL relevant clinical entities including medications, diagnoses, symptoms, interventions, goals, and assessment types
4. **Client Matching**: Use names, demographic info, and context clues to match clients with confidence scores
5. **Session Context Analysis**: 
   - Determine likely session type from content (individual therapy vs group vs family)
   - Extract any mentioned or implied session dates
   - Identify therapy phase (intake assessment vs ongoing treatment vs termination)
   - Assess urgency level based on content and tone
6. **Linking Hints Extraction**: Find specific references that help link to sessions:
   - Time references (relative dates, appointment times)
   - Direct appointment mentions
   - Session numbering or sequencing
   - Follow-up references
   - **Explicit dates**: Extract any specific dates mentioned (e.g., "7/5/2024", "July 5, 2024", "session on 07-05-2024")
7. **Therapy Concepts**: Extract sophisticated clinical concepts:
   - Therapeutic approaches and modalities used
   - Clinical terminology and techniques
   - Progress indicators and outcomes
   - Risk factors requiring attention
   - Client strengths and resources
8. **Auto-Linking Optimization**: Focus on extracting information that will help the system automatically link this document to the correct therapy session within a ±48 hour window

CRITICAL PROCESSING DECISION RULES:
- If document contains speaker labels like "Therapist:", "Client:", "T:", "C:" → type="transcript", needsProcessing=TRUE
- If document has conversational Q&A format with minimal clinical terminology → type="transcript", needsProcessing=TRUE
- If document follows SOAP format (Subjective/Objective/Assessment/Plan) → type="progress_note", needsProcessing=FALSE
- If document follows DAP format (Data/Assessment/Plan) → type="progress_note", needsProcessing=FALSE
- If document has professional clinical summary with diagnosis codes → type="progress_note", needsProcessing=FALSE
- If document is narrative but uses clinical language and structure → type="clinical_note", needsProcessing=FALSE

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

    // Define proper Zod schema for session matching results
    const sessionMatchingSchema = z.array(z.object({
      sessionId: z.string(),
      confidence: z.number().min(0).max(1),
      matchReason: z.string(),
      matchingFactors: z.array(z.string())
    }));

    const matchingResults = await aiRouter.chatJSON(
      [{ role: "user", content: sessionMatchingPrompt }],
      sessionMatchingSchema,
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

    // Define proper Zod schema for calendar analysis results
    const calendarAnalysisSchema = z.object({
      extractedDates: z.array(z.string()),
      appointmentReferences: z.array(z.string()),
      timeReferences: z.array(z.string()),
      calendarKeywords: z.array(z.string()),
      suggestedEventWindow: z.object({
        start: z.string(),
        end: z.string()
      }).optional()
    });

    const calendarAnalysis = await aiRouter.chatJSON(
      [{ role: "user", content: calendarPrompt }],
      calendarAnalysisSchema,
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

    // Get AI tagging insights
    const clientTags = await storage.getClientAITags(clientId, therapistId);
    const sessionTags = sessions
      .filter(s => s.aiTags)
      .map(s => ({
        date: s.sessionDate,
        tags: s.aiTags,
        sessionId: s.id
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Get session trends analysis
    const sessionTrends = await storage.getSessionTagTrends(clientId, therapistId);

    const conceptualizationPrompt = `
You are a licensed clinical psychologist providing comprehensive case conceptualization. Analyze all available data including advanced AI tagging insights to provide evidence-based clinical insights.

Client Information:
Name: ${client.firstName} ${client.lastName}
DOB: ${client.dateOfBirth}
Demographics: ${client.sex || 'Unknown'}, ${client.genderIdentity || 'Unknown'}, ${client.race || 'Unknown'}
Relationship: ${client.relationshipStatus || 'Unknown'}
Employment: ${client.employment || 'Unknown'}

AI-Generated Client Profile Insights:
${clientTags ? `
Therapy Trajectory: ${JSON.stringify(clientTags.therapyTrajectory, null, 2)}
Risk Profile: ${JSON.stringify(clientTags.riskProfile, null, 2)}
Client Strengths: ${JSON.stringify(clientTags.clientStrengths, null, 2)}
Treatment Response: ${JSON.stringify(clientTags.treatmentResponse, null, 2)}
Recurring Themes: ${JSON.stringify(clientTags.recurringThemes, null, 2)}
Clinical Patterns: ${JSON.stringify(clientTags.clinicalPatterns, null, 2)}
Engagement Profile: ${JSON.stringify(clientTags.engagementProfile, null, 2)}
Clinical Recommendations: ${JSON.stringify(clientTags.clinicalRecommendations, null, 2)}
` : 'No AI client tags available'}

Recent Session AI Analysis (Last ${Math.min(sessionTags.length, 5)} sessions):
${sessionTags.slice(0, 5).map((st, i) => `
Session ${i + 1} (${new Date(st.date).toLocaleDateString()}):
- Themes: ${st.tags.sessionThemes?.join(', ') || 'None'}
- Client Mood: ${st.tags.clientMood?.primary || 'Unknown'} (${st.tags.clientMood?.intensity || 'unknown'} intensity)
- Engagement: ${st.tags.clientEngagement?.level || 'Unknown'}
- Risk Factors: Suicide: ${st.tags.riskFactors?.suicideRisk || 'none'}, Substance: ${st.tags.riskFactors?.substanceUse || 'none'}
- Progress Markers: ${st.tags.progressMarkers?.improvements?.length || 0} improvements, ${st.tags.progressMarkers?.challenges?.length || 0} challenges
- Intervention Effectiveness: ${st.tags.interventionEffectiveness?.map(ie => `${ie.intervention}: ${ie.effectiveness}`).join(', ') || 'None assessed'}
- Session Quality: ${st.tags.sessionQuality || 'Unknown'}
- Therapeutic Relationship: ${st.tags.therapeuticRelationship || 'Unknown'}
- Clinical Observations: ${st.tags.clinicalObservations?.join('; ') || 'None'}
`).join('\n')}

Session Trend Analysis:
Total Sessions: ${sessions.length}
Tagged Sessions: ${sessionTrends?.taggedSessions || 0}
Trend Data Available: ${sessionTrends?.trends ? 'Yes' : 'No'}

Assessment History (${assessments.length} total):
${assessments.slice(0, 3).map(a => `Type: ${a.assessmentType}, Date: ${new Date(a.assessmentDate).toLocaleDateString()}, Scores: ${JSON.stringify(a.scores)}, Interpretation: ${a.interpretation || 'None'}`).join('\n')}

Treatment Plans (${treatmentPlans.length} total):
${treatmentPlans.slice(0, 2).map(tp => `Start: ${new Date(tp.startDate).toLocaleDateString()}, Goals: ${JSON.stringify(tp.goals)}, Interventions: ${JSON.stringify(tp.interventions)}`).join('\n')}

Documents: ${documents.length} total documents available for analysis

Please provide a comprehensive, evidence-based case conceptualization in JSON format:
{
  "conceptualization": "Detailed clinical case formulation integrating AI insights with traditional assessment. Include: presenting problems, precipitating factors, predisposing factors, perpetuating factors, protective factors, and AI-identified patterns. Use the AI tagging data to provide data-driven insights about therapy progress, intervention effectiveness, and client patterns.",
  "patterns": [
    "AI-identified recurring themes and patterns from session analysis",
    "Mood and engagement patterns from session tracking",
    "Treatment response patterns from intervention effectiveness analysis",
    "Risk factor patterns and trends over time",
    "Client strength patterns and therapeutic alliance development"
  ],
  "recommendations": [
    "Evidence-based intervention recommendations based on AI analysis of what works best for this client",
    "Specific therapeutic approaches recommended based on effectiveness data",
    "Risk management recommendations based on AI risk assessment",
    "Goal adjustment recommendations based on progress analysis",
    "Session frequency and treatment planning recommendations based on engagement and progress patterns"
  ],
  "riskFactors": [
    "Current and ongoing risk factors identified through AI analysis",
    "Risk patterns and trends from session tracking",
    "Environmental and situational risk factors"
  ],
  "strengths": [
    "Client strengths identified through AI analysis of session content",
    "Protective factors and resilience indicators",
    "Therapeutic alliance strengths and engagement factors",
    "Coping strategies and resources that have proven effective"
  ]
}

ENHANCED ANALYSIS GUIDELINES:
1. **AI-Informed Assessment**: Integrate AI tagging insights with clinical judgment for comprehensive understanding
2. **Pattern Recognition**: Use longitudinal AI data to identify therapeutic patterns not visible in individual sessions
3. **Evidence-Based Recommendations**: Ground recommendations in AI analysis of intervention effectiveness for this specific client
4. **Risk-Informed Practice**: Use AI risk assessment trends to inform safety planning and clinical decision-making
5. **Strengths-Based Approach**: Leverage AI identification of client strengths and effective coping strategies
6. **Treatment Optimization**: Use AI analysis of session quality and engagement to optimize therapeutic approach
7. **Progress Tracking**: Incorporate AI-identified progress markers and outcome patterns
8. **Clinical Integration**: Synthesize AI insights with traditional clinical assessment for holistic understanding

Focus on actionable, personalized insights that support effective ongoing treatment based on comprehensive data analysis.
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
        systemPrompt: "You are a licensed clinical psychologist providing evidence-based case conceptualization enhanced with AI insights. Always respond with valid JSON that integrates AI tagging data with clinical expertise.",
        maxTokens: 3000
      }
    );
  } catch (error) {
    console.error("Error generating enhanced case conceptualization:", error);
    throw new Error(`Enhanced case conceptualization failed: ${(error as any)?.message || error}`);
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
  
  // Determine document format and processing needs (for Session Notes)
  let documentFormat: { type: any; needsProcessing: boolean; processingNotes?: string } = {
    type: 'unknown',
    needsProcessing: false,
    processingNotes: 'Unable to determine format without AI analysis'
  };

  if (category === 'Session Note') {
    // Check for transcript indicators
    const hasTranscriptMarkers =
      content.toLowerCase().includes('therapist:') ||
      content.toLowerCase().includes('client:') ||
      /\b(therapist|client)\s*:/i.test(content);

    // Check for progress note indicators
    const hasProgressNoteMarkers =
      content.toLowerCase().includes('subjective:') ||
      content.toLowerCase().includes('objective:') ||
      /soap|dap|birp/i.test(content.toLowerCase());

    if (hasTranscriptMarkers) {
      documentFormat = {
        type: 'transcript',
        needsProcessing: true,
        processingNotes: 'Detected transcript format - requires conversion to clinical note'
      };
    } else if (hasProgressNoteMarkers) {
      documentFormat = {
        type: 'progress_note',
        needsProcessing: false,
        processingNotes: 'Detected structured progress note format - ready to use'
      };
    } else {
      documentFormat = {
        type: 'clinical_note',
        needsProcessing: false,
        processingNotes: 'Clinical narrative format - ready to use'
      };
    }
  }

  return {
    category: category as any,
    documentFormat,
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
      followUpReferences: [],
      explicitDates: []
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
