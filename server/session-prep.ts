/**
 * AI Session Prep Generator
 *
 * Generates intelligent session preparation materials including:
 * - Key themes from previous sessions to follow up on
 * - Important topics and concerns to address
 * - Progress markers and therapeutic engagement insights
 * - Case conceptualization summaries
 */

import { storage } from "./storage";
import { aiRouter } from "./ai";
import { Session, Document, Client } from "@shared/schema";

export interface SessionPrepData {
  sessionId: string;
  clientId: string;
  sessionDate: Date;
  previousSessionThemes: string[];
  topicsToRevisit: string[];
  progressMarkers: string[];
  concernsToAddress: string[];
  prepSummary: string;
  confidence: number;
  generatedAt: Date;
}

export interface ClientInsights {
  clientId: string;
  therapeuticEngagement: {
    level: 'high' | 'moderate' | 'low' | 'variable';
    description: string;
    trends: string[];
  };
  caseConceptualization: {
    presentingIssues: string[];
    coreConcerns: string[];
    strengths: string[];
    therapeuticApproach: string;
    progressSummary: string;
  };
  recentProgress: string[];
  areasOfFocus: string[];
  generatedAt: Date;
}

/**
 * Generate AI-powered session prep for an upcoming session
 */
export async function generateSessionPrep(
  sessionId: string,
  therapistId: string
): Promise<SessionPrepData | null> {
  try {
    console.log(`[Session Prep] Generating prep for session ${sessionId}`);

    // Get the target session
    const session = await storage.getSessionById(sessionId, therapistId);
    if (!session) {
      console.error(`[Session Prep] Session ${sessionId} not found`);
      return null;
    }

    // Get client information
    const client = await storage.getClientById(session.clientId, therapistId);
    if (!client) {
      console.error(`[Session Prep] Client ${session.clientId} not found`);
      return null;
    }

    // Get previous sessions (last 5 sessions before this one)
    const allSessions = await storage.getSessionsByClient(session.clientId, therapistId);
    const previousSessions = allSessions
      .filter(s => s.sessionDate < session.sessionDate && s.id !== sessionId)
      .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime())
      .slice(0, 5);

    console.log(`[Session Prep] Found ${previousSessions.length} previous sessions`);

    // Get documents for the client
    const allDocuments = await storage.getDocumentsByTherapist(therapistId);
    const clientDocuments = allDocuments
      .filter(doc => doc.clientId === session.clientId)
      .sort((a, b) => (b.uploadDate?.getTime() || 0) - (a.uploadDate?.getTime() || 0))
      .slice(0, 10);

    console.log(`[Session Prep] Found ${clientDocuments.length} client documents`);

    // Check if HIPAA AI is enabled
    const isHIPAACompliant = process.env.HIPAA_SAFE_AI === 'true';

    if (!isHIPAACompliant) {
      console.log('[Session Prep] HIPAA AI disabled, using deterministic prep generation');
      return generateDeterministicSessionPrep(session, client, previousSessions, clientDocuments);
    }

    // Build context for AI
    const previousSessionsSummary = previousSessions.map((s, index) => {
      return `Session ${index + 1} (${s.sessionDate.toLocaleDateString()}):
- Type: ${s.sessionType}
- Status: ${s.status}
- Notes: ${s.notes || 'No notes available'}`;
    }).join('\n\n');

    const documentsSummary = clientDocuments.slice(0, 5).map((doc, index) => {
      const metadata = doc.metadata as any;
      return `Document ${index + 1} - ${doc.fileName}:
- Category: ${metadata?.category || 'Unknown'}
- Key Insights: ${metadata?.keyInsights?.join(', ') || 'None'}`;
    }).join('\n\n');

    const prompt = `You are an expert clinical therapist preparing for an upcoming therapy session. Generate a comprehensive session preparation guide.

**Client Information:**
Name: ${client.firstName} ${client.lastName}
Session Date: ${session.sessionDate.toLocaleDateString()}
Session Type: ${session.sessionType}

**Previous Sessions Summary:**
${previousSessionsSummary || 'No previous sessions available'}

**Recent Documents:**
${documentsSummary || 'No recent documents available'}

**Task:** Generate a structured session prep guide with the following sections:

1. **Previous Session Themes** (array of 3-5 key themes from recent sessions to follow up on)
2. **Topics to Revisit** (array of 3-5 specific topics that need continued attention)
3. **Progress Markers** (array of 2-4 positive developments or progress indicators)
4. **Concerns to Address** (array of 2-4 important concerns or warning signs)
5. **Prep Summary** (2-3 paragraph narrative summary of what to focus on this session)

Format your response as valid JSON with this structure:
{
  "previousSessionThemes": ["theme1", "theme2", ...],
  "topicsToRevisit": ["topic1", "topic2", ...],
  "progressMarkers": ["marker1", "marker2", ...],
  "concernsToAddress": ["concern1", "concern2", ...],
  "prepSummary": "narrative summary here",
  "confidence": 0.85
}

Focus on clinically relevant information that will help the therapist provide effective care. Be specific and actionable.`;

    console.log('[Session Prep] Sending request to AI for prep generation');

    const response = await aiRouter.chat([
      {
        role: 'system',
        content: 'You are an expert clinical therapist. Respond only with valid JSON matching the requested structure.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      maxTokens: 2000,
      temperature: 0.3
    });

    // Parse AI response
    let prepData;
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        prepData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[Session Prep] Failed to parse AI response:', parseError);
      return generateDeterministicSessionPrep(session, client, previousSessions, clientDocuments);
    }

    const result: SessionPrepData = {
      sessionId: session.id,
      clientId: session.clientId,
      sessionDate: session.sessionDate,
      previousSessionThemes: prepData.previousSessionThemes || [],
      topicsToRevisit: prepData.topicsToRevisit || [],
      progressMarkers: prepData.progressMarkers || [],
      concernsToAddress: prepData.concernsToAddress || [],
      prepSummary: prepData.prepSummary || '',
      confidence: prepData.confidence || 0.7,
      generatedAt: new Date()
    };

    console.log(`[Session Prep] Generated prep for session ${sessionId} with confidence ${result.confidence}`);
    return result;

  } catch (error) {
    console.error('[Session Prep] Error generating session prep:', error);
    return null;
  }
}

