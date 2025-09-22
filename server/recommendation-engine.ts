import { Client, Assessment, Session, Document, TreatmentPlan } from "@shared/schema";
import { storage } from "./storage";
import { aiRouter } from "./ai";
import { z } from "zod";

// Treatment recommendation validation schema
const treatmentRecommendationSchema = z.object({
  primaryRecommendations: z.array(z.object({
    category: z.enum(["therapy", "medication", "assessment", "referral", "lifestyle", "crisis"]),
    recommendation: z.string(),
    priority: z.enum(["immediate", "urgent", "high", "medium", "low"]),
    evidenceLevel: z.enum(["strong", "moderate", "limited", "expert_opinion"]),
    rationale: z.string(),
    expectedOutcome: z.string().optional(),
    timeframe: z.string().optional(),
    contraindications: z.array(z.string()).optional(),
    alternatives: z.array(z.string()).optional()
  })),
  therapeuticApproaches: z.array(z.object({
    approach: z.string(),
    suitability: z.enum(["highly_suitable", "suitable", "moderately_suitable", "not_suitable"]),
    evidenceBase: z.string(),
    adaptations: z.array(z.string()).optional(),
    duration: z.string().optional(),
    frequency: z.string().optional()
  })),
  medicationConsiderations: z.object({
    indicated: z.boolean(),
    urgency: z.enum(["immediate", "soon", "routine", "not_indicated"]),
    recommendations: z.array(z.object({
      class: z.string(),
      specific: z.array(z.string()),
      rationale: z.string(),
      monitoring: z.array(z.string()),
      contraindications: z.array(z.string()).optional()
    })),
    psychiatricConsult: z.boolean()
  }),
  riskManagement: z.object({
    immediateActions: z.array(z.string()),
    safetyPlanUpdates: z.array(z.string()),
    monitoringPlan: z.array(z.string()),
    emergencyProtocols: z.array(z.string()),
    supportSystemActivation: z.array(z.string())
  }),
  goalAdjustments: z.array(z.object({
    currentGoal: z.string(),
    recommendedChange: z.enum(["maintain", "modify", "replace", "add", "discontinue"]),
    newGoal: z.string().optional(),
    rationale: z.string(),
    measurableOutcomes: z.array(z.string())
  })),
  sessionPlanAdjustments: z.object({
    frequency: z.string().optional(),
    duration: z.string().optional(),
    format: z.enum(["individual", "group", "family", "couples", "mixed"]).optional(),
    specializations: z.array(z.string()),
    focusAreas: z.array(z.string())
  }),
  qualityOfLife: z.array(z.object({
    domain: z.enum(["sleep", "nutrition", "exercise", "social", "work", "recreation", "spirituality"]),
    recommendation: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    resources: z.array(z.string())
  })),
  prognosis: z.object({
    shortTerm: z.object({
      timeframe: z.string(),
      expectedOutcomes: z.array(z.string()),
      uncertainties: z.array(z.string())
    }),
    longTerm: z.object({
      timeframe: z.string(),
      expectedOutcomes: z.array(z.string()),
      factors: z.array(z.string())
    }),
    overallPrognosis: z.enum(["excellent", "good", "fair", "guarded", "poor"])
  }),
  metadata: z.object({
    generatedDate: z.string(),
    basedOnData: z.object({
      assessments: z.number(),
      sessions: z.number(),
      documents: z.number(),
      treatmentPlans: z.number()
    }),
    aiConfidence: z.number().min(0).max(1),
    clinicalValidation: z.enum(["required", "recommended", "optional"]),
    reviewDate: z.string()
  })
});

export type TreatmentRecommendations = z.infer<typeof treatmentRecommendationSchema>;

export interface RecommendationGenerationResult {
  success: boolean;
  recommendations: TreatmentRecommendations | null;
  errors?: string[];
  metadata: {
    clientId: string;
    generationTime: number;
    dataQuality: string;
    recommendationCount: number;
  };
}

export class RecommendationEngine {

