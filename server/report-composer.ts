import { Client, Assessment, Session, Document, TreatmentPlan, InsertDocument } from "@shared/schema";
import { storage } from "./storage";
import { aiRouter } from "./ai";
import { insightsAggregator, type ClientInsights } from "./insights-aggregator";
import { recommendationEngine, type TreatmentRecommendations } from "./recommendation-engine";
import { z } from "zod";

// Report type definitions
export enum ReportType {
  PROGRESS_REPORT = "progress_report",
  TREATMENT_SUMMARY = "treatment_summary",
  ASSESSMENT_REPORT = "assessment_report",
  DISCHARGE_SUMMARY = "discharge_summary",
  INTAKE_REPORT = "intake_report",
  CRISIS_REPORT = "crisis_report",
  COMPREHENSIVE_EVALUATION = "comprehensive_evaluation"
}

// Report generation validation schema
const clinicalReportSchema = z.object({
  reportHeader: z.object({
    reportType: z.nativeEnum(ReportType),
    clientName: z.string(),
    clientId: z.string(),
    dateOfBirth: z.string().optional(),
    therapistName: z.string(),
    reportDate: z.string(),
    reportPeriod: z.object({
      startDate: z.string(),
      endDate: z.string()
    }).optional(),
    confidentialityNotice: z.string()
  }),
  executiveSummary: z.object({
    presentingProblems: z.array(z.string()),
    keyFindings: z.array(z.string()),
    treatmentResponse: z.string(),
    currentStatus: z.string(),
    recommendations: z.array(z.string())
  }),
  clientInformation: z.object({
    demographics: z.object({
      age: z.number().optional(),
      sex: z.string().optional(),
      genderIdentity: z.string().optional(),
      race: z.string().optional(),
      relationshipStatus: z.string().optional(),
      employment: z.string().optional(),
      language: z.string().optional()
    }),
    emergencyContact: z.any().optional(),
    insuranceInfo: z.any().optional()
  }),
  clinicalPresentation: z.object({
    currentSymptoms: z.array(z.string()),
    mentalStatusExam: z.string().optional(),
    riskAssessment: z.object({
      suicideRisk: z.enum(["none", "low", "moderate", "high", "imminent"]),
      violenceRisk: z.enum(["none", "low", "moderate", "high", "imminent"]),
      riskFactors: z.array(z.string()),
      protectiveFactors: z.array(z.string())
    }),
    diagnosticImpression: z.array(z.string()),
    differentialDiagnosis: z.array(z.string()).optional()
  }),
  assessmentResults: z.object({
    standardizedAssessments: z.array(z.object({
      instrument: z.string(),
      date: z.string(),
      score: z.number(),
      interpretation: z.string(),
      severity: z.string().optional(),
      trend: z.enum(["improving", "stable", "worsening", "new"]).optional()
    })),
    clinicalObservations: z.array(z.string()),
    functionalAssessment: z.string()
  }),
  treatmentHistory: z.object({
    currentTreatment: z.object({
      startDate: z.string(),
      totalSessions: z.number(),
      sessionFrequency: z.string(),
      therapeuticApproach: z.array(z.string()),
      medications: z.array(z.string()).optional()
    }),
    treatmentGoals: z.array(z.object({
      goal: z.string(),
      status: z.enum(["achieved", "in_progress", "not_started", "modified", "discontinued"]),
      progress: z.string()
    })),
    interventionsUsed: z.array(z.object({
      intervention: z.string(),
      frequency: z.string(),
      effectiveness: z.enum(["very_effective", "effective", "somewhat_effective", "not_effective", "unknown"])
    })),
    treatmentCompliance: z.string(),
    barriers: z.array(z.string()),
    facilitators: z.array(z.string())
  }),
  progressNotes: z.array(z.object({
    date: z.string(),
    sessionType: z.string(),
    duration: z.string(),
    summary: z.string(),
    interventions: z.array(z.string()),
    homework: z.string().optional(),
    planForNextSession: z.string().optional()
  })),
  treatmentRecommendations: z.object({
    immediateRecommendations: z.array(z.string()),
    shortTermGoals: z.array(z.string()),
    longTermGoals: z.array(z.string()),
    referrals: z.array(z.string()),
    medicationRecommendations: z.array(z.string()).optional(),
    sessionPlanChanges: z.string().optional(),
    monitoringPlan: z.array(z.string())
  }),
  prognosis: z.object({
    shortTermPrognosis: z.string(),
    longTermPrognosis: z.string(),
    factorsAffectingPrognosis: z.array(z.string()),
    overallPrognosis: z.enum(["excellent", "good", "fair", "guarded", "poor"])
  }),
  additionalNotes: z.object({
    specialConsiderations: z.array(z.string()),
    culturalFactors: z.array(z.string()),
    ethicalConsiderations: z.array(z.string()),
    qualityAssurance: z.string()
  }),
  appendices: z.object({
    assessmentScores: z.array(z.any()),
    progressCharts: z.array(z.string()),
    documentReferences: z.array(z.string())
  }),
  metadata: z.object({
    generatedDate: z.string(),
    reportVersion: z.string(),
    dataSourceCount: z.object({
      assessments: z.number(),
      sessions: z.number(),
      documents: z.number()
    }),
    aiGenerated: z.boolean(),
    clinicalReviewRequired: z.boolean(),
    confidentialityLevel: z.enum(["standard", "restricted", "highly_restricted"])
  })
});

