import { useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClientProfile } from "@/components/ClientProfile";
import { CaseConceptualization } from "@/components/CaseConceptualization";
import { ClientAITags } from "@/components/ClientAITags";
import { CalendarSync } from "@/components/CalendarSync";
import { Calendar, Brain, FileText, TrendingUp, Shield, Link2, User, Clock } from "lucide-react";
import { 
  useClient, 
  useClientSessions, 
  useClientAssessments, 
  useClientTreatmentPlans 
} from "@/hooks/useClientData";
import { useClientDocuments } from "@/hooks/useDocuments";
import { 
  useGenerateClientAssessments,
  useClientInsights,
  useRecomputeClientInsights,
  useGenerateClientRecommendations,
  useGenerateClientReport,
  useClientReports
} from "@/hooks/useAITagging";

export default function ClientChart() {
  const { id } = useParams();
  const clientId = id as string;

  const { data: client, isLoading: clientLoading } = useClient(clientId);
  const { data: sessions, isLoading: sessionsLoading } = useClientSessions(clientId);
  const { data: assessments, isLoading: assessmentsLoading } = useClientAssessments(clientId);
  const { data: treatmentPlans, isLoading: plansLoading } = useClientTreatmentPlans(clientId);
  const { data: documents, isLoading: documentsLoading } = useClientDocuments(clientId);

  // AI-powered hooks
  const generateClientAssessments = useGenerateClientAssessments(clientId);
  const { data: insights, isLoading: insightsLoading } = useClientInsights(clientId);
  const recomputeInsights = useRecomputeClientInsights(clientId);
  const generateRecommendations = useGenerateClientRecommendations(clientId);
  const generateReport = useGenerateClientReport(clientId);
  const { data: reports, isLoading: reportsLoading } = useClientReports(clientId);

  if (clientLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="lg:col-span-3 h-96" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <i className="fas fa-user-slash text-4xl text-muted-foreground mb-4"></i>
          <h2 className="text-xl font-semibold mb-2">Client Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested client could not be found.</p>
          <Link href="/clients">
            <Button data-testid="back-to-clients">
              <i className="fas fa-arrow-left mr-2"></i>
              Back to Clients
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getScoreTrend = (scores: any[]) => {
    if (scores.length < 2) return null;
    const latest = scores[0];
    const previous = scores[1];
    if (typeof latest === 'object' && typeof previous === 'object') {
      const latestTotal = latest.total || 0;
      const previousTotal = previous.total || 0;
      const diff = latestTotal - previousTotal;
      if (diff > 0) return { direction: "up", value: diff };
      if (diff < 0) return { direction: "down", value: Math.abs(diff) };
    }
    return { direction: "stable", value: 0 };
  };

  return (
    <div className="space-y-6" data-testid="client-chart">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/clients">
            <Button variant="outline" size="sm" data-testid="back-to-clients">
              <i className="fas fa-arrow-left mr-2"></i>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="client-chart-title">
              {client.firstName} {client.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">Client Chart & Clinical Data</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" data-testid="edit-client">
            <i className="fas fa-edit mr-2"></i>
            Edit Client
          </Button>
          <Button data-testid="new-session">
            <i className="fas fa-plus mr-2"></i>
            New Session
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Client Profile Sidebar */}
        <div className="space-y-6">
          <ClientProfile client={client} recentAssessments={assessments} />
          
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Sessions</span>
                <span className="font-medium" data-testid="total-sessions">
                  {sessions?.length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Assessments</span>
                <span className="font-medium" data-testid="total-assessments">
                  {assessments?.length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Documents</span>
                <span className="font-medium" data-testid="total-documents">
                  {documents?.length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Treatment Plans</span>
                <span className="font-medium" data-testid="total-treatment-plans">
                  {treatmentPlans?.length || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
              <TabsTrigger value="assessments" data-testid="tab-assessments">Assessments</TabsTrigger>
              <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
              <TabsTrigger value="treatment" data-testid="tab-treatment">Treatment</TabsTrigger>
              <TabsTrigger value="ai-insights" data-testid="tab-ai-insights">AI Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Session Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  {sessionsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : sessions?.length === 0 ? (
                    <div className="text-center py-8">
                      <i className="fas fa-clipboard-list text-4xl text-muted-foreground mb-4"></i>
                      <p className="text-muted-foreground">No sessions recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sessions?.slice(0, 5).map((session: any) => (
                        <div key={session.id} className="flex items-start space-x-4 p-4 bg-muted/30 rounded-lg" data-testid={`session-${session.id}`}>
                          <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">
                                {session.sessionType || "Individual Therapy"}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(session.sessionDate)}
                              </span>
                            </div>
                            {session.notes && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {session.notes}
                              </p>
                            )}
                            {session.duration && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Duration: {session.duration} minutes
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assessment History */}
              <Card>
                <CardHeader>
                  <CardTitle>Assessment History</CardTitle>
                </CardHeader>
                <CardContent>
                  {assessmentsLoading ? (
                    <div className="space-y-4">
                      {[...Array(2)].map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : assessments?.length === 0 ? (
                    <div className="text-center py-8">
                      <i className="fas fa-chart-bar text-4xl text-muted-foreground mb-4"></i>
                      <p className="text-muted-foreground">No assessments completed yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {assessments?.slice(0, 4).map((assessment: any) => (
                        <div key={assessment.id} className="p-4 bg-muted/30 rounded-lg" data-testid={`assessment-${assessment.id}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-sm">{assessment.assessmentType}</h3>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(assessment.assessmentDate)}
                            </span>
                          </div>
                          {assessment.scores && typeof assessment.scores === 'object' && (assessment.scores as any).total !== undefined && (
                            <div className="flex items-center space-x-2">
                              <span className="text-2xl font-bold text-primary">
                                {(assessment.scores as any).total}
                              </span>
                              <div className="flex-1">
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(((assessment.scores as any).total / 27) * 100, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sessions" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>All Sessions</CardTitle>
                    <Button data-testid="add-session">
                      <i className="fas fa-plus mr-2"></i>
                      Add Session
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {sessionsLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : sessions?.length === 0 ? (
                    <div className="text-center py-12">
                      <i className="fas fa-clipboard-list text-4xl text-muted-foreground mb-4"></i>
                      <h3 className="text-lg font-medium mb-2">No Sessions Yet</h3>
                      <p className="text-muted-foreground mb-4">Start documenting therapy sessions for this client</p>
                      <Button data-testid="first-session">
                        <i className="fas fa-plus mr-2"></i>
                        Create First Session
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sessions?.map((session: any) => (
                        <Card key={session.id} data-testid={`session-detail-${session.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h3 className="font-medium">
                                    {session.sessionType || "Individual Therapy"}
                                  </h3>
                                  <Badge variant="outline">
                                    {formatDate(session.sessionDate)}
                                  </Badge>
                                  {session.duration && (
                                    <Badge variant="secondary">
                                      {session.duration} min
                                    </Badge>
                                  )}
                                </div>
                                {session.notes && (
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {session.notes}
                                  </p>
                                )}
                                {session.homework && (
                                  <div className="text-sm">
                                    <span className="font-medium text-blue-600">Homework: </span>
                                    <span className="text-muted-foreground">{session.homework}</span>
                                  </div>
                                )}
                              </div>
                              <Button variant="ghost" size="sm" data-testid={`edit-session-${session.id}`}>
                                <i className="fas fa-edit"></i>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assessments" className="space-y-6">
              {/* AI Assessment Generation Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Brain className="w-5 h-5 text-blue-600" />
                      <CardTitle>AI-Generated Assessments</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="outline"
                        onClick={() => generateClientAssessments.mutate()}
                        disabled={generateClientAssessments.isPending}
                        data-testid="generate-batch-assessments"
                      >
                        {generateClientAssessments.isPending ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Brain className="w-4 h-4 mr-2" />
                            Generate from Documents
                          </>
                        )}
                      </Button>
                      <Button data-testid="add-manual-assessment">
                        <i className="fas fa-plus mr-2"></i>
                        Add Manual Assessment
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {assessmentsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-32" />
                      ))}
                    </div>
                  ) : assessments?.length === 0 ? (
                    <div className="text-center py-12">
                      <Brain className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Assessments Yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Generate AI-powered assessments from uploaded documents or add manual assessments
                      </p>
                      <div className="flex justify-center space-x-3">
                        <Button 
                          onClick={() => generateClientAssessments.mutate()}
                          disabled={generateClientAssessments.isPending || !documents?.length}
                          data-testid="generate-first-assessments"
                        >
                          <Brain className="w-4 h-4 mr-2" />
                          Generate from {documents?.length || 0} Documents
                        </Button>
                        <Button variant="outline" data-testid="add-first-manual-assessment">
                          <i className="fas fa-plus mr-2"></i>
                          Add Manual Assessment
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Assessment Timeline Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <h4 className="font-medium">Assessment Timeline</h4>
                          <Badge variant="outline">{assessments?.length} Total</Badge>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <span>Last updated: {formatDate(assessments?.[0]?.assessmentDate || new Date().toISOString())}</span>
                        </div>
                      </div>

                      {/* Assessment Cards with Enhanced Display */}
                      <div className="space-y-4">
                        {assessments?.map((assessment: any, index: number) => (
                          <Card key={assessment.id} data-testid={`assessment-detail-${assessment.id}`} className="border-l-4 border-l-blue-500">
                            <CardContent className="p-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-3">
                                    <div className="flex items-center space-x-2">
                                      <Brain className="w-4 h-4 text-blue-600" />
                                      <h3 className="font-semibold text-lg">{assessment.assessmentType}</h3>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      {formatDate(assessment.assessmentDate)}
                                    </Badge>
                                    {assessment.isAIGenerated && (
                                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                        AI Generated
                                      </Badge>
                                    )}
                                  </div>

                                  {/* Scores Display */}
                                  {assessment.scores && (
                                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <TrendingUp className="w-4 h-4 text-green-600" />
                                        <span className="font-medium text-sm">Assessment Scores</span>
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {Object.entries(assessment.scores).map(([key, value]: [string, any]) => (
                                          <div key={key} className="text-center">
                                            <div className="text-lg font-bold text-blue-600">{value}</div>
                                            <div className="text-xs text-muted-foreground capitalize">
                                              {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Interpretation */}
                                  {assessment.interpretation && (
                                    <div className="mb-3">
                                      <h5 className="font-medium text-sm mb-1 flex items-center space-x-1">
                                        <FileText className="w-3 h-3" />
                                        <span>Clinical Interpretation</span>
                                      </h5>
                                      <p className="text-sm text-muted-foreground leading-relaxed">
                                        {assessment.interpretation}
                                      </p>
                                    </div>
                                  )}

                                  {/* Recommendations */}
                                  {assessment.recommendations && (
                                    <div className="mb-3">
                                      <h5 className="font-medium text-sm mb-1 flex items-center space-x-1">
                                        <Shield className="w-3 h-3" />
                                        <span>Treatment Recommendations</span>
                                      </h5>
                                      <p className="text-sm text-muted-foreground leading-relaxed">
                                        {assessment.recommendations}
                                      </p>
                                    </div>
                                  )}

                                  {/* Source Document Link */}
                                  {assessment.sourceDocumentId && (
                                    <div className="mt-3 pt-3 border-t">
                                      <span className="text-xs text-muted-foreground flex items-center space-x-1">
                                        <Link2 className="w-3 h-3" />
                                        <span>Generated from document</span>
                                        <Badge variant="secondary" className="text-xs">
                                          View Source
                                        </Badge>
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex flex-col space-y-1 ml-4">
                                  <Button variant="ghost" size="sm" data-testid={`edit-assessment-${assessment.id}`}>
                                    <i className="fas fa-edit text-xs"></i>
                                  </Button>
                                  <Button variant="ghost" size="sm" data-testid={`view-assessment-${assessment.id}`}>
                                    <i className="fas fa-eye text-xs"></i>
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions for Insights and Reports */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span>Assessment Insights & Actions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col items-center space-y-2"
                      onClick={() => recomputeInsights.mutate()}
                      disabled={recomputeInsights.isPending}
                      data-testid="recompute-insights"
                    >
                      <Brain className="w-6 h-6 text-purple-600" />
                      <span className="text-sm">Recompute Insights</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col items-center space-y-2"
                      onClick={() => generateRecommendations.mutate()}
                      disabled={generateRecommendations.isPending}
                      data-testid="generate-recommendations"
                    >
                      <Shield className="w-6 h-6 text-blue-600" />
                      <span className="text-sm">Generate Recommendations</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col items-center space-y-2"
                      onClick={() => generateReport.mutate()}
                      disabled={generateReport.isPending}
                      data-testid="generate-assessment-report"
                    >
                      <FileText className="w-6 h-6 text-green-600" />
                      <span className="text-sm">Generate Report</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="medications" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Medication History</CardTitle>
                    <Button data-testid="add-medication">
                      <i className="fas fa-plus mr-2"></i>
                      Add Medication
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <i className="fas fa-pills text-4xl text-muted-foreground mb-4"></i>
                    <h3 className="text-lg font-medium mb-2">No Medications Recorded</h3>
                    <p className="text-muted-foreground mb-4">Track current and past medications for this client</p>
                    <Button data-testid="first-medication">
                      <i className="fas fa-plus mr-2"></i>
                      Add First Medication
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="treatment" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Treatment Plans</CardTitle>
                    <Button data-testid="add-treatment-plan">
                      <i className="fas fa-plus mr-2"></i>
                      Create Plan
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {plansLoading ? (
                    <div className="space-y-4">
                      {[...Array(2)].map((_, i) => (
                        <Skeleton key={i} className="h-32" />
                      ))}
                    </div>
                  ) : treatmentPlans?.length === 0 ? (
                    <div className="text-center py-12">
                      <i className="fas fa-bullseye text-4xl text-muted-foreground mb-4"></i>
                      <h3 className="text-lg font-medium mb-2">No Treatment Plans Yet</h3>
                      <p className="text-muted-foreground mb-4">Create comprehensive treatment plans with goals and interventions</p>
                      <Button data-testid="first-treatment-plan">
                        <i className="fas fa-plus mr-2"></i>
                        Create First Plan
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {treatmentPlans?.map((plan: any) => (
                        <Card key={plan.id} data-testid={`treatment-plan-${plan.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h3 className="font-medium">Treatment Plan</h3>
                                  <Badge variant="outline">
                                    Started {formatDate(plan.startDate)}
                                  </Badge>
                                  {plan.reviewDate && (
                                    <Badge variant="secondary">
                                      Review {formatDate(plan.reviewDate)}
                                    </Badge>
                                  )}
                                </div>
                                {plan.goals && Array.isArray(plan.goals) && (
                                  <div className="mb-2">
                                    <span className="text-sm font-medium">Goals:</span>
                                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-1">
                                      {plan.goals.map((goal: any, index: number) => (
                                        <li key={index}>
                                          {typeof goal === 'string' ? goal : goal.description || 'Goal'}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {plan.interventions && Array.isArray(plan.interventions) && (
                                  <div>
                                    <span className="text-sm font-medium">Interventions:</span>
                                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-1">
                                      {plan.interventions.map((intervention: any, index: number) => (
                                        <li key={index}>
                                          {typeof intervention === 'string' ? intervention : intervention.name || 'Intervention'}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                              <Button variant="ghost" size="sm" data-testid={`edit-treatment-plan-${plan.id}`}>
                                <i className="fas fa-edit"></i>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai-insights" className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Main AI Profile */}
                <div className="xl:col-span-2 space-y-6">
                  <ClientAITags 
                    clientId={clientId} 
                    clientName={`${client.firstName} ${client.lastName}`}
                    className="h-fit"
                  />
                  
                  <CaseConceptualization 
                    clientId={clientId} 
                    clientName={`${client.firstName} ${client.lastName}`}
                  />
                </div>
                
                {/* Quick Insights Sidebar */}
                <div className="space-y-4">
                  {/* Session Quick Stats */}
                  <Card data-testid="ai-quick-stats">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center space-x-2">
                        <Brain className="w-4 h-4 text-purple-600" />
                        <span>AI Insights Summary</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold text-blue-600">{sessions?.length || 0}</div>
                          <div className="text-xs text-muted-foreground">Sessions</div>
                        </div>
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold text-green-600">{documents?.length || 0}</div>
                          <div className="text-xs text-muted-foreground">Documents</div>
                        </div>
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold text-purple-600">{assessments?.length || 0}</div>
                          <div className="text-xs text-muted-foreground">Assessments</div>
                        </div>
                        <div className="text-center p-2 bg-muted/50 rounded">
                          <div className="font-semibold text-orange-600">{treatmentPlans?.length || 0}</div>
                          <div className="text-xs text-muted-foreground">Plans</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Document Auto-linking Status */}
                  <Card data-testid="document-linking-summary">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center space-x-2">
                        <Link2 className="w-4 h-4 text-green-600" />
                        <span>Document Linking</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Linked:</span>
                          <span className="font-medium text-green-600">
                            {documents?.filter((doc: any) => doc.sessionId).length || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Available:</span>
                          <span className="font-medium text-blue-600">
                            {documents?.filter((doc: any) => !doc.sessionId).length || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Calendar Sourced:</span>
                          <span className="font-medium text-purple-600">
                            {documents?.filter((doc: any) => doc.sourceEventId).length || 0}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Calendar Integration Status */}
                  <CalendarSync className="" />
                  
                  {/* HIPAA Compliance Notice */}
                  <Alert className="border-purple-200 bg-purple-50" data-testid="client-hipaa-notice">
                    <Shield className="h-4 w-4 text-purple-600" />
                    <AlertDescription>
                      <div className="text-purple-800">
                        <p className="font-medium text-xs">HIPAA Protected Client Data</p>
                        <p className="text-xs mt-1">
                          All AI analysis uses deidentified processing with full audit trail compliance.
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
