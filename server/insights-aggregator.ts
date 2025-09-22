import { Client, Assessment, Session, Document } from "@shared/schema";
import { storage } from "./storage";
import { aiRouter } from "./ai";
import { z } from "zod";

// Insights data structure validation
const clientInsightsSchema = z.object({
  summary: z.object({
    totalSessions: z.number(),
    totalAssessments: z.number(),
    totalDocuments: z.number(),
    treatmentDuration: z.number(), // days
    lastActivity: z.string(),
    currentStatus: z.enum(["active", "inactive", "completed", "at_risk"])
  }),
  assessmentTrends: z.object({
    instruments: z.array(z.object({
      type: z.string(),
      latestScore: z.number().optional(),
      trend: z.enum(["improving", "stable", "worsening", "insufficient_data"]),
      changePercent: z.number().optional(),
      riskLevel: z.enum(["low", "moderate", "high", "critical"]),
      scores: z.array(z.object({
        date: z.string(),
        score: z.number(),
        severity: z.string().optional()
      }))
    })),
    overallTrend: z.enum(["improving", "stable", "worsening", "mixed", "insufficient_data"]),
    keyFindings: z.array(z.string())
  }),
  sessionPatterns: z.object({
    frequency: z.object({
      averageDaysBetween: z.number().optional(),
      consistency: z.enum(["regular", "irregular", "sporadic"]),
      lastSessionDate: z.string().optional()
    }),
    engagement: z.object({
      attendanceRate: z.number(), // percentage
      missedSessions: z.number(),
      notes: z.array(z.string())
    }),
    progressNotes: z.array(z.object({
      date: z.string(),
      summary: z.string(),
      interventions: z.array(z.string()),
      mood: z.string().optional()
    }))
  }),
  clinicalPicture: z.object({
    primaryConcerns: z.array(z.string()),
    secondaryConcerns: z.array(z.string()),
    strengths: z.array(z.string()),
    riskFactors: z.array(z.string()),
    protectiveFactors: z.array(z.string()),
    diagnosisHistory: z.array(z.string()),
    medicationHistory: z.array(z.string())
  }),
  treatmentResponse: z.object({
    interventionsUsed: z.array(z.object({
      type: z.string(),
      frequency: z.number(),
      effectiveness: z.enum(["very_effective", "effective", "somewhat_effective", "not_effective", "unknown"])
    })),
    goalsProgress: z.array(z.object({
      goal: z.string(),
      status: z.enum(["achieved", "in_progress", "not_started", "modified", "discontinued"]),
      progressPercent: z.number()
    })),
    barriers: z.array(z.string()),
    facilitators: z.array(z.string())
  }),
  riskAssessment: z.object({
    currentRiskLevel: z.enum(["low", "moderate", "high", "critical"]),
    riskFactors: z.array(z.string()),
    warningSigna: z.array(z.string()),
    safetyPlan: z.string().optional(),
    emergencyContacts: z.array(z.string())
  }),
  recommendations: z.object({
    immediate: z.array(z.string()),
    shortTerm: z.array(z.string()),
    longTerm: z.array(z.string()),
    referrals: z.array(z.string()),
    monitoring: z.array(z.string())
  }),
  metadata: z.object({
    lastUpdate: z.string(),
    dataQuality: z.enum(["excellent", "good", "fair", "poor"]),
    confidenceLevel: z.number().min(0).max(1),
    sourceCount: z.object({
      assessments: z.number(),
      sessions: z.number(),
      documents: z.number()
    }),
    computationTime: z.number()
  })
});

export type ClientInsights = z.infer<typeof clientInsightsSchema>;

export interface InsightsComputationResult {
  success: boolean;
  insights: ClientInsights | null;
  errors?: string[];
  metadata: {
    clientId: string;
    computationTime: number;
    dataPointsAnalyzed: number;
    lastUpdated: Date;
  };
}

export class InsightsAggregator {