export type ClinicalReport = z.infer<typeof clinicalReportSchema>;

export interface ReportGenerationResult {
  success: boolean;
  report: ClinicalReport | null;
  reportDocument: Document | null;
  errors?: string[];
  metadata: {
    clientId: string;
    reportType: ReportType;
    generationTime: number;
    wordCount: number;
    dataSourcesUsed: number;
  };
}

export class ReportComposer {

  /**
   * Generate a comprehensive clinical report
   */
  async generateReport(
    clientId: string,
    therapistId: string,
    reportType: ReportType,
    options: {
      dateRange?: {
        startDate: Date;
        endDate: Date;
      };
      includeAIAnalysis?: boolean;
      includeRecommendations?: boolean;
      includeProgressCharts?: boolean;
      confidentialityLevel?: "standard" | "restricted" | "highly_restricted";
      customSections?: string[];
    } = {}
  ): Promise<ReportGenerationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[Report Composer] Generating ${reportType} report for client ${clientId}`);

      // Gather all client data
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

      // Filter data by date range if specified
      const filteredData = this.filterDataByDateRange(
        { assessments, sessions, documents },
        options.dateRange
      );

      // Get additional analysis data if requested
      let insights: ClientInsights | null = null;
      let recommendations: TreatmentRecommendations | null = null;

      if (options.includeAIAnalysis) {
        const insightsResult = await insightsAggregator.computeClientInsights(clientId, therapistId);
        if (insightsResult.success) {
          insights = insightsResult.insights;
        }
      }

      if (options.includeRecommendations) {
        const recommendationsResult = await recommendationEngine.generateRecommendations(clientId, therapistId);
        if (recommendationsResult.success) {
          recommendations = recommendationsResult.recommendations;
        }
      }

      // Generate the report using AI and structured data
      const report = await this.composeReport(
        client,
        filteredData.assessments,
        filteredData.sessions,
        filteredData.documents,
        treatmentPlans,
        insights,
        recommendations,
        reportType,
        options
      );

      // Save report as a document
      const reportDocument = await this.saveReportAsDocument(
        report,
        clientId,
        therapistId,
        reportType
      );

      const generationTime = Date.now() - startTime;
      console.log(`[Report Composer] Generated ${reportType} report for client ${clientId} in ${generationTime}ms`);

      return {
        success: true,
        report,
        reportDocument,
        metadata: {
          clientId,
          reportType,
          generationTime,
          wordCount: this.calculateWordCount(report),
          dataSourcesUsed: filteredData.assessments.length + filteredData.sessions.length + filteredData.documents.length
        }
      };

    } catch (error) {
      console.error(`[Report Composer] Error generating report for client ${clientId}:`, error);
      return {
        success: false,
        report: null,
        reportDocument: null,
        errors: [error instanceof Error ? error.message : String(error)],
        metadata: {
          clientId,
          reportType,
          generationTime: Date.now() - startTime,
          wordCount: 0,
          dataSourcesUsed: 0
        }
      };
    }
  }

  /**
   * Compose the comprehensive clinical report
   */
  private async composeReport(
    client: Client,
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[],
    treatmentPlans: TreatmentPlan[],
    insights: ClientInsights | null,
    recommendations: TreatmentRecommendations | null,
    reportType: ReportType,
    options: any
  ): Promise<ClinicalReport> {

    // Generate AI-powered narrative sections if enabled
    const narrativeSections = options.includeAIAnalysis ? 
      await this.generateNarrativeSections(client, assessments, sessions, documents, reportType) : 
      this.getDefaultNarrativeSections();

    // Build report header
    const reportHeader = this.buildReportHeader(client, reportType, options);
    
    // Build executive summary
    const executiveSummary = this.buildExecutiveSummary(
      assessments, 
      sessions, 
      insights, 
      recommendations,
      narrativeSections
    );

    // Build client information section
    const clientInformation = this.buildClientInformation(client);

    // Build clinical presentation
    const clinicalPresentation = this.buildClinicalPresentation(
      assessments, 
      sessions, 
      insights,
      narrativeSections
    );

    // Build assessment results
    const assessmentResults = this.buildAssessmentResults(assessments, narrativeSections);

    // Build treatment history
    const treatmentHistory = this.buildTreatmentHistory(
      sessions, 
      treatmentPlans, 
      insights,
      narrativeSections
    );

    // Build progress notes
    const progressNotes = this.buildProgressNotes(sessions, options);

    // Build treatment recommendations
    const treatmentRecommendations = this.buildTreatmentRecommendations(
      recommendations,
      insights
    );

    // Build prognosis
    const prognosis = this.buildPrognosis(recommendations, insights, narrativeSections);

    // Build additional notes
    const additionalNotes = this.buildAdditionalNotes(client, documents, options);

    // Build appendices
    const appendices = this.buildAppendices(assessments, sessions, documents, options);

    // Build metadata
    const metadata = this.buildReportMetadata(
      assessments,
      sessions,
      documents,
      options,
      reportType
    );

    return {
      reportHeader,
      executiveSummary,
      clientInformation,
      clinicalPresentation,
      assessmentResults,
      treatmentHistory,
      progressNotes,
      treatmentRecommendations,
      prognosis,
      additionalNotes,
      appendices,
      metadata
    };
  }

  /**
   * Generate AI-powered narrative sections
   */
  private async generateNarrativeSections(
    client: Client,
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[],
    reportType: ReportType
  ): Promise<Record<string, string>> {

    const clinicalSummary = this.prepareClinicalSummaryForAI(client, assessments, sessions, documents);

    const narrativePrompt = `
You are an expert clinical psychologist writing a comprehensive ${reportType.replace('_', ' ')} report. Generate professional, clinical narrative sections based on the following data:

${clinicalSummary}

Generate the following narrative sections in professional clinical language:

1. Clinical Presentation Summary (2-3 paragraphs describing current mental status, symptoms, and presentation)
2. Treatment Response Narrative (2-3 paragraphs describing how the client has responded to treatment)
3. Functional Assessment Narrative (1-2 paragraphs describing functional impairment and abilities)
4. Mental Status Examination (structured MSE findings)
5. Treatment Compliance Discussion (1-2 paragraphs about engagement and adherence)
6. Prognostic Factors Analysis (1-2 paragraphs discussing factors affecting prognosis)

Format as JSON:
{
  "clinicalPresentation": "Professional narrative describing current presentation...",
  "treatmentResponse": "Detailed description of treatment response...",
  "functionalAssessment": "Assessment of functional capabilities and limitations...",
  "mentalStatusExam": "Structured mental status examination findings...",
  "treatmentCompliance": "Discussion of treatment engagement and compliance...",
  "prognosticFactors": "Analysis of factors affecting prognosis..."
}

Use appropriate clinical terminology and maintain professional tone throughout. Base all content on the provided data.
`;

    try {
      const result = await aiRouter.chatJSON(
        [{ role: "user", content: narrativePrompt }],
        z.object({
          clinicalPresentation: z.string(),
          treatmentResponse: z.string(),
          functionalAssessment: z.string(),
          mentalStatusExam: z.string(),
          treatmentCompliance: z.string(),
          prognosticFactors: z.string()
        })
      );

      return result;
    } catch (error) {
      console.error("[Report Composer] Error generating narrative sections:", error);
      return this.getDefaultNarrativeSections();
    }
  }

  /**
   * Filter data by date range
   */
  private filterDataByDateRange(
    data: { assessments: Assessment[]; sessions: Session[]; documents: Document[] },
    dateRange?: { startDate: Date; endDate: Date }
  ): { assessments: Assessment[]; sessions: Session[]; documents: Document[] } {
    
    if (!dateRange) {
      return data;
    }

    const { startDate, endDate } = dateRange;

    return {
      assessments: data.assessments.filter(a => {
        const date = new Date(a.assessmentDate);
        return date >= startDate && date <= endDate;
      }),
      sessions: data.sessions.filter(s => {
        const date = new Date(s.sessionDate);
        return date >= startDate && date <= endDate;
      }),
      documents: data.documents.filter(d => {
        const date = new Date(d.uploadDate || 0);
        return date >= startDate && date <= endDate;
      })
    };
  }

  /**
   * Build report header section
   */
  private buildReportHeader(
    client: Client,
    reportType: ReportType,
    options: any
  ): ClinicalReport['reportHeader'] {
    
    return {
      reportType,
      clientName: `${client.firstName} ${client.lastName}`,
      clientId: client.id,
      dateOfBirth: client.dateOfBirth?.toISOString(),
      therapistName: "Dr. Jonathan Procter", // Static for single-therapist practice
      reportDate: new Date().toISOString(),
      reportPeriod: options.dateRange ? {
        startDate: options.dateRange.startDate.toISOString(),
        endDate: options.dateRange.endDate.toISOString()
      } : undefined,
      confidentialityNotice: "This report contains confidential information protected by HIPAA. Distribution is restricted to authorized personnel only."
    };
  }

  /**
   * Build executive summary section
   */
  private buildExecutiveSummary(
    assessments: Assessment[],
    sessions: Session[],
    insights: ClientInsights | null,
    recommendations: TreatmentRecommendations | null,
    narrativeSections: Record<string, string>
  ): ClinicalReport['executiveSummary'] {
    
    const presentingProblems = insights?.clinicalPicture?.primaryConcerns || 
      this.extractPresentingProblems(assessments, sessions);
    
    const keyFindings = insights?.assessmentTrends?.keyFindings || 
      this.extractKeyFindings(assessments, sessions);
    
    const treatmentResponse = narrativeSections.treatmentResponse || 
      "Treatment response information not available";
    
    const currentStatus = this.determineCurrentStatus(assessments, sessions, insights);
    
    const recommendationsSummary = recommendations?.primaryRecommendations
      .filter(r => r.priority === "immediate" || r.priority === "urgent")
      .map(r => r.recommendation) || [];

    return {
      presentingProblems,
      keyFindings,
      treatmentResponse,
      currentStatus,
      recommendations: recommendationsSummary
    };
  }

  /**
   * Build client information section
   */
  private buildClientInformation(client: Client): ClinicalReport['clientInformation'] {
    
    const age = client.dateOfBirth ? 
      Math.floor((Date.now() - new Date(client.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 
      undefined;

    return {
      demographics: {
        age,
        sex: client.sex || undefined,
        genderIdentity: client.genderIdentity || undefined,
        race: client.race || undefined,
        relationshipStatus: client.relationshipStatus || undefined,
        employment: client.employment || undefined,
        language: client.language || undefined
      },
      emergencyContact: client.emergencyContact,
      insuranceInfo: client.insuranceInfo
    };
  }

  /**
   * Build clinical presentation section
   */
  private buildClinicalPresentation(
    assessments: Assessment[],
    sessions: Session[],
    insights: ClientInsights | null,
    narrativeSections: Record<string, string>
  ): ClinicalReport['clinicalPresentation'] {
    
    const currentSymptoms = insights?.clinicalPicture?.primaryConcerns || 
      this.extractSymptomsFromSessions(sessions);
    
    const riskLevel = insights?.riskAssessment?.currentRiskLevel || "low";
    const riskFactors = insights?.riskAssessment?.riskFactors || [];
    const protectiveFactors = insights?.clinicalPicture?.protectiveFactors || [];
    
    const diagnosticImpression = insights?.clinicalPicture?.diagnosisHistory || 
      this.extractDiagnosticImpression(assessments, sessions);

    return {
      currentSymptoms,
      mentalStatusExam: narrativeSections.mentalStatusExam || undefined,
      riskAssessment: {
        suicideRisk: riskLevel as any,
        violenceRisk: "low", // Would need specific assessment
        riskFactors,
        protectiveFactors
      },
      diagnosticImpression,
      differentialDiagnosis: []
    };
  }

  /**
   * Build assessment results section
   */
  private buildAssessmentResults(
    assessments: Assessment[],
    narrativeSections: Record<string, string>
  ): ClinicalReport['assessmentResults'] {
    
    const standardizedAssessments = assessments.map(assessment => {
      const score = this.extractTotalScore(assessment.scores);
      const severity = this.determineSeverity(assessment.scores, assessment.assessmentType);
      
      return {
        instrument: assessment.assessmentType,
        date: assessment.assessmentDate.toISOString(),
        score,
        interpretation: assessment.interpretation || `Score: ${score}`,
        severity,
        trend: this.determineTrend(assessment, assessments) as any
      };
    });

    return {
      standardizedAssessments,
      clinicalObservations: this.extractClinicalObservations(assessments),
      functionalAssessment: narrativeSections.functionalAssessment || "Functional assessment not available"
    };
  }

  /**
   * Build treatment history section
   */
  private buildTreatmentHistory(
    sessions: Session[],
    treatmentPlans: TreatmentPlan[],
    insights: ClientInsights | null,
    narrativeSections: Record<string, string>
  ): ClinicalReport['treatmentHistory'] {
    
    const sortedSessions = sessions.sort((a, b) => 
      new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()
    );
    
    const startDate = sortedSessions[0]?.sessionDate.toISOString() || new Date().toISOString();
    const therapeuticApproach = this.extractTherapeuticApproaches(sessions);
    
    const currentTreatment = {
      startDate,
      totalSessions: sessions.length,
      sessionFrequency: this.calculateSessionFrequency(sessions),
      therapeuticApproach,
      medications: insights?.clinicalPicture?.medicationHistory
    };

    const treatmentGoals = insights?.treatmentResponse?.goalsProgress?.map(goal => ({
      goal: goal.goal,
      status: goal.status as any,
      progress: `${goal.progressPercent}% complete`
    })) || [];

    const interventionsUsed = insights?.treatmentResponse?.interventionsUsed?.map(intervention => ({
      intervention: intervention.type,
      frequency: `${intervention.frequency} times`,
      effectiveness: intervention.effectiveness
    })) || [];

    return {
      currentTreatment,
      treatmentGoals,
      interventionsUsed,
      treatmentCompliance: narrativeSections.treatmentCompliance || "Good compliance noted",
      barriers: insights?.treatmentResponse?.barriers || [],
      facilitators: insights?.treatmentResponse?.facilitators || []
    };
  }

  /**
   * Build progress notes section
   */
  private buildProgressNotes(
    sessions: Session[],
    options: any
  ): ClinicalReport['progressNotes'] {
    
    return sessions
      .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
      .slice(0, 10) // Last 10 sessions
      .map(session => ({
        date: session.sessionDate.toISOString(),
        sessionType: session.sessionType || "Individual",
        duration: session.duration ? `${session.duration} minutes` : "50 minutes",
        summary: session.notes?.substring(0, 300) || "No notes available",
        interventions: this.extractInterventionsFromSession(session),
        homework: session.homework || undefined,
        planForNextSession: session.nextSessionPlan || undefined
      }));
  }

  /**
   * Build treatment recommendations section
   */
  private buildTreatmentRecommendations(
    recommendations: TreatmentRecommendations | null,
    insights: ClientInsights | null
  ): ClinicalReport['treatmentRecommendations'] {
    
    if (!recommendations) {
      return {
        immediateRecommendations: ["Continue current treatment approach"],
        shortTermGoals: ["Maintain therapeutic progress"],
        longTermGoals: ["Achieve sustained improvement"],
        referrals: [],
        monitoringPlan: ["Regular assessment tracking"]
      };
    }

    return {
      immediateRecommendations: recommendations.primaryRecommendations
        .filter(r => r.priority === "immediate")
        .map(r => r.recommendation),
      shortTermGoals: recommendations.primaryRecommendations
        .filter(r => r.priority === "urgent" || r.priority === "high")
        .map(r => r.recommendation),
      longTermGoals: recommendations.primaryRecommendations
        .filter(r => r.priority === "medium" || r.priority === "low")
        .map(r => r.recommendation),
      referrals: recommendations.primaryRecommendations
        .filter(r => r.category === "referral")
        .map(r => r.recommendation),
      medicationRecommendations: recommendations.medicationConsiderations.indicated ? 
        recommendations.medicationConsiderations.recommendations.map(med => 
          `${med.class}: ${med.specific.join(", ")} - ${med.rationale}`
        ) : undefined,
      sessionPlanChanges: recommendations.sessionPlanAdjustments.frequency || undefined,
      monitoringPlan: recommendations.riskManagement.monitoringPlan
    };
  }

  /**
   * Build prognosis section
   */
  private buildPrognosis(
    recommendations: TreatmentRecommendations | null,
    insights: ClientInsights | null,
    narrativeSections: Record<string, string>
  ): ClinicalReport['prognosis'] {
    
    if (recommendations?.prognosis) {
      return {
        shortTermPrognosis: recommendations.prognosis.shortTerm.expectedOutcomes.join("; "),
        longTermPrognosis: recommendations.prognosis.longTerm.expectedOutcomes.join("; "),
        factorsAffectingPrognosis: recommendations.prognosis.longTerm.factors,
        overallPrognosis: recommendations.prognosis.overallPrognosis
      };
    }

    return {
      shortTermPrognosis: "Continued improvement with current treatment approach",
      longTermPrognosis: "Good potential for sustained recovery with ongoing treatment",
      factorsAffectingPrognosis: ["Treatment adherence", "Social support", "Life stressors"],
      overallPrognosis: "good"
    };
  }

  /**
   * Build additional notes section
   */
  private buildAdditionalNotes(
    client: Client,
    documents: Document[],
    options: any
  ): ClinicalReport['additionalNotes'] {
    
    const culturalFactors: string[] = [];
    if (client.race) culturalFactors.push(`Race: ${client.race}`);
    if (client.language && client.language !== 'English') culturalFactors.push(`Primary language: ${client.language}`);

    return {
      specialConsiderations: [],
      culturalFactors,
      ethicalConsiderations: [],
      qualityAssurance: "Report generated using AI-assisted analysis with clinical oversight required"
    };
  }

  /**
   * Build appendices section
   */
  private buildAppendices(
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[],
    options: any
  ): ClinicalReport['appendices'] {
    
    return {
      assessmentScores: assessments.map(a => ({
        instrument: a.assessmentType,
        date: a.assessmentDate.toISOString(),
        scores: a.scores
      })),
      progressCharts: [], // Would include chart data if available
      documentReferences: documents.map(d => `${d.fileName} (${d.uploadDate?.toDateString()})`)
    };
  }

  /**
   * Build report metadata
   */
  private buildReportMetadata(
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[],
    options: any,
    reportType: ReportType
  ): ClinicalReport['metadata'] {
    
    return {
      generatedDate: new Date().toISOString(),
      reportVersion: "1.0",
      dataSourceCount: {
        assessments: assessments.length,
        sessions: sessions.length,
        documents: documents.length
      },
      aiGenerated: options.includeAIAnalysis || false,
      clinicalReviewRequired: true,
      confidentialityLevel: options.confidentialityLevel || "standard"
    };
  }

  /**
   * Save report as a document in the database
   */
  private async saveReportAsDocument(
    report: ClinicalReport,
    clientId: string,
    therapistId: string,
    reportType: ReportType
  ): Promise<Document> {
    
    const reportContent = this.formatReportAsText(report);
    const fileName = `${reportType}_${report.reportHeader.clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;

    const documentData: InsertDocument = {
      therapistId,
      clientId,
      fileName,
      fileType: "text/plain",
      fileSize: reportContent.length,
      filePath: `/reports/${fileName}`,
      content: reportContent,
      metadata: {
        reportType,
        generatedDate: new Date().toISOString(),
        category: "Report",
        aiGenerated: true
      },
      isProcessed: true,
      analysis: {
        category: "Report",
        reportType,
        clientId
      },
      tags: [reportType, "clinical_report", "ai_generated"]
    };

    return await storage.createDocument(documentData);
  }

