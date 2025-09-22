import { Client, Session, Assessment, TreatmentPlan, Document } from "@shared/schema";
import { storage } from "./storage";
import { aiRouter } from "./ai";
import { sessionTagger, SessionAITags } from "./sessionTagger";
import { z } from "zod";

// Enhanced Zod schema for client AI tags validation
const clientAITagsSchema = z.object({
  // Overall therapy trajectory and patterns
  therapyTrajectory: z.object({
    overallProgress: z.enum(["declining", "stable", "improving", "significant_improvement"]).optional(),
    progressRate: z.enum(["slow", "moderate", "rapid"]).optional(),
    treatmentPhase: z.enum(["initial", "working", "maintenance", "termination"]).optional(),
    sessionsCompleted: z.number().optional(),
    estimatedTreatmentLength: z.enum(["short_term", "medium_term", "long_term", "ongoing"]).optional()
  }).optional(),

  // Diagnosis and clinical insights
  diagnosticInsights: z.object({
    primaryDiagnoses: z.array(z.string()).optional(),
    secondaryDiagnoses: z.array(z.string()).optional(),
    diagnosticConfidence: z.enum(["low", "moderate", "high"]).optional(),
    differentialConsiderations: z.array(z.string()).optional(),
    comorbidityPatterns: z.array(z.string()).optional()
  }).optional(),

  // Treatment response and intervention effectiveness
  treatmentResponse: z.object({
    mostEffectiveInterventions: z.array(z.object({
      intervention: z.string(),
      effectiveness: z.enum(["limited", "moderate", "effective", "highly_effective"]),
      evidenceNotes: z.string().optional()
    })).optional(),
    leastEffectiveInterventions: z.array(z.object({
      intervention: z.string(),
      issues: z.string()
    })).optional(),
    preferredTherapeuticApproaches: z.array(z.string()).optional(),
    responseToHomework: z.enum(["poor", "inconsistent", "good", "excellent"]).optional()
  }).optional(),

  // Long-term patterns and themes
  recurringThemes: z.object({
    primaryThemes: z.array(z.string()).optional(),
    emergingPatterns: z.array(z.string()).optional(),
    cyclicalIssues: z.array(z.string()).optional(),
    persistentChallenges: z.array(z.string()).optional(),
    coreConflicts: z.array(z.string()).optional()
  }).optional(),

  // Risk assessment and safety
  riskProfile: z.object({
    overallRiskLevel: z.enum(["low", "moderate", "high", "very_high"]).optional(),
    riskFactors: z.array(z.string()).optional(),
    protectiveFactors: z.array(z.string()).optional(),
    riskTrends: z.enum(["decreasing", "stable", "increasing", "fluctuating"]).optional(),
    safetyPlanNeed: z.boolean().optional(),
    crisisHistoryPattern: z.array(z.string()).optional()
  }).optional(),

  // Strengths and resources
  clientStrengths: z.object({
    personalStrengths: z.array(z.string()).optional(),
    copingStrategies: z.array(z.string()).optional(),
    supportSystems: z.array(z.string()).optional(),
    motivation: z.enum(["low", "moderate", "high", "very_high"]).optional(),
    insight: z.enum(["limited", "developing", "good", "excellent"]).optional(),
    therapeuticAlliance: z.enum(["poor", "developing", "good", "strong", "excellent"]).optional()
  }).optional(),

  // Goal progress and outcomes
  goalProgress: z.object({
    achievedGoals: z.array(z.object({
      goal: z.string(),
      completionDate: z.string().optional(),
      impact: z.string().optional()
    })).optional(),
    activeGoals: z.array(z.object({
      goal: z.string(),
      progress: z.enum(["not_started", "minimal", "moderate", "significant", "nearly_complete"]),
      barriers: z.array(z.string()).optional()
    })).optional(),
    futureGoals: z.array(z.string()).optional(),
    goalsNeedingRevision: z.array(z.object({
      goal: z.string(),
      reason: z.string()
    })).optional()
  }).optional(),

  // Mood and symptom patterns
  clinicalPatterns: z.object({
    moodPatterns: z.array(z.object({
      pattern: z.string(),
      frequency: z.enum(["rare", "occasional", "frequent", "persistent"]),
      triggers: z.array(z.string()).optional()
    })).optional(),
    symptomSeverity: z.enum(["minimal", "mild", "moderate", "severe", "very_severe"]).optional(),
    symptomTrends: z.enum(["worsening", "stable", "improving", "fluctuating"]).optional(),
    functionalImpairment: z.enum(["minimal", "mild", "moderate", "severe"]).optional(),
    cognitiveFunctioning: z.enum(["impaired", "below_average", "average", "above_average"]).optional()
  }).optional(),

  // Engagement and participation
  engagementProfile: z.object({
    averageEngagement: z.enum(["minimal", "limited", "moderate", "good", "excellent"]).optional(),
    engagementTrends: z.enum(["declining", "stable", "improving"]).optional(),
    participationBarriers: z.array(z.string()).optional(),
    motivationalFactors: z.array(z.string()).optional(),
    attendancePattern: z.enum(["poor", "inconsistent", "regular", "excellent"]).optional()
  }).optional(),

  // Treatment recommendations
  clinicalRecommendations: z.object({
    continuedInterventions: z.array(z.string()).optional(),
    newInterventions: z.array(z.string()).optional(),
    referrals: z.array(z.object({
      type: z.string(),
      reason: z.string(),
      urgency: z.enum(["low", "moderate", "high", "urgent"])
    })).optional(),
    medicationConsiderations: z.array(z.string()).optional(),
    environmentalChanges: z.array(z.string()).optional(),
    sessionFrequencyRecommendation: z.enum(["weekly", "biweekly", "monthly", "as_needed", "intensive"]).optional()
  }).optional(),

  // Progress metrics and analytics
  progressMetrics: z.object({
    improvementAreas: z.array(z.object({
      area: z.string(),
      percentImprovement: z.number().optional(),
      measurementMethod: z.string().optional()
    })).optional(),
    stagnantAreas: z.array(z.string()).optional(),
    unexpectedFindings: z.array(z.string()).optional(),
    assessmentScoreTrends: z.array(z.object({
      assessment: z.string(),
      trend: z.enum(["worsening", "stable", "improving"]),
      significance: z.enum(["minimal", "moderate", "significant"])
    })).optional()
  }).optional(),

  // Metadata and generation info
  analysisMetadata: z.object({
    sessionAnalyzed: z.number().optional(),
    assessmentsIncluded: z.number().optional(),
    documentsIncluded: z.number().optional(),
    treatmentPlansIncluded: z.number().optional(),
    timeframeCovered: z.object({
      startDate: z.string(),
      endDate: z.string()
    }).optional(),
    lastUpdated: z.string().optional(),
    aiModel: z.string().optional(),
    confidence: z.number().min(0).max(1).optional()
  }).optional()
});