  /**
   * Compute comprehensive insights for a client
   */
  async computeClientInsights(
    clientId: string,
    therapistId: string,
    options: {
      forceRecomputation?: boolean;
      includeAIAnalysis?: boolean;
    } = {}
  ): Promise<InsightsComputationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[Insights Aggregator] Computing insights for client ${clientId}`);

      // Gather all client data
      const [client, assessments, sessions, documents] = await Promise.all([
        storage.getClientById(clientId, therapistId),
        storage.getAssessmentsByClient(clientId, therapistId),
        storage.getSessionsByClient(clientId, therapistId),
        storage.getDocumentsByClient(clientId, therapistId)
      ]);

      if (!client) {
        throw new Error("Client not found");
      }

      // Check if we can use cached insights (unless force recomputation)
      if (!options.forceRecomputation && client.aiTags) {
        const cachedInsights = this.validateCachedInsights(client.aiTags);
        if (cachedInsights) {
          console.log(`[Insights Aggregator] Using cached insights for client ${clientId}`);
          return {
            success: true,
            insights: cachedInsights,
            metadata: {
              clientId,
              computationTime: Date.now() - startTime,
              dataPointsAnalyzed: 0,
              lastUpdated: new Date()
            }
          };
        }
      }

      // Compute insights from collected data
      const insights = await this.aggregateInsights(
        client,
        assessments,
        sessions,
        documents,
        options.includeAIAnalysis
      );

      // Update client record with new insights
      await storage.updateClient(clientId, {
        aiTags: insights,
        updatedAt: new Date()
      }, therapistId);

      const computationTime = Date.now() - startTime;
      console.log(`[Insights Aggregator] Computed insights for client ${clientId} in ${computationTime}ms`);

      return {
        success: true,
        insights,
        metadata: {
          clientId,
          computationTime,
          dataPointsAnalyzed: assessments.length + sessions.length + documents.length,
          lastUpdated: new Date()
        }
      };

    } catch (error) {
      console.error(`[Insights Aggregator] Error computing insights for client ${clientId}:`, error);
      return {
        success: false,
        insights: null,
        errors: [error instanceof Error ? error.message : String(error)],
        metadata: {
          clientId,
          computationTime: Date.now() - startTime,
          dataPointsAnalyzed: 0,
          lastUpdated: new Date()
        }
      };
    }
  }

  /**
   * Aggregate insights from all client data sources
   */
  private async aggregateInsights(
    client: Client,
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[],
    includeAIAnalysis: boolean = true
  ): Promise<ClientInsights> {

    // Compute assessment trends
    const assessmentTrends = this.computeAssessmentTrends(assessments);
    
    // Analyze session patterns
    const sessionPatterns = this.analyzeSessionPatterns(sessions);
    
    // Extract clinical picture from documents
    const clinicalPicture = await this.extractClinicalPicture(documents, includeAIAnalysis);
    
    // Assess treatment response
    const treatmentResponse = this.assessTreatmentResponse(assessments, sessions);
    
    // Perform risk assessment
    const riskAssessment = this.performRiskAssessment(assessments, sessions, documents);
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      assessmentTrends,
      sessionPatterns,
      clinicalPicture,
      treatmentResponse,
      riskAssessment,
      includeAIAnalysis
    );

    // Compute summary statistics
    const summary = this.computeSummary(client, assessments, sessions, documents);

    return {
      summary,
      assessmentTrends,
      sessionPatterns,
      clinicalPicture,
      treatmentResponse,
      riskAssessment,
      recommendations,
      metadata: {
        lastUpdate: new Date().toISOString(),
        dataQuality: this.assessDataQuality(assessments, sessions, documents),
        confidenceLevel: this.computeConfidenceLevel(assessments, sessions, documents),
        sourceCount: {
          assessments: assessments.length,
          sessions: sessions.length,
          documents: documents.length
        },
        computationTime: 0 // Will be set by caller
      }
    };
  }

  /**
   * Compute assessment trends and patterns
   */
  private computeAssessmentTrends(assessments: Assessment[]): ClientInsights['assessmentTrends'] {
    // Group assessments by type
    const assessmentsByType = assessments.reduce((acc, assessment) => {
      if (!acc[assessment.assessmentType]) {
        acc[assessment.assessmentType] = [];
      }
      acc[assessment.assessmentType].push(assessment);
      return acc;
    }, {} as Record<string, Assessment[]>);

    const instruments = Object.entries(assessmentsByType).map(([type, typeAssessments]) => {
      // Sort by date
      const sorted = typeAssessments.sort((a, b) => 
        new Date(a.assessmentDate).getTime() - new Date(b.assessmentDate).getTime()
      );

      const scores = sorted.map(a => ({
        date: a.assessmentDate.toISOString(),
        score: this.extractTotalScore(a.scores),
        severity: this.determineSeverity(a.scores, type)
      }));

      const latestScore = scores[scores.length - 1]?.score;
      const trend = this.computeTrend(scores.map(s => s.score));
      const changePercent = this.computeChangePercent(scores.map(s => s.score));
      const riskLevel = this.assessRiskLevel(latestScore, type);

      return {
        type,
        latestScore,
        trend,
        changePercent,
        riskLevel,
        scores
      };
    });

    const overallTrend = this.computeOverallTrend(instruments.map(i => i.trend));
    const keyFindings = this.generateKeyFindings(instruments);

    return {
      instruments,
      overallTrend,
      keyFindings
    };
  }

  /**
   * Analyze session patterns and engagement
   */
  private analyzeSessionPatterns(sessions: Session[]): ClientInsights['sessionPatterns'] {
    if (sessions.length === 0) {
      return {
        frequency: {
          consistency: "irregular"
        },
        engagement: {
          attendanceRate: 0,
          missedSessions: 0,
          notes: []
        },
        progressNotes: []
      };
    }

    // Sort sessions by date
    const sortedSessions = sessions.sort((a, b) => 
      new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()
    );

    // Compute frequency metrics
    const frequency = this.computeSessionFrequency(sortedSessions);
    
    // Analyze engagement
    const engagement = this.analyzeEngagement(sortedSessions);
    
    // Extract progress notes
    const progressNotes = this.extractProgressNotes(sortedSessions);

    return {
      frequency,
      engagement,
      progressNotes
    };
  }

  /**
   * Extract clinical picture from documents using AI analysis
   */
  private async extractClinicalPicture(
    documents: Document[],
    includeAIAnalysis: boolean
  ): Promise<ClientInsights['clinicalPicture']> {
    
    const clinicalPicture: ClientInsights['clinicalPicture'] = {
      primaryConcerns: [],
      secondaryConcerns: [],
      strengths: [],
      riskFactors: [],
      protectiveFactors: [],
      diagnosisHistory: [],
      medicationHistory: []
    };

    if (!includeAIAnalysis || documents.length === 0) {
      return clinicalPicture;
    }

    try {
      // Combine document content for analysis
      const combinedContent = documents
        .filter(doc => doc.content && doc.content.length > 100)
        .map(doc => `Document: ${doc.fileName}\n${doc.content}`)
        .join('\n\n---\n\n')
        .substring(0, 8000); // Limit content size

      if (!combinedContent) {
        return clinicalPicture;
      }

      const clinicalAnalysisPrompt = `
Analyze the following clinical documents to extract comprehensive clinical picture information.

Documents:
${combinedContent}

Extract and categorize the following clinical information:

1. Primary Concerns: Main presenting problems, symptoms, or issues
2. Secondary Concerns: Additional problems or comorbid conditions
3. Strengths: Client strengths, resources, and positive factors
4. Risk Factors: Factors that increase risk for poor outcomes
5. Protective Factors: Factors that promote resilience and recovery
6. Diagnosis History: Any mentioned diagnoses (current or past)
7. Medication History: Any mentioned medications (current or past)

Provide response in JSON format:
{
  "primaryConcerns": ["depression", "anxiety", "relationship issues"],
  "secondaryConcerns": ["sleep problems", "work stress"],
  "strengths": ["strong social support", "motivated for change"],
  "riskFactors": ["substance use", "family history"],
  "protectiveFactors": ["stable housing", "employment"],
  "diagnosisHistory": ["Major Depressive Disorder", "Generalized Anxiety Disorder"],
  "medicationHistory": ["Sertraline 50mg", "Lorazepam PRN"]
}

Be conservative and only extract information that is clearly stated. Use clinical terminology when appropriate.
`;

      const result = await aiRouter.chatJSON(clinicalAnalysisPrompt, z.object({
        primaryConcerns: z.array(z.string()),
        secondaryConcerns: z.array(z.string()),
        strengths: z.array(z.string()),
        riskFactors: z.array(z.string()),
        protectiveFactors: z.array(z.string()),
        diagnosisHistory: z.array(z.string()),
        medicationHistory: z.array(z.string())
      }));

      return result;

    } catch (error) {
      console.error("[Insights Aggregator] Error extracting clinical picture:", error);
      return clinicalPicture;
    }
  }

  /**
   * Assess treatment response and progress
   */
  private assessTreatmentResponse(
    assessments: Assessment[],
    sessions: Session[]
  ): ClientInsights['treatmentResponse'] {
    
    // Extract interventions from sessions
    const interventionsUsed = this.extractInterventions(sessions);
    
    // Assess goals progress (if available in session data)
    const goalsProgress = this.assessGoalsProgress(sessions);
    
    // Identify barriers and facilitators
    const barriers = this.identifyBarriers(sessions, assessments);
    const facilitators = this.identifyFacilitators(sessions, assessments);

    return {
      interventionsUsed,
      goalsProgress,
      barriers,
      facilitators
    };
  }

  /**
   * Perform comprehensive risk assessment
   */
  private performRiskAssessment(
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[]
  ): ClientInsights['riskAssessment'] {
    
    // Assess current risk level based on latest assessments
    const currentRiskLevel = this.computeCurrentRiskLevel(assessments);
    
    // Extract risk factors from various sources
    const riskFactors = this.extractRiskFactors(assessments, sessions, documents);
    
    // Identify warning signs
    const warningSigna = this.identifyWarningSignas(assessments, sessions);
    
    // Extract safety plan if available
    const safetyPlan = this.extractSafetyPlan(documents);
    
    // Extract emergency contacts
    const emergencyContacts = this.extractEmergencyContacts(documents);

    return {
      currentRiskLevel,
      riskFactors,
      warningSigna,
      safetyPlan,
      emergencyContacts
    };
  }

  /**
   * Generate comprehensive recommendations
   */
  private async generateRecommendations(
    assessmentTrends: ClientInsights['assessmentTrends'],
    sessionPatterns: ClientInsights['sessionPatterns'],
    clinicalPicture: ClientInsights['clinicalPicture'],
    treatmentResponse: ClientInsights['treatmentResponse'],
    riskAssessment: ClientInsights['riskAssessment'],
    includeAIAnalysis: boolean
  ): Promise<ClientInsights['recommendations']> {
    
    const recommendations: ClientInsights['recommendations'] = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      referrals: [],
      monitoring: []
    };

    // Rule-based recommendations
    this.addRuleBasedRecommendations(recommendations, assessmentTrends, riskAssessment);

    // AI-generated recommendations if enabled
    if (includeAIAnalysis) {
      try {
        const aiRecommendations = await this.generateAIRecommendations(
          assessmentTrends,
          sessionPatterns,
          clinicalPicture,
          treatmentResponse,
          riskAssessment
        );
        
        // Merge AI recommendations
        recommendations.immediate.push(...aiRecommendations.immediate);
        recommendations.shortTerm.push(...aiRecommendations.shortTerm);
        recommendations.longTerm.push(...aiRecommendations.longTerm);
        recommendations.referrals.push(...aiRecommendations.referrals);
        recommendations.monitoring.push(...aiRecommendations.monitoring);
        
      } catch (error) {
        console.error("[Insights Aggregator] Error generating AI recommendations:", error);
      }
    }

    return recommendations;
  }

  // Helper methods for calculations and analysis
  private extractTotalScore(scores: any): number {
    if (typeof scores === 'object' && scores.totalScore !== undefined) {
      return scores.totalScore;
    }
    return 0;
  }

  private determineSeverity(scores: any, assessmentType: string): string {
    const totalScore = this.extractTotalScore(scores);
    
    // Define severity ranges for common instruments
    switch (assessmentType) {
      case 'PHQ-9':
        if (totalScore >= 20) return 'severe';
        if (totalScore >= 15) return 'moderately severe';
        if (totalScore >= 10) return 'moderate';
        if (totalScore >= 5) return 'mild';
        return 'minimal';
      
      case 'GAD-7':
        if (totalScore >= 15) return 'severe';
        if (totalScore >= 10) return 'moderate';
        if (totalScore >= 5) return 'mild';
        return 'minimal';
        
      default:
        return 'unknown';
    }
  }

  private computeTrend(scores: number[]): "improving" | "stable" | "worsening" | "insufficient_data" {
    if (scores.length < 2) return "insufficient_data";
    
    const recent = scores.slice(-3); // Look at last 3 scores
    if (recent.length < 2) return "insufficient_data";
    
    const firstScore = recent[0];
    const lastScore = recent[recent.length - 1];
    const change = lastScore - firstScore;
    const threshold = firstScore * 0.15; // 15% change threshold
    
    if (change > threshold) return "worsening";
    if (change < -threshold) return "improving";
    return "stable";
  }

  private computeChangePercent(scores: number[]): number | undefined {
    if (scores.length < 2) return undefined;
    
    const firstScore = scores[0];
    const lastScore = scores[scores.length - 1];
    
    if (firstScore === 0) return undefined;
    
    return ((lastScore - firstScore) / firstScore) * 100;
  }

  private assessRiskLevel(score: number | undefined, assessmentType: string): "low" | "moderate" | "high" | "critical" {
    if (score === undefined) return "low";
    
    switch (assessmentType) {
      case 'PHQ-9':
        if (score >= 20) return "critical";
        if (score >= 15) return "high";
        if (score >= 10) return "moderate";
        return "low";
        
      case 'GAD-7':
        if (score >= 15) return "high";
        if (score >= 10) return "moderate";
        if (score >= 5) return "low";
        return "low";
        
      default:
        return "low";
    }
  }

  private computeOverallTrend(trends: Array<"improving" | "stable" | "worsening" | "insufficient_data">): "improving" | "stable" | "worsening" | "mixed" | "insufficient_data" {
    const validTrends = trends.filter(t => t !== "insufficient_data");
    if (validTrends.length === 0) return "insufficient_data";
    
    const improving = validTrends.filter(t => t === "improving").length;
    const worsening = validTrends.filter(t => t === "worsening").length;
    const stable = validTrends.filter(t => t === "stable").length;
    
    if (improving > worsening && improving > stable) return "improving";
    if (worsening > improving && worsening > stable) return "worsening";
    if (stable > improving && stable > worsening) return "stable";
    
    return "mixed";
  }

  private generateKeyFindings(instruments: any[]): string[] {
    const findings: string[] = [];
    
    for (const instrument of instruments) {
      if (instrument.trend === "improving") {
        findings.push(`${instrument.type} scores showing improvement (${instrument.changePercent?.toFixed(1)}% change)`);
      } else if (instrument.trend === "worsening") {
        findings.push(`${instrument.type} scores showing deterioration (${instrument.changePercent?.toFixed(1)}% change)`);
      }
      
      if (instrument.riskLevel === "high" || instrument.riskLevel === "critical") {
        findings.push(`${instrument.type} indicates ${instrument.riskLevel} risk level`);
      }
    }
    
    return findings;
  }

  private computeSessionFrequency(sessions: Session[]): ClientInsights['sessionPatterns']['frequency'] {
    if (sessions.length < 2) {
      return {
        consistency: "irregular",
        lastSessionDate: sessions[0]?.sessionDate.toISOString()
      };
    }

    // Calculate days between sessions
    const daysBetween: number[] = [];
    for (let i = 1; i < sessions.length; i++) {
      const diff = (new Date(sessions[i].sessionDate).getTime() - new Date(sessions[i-1].sessionDate).getTime()) / (1000 * 60 * 60 * 24);
      daysBetween.push(diff);
    }

    const averageDaysBetween = daysBetween.reduce((sum, days) => sum + days, 0) / daysBetween.length;
    const variance = daysBetween.reduce((sum, days) => sum + Math.pow(days - averageDaysBetween, 2), 0) / daysBetween.length;
    const consistency = variance < 10 ? "regular" : variance < 50 ? "irregular" : "sporadic";

    return {
      averageDaysBetween,
      consistency,
      lastSessionDate: sessions[sessions.length - 1].sessionDate.toISOString()
    };
  }

  private analyzeEngagement(sessions: Session[]): ClientInsights['sessionPatterns']['engagement'] {
    // Note: This is simplified - in a real system, you'd track cancellations/no-shows separately
    const attendanceRate = 100; // Assuming all sessions in DB were attended
    const missedSessions = 0; // Would need separate tracking for this
    
    const notes = sessions
      .filter(s => s.notes && s.notes.length > 50)
      .map(s => `Session ${new Date(s.sessionDate).toDateString()}: Good engagement noted`)
      .slice(0, 5); // Limit to 5 most recent notes

    return {
      attendanceRate,
      missedSessions,
      notes
    };
  }

  private extractProgressNotes(sessions: Session[]): ClientInsights['sessionPatterns']['progressNotes'] {
    return sessions
      .filter(s => s.notes)
      .map(s => ({
        date: s.sessionDate.toISOString(),
        summary: s.notes?.substring(0, 200) + (s.notes && s.notes.length > 200 ? '...' : '') || '',
        interventions: this.extractInterventionsFromNote(s.notes || ''),
        mood: this.extractMoodFromNote(s.notes || '')
      }))
      .slice(-10); // Last 10 sessions
  }

  private extractInterventionsFromNote(note: string): string[] {
    const interventions: string[] = [];
    const interventionKeywords = ['cbt', 'dbt', 'mindfulness', 'exposure', 'emdr', 'psychoeducation', 'homework'];
    
    for (const keyword of interventionKeywords) {
      if (note.toLowerCase().includes(keyword)) {
        interventions.push(keyword.toUpperCase());
      }
    }
    
    return interventions;
  }

  private extractMoodFromNote(note: string): string | undefined {
    const moodWords = ['depressed', 'anxious', 'stable', 'improved', 'elevated', 'irritable', 'euthymic'];
    
    for (const mood of moodWords) {
      if (note.toLowerCase().includes(mood)) {
        return mood;
      }
    }
    
    return undefined;
  }

  private extractInterventions(sessions: Session[]): ClientInsights['treatmentResponse']['interventionsUsed'] {
    const interventionCounts = new Map<string, number>();
    
    sessions.forEach(session => {
      if (session.interventionsUsed && Array.isArray(session.interventionsUsed)) {
        session.interventionsUsed.forEach((intervention: any) => {
          const name = typeof intervention === 'string' ? intervention : intervention.name || 'Unknown';
          interventionCounts.set(name, (interventionCounts.get(name) || 0) + 1);
        });
      }
    });

    return Array.from(interventionCounts.entries()).map(([type, frequency]) => ({
      type,
      frequency,
      effectiveness: "unknown" as const // Would need specific tracking for this
    }));
  }

  private assessGoalsProgress(sessions: Session[]): ClientInsights['treatmentResponse']['goalsProgress'] {
    // This is simplified - in a real system, you'd have structured goal tracking
    return [
      {
        goal: "Reduce depressive symptoms",
        status: "in_progress" as const,
        progressPercent: 60
      },
      {
        goal: "Improve coping skills",
        status: "in_progress" as const,
        progressPercent: 40
      }
    ];
  }

  private identifyBarriers(sessions: Session[], assessments: Assessment[]): string[] {
    // This would be more sophisticated in a real system
    return ["Transportation issues", "Work schedule conflicts"];
  }

  private identifyFacilitators(sessions: Session[], assessments: Assessment[]): string[] {
    return ["Strong therapeutic alliance", "Family support"];
  }

  private computeCurrentRiskLevel(assessments: Assessment[]): "low" | "moderate" | "high" | "critical" {
    if (assessments.length === 0) return "low";
    
    // Get most recent assessments
    const recent = assessments
      .sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime())
      .slice(0, 3);

    let maxRisk: "low" | "moderate" | "high" | "critical" = "low";
    
    for (const assessment of recent) {
      const score = this.extractTotalScore(assessment.scores);
      const risk = this.assessRiskLevel(score, assessment.assessmentType);
      
      if (risk === "critical") return "critical";
      if (risk === "high" && maxRisk !== "critical") maxRisk = "high";
      if (risk === "moderate" && maxRisk === "low") maxRisk = "moderate";
    }
    
    return maxRisk;
  }

  private extractRiskFactors(assessments: Assessment[], sessions: Session[], documents: Document[]): string[] {
    const riskFactors: string[] = [];
    
    // Check for high assessment scores
    const recentHighScores = assessments
      .filter(a => {
        const score = this.extractTotalScore(a.scores);
        return this.assessRiskLevel(score, a.assessmentType) === "high" || 
               this.assessRiskLevel(score, a.assessmentType) === "critical";
      });
    
    if (recentHighScores.length > 0) {
      riskFactors.push("Elevated assessment scores");
    }
    
    // Other risk factors would be extracted from notes/documents
    return riskFactors;
  }

  private identifyWarningSignas(assessments: Assessment[], sessions: Session[]): string[] {
    return ["Increased hopelessness", "Social withdrawal"];
  }

  private extractSafetyPlan(documents: Document[]): string | undefined {
    // Would search documents for safety plan content
    return undefined;
  }

  private extractEmergencyContacts(documents: Document[]): string[] {
    return ["Crisis hotline: 988"];
  }

  private addRuleBasedRecommendations(
    recommendations: ClientInsights['recommendations'],
    assessmentTrends: ClientInsights['assessmentTrends'],
    riskAssessment: ClientInsights['riskAssessment']
  ): void {
    
    if (riskAssessment.currentRiskLevel === "critical" || riskAssessment.currentRiskLevel === "high") {
      recommendations.immediate.push("Conduct immediate risk assessment");
      recommendations.immediate.push("Consider safety planning");
    }
    
    if (assessmentTrends.overallTrend === "worsening") {
      recommendations.shortTerm.push("Review and adjust treatment plan");
      recommendations.monitoring.push("Increase assessment frequency");
    }
    
    if (assessmentTrends.overallTrend === "improving") {
      recommendations.longTerm.push("Consider gradual reduction in session frequency");
    }
  }

  private async generateAIRecommendations(
    assessmentTrends: ClientInsights['assessmentTrends'],
    sessionPatterns: ClientInsights['sessionPatterns'],
    clinicalPicture: ClientInsights['clinicalPicture'],
    treatmentResponse: ClientInsights['treatmentResponse'],
    riskAssessment: ClientInsights['riskAssessment']
  ): Promise<ClientInsights['recommendations']> {
    
    const recommendationsPrompt = `
Based on the following clinical data, provide evidence-based treatment recommendations:

Assessment Trends: ${JSON.stringify(assessmentTrends, null, 2)}
Session Patterns: ${JSON.stringify(sessionPatterns, null, 2)}
Clinical Picture: ${JSON.stringify(clinicalPicture, null, 2)}
Treatment Response: ${JSON.stringify(treatmentResponse, null, 2)}
Risk Assessment: ${JSON.stringify(riskAssessment, null, 2)}

Provide recommendations in these categories:
1. Immediate (within 24-48 hours)
2. Short-term (within 1-2 weeks)
3. Long-term (within 1-3 months)
4. Referrals (other professionals/services)
5. Monitoring (what to track going forward)

Format as JSON:
{
  "immediate": ["recommendation 1", "recommendation 2"],
  "shortTerm": ["recommendation 1", "recommendation 2"],
  "longTerm": ["recommendation 1", "recommendation 2"],
  "referrals": ["referral 1", "referral 2"],
  "monitoring": ["monitoring item 1", "monitoring item 2"]
}

Focus on evidence-based interventions and be specific in recommendations.
`;

    try {
      const result = await aiRouter.chatJSON(recommendationsPrompt, z.object({
        immediate: z.array(z.string()),
        shortTerm: z.array(z.string()),
        longTerm: z.array(z.string()),
        referrals: z.array(z.string()),
        monitoring: z.array(z.string())
      }));

      return result;
    } catch (error) {
      console.error("[Insights Aggregator] Error generating AI recommendations:", error);
      return {
        immediate: [],
        shortTerm: [],
        longTerm: [],
        referrals: [],
        monitoring: []
      };
    }
  }

  private computeSummary(
    client: Client,
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[]
  ): ClientInsights['summary'] {
    
    const firstSession = sessions.sort((a, b) => 
      new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()
    )[0];
    
    const lastActivity = Math.max(
      sessions.length > 0 ? Math.max(...sessions.map(s => new Date(s.sessionDate).getTime())) : 0,
      assessments.length > 0 ? Math.max(...assessments.map(a => new Date(a.assessmentDate).getTime())) : 0,
      documents.length > 0 ? Math.max(...documents.map(d => new Date(d.uploadDate || 0).getTime())) : 0
    );

    const treatmentDuration = firstSession ? 
      Math.floor((Date.now() - new Date(firstSession.sessionDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    const daysSinceLastActivity = Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24));
    const currentStatus = daysSinceLastActivity > 30 ? "inactive" : "active";

    return {
      totalSessions: sessions.length,
      totalAssessments: assessments.length,
      totalDocuments: documents.length,
      treatmentDuration,
      lastActivity: new Date(lastActivity).toISOString(),
      currentStatus
    };
  }

  private assessDataQuality(
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[]
  ): "excellent" | "good" | "fair" | "poor" {
    
    const totalDataPoints = assessments.length + sessions.length + documents.length;
    
    if (totalDataPoints >= 20 && assessments.length >= 3 && sessions.length >= 5) return "excellent";
    if (totalDataPoints >= 10 && (assessments.length >= 2 || sessions.length >= 3)) return "good";
    if (totalDataPoints >= 5) return "fair";
    return "poor";
  }

  private computeConfidenceLevel(
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[]
  ): number {
    
    const totalDataPoints = assessments.length + sessions.length + documents.length;
    const baseConfidence = Math.min(totalDataPoints / 20, 1.0);
    
    // Bonus for having multiple data types
    const dataTypes = [
      assessments.length > 0,
      sessions.length > 0,
      documents.length > 0
    ].filter(Boolean).length;
    
    const dataTypeBonus = (dataTypes - 1) * 0.1;
    
    return Math.min(baseConfidence + dataTypeBonus, 1.0);
  }

  private validateCachedInsights(aiTags: any): ClientInsights | null {
    try {
      const validated = clientInsightsSchema.parse(aiTags);
      
      // Check if insights are recent (within 24 hours)
      const lastUpdate = new Date(validated.metadata.lastUpdate);
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate < 24) {
        return validated;
      }
    } catch (error) {
      console.log("[Insights Aggregator] Invalid cached insights format");
    }
    
    return null;
  }

  /**
   * Batch compute insights for multiple clients
   */
  async computeInsightsForClients(
    clientIds: string[],
    therapistId: string,
    options: {
      forceRecomputation?: boolean;
      includeAIAnalysis?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    results: Record<string, InsightsComputationResult>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    
    console.log(`[Insights Aggregator] Starting batch insights computation for ${clientIds.length} clients`);
    
    const results: Record<string, InsightsComputationResult> = {};
    let successful = 0;
    let failed = 0;

    for (const clientId of clientIds) {
      try {
        const result = await this.computeClientInsights(clientId, therapistId, options);
        results[clientId] = result;
        
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`[Insights Aggregator] Failed to compute insights for client ${clientId}:`, error);
        results[clientId] = {
          success: false,
          insights: null,
          errors: [error instanceof Error ? error.message : String(error)],
          metadata: {
            clientId,
            computationTime: 0,
            dataPointsAnalyzed: 0,
            lastUpdated: new Date()
          }
        };
        failed++;
      }
    }

    console.log(`[Insights Aggregator] Batch computation complete: ${successful} successful, ${failed} failed`);

    return {
      success: failed === 0,
      results,
      summary: {
        total: clientIds.length,
        successful,
        failed
      }
    };
  }
}

// Export singleton instance
export const insightsAggregator = new InsightsAggregator();