  /**
   * Format report as readable text
   */
  private formatReportAsText(report: ClinicalReport): string {
    const sections: string[] = [];

    // Header
    sections.push(`CLINICAL REPORT - ${report.reportHeader.reportType.toUpperCase().replace('_', ' ')}`);
    sections.push(`${'='.repeat(60)}`);
    sections.push(`Client: ${report.reportHeader.clientName}`);
    sections.push(`Date of Birth: ${report.reportHeader.dateOfBirth || 'Not provided'}`);
    sections.push(`Therapist: ${report.reportHeader.therapistName}`);
    sections.push(`Report Date: ${new Date(report.reportHeader.reportDate).toDateString()}`);
    sections.push(`\n${report.reportHeader.confidentialityNotice}`);
    sections.push('\n');

    // Executive Summary
    sections.push('EXECUTIVE SUMMARY');
    sections.push('-'.repeat(20));
    sections.push(`Presenting Problems: ${report.executiveSummary.presentingProblems.join(', ')}`);
    sections.push(`Current Status: ${report.executiveSummary.currentStatus}`);
    sections.push(`Treatment Response: ${report.executiveSummary.treatmentResponse}`);
    sections.push('\n');

    // Assessment Results
    if (report.assessmentResults.standardizedAssessments.length > 0) {
      sections.push('ASSESSMENT RESULTS');
      sections.push('-'.repeat(20));
      report.assessmentResults.standardizedAssessments.forEach(assessment => {
        sections.push(`${assessment.instrument}: Score ${assessment.score} (${assessment.interpretation})`);
      });
      sections.push('\n');
    }

    // Treatment Recommendations
    sections.push('TREATMENT RECOMMENDATIONS');
    sections.push('-'.repeat(30));
    if (report.treatmentRecommendations.immediateRecommendations.length > 0) {
      sections.push('Immediate:');
      report.treatmentRecommendations.immediateRecommendations.forEach(rec => {
        sections.push(`• ${rec}`);
      });
    }
    if (report.treatmentRecommendations.shortTermGoals.length > 0) {
      sections.push('\nShort-term Goals:');
      report.treatmentRecommendations.shortTermGoals.forEach(goal => {
        sections.push(`• ${goal}`);
      });
    }
    sections.push('\n');

    // Prognosis
    sections.push('PROGNOSIS');
    sections.push('-'.repeat(10));
    sections.push(`Overall Prognosis: ${report.prognosis.overallPrognosis}`);
    sections.push(`Short-term: ${report.prognosis.shortTermPrognosis}`);
    sections.push(`Long-term: ${report.prognosis.longTermPrognosis}`);
    sections.push('\n');

    // Metadata
    sections.push('REPORT INFORMATION');
    sections.push('-'.repeat(20));
    sections.push(`Generated: ${new Date(report.metadata.generatedDate).toDateString()}`);
    sections.push(`AI Generated: ${report.metadata.aiGenerated ? 'Yes' : 'No'}`);
    sections.push(`Clinical Review Required: ${report.metadata.clinicalReviewRequired ? 'Yes' : 'No'}`);

    return sections.join('\n');
  }