export type ClientAITags = z.infer<typeof clientAITagsSchema>;

/**
 * Enhanced client AI tagging service for comprehensive therapy progress analysis
 */
export class ClientTagger {
  
  /**
   * Generate comprehensive AI tags for a client by aggregating all session and assessment data
   */
  async generateClientTags(clientId: string, therapistId: string): Promise<ClientAITags> {
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

      // Try AI-powered analysis first
      try {
        const aiTags = await this.generateAIAnalysis(client, sessions, assessments, treatmentPlans, documents);
        
        // Validate the AI response
        const validatedTags = clientAITagsSchema.parse(aiTags);
        
        // Add metadata
        validatedTags.analysisMetadata = {
          sessionAnalyzed: sessions.length,
          assessmentsIncluded: assessments.length,
          documentsIncluded: documents.length,
          treatmentPlansIncluded: treatmentPlans.length,
          timeframeCovered: this.calculateTimeframe(sessions),
          lastUpdated: new Date().toISOString(),
          aiModel: 'ai_powered',
          confidence: 0.85
        };
        
        return validatedTags;
      } catch (aiError) {
        console.warn('[ClientTagger] AI analysis failed, falling back to deterministic analysis:', aiError);
        
        // Fallback to deterministic analysis
        return this.generateDeterministicTags(client, sessions, assessments, treatmentPlans, documents);
      }
    } catch (error) {
      console.error('[ClientTagger] Error generating client tags:', error);
      throw new Error(`Client tag generation failed: ${(error as any)?.message || error}`);
    }
  }

  /**
   * AI-powered client analysis using the existing AI router
   */
  private async generateAIAnalysis(
    client: Client,
    sessions: Session[],
    assessments: Assessment[],
    treatmentPlans: TreatmentPlan[],
    documents: Document[]
  ): Promise<any> {
    // Analyze session tags for patterns
    const sessionTags = sessions
      .filter(s => s.aiTags)
      .map(s => ({
        date: s.sessionDate,
        tags: s.aiTags as SessionAITags,
        notes: s.notes?.substring(0, 200) || ''
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const analysisPrompt = `
You are a senior clinical psychologist conducting a comprehensive case review and client assessment. Analyze all available data to provide insights into the client's therapy journey, progress patterns, and treatment recommendations.

Client Information:
- Name: ${client.firstName} ${client.lastName}
- Age: ${client.dateOfBirth ? Math.floor((Date.now() - new Date(client.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 'Unknown'}
- Demographics: ${client.sex || 'Unknown'}, ${client.genderIdentity || 'Unknown'}, ${client.race || 'Unknown'}
- Relationship Status: ${client.relationshipStatus || 'Unknown'}
- Employment: ${client.employment || 'Unknown'}
- Location: ${client.location || 'Unknown'}

Treatment History:
- Total Sessions: ${sessions.length}
- Session Timeframe: ${sessions.length > 0 ? `${new Date(sessions[0].sessionDate).toLocaleDateString()} to ${new Date(sessions[sessions.length - 1].sessionDate).toLocaleDateString()}` : 'No sessions'}
- Treatment Plans: ${treatmentPlans.length}
- Assessments: ${assessments.length}
- Documents: ${documents.length}

Session AI Tag Analysis (Recent ${Math.min(sessionTags.length, 10)} sessions):
${sessionTags.slice(-10).map((s, i) => `
Session ${i + 1} (${new Date(s.date).toLocaleDateString()}):
- Themes: ${s.tags.sessionThemes?.join(', ') || 'None'}
- Mood: ${s.tags.clientMood?.primary || 'Unknown'} (${s.tags.clientMood?.intensity || 'unknown'} intensity)
- Engagement: ${s.tags.clientEngagement?.level || 'Unknown'}
- Risk Level: ${s.tags.riskFactors?.suicideRisk || 'None'} suicide risk
- Progress: ${s.tags.progressMarkers?.improvements?.length || 0} improvements, ${s.tags.progressMarkers?.challenges?.length || 0} challenges
- Interventions: ${s.tags.interventionsUsed?.join(', ') || 'None specified'}
- Quality: ${s.tags.sessionQuality || 'Unknown'}
- Relationship: ${s.tags.therapeuticRelationship || 'Unknown'}
`).join('\n')}

Assessment History:
${assessments.slice(-5).map(a => `
- ${a.assessmentType} (${new Date(a.assessmentDate).toLocaleDateString()}): ${JSON.stringify(a.scores)}
  Interpretation: ${a.interpretation || 'None provided'}
`).join('\n')}

Treatment Plan Goals:
${treatmentPlans.slice(-2).map(tp => `
- Start Date: ${new Date(tp.startDate).toLocaleDateString()}
- Goals: ${JSON.stringify(tp.goals)}
- Interventions: ${JSON.stringify(tp.interventions)}
`).join('\n')}

Please provide a comprehensive clinical assessment in the following JSON format:

{
  "therapyTrajectory": {
    "overallProgress": "declining|stable|improving|significant_improvement",
    "progressRate": "slow|moderate|rapid",
    "treatmentPhase": "initial|working|maintenance|termination",
    "sessionsCompleted": ${sessions.length},
    "estimatedTreatmentLength": "short_term|medium_term|long_term|ongoing"
  },
  
  "diagnosticInsights": {
    "primaryDiagnoses": ["Major Depressive Disorder", "Generalized Anxiety Disorder"],
    "secondaryDiagnoses": ["adjustment difficulties"],
    "diagnosticConfidence": "low|moderate|high",
    "differentialConsiderations": ["alternative diagnoses to consider"],
    "comorbidityPatterns": ["pattern observations"]
  },
  
  "treatmentResponse": {
    "mostEffectiveInterventions": [
      {
        "intervention": "CBT techniques",
        "effectiveness": "limited|moderate|effective|highly_effective",
        "evidenceNotes": "specific evidence of effectiveness"
      }
    ],
    "leastEffectiveInterventions": [
      {
        "intervention": "intervention name",
        "issues": "reasons for limited effectiveness"
      }
    ],
    "preferredTherapeuticApproaches": ["CBT", "DBT", "humanistic"],
    "responseToHomework": "poor|inconsistent|good|excellent"
  },
  
  "recurringThemes": {
    "primaryThemes": ["anxiety about work", "relationship difficulties"],
    "emergingPatterns": ["patterns becoming apparent"],
    "cyclicalIssues": ["recurring problems"],
    "persistentChallenges": ["ongoing difficulties"],
    "coreConflicts": ["underlying conflicts"]
  },
  
  "riskProfile": {
    "overallRiskLevel": "low|moderate|high|very_high",
    "riskFactors": ["identified risk factors"],
    "protectiveFactors": ["client strengths that reduce risk"],
    "riskTrends": "decreasing|stable|increasing|fluctuating",
    "safetyPlanNeed": true,
    "crisisHistoryPattern": ["crisis patterns if any"]
  },
  
  "clientStrengths": {
    "personalStrengths": ["resilience", "insight", "motivation"],
    "copingStrategies": ["effective coping mechanisms"],
    "supportSystems": ["family", "friends", "community"],
    "motivation": "low|moderate|high|very_high",
    "insight": "limited|developing|good|excellent",
    "therapeuticAlliance": "poor|developing|good|strong|excellent"
  },
  
  "goalProgress": {
    "achievedGoals": [
      {
        "goal": "goal description",
        "completionDate": "2024-01-15",
        "impact": "impact on client"
      }
    ],
    "activeGoals": [
      {
        "goal": "current goal",
        "progress": "not_started|minimal|moderate|significant|nearly_complete",
        "barriers": ["obstacles to progress"]
      }
    ],
    "futureGoals": ["goals to work on"],
    "goalsNeedingRevision": [
      {
        "goal": "goal to revise",
        "reason": "why revision is needed"
      }
    ]
  },
  
  "clinicalPatterns": {
    "moodPatterns": [
      {
        "pattern": "pattern description",
        "frequency": "rare|occasional|frequent|persistent",
        "triggers": ["identified triggers"]
      }
    ],
    "symptomSeverity": "minimal|mild|moderate|severe|very_severe",
    "symptomTrends": "worsening|stable|improving|fluctuating",
    "functionalImpairment": "minimal|mild|moderate|severe",
    "cognitiveFunctioning": "impaired|below_average|average|above_average"
  },
  
  "engagementProfile": {
    "averageEngagement": "minimal|limited|moderate|good|excellent",
    "engagementTrends": "declining|stable|improving",
    "participationBarriers": ["barriers to engagement"],
    "motivationalFactors": ["what motivates the client"],
    "attendancePattern": "poor|inconsistent|regular|excellent"
  },
  
  "clinicalRecommendations": {
    "continuedInterventions": ["interventions to continue"],
    "newInterventions": ["new interventions to try"],
    "referrals": [
      {
        "type": "psychiatry",
        "reason": "medication evaluation",
        "urgency": "low|moderate|high|urgent"
      }
    ],
    "medicationConsiderations": ["medication recommendations"],
    "environmentalChanges": ["lifestyle or environment changes"],
    "sessionFrequencyRecommendation": "weekly|biweekly|monthly|as_needed|intensive"
  },
  
  "progressMetrics": {
    "improvementAreas": [
      {
        "area": "anxiety management",
        "percentImprovement": 30,
        "measurementMethod": "self-report and observation"
      }
    ],
    "stagnantAreas": ["areas without progress"],
    "unexpectedFindings": ["surprising discoveries"],
    "assessmentScoreTrends": [
      {
        "assessment": "PHQ-9",
        "trend": "worsening|stable|improving",
        "significance": "minimal|moderate|significant"
      }
    ]
  }
}

CLINICAL ANALYSIS GUIDELINES:
1. **Longitudinal Perspective**: Analyze patterns across time, not just current state
2. **Evidence-Based Assessment**: Ground insights in observable data and client reports
3. **Risk-Informed Practice**: Prioritize safety assessment and crisis prevention
4. **Strengths-Based Approach**: Identify and build on client strengths and resources
5. **Treatment Planning**: Provide actionable recommendations for continued care
6. **Cultural Sensitivity**: Consider cultural, social, and demographic factors
7. **Professional Standards**: Maintain clinical accuracy and therapeutic objectivity
8. **Progress Monitoring**: Track measurable changes and outcomes
9. **Intervention Effectiveness**: Assess what works and what doesn't for this client
10. **Future-Oriented**: Consider long-term treatment needs and goals

Focus on providing clinically sound, evidence-based insights that support effective ongoing treatment.
`;

    const tagsResult = await aiRouter.chatJSON(
      [
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      clientAITagsSchema,
      {
        systemPrompt: "You are a senior clinical psychologist providing comprehensive client assessment. Always respond with valid JSON following the exact schema provided.",
        maxTokens: 4000
      }
    );

    return tagsResult;
  }

  /**
   * Deterministic client analysis when AI is unavailable
   */
  private generateDeterministicTags(
    client: Client,
    sessions: Session[],
    assessments: Assessment[],
    treatmentPlans: TreatmentPlan[],
    documents: Document[]
  ): ClientAITags {
    // Basic analysis based on session count and patterns
    let overallProgress: any = 'stable';
    if (sessions.length > 10) {
      overallProgress = 'improving';
    } else if (sessions.length < 5) {
      overallProgress = 'initial';
    }

    let treatmentPhase: any = 'initial';
    if (sessions.length > 15) {
      treatmentPhase = 'working';
    } else if (sessions.length > 5) {
      treatmentPhase = 'working';
    }

    // Basic risk assessment from session notes
    let overallRiskLevel: any = 'low';
    const allNotes = sessions.map(s => s.notes || '').join(' ').toLowerCase();
    if (allNotes.includes('suicide') || allNotes.includes('self-harm')) {
      overallRiskLevel = 'moderate';
    }

    // Basic intervention analysis
    const allInterventions = sessions
      .filter(s => s.interventionsUsed)
      .flatMap(s => s.interventionsUsed as string[]);
    
    const interventionCounts = allInterventions.reduce((acc: any, intervention) => {
      acc[intervention] = (acc[intervention] || 0) + 1;
      return acc;
    }, {});

    const mostUsedInterventions = Object.entries(interventionCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([intervention]) => intervention);

    return {
      therapyTrajectory: {
        overallProgress,
        progressRate: 'moderate',
        treatmentPhase,
        sessionsCompleted: sessions.length,
        estimatedTreatmentLength: sessions.length > 20 ? 'long_term' : 'medium_term'
      },
      
      riskProfile: {
        overallRiskLevel,
        riskFactors: [],
        protectiveFactors: ['engaged in treatment'],
        riskTrends: 'stable'
      },
      
      clientStrengths: {
        personalStrengths: ['consistent attendance'],
        motivation: sessions.length > 5 ? 'moderate' : 'high',
        therapeuticAlliance: 'developing'
      },
      
      treatmentResponse: {
        mostEffectiveInterventions: mostUsedInterventions.map(intervention => ({
          intervention,
          effectiveness: 'moderate' as const
        })),
        preferredTherapeuticApproaches: ['general_supportive']
      },
      
      engagementProfile: {
        averageEngagement: 'moderate',
        engagementTrends: 'stable',
        attendancePattern: sessions.length > 0 ? 'regular' : 'poor'
      },
      
      analysisMetadata: {
        sessionAnalyzed: sessions.length,
        assessmentsIncluded: assessments.length,
        documentsIncluded: documents.length,
        treatmentPlansIncluded: treatmentPlans.length,
        timeframeCovered: this.calculateTimeframe(sessions),
        lastUpdated: new Date().toISOString(),
        aiModel: 'deterministic_fallback',
        confidence: 0.6
      }
    };
  }

  /**
   * Calculate timeframe covered by sessions
   */
  private calculateTimeframe(sessions: Session[]): { startDate: string; endDate: string } | undefined {
    if (sessions.length === 0) return undefined;
    
    const dates = sessions.map(s => new Date(s.sessionDate)).sort((a, b) => a.getTime() - b.getTime());
    return {
      startDate: dates[0].toISOString(),
      endDate: dates[dates.length - 1].toISOString()
    };
  }

  /**
   * Update client AI tags in the database
   */
  async updateClientTags(clientId: string, therapistId: string, tags: ClientAITags): Promise<boolean> {
    try {
      const updatedClient = await storage.updateClientAITags(clientId, tags, therapistId);
      return !!updatedClient;
    } catch (error) {
      console.error('[ClientTagger] Error updating client tags:', error);
      return false;
    }
  }

  /**
   * Get client AI tags
   */
  async getClientTags(clientId: string, therapistId: string): Promise<ClientAITags | null> {
    try {
      const tags = await storage.getClientAITags(clientId, therapistId);
      return tags ? clientAITagsSchema.parse(tags) : null;
    } catch (error) {
      console.error('[ClientTagger] Error getting client tags:', error);
      return null;
    }
  }

  /**
   * Regenerate tags for a client (useful when new sessions are added)
   */
  async regenerateClientTags(clientId: string, therapistId: string): Promise<ClientAITags> {
    try {
      const newTags = await this.generateClientTags(clientId, therapistId);
      await this.updateClientTags(clientId, therapistId, newTags);
      return newTags;
    } catch (error) {
      console.error('[ClientTagger] Error regenerating client tags:', error);
      throw error;
    }
  }

  /**
   * Bulk generate tags for multiple clients
   */
  async bulkGenerateClientTags(clientIds: string[], therapistId: string): Promise<{ clientId: string; tags: ClientAITags | null; success: boolean }[]> {
    const results = [];
    
    for (const clientId of clientIds) {
      try {
        const tags = await this.generateClientTags(clientId, therapistId);
        await this.updateClientTags(clientId, therapistId, tags);
        results.push({ clientId, tags, success: true });
      } catch (error) {
        console.error(`[ClientTagger] Failed to generate tags for client ${clientId}:`, error);
        results.push({ clientId, tags: null, success: false });
      }
    }
    
    return results;
  }

  /**
   * Update client tags when new session is added
   */
  async updateClientTagsForNewSession(clientId: string, therapistId: string, sessionId: string): Promise<void> {
    try {
      // First ensure the new session has tags
      const sessionTags = await sessionTagger.getSessionTags(sessionId, therapistId);
      if (!sessionTags) {
        await sessionTagger.generateSessionTags(sessionId, therapistId);
      }
      
      // Then regenerate client tags with the new session data
      await this.regenerateClientTags(clientId, therapistId);
    } catch (error) {
      console.error('[ClientTagger] Error updating client tags for new session:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive client progress report
   */
  async getClientProgressReport(clientId: string, therapistId: string): Promise<any> {
    try {
      const clientTags = await this.getClientTags(clientId, therapistId);
      const sessionTrends = await sessionTagger.analyzeSessionTrends(clientId, therapistId);
      const progressInsights = await storage.getClientProgressInsights(clientId, therapistId);
      
      return {
        clientTags,
        sessionTrends,
        progressInsights,
        generateReport: {
          reportDate: new Date().toISOString(),
          dataCompleteness: this.assessDataCompleteness(clientTags, sessionTrends, progressInsights),
          keyFindings: this.extractKeyFindings(clientTags),
          recommendations: this.generateRecommendations(clientTags)
        }
      };
    } catch (error) {
      console.error('[ClientTagger] Error generating progress report:', error);
      throw error;
    }
  }

  private assessDataCompleteness(clientTags: any, sessionTrends: any, progressInsights: any): any {
    const completeness = {
      clientTags: !!clientTags,
      sessionTrends: !!sessionTrends && sessionTrends.taggedSessions > 0,
      progressInsights: !!progressInsights,
      overallScore: 0
    };
    
    completeness.overallScore = [
      completeness.clientTags,
      completeness.sessionTrends,
      completeness.progressInsights
    ].filter(Boolean).length / 3;
    
    return completeness;
  }

  private extractKeyFindings(clientTags: ClientAITags | null): string[] {
    if (!clientTags) return ['No AI tags available for analysis'];
    
    const findings = [];
    
    if (clientTags.therapyTrajectory?.overallProgress) {
      findings.push(`Overall therapy progress: ${clientTags.therapyTrajectory.overallProgress}`);
    }
    
    if (clientTags.riskProfile?.overallRiskLevel) {
      findings.push(`Current risk level: ${clientTags.riskProfile.overallRiskLevel}`);
    }
    
    if (clientTags.clientStrengths?.motivation) {
      findings.push(`Client motivation: ${clientTags.clientStrengths.motivation}`);
    }
    
    if (clientTags.treatmentResponse?.mostEffectiveInterventions?.length) {
      findings.push(`Most effective interventions: ${clientTags.treatmentResponse.mostEffectiveInterventions.map(i => i.intervention).join(', ')}`);
    }
    
    return findings;
  }

  private generateRecommendations(clientTags: ClientAITags | null): string[] {
    if (!clientTags) return ['Generate AI tags to receive personalized recommendations'];
    
    const recommendations = [];
    
    if (clientTags.clinicalRecommendations?.continuedInterventions?.length) {
      recommendations.push(`Continue: ${clientTags.clinicalRecommendations.continuedInterventions.join(', ')}`);
    }
    
    if (clientTags.clinicalRecommendations?.newInterventions?.length) {
      recommendations.push(`Consider new interventions: ${clientTags.clinicalRecommendations.newInterventions.join(', ')}`);
    }
    
    if (clientTags.riskProfile?.overallRiskLevel === 'high' || clientTags.riskProfile?.overallRiskLevel === 'very_high') {
      recommendations.push('Prioritize safety planning and risk management');
    }
    
    if (clientTags.engagementProfile?.averageEngagement === 'minimal' || clientTags.engagementProfile?.averageEngagement === 'limited') {
      recommendations.push('Focus on enhancing therapeutic engagement and motivation');
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const clientTagger = new ClientTagger();