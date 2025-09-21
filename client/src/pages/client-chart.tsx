import { useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientProfile } from "@/components/ClientProfile";
import { CaseConceptualization } from "@/components/CaseConceptualization";
import { 
  useClient, 
  useClientSessions, 
  useClientAssessments, 
  useClientTreatmentPlans 
} from "@/hooks/useClientData";
import { useClientDocuments } from "@/hooks/useDocuments";

export default function ClientChart() {
  const { id } = useParams();
  const clientId = id as string;

  const { data: client, isLoading: clientLoading } = useClient(clientId);
  const { data: sessions, isLoading: sessionsLoading } = useClientSessions(clientId);
  const { data: assessments, isLoading: assessmentsLoading } = useClientAssessments(clientId);
  const { data: treatmentPlans, isLoading: plansLoading } = useClientTreatmentPlans(clientId);
  const { data: documents, isLoading: documentsLoading } = useClientDocuments(clientId);

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
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Assessment History</CardTitle>
                    <Button data-testid="add-assessment">
                      <i className="fas fa-plus mr-2"></i>
                      Add Assessment
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {assessmentsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                  ) : assessments?.length === 0 ? (
                    <div className="text-center py-12">
                      <i className="fas fa-chart-bar text-4xl text-muted-foreground mb-4"></i>
                      <h3 className="text-lg font-medium mb-2">No Assessments Yet</h3>
                      <p className="text-muted-foreground mb-4">Track client progress with standardized assessments</p>
                      <Button data-testid="first-assessment">
                        <i className="fas fa-plus mr-2"></i>
                        Add First Assessment
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {assessments?.map((assessment: any) => (
                        <Card key={assessment.id} data-testid={`assessment-detail-${assessment.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h3 className="font-medium">{assessment.assessmentType}</h3>
                                  <Badge variant="outline">
                                    {formatDate(assessment.assessmentDate)}
                                  </Badge>
                                </div>
                                {assessment.scores && (
                                  <div className="mb-2">
                                    <span className="text-sm text-muted-foreground">Scores: </span>
                                    <span className="font-medium">
                                      {JSON.stringify(assessment.scores)}
                                    </span>
                                  </div>
                                )}
                                {assessment.interpretation && (
                                  <p className="text-sm text-muted-foreground mb-2">
                                    <span className="font-medium">Interpretation: </span>
                                    {assessment.interpretation}
                                  </p>
                                )}
                                {assessment.recommendations && (
                                  <p className="text-sm text-muted-foreground">
                                    <span className="font-medium">Recommendations: </span>
                                    {assessment.recommendations}
                                  </p>
                                )}
                              </div>
                              <Button variant="ghost" size="sm" data-testid={`edit-assessment-${assessment.id}`}>
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
              <CaseConceptualization 
                clientId={clientId} 
                clientName={`${client.firstName} ${client.lastName}`}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