  // Helper methods
  private calculateWordCount(report: ClinicalReport): number {
    const text = this.formatReportAsText(report);
    return text.split(/\s+/).length;
  }

  private prepareClinicalSummaryForAI(
    client: Client,
    assessments: Assessment[],
    sessions: Session[],
    documents: Document[]
  ): string {
    const summary: string[] = [];

    summary.push(`Client: ${client.firstName} ${client.lastName}`);
    summary.push(`Total Sessions: ${sessions.length}`);
    summary.push(`Total Assessments: ${assessments.length}`);
    
    if (assessments.length > 0) {
      summary.push('\nRecent Assessments:');
      assessments.slice(-3).forEach(assessment => {
        const score = this.extractTotalScore(assessment.scores);
        summary.push(`- ${assessment.assessmentType}: ${score} (${new Date(assessment.assessmentDate).toDateString()})`);
      });
    }

    if (sessions.length > 0) {
      summary.push('\nRecent Session Notes:');
      sessions.slice(-3).forEach(session => {
        summary.push(`- ${new Date(session.sessionDate).toDateString()}: ${session.notes?.substring(0, 200) || 'No notes'}`);
      });
    }

    return summary.join('\n');
  }

  private getDefaultNarrativeSections(): Record<string, string> {
    return {
      clinicalPresentation: "Clinical presentation information not available through AI analysis.",
      treatmentResponse: "Treatment response information requires further assessment.",
      functionalAssessment: "Functional assessment pending comprehensive evaluation.",
      mentalStatusExam: "Mental status examination to be completed during clinical interview.",
      treatmentCompliance: "Treatment compliance appears satisfactory based on available data.",
      prognosticFactors: "Prognostic factors require further clinical assessment."
    };
  }