/**
 * Generate deterministic session prep without AI
 */
function generateDeterministicSessionPrep(
  session: Session,
  client: Client,
  previousSessions: Session[],
  documents: Document[]
): SessionPrepData {
  console.log('[Session Prep] Generating deterministic prep');

  const themes: string[] = [];
  const topics: string[] = [];
  const progress: string[] = [];
  const concerns: string[] = [];

  // Extract themes from previous session notes
  if (previousSessions.length > 0) {
    const recentSession = previousSessions[0];
    if (recentSession.notes) {
      themes.push(`Follow up on topics from ${recentSession.sessionDate.toLocaleDateString()}`);
    }
  }

  // Add generic prep items based on session count
  if (previousSessions.length === 0) {
    themes.push('Initial intake and assessment');
    topics.push('Build therapeutic rapport');
    topics.push('Understand presenting concerns');
  } else if (previousSessions.length < 5) {
    themes.push('Continue building therapeutic alliance');
    topics.push('Explore presenting concerns in depth');
  } else {
    themes.push('Review progress toward treatment goals');
    topics.push('Address ongoing therapeutic work');
  }

  // Check session frequency for engagement
  if (previousSessions.length >= 2) {
    const lastSession = previousSessions[0];
    const secondLastSession = previousSessions[1];
    const daysBetween = Math.floor(
      (lastSession.sessionDate.getTime() - secondLastSession.sessionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysBetween <= 7) {
      progress.push('Consistent weekly attendance demonstrates engagement');
    } else if (daysBetween <= 14) {
      progress.push('Regular biweekly attendance maintained');
    } else if (daysBetween > 30) {
      concerns.push(`Gap of ${daysBetween} days since last session - check in on engagement`);
    }
  }

  // Document-based insights
  if (documents.length > 0) {
    progress.push(`${documents.length} documents on file for reference`);
  }

  const prepSummary = `Upcoming ${session.sessionType} session with ${client.firstName} ${client.lastName}. ` +
    `${previousSessions.length > 0 ? `This is session ${previousSessions.length + 1}. ` : 'This is an initial session. '}` +
    `Focus on continuing therapeutic work and addressing current needs.`;

  return {
    sessionId: session.id,
    clientId: session.clientId,
    sessionDate: session.sessionDate,
    previousSessionThemes: themes,
    topicsToRevisit: topics,
    progressMarkers: progress,
    concernsToAddress: concerns,
    prepSummary,
    confidence: 0.6,
    generatedAt: new Date()
  };
}

/**
 * Generate overall AI insights about a client
 */
export async function generateClientInsights(
  clientId: string,
  therapistId: string
): Promise<ClientInsights | null> {
  try {
    console.log(`[Client Insights] Generating insights for client ${clientId}`);

    // Get client information
    const client = await storage.getClientById(clientId, therapistId);
    if (!client) {
      console.error(`[Client Insights] Client ${clientId} not found`);
      return null;
    }

    // Get all sessions for the client
    const sessions = await storage.getSessionsByClient(clientId, therapistId);

    // Get all documents
    const allDocuments = await storage.getDocumentsByTherapist(therapistId);
    const clientDocuments = allDocuments.filter(doc => doc.clientId === clientId);

    console.log(`[Client Insights] Found ${sessions.length} sessions and ${clientDocuments.length} documents`);

    // Check if HIPAA AI is enabled
    const isHIPAACompliant = process.env.HIPAA_SAFE_AI === 'true';

    if (!isHIPAACompliant) {
      console.log('[Client Insights] HIPAA AI disabled, using deterministic insights');
      return generateDeterministicClientInsights(client, sessions, clientDocuments);
    }

    // Build context for AI
    const sessionsSummary = sessions
      .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime())
      .slice(0, 10)
      .map((s, index) => {
        return `Session ${index + 1} (${s.sessionDate.toLocaleDateString()}):
- Type: ${s.sessionType}
- Status: ${s.status}
- Notes: ${s.notes || 'No notes available'}`;
      }).join('\n\n');

    const documentsSummary = clientDocuments
      .sort((a, b) => (b.uploadDate?.getTime() || 0) - (a.uploadDate?.getTime() || 0))
      .slice(0, 5)
      .map((doc, index) => {
        const metadata = doc.metadata as any;
        return `Document ${index + 1} - ${doc.fileName}:
- Category: ${metadata?.category || 'Unknown'}
- Tags: ${metadata?.tags?.join(', ') || 'None'}
- Key Insights: ${metadata?.keyInsights?.join(', ') || 'None'}`;
      }).join('\n\n');

    const prompt = `You are an expert clinical therapist conducting a comprehensive case review. Generate overall insights about this client's therapeutic journey.

**Client Information:**
Name: ${client.firstName} ${client.lastName}
Total Sessions: ${sessions.length}
Documents on File: ${clientDocuments.length}

**Session History:**
${sessionsSummary || 'No sessions available'}

**Documentation:**
${documentsSummary || 'No documents available'}

**Task:** Generate comprehensive clinical insights with the following structure:

1. **Therapeutic Engagement:**
   - level: "high" | "moderate" | "low" | "variable"
   - description: Brief description of engagement pattern
   - trends: Array of 2-3 engagement trend observations

2. **Case Conceptualization:**
   - presentingIssues: Array of 3-5 primary presenting concerns
   - coreConcerns: Array of 2-4 underlying core issues
   - strengths: Array of 2-4 client strengths
   - therapeuticApproach: Recommended therapeutic approach/modality
   - progressSummary: 2-3 sentence summary of progress

3. **Recent Progress:** Array of 2-4 recent positive developments
4. **Areas of Focus:** Array of 2-4 key areas needing attention

Format your response as valid JSON with this structure:
{
  "therapeuticEngagement": {
    "level": "high",
    "description": "description here",
    "trends": ["trend1", "trend2"]
  },
  "caseConceptualization": {
    "presentingIssues": ["issue1", "issue2"],
    "coreConcerns": ["concern1", "concern2"],
    "strengths": ["strength1", "strength2"],
    "therapeuticApproach": "approach description",
    "progressSummary": "summary here"
  },
  "recentProgress": ["progress1", "progress2"],
  "areasOfFocus": ["area1", "area2"]
}

Focus on clinically relevant insights that support effective treatment planning.`;

    console.log('[Client Insights] Sending request to AI for insights generation');

    const response = await aiRouter.chat([
      {
        role: 'system',
        content: 'You are an expert clinical therapist. Respond only with valid JSON matching the requested structure.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      maxTokens: 2500,
      temperature: 0.3
    });

    // Parse AI response
    let insightsData;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insightsData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[Client Insights] Failed to parse AI response:', parseError);
      return generateDeterministicClientInsights(client, sessions, clientDocuments);
    }

    const result: ClientInsights = {
      clientId: client.id,
      therapeuticEngagement: insightsData.therapeuticEngagement || {
        level: 'moderate',
        description: 'Unable to generate engagement assessment',
        trends: []
      },
      caseConceptualization: insightsData.caseConceptualization || {
        presentingIssues: [],
        coreConcerns: [],
        strengths: [],
        therapeuticApproach: 'To be determined',
        progressSummary: 'Unable to generate progress summary'
      },
      recentProgress: insightsData.recentProgress || [],
      areasOfFocus: insightsData.areasOfFocus || [],
      generatedAt: new Date()
    };

    console.log(`[Client Insights] Generated insights for client ${clientId}`);
    return result;

  } catch (error) {
    console.error('[Client Insights] Error generating client insights:', error);
    return null;
  }
}

