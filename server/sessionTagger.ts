import { Session, Client, Document } from "@shared/schema";
import { storage } from "./storage";
import { aiRouter } from "./ai";
import { z } from "zod";

// Enhanced Zod schema for session AI tags validation
const sessionAITagsSchema = z.object({
  // Core session analysis
  sessionThemes: z.array(z.string()).optional(),
  interventionsUsed: z.array(z.string()).optional(),
  therapeuticApproaches: z.array(z.string()).optional(),
  
  // Client state and progress
  clientMood: z.object({
    primary: z.enum(["depressed", "anxious", "irritable", "stable", "elevated", "mixed", "unknown"]).optional(),
    secondary: z.array(z.string()).optional(),
    intensity: z.enum(["low", "moderate", "high", "severe"]).optional()
  }).optional(),
  
  clientEngagement: z.object({
    level: z.enum(["minimal", "limited", "moderate", "good", "excellent"]).optional(),
    participation: z.array(z.string()).optional(),
    resistance: z.array(z.string()).optional()
  }).optional(),
  
  // Progress and outcomes
  progressMarkers: z.object({
    improvements: z.array(z.string()).optional(),
    challenges: z.array(z.string()).optional(),
    breakthroughs: z.array(z.string()).optional(),
    regressions: z.array(z.string()).optional()
  }).optional(),
  
  goalProgress: z.array(z.object({
    goalArea: z.string(),
    status: z.enum(["not_started", "in_progress", "partially_met", "met", "exceeded"]),
    notes: z.string().optional()
  })).optional(),
  
  // Risk and safety assessment
  riskFactors: z.object({
    suicideRisk: z.enum(["none", "low", "moderate", "high", "imminent"]).optional(),
    selfHarmRisk: z.enum(["none", "low", "moderate", "high"]).optional(),
    substanceUse: z.enum(["none", "minimal", "moderate", "concerning", "severe"]).optional(),
    riskToOthers: z.enum(["none", "low", "moderate", "high"]).optional(),
    notes: z.array(z.string()).optional()
  }).optional(),
  
  // Intervention effectiveness
  interventionEffectiveness: z.array(z.object({
    intervention: z.string(),
    effectiveness: z.enum(["ineffective", "limited", "moderate", "effective", "highly_effective"]),
    notes: z.string().optional()
  })).optional(),
  
  // Clinical insights
  clinicalObservations: z.array(z.string()).optional(),
  diagnosticConsiderations: z.array(z.string()).optional(),
  strengthsIdentified: z.array(z.string()).optional(),
  
  // Homework and assignments
  homeworkAssigned: z.array(z.object({
    task: z.string(),
    purpose: z.string(),
    difficulty: z.enum(["easy", "moderate", "challenging"]).optional()
  })).optional(),
  
  homeworkReview: z.array(z.object({
    task: z.string(),
    completion: z.enum(["not_attempted", "partial", "completed", "exceeded"]),
    effectiveness: z.enum(["unhelpful", "somewhat_helpful", "helpful", "very_helpful"]).optional()
  })).optional(),
  
  // Session-specific metadata
  sessionQuality: z.enum(["poor", "fair", "good", "excellent"]).optional(),
  therapeuticRelationship: z.enum(["strained", "developing", "good", "strong", "excellent"]).optional(),
  nextSessionPlanning: z.array(z.string()).optional(),
  
  // Emergency or crisis indicators
  crisisIndicators: z.array(z.string()).optional(),
  immediateActions: z.array(z.string()).optional(),
  
  // Metadata
  generatedAt: z.string().optional(),
  aiModel: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

export type SessionAITags = z.infer<typeof sessionAITagsSchema>;

/**
 * Enhanced session AI tagging service for comprehensive therapeutic analysis
 */
export class SessionTagger {
  
  /**
   * Generate comprehensive AI tags for a therapy session
   */
  async generateSessionTags(sessionId: string, therapistId: string): Promise<SessionAITags> {
    try {
      // Get session data
      const session = await storage.getSessionById(sessionId, therapistId);
      if (!session) {
        throw new Error("Session not found");
      }

      // Get client data for context
      const client = await storage.getClientById(session.clientId, therapistId);
      if (!client) {
        throw new Error("Client not found");
      }

      // Get recent sessions for context
      const recentSessions = await storage.getSessionsByClient(session.clientId, therapistId);
      const sessionHistory = recentSessions
        .filter(s => s.id !== sessionId)
        .slice(0, 3)
        .map(s => ({
          date: s.sessionDate,
          notes: s.notes?.substring(0, 300) || '',
          interventions: s.interventionsUsed,
          aiTags: s.aiTags
        }));

      // Get related documents
      const sessionDocuments = await storage.getDocumentsBySession(sessionId, therapistId);

      // Try AI-powered analysis first
      try {
        const aiTags = await this.generateAIAnalysis(session, client, sessionHistory, sessionDocuments);
        
        // Validate the AI response
        const validatedTags = sessionAITagsSchema.parse(aiTags);
        
        // Add metadata
        validatedTags.generatedAt = new Date().toISOString();
        validatedTags.aiModel = 'ai_powered';
        
        return validatedTags;
      } catch (aiError) {
        console.warn('[SessionTagger] AI analysis failed, falling back to deterministic analysis:', aiError);
        
        // Fallback to deterministic analysis
        return this.generateDeterministicTags(session, client, sessionHistory, sessionDocuments);
      }
    } catch (error) {
      console.error('[SessionTagger] Error generating session tags:', error);
      throw new Error(`Session tag generation failed: ${(error as any)?.message || error}`);
    }
  }

  /**
   * AI-powered session analysis using the existing AI router
   */
  private async generateAIAnalysis(
    session: Session,
    client: Client,
    sessionHistory: any[],
    documents: Document[]
  ): Promise<any> {
    const analysisPrompt = `
You are an expert clinical psychologist analyzing a therapy session for comprehensive AI tagging. Provide detailed therapeutic insights and assessments.

Session Information:
- Date: ${session.sessionDate}
- Type: ${session.sessionType || 'Individual Therapy'}
- Duration: ${session.duration || 'Not specified'} minutes
- Notes: ${session.notes || 'No notes provided'}
- Interventions Used: ${JSON.stringify(session.interventionsUsed) || 'None specified'}
- Homework: ${session.homework || 'None assigned'}
- Next Session Plan: ${session.nextSessionPlan || 'Not specified'}

Client Context:
- Name: ${client.firstName} ${client.lastName}
- Age: ${client.dateOfBirth ? Math.floor((Date.now() - new Date(client.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 'Unknown'}
- Demographics: ${client.sex || 'Unknown'}, ${client.genderIdentity || 'Unknown'}, ${client.race || 'Unknown'}
- Relationship Status: ${client.relationshipStatus || 'Unknown'}
- Employment: ${client.employment || 'Unknown'}

Recent Session History (Last 3 sessions):
${sessionHistory.map((s, i) => `
Session ${i + 1} (${s.date}):
- Notes: ${s.notes}
- Previous AI Insights: ${JSON.stringify(s.aiTags) || 'None'}
`).join('\n')}

Related Documents:
${documents.map(d => `- ${d.fileName}: ${d.content?.substring(0, 200) || 'No content'}...`).join('\n')}

Please provide a comprehensive therapeutic analysis in the following JSON format:

{
  "sessionThemes": ["primary themes from the session"],
  "interventionsUsed": ["CBT", "DBT", "mindfulness", "psychoeducation"],
  "therapeuticApproaches": ["cognitive-behavioral", "humanistic", "psychodynamic"],
  
  "clientMood": {
    "primary": "depressed|anxious|irritable|stable|elevated|mixed|unknown",
    "secondary": ["additional mood descriptors"],
    "intensity": "low|moderate|high|severe"
  },
  
  "clientEngagement": {
    "level": "minimal|limited|moderate|good|excellent",
    "participation": ["engaged in discussion", "completed exercises"],
    "resistance": ["avoidance", "defensiveness"]
  },
  
  "progressMarkers": {
    "improvements": ["areas of positive change"],
    "challenges": ["ongoing difficulties"],
    "breakthroughs": ["significant insights or progress"],
    "regressions": ["areas of decline"]
  },
  
  "goalProgress": [
    {
      "goalArea": "anxiety management",
      "status": "not_started|in_progress|partially_met|met|exceeded",
      "notes": "specific progress notes"
    }
  ],
  
  "riskFactors": {
    "suicideRisk": "none|low|moderate|high|imminent",
    "selfHarmRisk": "none|low|moderate|high",
    "substanceUse": "none|minimal|moderate|concerning|severe",
    "riskToOthers": "none|low|moderate|high",
    "notes": ["specific risk observations"]
  },
  
  "interventionEffectiveness": [
    {
      "intervention": "cognitive restructuring",
      "effectiveness": "ineffective|limited|moderate|effective|highly_effective",
      "notes": "client response and outcomes"
    }
  ],
  
  "clinicalObservations": ["key clinical observations"],
  "diagnosticConsiderations": ["potential diagnoses or diagnostic changes"],
  "strengthsIdentified": ["client strengths and resources"],
  
  "homeworkAssigned": [
    {
      "task": "mood tracking",
      "purpose": "increase awareness of mood patterns",
      "difficulty": "easy|moderate|challenging"
    }
  ],
  
  "homeworkReview": [
    {
      "task": "breathing exercises",
      "completion": "not_attempted|partial|completed|exceeded",
      "effectiveness": "unhelpful|somewhat_helpful|helpful|very_helpful"
    }
  ],
  
  "sessionQuality": "poor|fair|good|excellent",
  "therapeuticRelationship": "strained|developing|good|strong|excellent",
  "nextSessionPlanning": ["priorities for next session"],
  
  "crisisIndicators": ["any crisis or emergency indicators"],
  "immediateActions": ["any immediate actions taken or needed"],
  
  "confidence": 0.85
}

ANALYSIS GUIDELINES:
1. **Therapeutic Assessment**: Provide professional-level clinical insights based on session content
2. **Risk Assessment**: Carefully evaluate any risk factors mentioned or implied
3. **Progress Evaluation**: Track therapeutic progress and goal advancement
4. **Intervention Analysis**: Assess effectiveness of interventions used
5. **Clinical Insights**: Identify patterns, strengths, and areas for growth
6. **Safety First**: Always prioritize client safety and crisis indicators
7. **Evidence-Based**: Ground insights in observable behaviors and client reports
8. **Therapeutic Relationship**: Assess quality of therapeutic alliance
9. **Future Planning**: Consider next steps and session priorities

Focus on therapeutic accuracy, clinical relevance, and actionable insights for ongoing treatment.
`;

    const tagsResult = await aiRouter.chatJSON(
      [
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      sessionAITagsSchema,
      {
        systemPrompt: "You are a licensed clinical psychologist providing comprehensive session analysis. Always respond with valid JSON following the exact schema provided.",
        maxTokens: 3000
      }
    );

    return tagsResult;
  }

  /**
   * Deterministic session analysis when AI is unavailable
   */
  private generateDeterministicTags(
    session: Session,
    client: Client,
    sessionHistory: any[],
    documents: Document[]
  ): SessionAITags {
    const notes = session.notes || '';
    const interventions = session.interventionsUsed || [];
    
    // Basic theme extraction based on keywords
    const themes = [];
    if (notes.toLowerCase().includes('anxiety') || notes.toLowerCase().includes('anxious')) {
      themes.push('anxiety_management');
    }
    if (notes.toLowerCase().includes('depression') || notes.toLowerCase().includes('depressed')) {
      themes.push('depression_treatment');
    }
    if (notes.toLowerCase().includes('trauma') || notes.toLowerCase().includes('ptsd')) {
      themes.push('trauma_processing');
    }
    if (notes.toLowerCase().includes('relationship') || notes.toLowerCase().includes('family')) {
      themes.push('relationship_issues');
    }
    if (notes.toLowerCase().includes('coping') || notes.toLowerCase().includes('stress')) {
      themes.push('coping_strategies');
    }

    // Basic mood assessment
    let primaryMood: any = 'unknown';
    let moodIntensity: any = 'moderate';
    
    if (notes.toLowerCase().includes('sad') || notes.toLowerCase().includes('down')) {
      primaryMood = 'depressed';
    } else if (notes.toLowerCase().includes('anxious') || notes.toLowerCase().includes('worried')) {
      primaryMood = 'anxious';
    } else if (notes.toLowerCase().includes('angry') || notes.toLowerCase().includes('irritated')) {
      primaryMood = 'irritable';
    } else if (notes.toLowerCase().includes('stable') || notes.toLowerCase().includes('good')) {
      primaryMood = 'stable';
    }

    // Basic engagement assessment
    let engagementLevel: any = 'moderate';
    if (notes.toLowerCase().includes('engaged') || notes.toLowerCase().includes('participated')) {
      engagementLevel = 'good';
    } else if (notes.toLowerCase().includes('resistant') || notes.toLowerCase().includes('withdrawn')) {
      engagementLevel = 'limited';
    }

    // Basic risk assessment
    const riskFactors: any = {
      suicideRisk: 'none',
      selfHarmRisk: 'none',
      substanceUse: 'none',
      riskToOthers: 'none',
      notes: []
    };

    if (notes.toLowerCase().includes('suicide') || notes.toLowerCase().includes('self-harm')) {
      riskFactors.suicideRisk = 'moderate';
      riskFactors.notes.push('Suicide/self-harm mentioned in session notes');
    }
    if (notes.toLowerCase().includes('alcohol') || notes.toLowerCase().includes('drugs') || notes.toLowerCase().includes('substance')) {
      riskFactors.substanceUse = 'moderate';
      riskFactors.notes.push('Substance use mentioned');
    }

    // Identify common interventions
    const commonInterventions = ['psychoeducation', 'coping_skills', 'cognitive_restructuring'];
    const detectedInterventions = [];
    
    if (notes.toLowerCase().includes('cbt') || notes.toLowerCase().includes('cognitive')) {
      detectedInterventions.push('cognitive_behavioral');
    }
    if (notes.toLowerCase().includes('mindfulness') || notes.toLowerCase().includes('meditation')) {
      detectedInterventions.push('mindfulness');
    }
    if (notes.toLowerCase().includes('homework') || notes.toLowerCase().includes('assignment')) {
      detectedInterventions.push('homework_assignment');
    }

    return {
      sessionThemes: themes,
      interventionsUsed: detectedInterventions,
      therapeuticApproaches: ['general_supportive'],
      
      clientMood: {
        primary: primaryMood,
        intensity: moodIntensity
      },
      
      clientEngagement: {
        level: engagementLevel,
        participation: []
      },
      
      progressMarkers: {
        improvements: [],
        challenges: [],
        breakthroughs: [],
        regressions: []
      },
      
      riskFactors,
      
      clinicalObservations: [
        `Session duration: ${session.duration || 'Not specified'} minutes`,
        `Session type: ${session.sessionType || 'Individual therapy'}`
      ],
      
      sessionQuality: 'fair',
      therapeuticRelationship: 'developing',
      
      generatedAt: new Date().toISOString(),
      aiModel: 'deterministic_fallback',
      confidence: 0.6
    };
  }

  /**
   * Update session AI tags in the database
   */
  async updateSessionTags(sessionId: string, therapistId: string, tags: SessionAITags): Promise<boolean> {
    try {
      const updatedSession = await storage.updateSessionAITags(sessionId, tags, therapistId);
      return !!updatedSession;
    } catch (error) {
      console.error('[SessionTagger] Error updating session tags:', error);
      return false;
    }
  }

  /**
   * Get session AI tags
   */
  async getSessionTags(sessionId: string, therapistId: string): Promise<SessionAITags | null> {
    try {
      const tags = await storage.getSessionAITags(sessionId, therapistId);
      return tags ? sessionAITagsSchema.parse(tags) : null;
    } catch (error) {
      console.error('[SessionTagger] Error getting session tags:', error);
      return null;
    }
  }

  /**
   * Regenerate tags for a session (useful when session content is updated)
   */
  async regenerateSessionTags(sessionId: string, therapistId: string): Promise<SessionAITags> {
    try {
      const newTags = await this.generateSessionTags(sessionId, therapistId);
      await this.updateSessionTags(sessionId, therapistId, newTags);
      return newTags;
    } catch (error) {
      console.error('[SessionTagger] Error regenerating session tags:', error);
      throw error;
    }
  }

  /**
   * Bulk generate tags for multiple sessions
   */
  async bulkGenerateSessionTags(sessionIds: string[], therapistId: string): Promise<{ sessionId: string; tags: SessionAITags | null; success: boolean }[]> {
    const results = [];
    
    for (const sessionId of sessionIds) {
      try {
        const tags = await this.generateSessionTags(sessionId, therapistId);
        await this.updateSessionTags(sessionId, therapistId, tags);
        results.push({ sessionId, tags, success: true });
      } catch (error) {
        console.error(`[SessionTagger] Failed to generate tags for session ${sessionId}:`, error);
        results.push({ sessionId, tags: null, success: false });
      }
    }
    
    return results;
  }

  /**
   * Analyze session tag trends for a client
   */
  async analyzeSessionTrends(clientId: string, therapistId: string): Promise<any> {
    try {
      const sessions = await storage.getSessionsByClient(clientId, therapistId);
      const taggedSessions = sessions.filter(s => s.aiTags);
      
      if (taggedSessions.length === 0) {
        return {
          totalSessions: sessions.length,
          taggedSessions: 0,
          trends: {},
          message: 'No tagged sessions available for analysis'
        };
      }

      // Analyze trends across sessions
      const moodTrends = [];
      const engagementTrends = [];
      const riskTrends = [];
      const progressTrends = [];
      
      for (const session of taggedSessions) {
        const tags = session.aiTags as SessionAITags;
        const sessionDate = new Date(session.sessionDate);
        
        if (tags.clientMood?.primary) {
          moodTrends.push({
            date: sessionDate,
            mood: tags.clientMood.primary,
            intensity: tags.clientMood.intensity
          });
        }
        
        if (tags.clientEngagement?.level) {
          engagementTrends.push({
            date: sessionDate,
            engagement: tags.clientEngagement.level
          });
        }
        
        if (tags.riskFactors?.suicideRisk) {
          riskTrends.push({
            date: sessionDate,
            suicideRisk: tags.riskFactors.suicideRisk,
            substanceUse: tags.riskFactors.substanceUse
          });
        }
        
        if (tags.progressMarkers) {
          progressTrends.push({
            date: sessionDate,
            improvements: tags.progressMarkers.improvements?.length || 0,
            challenges: tags.progressMarkers.challenges?.length || 0
          });
        }
      }

      return {
        totalSessions: sessions.length,
        taggedSessions: taggedSessions.length,
        trends: {
          mood: moodTrends,
          engagement: engagementTrends,
          risk: riskTrends,
          progress: progressTrends
        },
        summary: {
          mostCommonMood: this.getMostCommon(moodTrends.map(t => t.mood)),
          averageEngagement: this.calculateAverageEngagement(engagementTrends),
          riskLevel: this.assessOverallRisk(riskTrends),
          progressDirection: this.assessProgressDirection(progressTrends)
        }
      };
    } catch (error) {
      console.error('[SessionTagger] Error analyzing session trends:', error);
      throw error;
    }
  }

  private getMostCommon(arr: string[]): string | null {
    if (arr.length === 0) return null;
    const counts = arr.reduce((acc: any, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
  }

  private calculateAverageEngagement(engagementTrends: any[]): string {
    if (engagementTrends.length === 0) return 'unknown';
    const engagementLevels = ['minimal', 'limited', 'moderate', 'good', 'excellent'];
    const sum = engagementTrends.reduce((acc, trend) => {
      return acc + engagementLevels.indexOf(trend.engagement);
    }, 0);
    const avgIndex = Math.round(sum / engagementTrends.length);
    return engagementLevels[avgIndex] || 'moderate';
  }

  private assessOverallRisk(riskTrends: any[]): string {
    if (riskTrends.length === 0) return 'unknown';
    const latestRisk = riskTrends[riskTrends.length - 1];
    return latestRisk.suicideRisk || 'none';
  }

  private assessProgressDirection(progressTrends: any[]): string {
    if (progressTrends.length < 2) return 'insufficient_data';
    const recent = progressTrends.slice(-3);
    const improvementSum = recent.reduce((acc, trend) => acc + trend.improvements, 0);
    const challengeSum = recent.reduce((acc, trend) => acc + trend.challenges, 0);
    
    if (improvementSum > challengeSum) return 'improving';
    if (challengeSum > improvementSum) return 'declining';
    return 'stable';
  }
}

// Export singleton instance
export const sessionTagger = new SessionTagger();