  private extractTotalScore(scores: any): number {
    if (typeof scores === 'object' && scores.totalScore !== undefined) {
      return scores.totalScore;
    }
    return 0;
  }

  private determineSeverity(scores: any, assessmentType: string): string | undefined {
    const totalScore = this.extractTotalScore(scores);
    
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
        return undefined;
    }
  }

  private determineTrend(
    currentAssessment: Assessment,
    allAssessments: Assessment[]
  ): "improving" | "stable" | "worsening" | "new" {
    const sameType = allAssessments.filter(a => a.assessmentType === currentAssessment.assessmentType);
    if (sameType.length <= 1) return "new";
    
    const sorted = sameType.sort((a, b) => new Date(a.assessmentDate).getTime() - new Date(b.assessmentDate).getTime());
    const currentIndex = sorted.findIndex(a => a.id === currentAssessment.id);
    
    if (currentIndex === 0) return "new";
    
    const currentScore = this.extractTotalScore(currentAssessment.scores);
    const previousScore = this.extractTotalScore(sorted[currentIndex - 1].scores);
    
    const change = currentScore - previousScore;
    const threshold = previousScore * 0.15;
    
    if (change > threshold) return "worsening";
    if (change < -threshold) return "improving";
    return "stable";
  }

  private extractPresentingProblems(assessments: Assessment[], sessions: Session[]): string[] {
    const problems: string[] = [];
    
    assessments.forEach(assessment => {
      if (assessment.assessmentType === "PHQ-9") problems.push("Depression");
      if (assessment.assessmentType === "GAD-7") problems.push("Anxiety");
      if (assessment.assessmentType === "PCL-5") problems.push("Trauma-related symptoms");
    });
    
    return problems.length > 0 ? problems : ["General mental health concerns"];
  }

  private extractKeyFindings(assessments: Assessment[], sessions: Session[]): string[] {
    const findings: string[] = [];
    
    const latestAssessments = assessments
      .sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime())
      .slice(0, 3);
    
    latestAssessments.forEach(assessment => {
      const score = this.extractTotalScore(assessment.scores);
      const severity = this.determineSeverity(assessment.scores, assessment.assessmentType);
      if (severity && severity !== 'minimal') {
        findings.push(`${assessment.assessmentType} indicates ${severity} symptoms (score: ${score})`);
      }
    });
    
    return findings.length > 0 ? findings : ["No significant findings noted"];
  }

  private determineCurrentStatus(
    assessments: Assessment[],
    sessions: Session[],
    insights: ClientInsights | null
  ): string {
    if (insights?.summary?.currentStatus) {
      return insights.summary.currentStatus === "active" ? 
        "Client is actively engaged in treatment with regular attendance" :
        "Client status requires review";
    }
    
    return sessions.length > 0 ? "Actively engaged in treatment" : "Treatment status pending";
  }

  private extractSymptomsFromSessions(sessions: Session[]): string[] {
    const symptoms = new Set<string>();
    
    sessions.slice(-5).forEach(session => {
      if (session.notes) {
        const note = session.notes.toLowerCase();
        if (note.includes('depress')) symptoms.add('Depressive symptoms');
        if (note.includes('anxiet') || note.includes('worry')) symptoms.add('Anxiety symptoms');
        if (note.includes('sleep')) symptoms.add('Sleep disturbances');
        if (note.includes('stress')) symptoms.add('Stress-related symptoms');
      }
    });
    
    return Array.from(symptoms);
  }

  private extractDiagnosticImpression(assessments: Assessment[], sessions: Session[]): string[] {
    const diagnoses = new Set<string>();
    
    assessments.forEach(assessment => {
      const score = this.extractTotalScore(assessment.scores);
      const severity = this.determineSeverity(assessment.scores, assessment.assessmentType);
      
      if (assessment.assessmentType === "PHQ-9" && score >= 10) {
        diagnoses.add("Major Depressive Disorder (provisional)");
      }
      if (assessment.assessmentType === "GAD-7" && score >= 10) {
        diagnoses.add("Generalized Anxiety Disorder (provisional)");
      }
    });
    
    return Array.from(diagnoses);
  }

  private extractClinicalObservations(assessments: Assessment[]): string[] {
    const observations: string[] = [];
    
    assessments.forEach(assessment => {
      if (assessment.interpretation) {
        observations.push(`${assessment.assessmentType}: ${assessment.interpretation}`);
      }
    });
    
    return observations.length > 0 ? observations : ["Clinical observations to be documented"];
  }

  private extractTherapeuticApproaches(sessions: Session[]): string[] {
    const approaches = new Set<string>();
    
    sessions.forEach(session => {
      if (session.interventionsUsed && Array.isArray(session.interventionsUsed)) {
        session.interventionsUsed.forEach((intervention: any) => {
          const name = typeof intervention === 'string' ? intervention : intervention.name || 'Unknown';
          approaches.add(name);
        });
      }
      
      if (session.notes) {
        const note = session.notes.toLowerCase();
        if (note.includes('cbt')) approaches.add('Cognitive Behavioral Therapy');
        if (note.includes('dbt')) approaches.add('Dialectical Behavior Therapy');
        if (note.includes('mindfulness')) approaches.add('Mindfulness-based interventions');
      }
    });
    
    return Array.from(approaches);
  }

  private calculateSessionFrequency(sessions: Session[]): string {
    if (sessions.length < 2) return "Insufficient data";
    
    const sortedSessions = sessions.sort((a, b) => 
      new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()
    );
    
    let totalDays = 0;
    for (let i = 1; i < sortedSessions.length; i++) {
      const diff = (new Date(sortedSessions[i].sessionDate).getTime() - 
                   new Date(sortedSessions[i-1].sessionDate).getTime()) / (1000 * 60 * 60 * 24);
      totalDays += diff;
    }
    
    const averageDays = totalDays / (sortedSessions.length - 1);
    
    if (averageDays <= 8) return "Weekly";
    if (averageDays <= 15) return "Biweekly";
    if (averageDays <= 35) return "Monthly";
    return "Irregular";
  }

  private extractInterventionsFromSession(session: Session): string[] {
    const interventions: string[] = [];
    
    if (session.interventionsUsed && Array.isArray(session.interventionsUsed)) {
      session.interventionsUsed.forEach((intervention: any) => {
        const name = typeof intervention === 'string' ? intervention : intervention.name || 'Unknown';
        interventions.push(name);
      });
    }
    
    return interventions;
  }
}

// Export singleton instance
export const reportComposer = new ReportComposer();