/**
 * Generate deterministic client insights without AI
 */
function generateDeterministicClientInsights(
  client: Client,
  sessions: Session[],
  documents: Document[]
): ClientInsights {
  console.log('[Client Insights] Generating deterministic insights');

  // Calculate engagement level based on session frequency
  let engagementLevel: 'high' | 'moderate' | 'low' | 'variable' = 'moderate';
  const engagementTrends: string[] = [];

  if (sessions.length >= 10) {
    engagementLevel = 'high';
    engagementTrends.push('Consistent long-term engagement');
  } else if (sessions.length >= 5) {
    engagementLevel = 'moderate';
    engagementTrends.push('Established therapeutic relationship');
  } else if (sessions.length > 0) {
    engagementLevel = 'moderate';
    engagementTrends.push('Early stage of treatment');
  } else {
    engagementLevel = 'low';
    engagementTrends.push('No sessions recorded yet');
  }

  // Check session regularity
  if (sessions.length >= 2) {
    const sortedSessions = sessions.sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime());
    const gaps = [];
    for (let i = 0; i < sortedSessions.length - 1 && i < 5; i++) {
      const daysBetween = Math.floor(
        (sortedSessions[i].sessionDate.getTime() - sortedSessions[i + 1].sessionDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      gaps.push(daysBetween);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    if (avgGap <= 10) {
      engagementTrends.push('Consistent weekly attendance');
    } else if (avgGap <= 20) {
      engagementTrends.push('Regular biweekly attendance');
    } else {
      engagementTrends.push('Variable attendance pattern');
      engagementLevel = 'variable';
    }
  }

  const result: ClientInsights = {
    clientId: client.id,
    therapeuticEngagement: {
      level: engagementLevel,
      description: `Client has attended ${sessions.length} session${sessions.length !== 1 ? 's' : ''} with ${documents.length} document${documents.length !== 1 ? 's' : ''} on file.`,
      trends: engagementTrends
    },
    caseConceptualization: {
      presentingIssues: sessions.length > 0 ? ['Treatment in progress'] : ['Initial assessment pending'],
      coreConcerns: [],
      strengths: sessions.length > 0 ? ['Engagement with treatment process'] : [],
      therapeuticApproach: 'Individualized treatment approach',
      progressSummary: sessions.length > 0
        ? `Client has completed ${sessions.length} session${sessions.length !== 1 ? 's' : ''}. Continued therapeutic work in progress.`
        : 'Initial assessment and treatment planning phase.'
    },
    recentProgress: sessions.length > 0 ? ['Attending scheduled sessions'] : [],
    areasOfFocus: sessions.length > 0 ? ['Continue current therapeutic work'] : ['Complete initial assessment'],
    generatedAt: new Date()
  };

  return result;
}