  /**
   * Generate comprehensive treatment recommendations for a client
   */
  async generateRecommendations(
    clientId: string,
    therapistId: string,
    options: {
      focusAreas?: string[];
      includeMedication?: boolean;
      includeRiskManagement?: boolean;
      urgentOnly?: boolean;
    } = {}
  ): Promise<RecommendationGenerationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[Recommendation Engine] Generating recommendations for client ${clientId}`);

      // Gather comprehensive client data
      const [client, assessments, sessions, documents, treatmentPlans] = await Promise.all([
        storage.getClientById(clientId, therapistId),
        storage.getAssessmentsByClient(clientId, therapistId),
        storage.getSessionsByClient(clientId, therapistId),
        storage.getDocumentsByClient(clientId, therapistId),
        storage.getTreatmentPlansByClient(clientId, therapistId)
      ]);

      if (!client) {
        throw new Error("Client not found");
      }

      // Analyze data quality
      const dataQuality = this.assessDataQuality(assessments, sessions, documents, treatmentPlans);
      
      if (dataQuality === "insufficient") {
        throw new Error("Insufficient data to generate reliable recommendations");
      }

      // Generate recommendations using AI analysis
      const recommendations = await this.generateAIRecommendations(
        client,
        assessments,
        sessions,
        documents,
        treatmentPlans,
        options
      );

      // Enhance with rule-based recommendations
      const enhancedRecommendations = this.enhanceWithRules(
        recommendations,
        assessments,
        sessions,
        options
      );

      const generationTime = Date.now() - startTime;
      console.log(`[Recommendation Engine] Generated recommendations for client ${clientId} in ${generationTime}ms`);

      return {
        success: true,
        recommendations: enhancedRecommendations,
        metadata: {
          clientId,
          generationTime,
          dataQuality,
          recommendationCount: enhancedRecommendations.primaryRecommendations.length
        }
      };

    } catch (error) {
      console.error(`[Recommendation Engine] Error generating recommendations for client ${clientId}:`, error);
      return {
        success: false,
        recommendations: null,
        errors: [error instanceof Error ? error.message : String(error)],
        metadata: {
          clientId,
          generationTime: Date.now() - startTime,
          dataQuality: "unknown",
          recommendationCount: 0
        }
      };
    }
  }

  /**
   * Generate AI-powered recommendations using comprehensive analysis
   */
  private async generateAIRecommendations(
    client: Client,
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[],
    treatmentPlans: TreatmentPlan[],
    options: any
  ): Promise<TreatmentRecommendations> {

    // Prepare comprehensive clinical summary for AI analysis
    const clinicalSummary = this.prepareClinicalSummary(
      client,
      assessments,
      sessions,
      documents,
      treatmentPlans
    );

    const recommendationPrompt = `
You are an expert clinical psychologist and psychiatrist providing evidence-based treatment recommendations. Analyze the following comprehensive clinical data and provide detailed treatment recommendations.

Client Information:
${JSON.stringify({
  demographics: {
    age: client.dateOfBirth ? Math.floor((Date.now() - new Date(client.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : "unknown",
    sex: client.sex,
    genderIdentity: client.genderIdentity,
    employment: client.employment,
    relationshipStatus: client.relationshipStatus
  },
  treatmentHistory: {
    totalSessions: sessions.length,
    treatmentDuration: sessions.length > 0 ? Math.floor((Date.now() - new Date(sessions[0].sessionDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
    currentTreatmentPlans: treatmentPlans.length
  }
}, null, 2)}

Clinical Summary:
${clinicalSummary}

Assessment Data:
${this.formatAssessmentData(assessments)}

Recent Session Notes (Last 3):
${this.formatRecentSessions(sessions.slice(-3))}

Treatment Options to Consider:
${options.focusAreas ? `Focus Areas: ${options.focusAreas.join(", ")}` : "All areas"}
${options.includeMedication ? "Include medication recommendations" : "Therapy-focused recommendations"}
${options.includeRiskManagement ? "Include detailed risk management" : "Standard recommendations"}
${options.urgentOnly ? "Urgent recommendations only" : "Comprehensive recommendations"}

Provide evidence-based treatment recommendations following current clinical guidelines (APA, NICE, etc.). Consider:

1. Current diagnostic picture and symptom severity
2. Treatment response and engagement patterns
3. Risk factors and protective factors
4. Cultural considerations and client preferences
5. Evidence-based treatment approaches
6. Medication considerations if appropriate
7. Safety and risk management
8. Treatment goals and adjustments
9. Prognosis and expected outcomes

Format your response as JSON:
{
  "primaryRecommendations": [
    {
      "category": "therapy",
      "recommendation": "Initiate Cognitive Behavioral Therapy (CBT) for depression",
      "priority": "high",
      "evidenceLevel": "strong",
      "rationale": "Strong evidence base for CBT in treating major depression, client shows good insight",
      "expectedOutcome": "50-70% symptom reduction in 12-16 sessions",
      "timeframe": "12-16 weekly sessions",
      "contraindications": [],
      "alternatives": ["Interpersonal Therapy", "Behavioral Activation"]
    }
  ],
  "therapeuticApproaches": [
    {
      "approach": "Cognitive Behavioral Therapy (CBT)",
      "suitability": "highly_suitable",
      "evidenceBase": "Extensive RCT evidence for depression and anxiety",
      "adaptations": ["Trauma-informed approach if needed"],
      "duration": "12-20 sessions",
      "frequency": "Weekly"
    }
  ],
  "medicationConsiderations": {
    "indicated": true,
    "urgency": "routine",
    "recommendations": [
      {
        "class": "SSRI",
        "specific": ["Sertraline", "Escitalopram"],
        "rationale": "First-line treatment for depression with anxiety features",
        "monitoring": ["Side effects", "Suicidal ideation", "Response"],
        "contraindications": ["Bipolar disorder risk"]
      }
    ],
    "psychiatricConsult": true
  },
  "riskManagement": {
    "immediateActions": ["Suicide risk assessment"],
    "safetyPlanUpdates": ["Emergency contacts", "Coping strategies"],
    "monitoringPlan": ["Weekly check-ins", "Assessment tracking"],
    "emergencyProtocols": ["Crisis hotline numbers", "Emergency contacts"],
    "supportSystemActivation": ["Family involvement", "Peer support"]
  },
  "goalAdjustments": [
    {
      "currentGoal": "Reduce depressive symptoms",
      "recommendedChange": "modify",
      "newGoal": "Achieve PHQ-9 score below 5 within 3 months",
      "rationale": "More specific and measurable goal",
      "measurableOutcomes": ["PHQ-9 scores", "Functional improvement", "Sleep quality"]
    }
  ],
  "sessionPlanAdjustments": {
    "frequency": "Weekly for 8 weeks, then biweekly",
    "duration": "50 minutes",
    "format": "individual",
    "specializations": ["CBT for depression", "Trauma-informed care"],
    "focusAreas": ["Cognitive restructuring", "Behavioral activation", "Relapse prevention"]
  },
  "qualityOfLife": [
    {
      "domain": "sleep",
      "recommendation": "Sleep hygiene education and CBT-I if needed",
      "priority": "high",
      "resources": ["Sleep diary", "Relaxation techniques"]
    }
  ],
  "prognosis": {
    "shortTerm": {
      "timeframe": "3 months",
      "expectedOutcomes": ["30-50% symptom reduction", "Improved functioning"],
      "uncertainties": ["Treatment engagement", "Medication response"]
    },
    "longTerm": {
      "timeframe": "12 months",
      "expectedOutcomes": ["Sustained remission", "Return to baseline functioning"],
      "factors": ["Treatment adherence", "Social support", "Life stressors"]
    },
    "overallPrognosis": "good"
  },
  "metadata": {
    "generatedDate": "${new Date().toISOString()}",
    "basedOnData": {
      "assessments": ${assessments.length},
      "sessions": ${sessions.length},
      "documents": ${documents.length},
      "treatmentPlans": ${treatmentPlans.length}
    },
    "aiConfidence": 0.85,
    "clinicalValidation": "recommended",
    "reviewDate": "${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}"
  }
}

Base all recommendations on evidence-based practices and current clinical guidelines. Be specific and actionable.
`;

    try {
      const recommendations = await aiRouter.chatJSON(recommendationPrompt, treatmentRecommendationSchema);
      return recommendations;
    } catch (error) {
      console.error("[Recommendation Engine] AI recommendation generation failed:", error);
      // Return minimal recommendations structure if AI fails
      return this.getMinimalRecommendations(assessments, sessions);
    }
  }

  /**
   * Prepare comprehensive clinical summary for AI analysis
   */
  private prepareClinicalSummary(
    client: Client,
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[],
    treatmentPlans: TreatmentPlan[]
  ): string {
    
    const summary: string[] = [];

    // Current clinical picture
    if (assessments.length > 0) {
      const recentAssessments = assessments
        .sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime())
        .slice(0, 3);
      
      summary.push("Recent Assessment Results:");
      recentAssessments.forEach(assessment => {
        const score = this.extractTotalScore(assessment.scores);
        summary.push(`- ${assessment.assessmentType}: Score ${score} (${assessment.interpretation || 'No interpretation'})`);
      });
    }

    // Treatment progress
    if (sessions.length > 0) {
      const recentSessions = sessions.slice(-5);
      summary.push("\nRecent Treatment Progress:");
      summary.push(`- Total sessions: ${sessions.length}`);
      summary.push(`- Treatment duration: ${Math.floor((Date.now() - new Date(sessions[0].sessionDate).getTime()) / (1000 * 60 * 60 * 24))} days`);
      
      const interventions = this.extractInterventions(recentSessions);
      if (interventions.length > 0) {
        summary.push(`- Recent interventions: ${interventions.join(", ")}`);
      }
    }

    // Current treatment plans
    if (treatmentPlans.length > 0) {
      const activePlan = treatmentPlans
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
      
      summary.push("\nCurrent Treatment Plan:");
      if (activePlan.diagnosis) {
        summary.push(`- Diagnosis: ${JSON.stringify(activePlan.diagnosis)}`);
      }
      if (activePlan.goals) {
        summary.push(`- Goals: ${JSON.stringify(activePlan.goals)}`);
      }
    }

    // AI insights if available
    if (client.aiTags && typeof client.aiTags === 'object') {
      summary.push("\nAI-Generated Insights:");
      summary.push(JSON.stringify(client.aiTags, null, 2).substring(0, 1000));
    }

    return summary.join("\n");
  }

  /**
   * Format assessment data for AI analysis
   */
  private formatAssessmentData(assessments: Assessment[]): string {
    if (assessments.length === 0) return "No assessment data available.";

    return assessments
      .sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime())
      .slice(0, 5)
      .map(assessment => {
        const score = this.extractTotalScore(assessment.scores);
        return `${assessment.assessmentType} (${new Date(assessment.assessmentDate).toDateString()}): Score ${score}${assessment.interpretation ? ` - ${assessment.interpretation}` : ''}`;
      })
      .join("\n");
  }

  /**
   * Format recent session notes for AI analysis
   */
  private formatRecentSessions(sessions: Session[]): string {
    if (sessions.length === 0) return "No recent session data available.";

    return sessions.map(session => {
      return `Session ${new Date(session.sessionDate).toDateString()}:
- Type: ${session.sessionType || 'Individual'}
- Duration: ${session.duration || 'Unknown'} minutes
- Notes: ${session.notes?.substring(0, 300) || 'No notes available'}
- Interventions: ${session.interventionsUsed ? JSON.stringify(session.interventionsUsed) : 'None recorded'}
${session.homework ? `- Homework: ${session.homework}` : ''}
${session.nextSessionPlan ? `- Next session plan: ${session.nextSessionPlan}` : ''}`;
    }).join("\n\n");
  }

  /**
   * Enhance AI recommendations with rule-based clinical guidelines
   */
  private enhanceWithRules(
    recommendations: TreatmentRecommendations,
    assessments: Assessment[],
    sessions: Session[],
    options: any
  ): TreatmentRecommendations {
    
    // Add safety checks based on assessment scores
    this.addSafetyRecommendations(recommendations, assessments);
    
    // Add session frequency recommendations
    this.addSessionFrequencyRecommendations(recommendations, sessions);
    
    // Add evidence-based treatment duration guidelines
    this.addTreatmentDurationGuidelines(recommendations, assessments);
    
    // Add medication safety considerations
    this.addMedicationSafetyChecks(recommendations);

    return recommendations;
  }

  /**
   * Add safety recommendations based on assessment scores
   */
  private addSafetyRecommendations(
    recommendations: TreatmentRecommendations,
    assessments: Assessment[]
  ): void {
    
    const recentAssessments = assessments
      .sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime())
      .slice(0, 3);

    for (const assessment of recentAssessments) {
      const score = this.extractTotalScore(assessment.scores);
      
      if (assessment.assessmentType === "PHQ-9" && score >= 20) {
        recommendations.riskManagement.immediateActions.push("Immediate suicide risk assessment due to severe depression (PHQ-9 ≥ 20)");
        recommendations.primaryRecommendations.unshift({
          category: "crisis",
          recommendation: "Conduct comprehensive suicide risk assessment",
          priority: "immediate",
          evidenceLevel: "expert_opinion",
          rationale: "PHQ-9 score indicates severe depression with elevated suicide risk",
          timeframe: "Within 24 hours"
        });
      }
      
      if (assessment.assessmentType === "GAD-7" && score >= 15) {
        recommendations.riskManagement.monitoringPlan.push("Monitor for panic attacks and functional impairment due to severe anxiety");
      }
    }
  }

  /**
   * Add session frequency recommendations based on severity
   */
  private addSessionFrequencyRecommendations(
    recommendations: TreatmentRecommendations,
    sessions: Session[]
  ): void {
    
    if (sessions.length > 0) {
      const recentSessions = sessions.slice(-4);
      const avgDaysBetween = this.calculateAverageSessionInterval(recentSessions);
      
      if (avgDaysBetween > 14) {
        recommendations.sessionPlanAdjustments.frequency = "Increase to weekly sessions for better therapeutic continuity";
      }
    }
  }

  /**
   * Add evidence-based treatment duration guidelines
   */
  private addTreatmentDurationGuidelines(
    recommendations: TreatmentRecommendations,
    assessments: Assessment[]
  ): void {
    
    // Add standard treatment duration recommendations based on assessment types
    const hasDepression = assessments.some(a => a.assessmentType === "PHQ-9");
    const hasAnxiety = assessments.some(a => a.assessmentType === "GAD-7");
    
    if (hasDepression) {
      recommendations.therapeuticApproaches.forEach(approach => {
        if (approach.approach.includes("CBT") && !approach.duration) {
          approach.duration = "12-20 sessions (evidence-based standard for depression)";
        }
      });
    }
    
    if (hasAnxiety) {
      recommendations.therapeuticApproaches.forEach(approach => {
        if (approach.approach.includes("CBT") && !approach.duration) {
          approach.duration = "8-12 sessions (evidence-based standard for anxiety)";
        }
      });
    }
  }

  /**
   * Add medication safety considerations
   */
  private addMedicationSafetyChecks(recommendations: TreatmentRecommendations): void {
    if (recommendations.medicationConsiderations.indicated) {
      recommendations.medicationConsiderations.recommendations.forEach(med => {
        if (!med.monitoring.includes("Suicidal ideation monitoring")) {
          med.monitoring.push("Suicidal ideation monitoring (especially first 2-4 weeks)");
        }
        if (!med.monitoring.includes("Side effect assessment")) {
          med.monitoring.push("Side effect assessment at each visit");
        }
      });
    }
  }

  /**
   * Get minimal recommendations structure when AI fails
   */
  private getMinimalRecommendations(
    assessments: Assessment[],
    sessions: Session[]
  ): TreatmentRecommendations {
    
    const hasHighScores = assessments.some(a => {
      const score = this.extractTotalScore(a.scores);
      return (a.assessmentType === "PHQ-9" && score >= 15) || 
             (a.assessmentType === "GAD-7" && score >= 10);
    });

    return {
      primaryRecommendations: [
        {
          category: "therapy",
          recommendation: hasHighScores ? "Continue intensive therapy" : "Maintain current therapy approach",
          priority: hasHighScores ? "high" : "medium",
          evidenceLevel: "expert_opinion",
          rationale: "Based on current assessment scores and treatment progress"
        }
      ],
      therapeuticApproaches: [
        {
          approach: "Cognitive Behavioral Therapy",
          suitability: "suitable",
          evidenceBase: "Strong evidence for anxiety and depression"
        }
      ],
      medicationConsiderations: {
        indicated: hasHighScores,
        urgency: hasHighScores ? "soon" : "routine",
        recommendations: [],
        psychiatricConsult: hasHighScores
      },
      riskManagement: {
        immediateActions: hasHighScores ? ["Risk assessment"] : [],
        safetyPlanUpdates: [],
        monitoringPlan: ["Regular assessment tracking"],
        emergencyProtocols: ["Crisis hotline available"],
        supportSystemActivation: []
      },
      goalAdjustments: [
        {
          currentGoal: "Symptom reduction",
          recommendedChange: "maintain",
          rationale: "Continue current treatment approach"
        }
      ],
      sessionPlanAdjustments: {
        frequency: "Weekly",
        format: "individual",
        specializations: [],
        focusAreas: ["Symptom management"]
      },
      qualityOfLife: [],
      prognosis: {
        shortTerm: {
          timeframe: "3 months",
          expectedOutcomes: ["Symptom stabilization"],
          uncertainties: ["Treatment response"]
        },
        longTerm: {
          timeframe: "12 months",
          expectedOutcomes: ["Improved functioning"],
          factors: ["Treatment adherence"]
        },
        overallPrognosis: "fair"
      },
      metadata: {
        generatedDate: new Date().toISOString(),
        basedOnData: {
          assessments: assessments.length,
          sessions: sessions.length,
          documents: 0,
          treatmentPlans: 0
        },
        aiConfidence: 0.5,
        clinicalValidation: "required",
        reviewDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      }
    };
  }

  // Helper methods
  private extractTotalScore(scores: any): number {
    if (typeof scores === 'object' && scores.totalScore !== undefined) {
      return scores.totalScore;
    }
    return 0;
  }

  private extractInterventions(sessions: Session[]): string[] {
    const interventions = new Set<string>();
    
    sessions.forEach(session => {
      if (session.interventionsUsed && Array.isArray(session.interventionsUsed)) {
        session.interventionsUsed.forEach((intervention: any) => {
          const name = typeof intervention === 'string' ? intervention : intervention.name || 'Unknown';
          interventions.add(name);
        });
      }
      
      // Extract interventions from notes
      if (session.notes) {
        const note = session.notes.toLowerCase();
        const commonInterventions = ['cbt', 'dbt', 'mindfulness', 'exposure', 'emdr'];
        commonInterventions.forEach(intervention => {
          if (note.includes(intervention)) {
            interventions.add(intervention.toUpperCase());
          }
        });
      }
    });
    
    return Array.from(interventions);
  }

  private calculateAverageSessionInterval(sessions: Session[]): number {
    if (sessions.length < 2) return 0;
    
    const intervals: number[] = [];
    for (let i = 1; i < sessions.length; i++) {
      const diff = (new Date(sessions[i].sessionDate).getTime() - new Date(sessions[i-1].sessionDate).getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(diff);
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  private assessDataQuality(
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[],
    treatmentPlans: TreatmentPlan[]
  ): string {
    
    const totalDataPoints = assessments.length + sessions.length + documents.length + treatmentPlans.length;
    
    if (totalDataPoints >= 10 && assessments.length >= 2 && sessions.length >= 3) return "excellent";
    if (totalDataPoints >= 6 && (assessments.length >= 1 || sessions.length >= 2)) return "good";
    if (totalDataPoints >= 3) return "fair";
    if (totalDataPoints >= 1) return "minimal";
    return "insufficient";
  }

  /**
   * Generate crisis-specific recommendations
   */
  async generateCrisisRecommendations(
    clientId: string,
    therapistId: string,
    crisisType: "suicide" | "violence" | "psychosis" | "substance" | "other",
    urgencyLevel: "low" | "moderate" | "high" | "imminent"
  ): Promise<RecommendationGenerationResult> {
    
    try {
      console.log(`[Recommendation Engine] Generating crisis recommendations for client ${clientId}, type: ${crisisType}, urgency: ${urgencyLevel}`);

      const crisisRecommendations: TreatmentRecommendations = {
        primaryRecommendations: this.getCrisisRecommendations(crisisType, urgencyLevel),
        therapeuticApproaches: [],
        medicationConsiderations: {
          indicated: urgencyLevel === "high" || urgencyLevel === "imminent",
          urgency: urgencyLevel === "imminent" ? "immediate" : "soon",
          recommendations: [],
          psychiatricConsult: true
        },
        riskManagement: this.getCrisisRiskManagement(crisisType, urgencyLevel),
        goalAdjustments: [{
          currentGoal: "Crisis stabilization",
          recommendedChange: "add",
          newGoal: "Ensure immediate safety and crisis resolution",
          rationale: "Crisis situation requires immediate safety focus"
        }],
        sessionPlanAdjustments: {
          frequency: urgencyLevel === "imminent" ? "Daily check-ins" : "Increased frequency",
          format: "individual",
          specializations: ["Crisis intervention"],
          focusAreas: ["Safety planning", "Crisis de-escalation"]
        },
        qualityOfLife: [],
        prognosis: {
          shortTerm: {
            timeframe: "24-72 hours",
            expectedOutcomes: ["Crisis stabilization", "Safety assurance"],
            uncertainties: ["Client cooperation", "Support system availability"]
          },
          longTerm: {
            timeframe: "1-3 months",
            expectedOutcomes: ["Return to baseline functioning", "Crisis prevention skills"],
            factors: ["Treatment engagement", "Support system strength"]
          },
          overallPrognosis: urgencyLevel === "imminent" ? "guarded" : "fair"
        },
        metadata: {
          generatedDate: new Date().toISOString(),
          basedOnData: { assessments: 0, sessions: 0, documents: 0, treatmentPlans: 0 },
          aiConfidence: 0.9,
          clinicalValidation: "required",
          reviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        }
      };

      return {
        success: true,
        recommendations: crisisRecommendations,
        metadata: {
          clientId,
          generationTime: 100,
          dataQuality: "crisis",
          recommendationCount: crisisRecommendations.primaryRecommendations.length
        }
      };

    } catch (error) {
      console.error(`[Recommendation Engine] Error generating crisis recommendations:`, error);
      return {
        success: false,
        recommendations: null,
        errors: [error instanceof Error ? error.message : String(error)],
        metadata: {
          clientId,
          generationTime: 0,
          dataQuality: "error",
          recommendationCount: 0
        }
      };
    }
  }

  private getCrisisRecommendations(
    crisisType: string,
    urgencyLevel: string
  ): TreatmentRecommendations['primaryRecommendations'] {
    
    const recommendations: TreatmentRecommendations['primaryRecommendations'] = [];

    if (urgencyLevel === "imminent") {
      recommendations.push({
        category: "crisis",
        recommendation: "Immediate emergency intervention - consider hospitalization or emergency services",
        priority: "immediate",
        evidenceLevel: "expert_opinion",
        rationale: "Imminent risk requires immediate professional intervention",
        timeframe: "Immediately"
      });
    }

    switch (crisisType) {
      case "suicide":
        recommendations.push({
          category: "crisis",
          recommendation: "Comprehensive suicide risk assessment with safety planning",
          priority: "immediate",
          evidenceLevel: "strong",
          rationale: "Evidence-based approach to suicide prevention",
          timeframe: "Within 1 hour"
        });
        break;

      case "violence":
        recommendations.push({
          category: "crisis",
          recommendation: "Violence risk assessment and safety planning for all parties",
          priority: "immediate",
          evidenceLevel: "expert_opinion",
          rationale: "Duty to warn and protect potential victims",
          timeframe: "Immediately"
        });
        break;

      case "psychosis":
        recommendations.push({
          category: "crisis",
          recommendation: "Psychiatric evaluation for medication management and reality testing",
          priority: "urgent",
          evidenceLevel: "strong",
          rationale: "Acute psychosis requires medical intervention",
          timeframe: "Within 4 hours"
        });
        break;

      case "substance":
        recommendations.push({
          category: "crisis",
          recommendation: "Medical evaluation for detoxification needs and substance abuse treatment",
          priority: "urgent",
          evidenceLevel: "strong",
          rationale: "Substance-related crises may require medical monitoring",
          timeframe: "Within 6 hours"
        });
        break;
    }

    return recommendations;
  }

  private getCrisisRiskManagement(
    crisisType: string,
    urgencyLevel: string
  ): TreatmentRecommendations['riskManagement'] {
    
    return {
      immediateActions: [
        "Contact emergency services if imminent danger",
        "Activate support system",
        "Remove means of harm if applicable",
        "Ensure continuous supervision"
      ],
      safetyPlanUpdates: [
        "Update emergency contacts",
        "Identify warning signs",
        "Develop coping strategies",
        "Create environmental safety measures"
      ],
      monitoringPlan: [
        "Continuous risk assessment",
        "Frequent check-ins",
        "Monitor compliance with safety plan",
        "Track risk factors and triggers"
      ],
      emergencyProtocols: [
        "Emergency services: 911",
        "Crisis hotline: 988",
        "Emergency contact protocols",
        "Hospitalization criteria"
      ],
      supportSystemActivation: [
        "Contact family/friends",
        "Coordinate with healthcare team",
        "Engage community resources",
        "Professional consultation"
      ]
    };
  }
}

// Export singleton instance
export const recommendationEngine = new RecommendationEngine();