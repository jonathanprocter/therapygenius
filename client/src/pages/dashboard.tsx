import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Target, Activity, Sparkles } from "lucide-react";
import { useDashboardStats, useClients, useTodaysSessions } from "@/hooks/useClientData";
import { useDocuments } from "@/hooks/useDocuments";
import { AIInsightsDashboard } from "@/components/AIInsightsDashboard";
import { Link } from "wouter";
import { formatDateEastern, formatDateTimeEastern, formatTimeEastern } from "@/lib/utils";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: documents, isLoading: documentsLoading } = useDocuments(5);
  const { data: todaysSessions, isLoading: sessionsLoading } = useTodaysSessions();

  const recentClients = clients?.slice(0, 3) || [];
  const recentDocuments = documents?.slice(0, 3) || [];

  // Using Eastern Time formatting utilities for consistent timezone display
  const formatDate = formatDateEastern;

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return "fas fa-file-pdf text-red-600";
    if (fileType.includes("word") || fileType.includes("document")) return "fas fa-file-word text-blue-600";
    if (fileType.includes("text")) return "fas fa-file-alt text-gray-600";
    if (fileType.includes("image")) return "fas fa-file-image text-green-600";
    return "fas fa-file text-gray-600";
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      "Assessment": "bg-blue-100 text-blue-800",
      "Session Note": "bg-yellow-100 text-yellow-800", 
      "Treatment Plan": "bg-green-100 text-green-800",
      "Correspondence": "bg-purple-100 text-purple-800",
      "Legal": "bg-red-100 text-red-800",
      "Insurance": "bg-orange-100 text-orange-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="space-y-6">
          <Skeleton className="h-96" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                <p className="text-3xl font-bold" data-testid="active-clients">{stats?.activeClients || 0}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-users text-primary text-xl"></i>
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <span className="text-green-600 font-medium">Active</span>
              <span className="text-muted-foreground ml-2">total clients</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sessions This Week</p>
                <p className="text-3xl font-bold" data-testid="week-sessions">{stats?.weekSessions || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-calendar-check text-green-600 text-xl"></i>
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <span className="text-green-600 font-medium">This week</span>
              <span className="text-muted-foreground ml-2">completed</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Documents Processed</p>
                <p className="text-3xl font-bold" data-testid="documents-processed">{stats?.documentsProcessed || 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-file-alt text-purple-600 text-xl"></i>
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <span className="text-purple-600 font-medium">AI Powered</span>
              <span className="text-muted-foreground ml-2">auto-categorized</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Treatment Goals</p>
                <p className="text-3xl font-bold" data-testid="completed-goals">
                  {stats?.completedGoals ? `${stats.completedGoals.completed}/${stats.completedGoals.total}` : "0/0"}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-target text-orange-600 text-xl"></i>
              </div>
            </div>
            <div className="flex items-center mt-4 text-sm">
              <span className="text-orange-600 font-medium">
                {stats?.completedGoals?.total ? Math.round((stats.completedGoals.completed / stats.completedGoals.total) * 100) : 0}%
              </span>
              <span className="text-muted-foreground ml-2">completion rate</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Section - Prominently Featured */}
      <div className="space-y-4" data-testid="dashboard-ai-insights">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">AI Clinical Insights</h2>
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">
              <Activity className="w-3 h-3 mr-1" />
              Real-time Analysis
            </Badge>
          </div>
          <Link href="/ai/case-insights">
            <Button variant="outline" size="sm" data-testid="view-detailed-insights">
              <TrendingUp className="w-4 h-4 mr-2" />
              View Detailed Insights
            </Button>
          </Link>
        </div>
        
        {/* AI Insights Dashboard Component */}
        <AIInsightsDashboard className="mb-6" />
        
        <Separator />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Clients */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Clients</CardTitle>
              <Link href="/clients">
                <Button variant="ghost" size="sm" data-testid="view-all-clients">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : recentClients.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-users text-4xl text-muted-foreground mb-4"></i>
                <p className="text-muted-foreground">No clients yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentClients.map((client: any) => (
                  <Link key={client.id} href={`/client-chart/${client.id}`}>
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer" data-testid={`recent-client-${client.id}`}>
                      <div className="flex items-center space-x-4">
                        <div className="relative">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-primary font-medium text-sm">
                              {client.firstName?.[0]}{client.lastName?.[0]}
                            </span>
                          </div>
                          {/* AI Analysis Indicator */}
                          {client.aiTags && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                              <Brain className="w-2 h-2 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">{client.firstName} {client.lastName}</p>
                            {/* AI Risk Indicator */}
                            {client.aiTags?.riskProfile?.overallRiskLevel && (
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  client.aiTags.riskProfile.overallRiskLevel === 'high' || client.aiTags.riskProfile.overallRiskLevel === 'very_high' ? 
                                    'border-red-300 text-red-700 bg-red-50' :
                                  client.aiTags.riskProfile.overallRiskLevel === 'moderate' ?
                                    'border-orange-300 text-orange-700 bg-orange-50' :
                                    'border-green-300 text-green-700 bg-green-50'
                                }`}
                              >
                                <AlertTriangle className="w-2 h-2 mr-1" />
                                {client.aiTags.riskProfile.overallRiskLevel === 'very_high' ? 'Very High' : 
                                 client.aiTags.riskProfile.overallRiskLevel.replace('_', ' ')}
                              </Badge>
                            )}
                            {/* AI Progress Indicator */}
                            {client.aiTags?.therapyTrajectory?.overallProgress && (
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  client.aiTags.therapyTrajectory.overallProgress === 'improving' ? 
                                    'border-green-300 text-green-700 bg-green-50' :
                                  client.aiTags.therapyTrajectory.overallProgress === 'declining' ?
                                    'border-red-300 text-red-700 bg-red-50' :
                                    'border-blue-300 text-blue-700 bg-blue-50'
                                }`}
                              >
                                {client.aiTags.therapyTrajectory.overallProgress === 'improving' ? 
                                  <TrendingUp className="w-2 h-2 mr-1" /> :
                                 client.aiTags.therapyTrajectory.overallProgress === 'declining' ?
                                  <TrendingDown className="w-2 h-2 mr-1" /> :
                                  <Activity className="w-2 h-2 mr-1" />
                                }
                                {client.aiTags.therapyTrajectory.overallProgress.replace('_', ' ')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Last updated: {formatDate(client.updatedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                        <i className="fas fa-chevron-right text-muted-foreground"></i>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <p className="text-sm text-muted-foreground">{formatDateEastern(new Date())} (EST/EDT)</p>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : !todaysSessions || todaysSessions.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-calendar-alt text-4xl text-muted-foreground mb-4"></i>
                <p className="text-muted-foreground" data-testid="no-sessions-today">No appointments scheduled for today</p>
                <p className="text-xs text-muted-foreground mt-2">Enjoy your free time!</p>
              </div>
            ) : (
              <div className="space-y-3" data-testid="todays-sessions">
                {todaysSessions.map((session: any) => (
                  <div key={session.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors" data-testid={`session-${session.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Link href={`/client-chart/${session.clientId}`}>
                            <span className="font-medium text-primary hover:underline cursor-pointer" data-testid={`client-link-${session.clientId}`}>
                              {session.clientName}
                            </span>
                          </Link>
                          {/* AI Session Analysis Indicator */}
                          {session.aiTags && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                              <Brain className="w-2 h-2 mr-1" />
                              AI Analyzed
                            </Badge>
                          )}
                          {/* Risk Alert for High-Risk Sessions */}
                          {session.aiTags?.riskFactors?.suicideRisk && (session.aiTags.riskFactors.suicideRisk === 'high' || session.aiTags.riskFactors.suicideRisk === 'moderate') && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-2 h-2 mr-1" />
                              Risk Alert
                            </Badge>
                          )}
                          {session.sourceCalendar && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200" data-testid={`calendar-badge-${session.id}`}>
                              From Calendar
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1" data-testid={`session-time-${session.id}`}>
                            <i className="fas fa-clock text-xs"></i>
                            <span>{formatTimeEastern(session.sessionDate)}</span>
                          </div>
                          {session.duration && (
                            <div className="flex items-center space-x-1" data-testid={`session-duration-${session.id}`}>
                              <i className="fas fa-hourglass-half text-xs"></i>
                              <span>{session.duration} min</span>
                            </div>
                          )}
                          {session.sessionType && (
                            <Badge variant="secondary" className="text-xs" data-testid={`session-type-${session.id}`}>
                              {session.sessionType}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Section */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-200/20 ai-glow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-brain text-white text-sm"></i>
              </div>
              <CardTitle>AI Clinical Insights</CardTitle>
              <Badge className="bg-purple-100 text-purple-800">New</Badge>
            </div>
            <Button variant="ghost" size="sm" data-testid="view-all-insights">
              View All Insights
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-background/80 backdrop-blur-sm rounded-lg p-4 border border-border/50">
              <div className="flex items-start space-x-3">
                <i className="fas fa-lightbulb text-yellow-500 mt-1"></i>
                <div>
                  <h3 className="font-medium text-sm">System Ready</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    AI analysis ready for your client documents and case data
                  </p>
                  <Link href="/documents">
                    <Button variant="link" size="sm" className="text-xs p-0 h-auto mt-2">
                      Upload Documents →
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-background/80 backdrop-blur-sm rounded-lg p-4 border border-border/50">
              <div className="flex items-start space-x-3">
                <i className="fas fa-chart-line text-green-500 mt-1"></i>
                <div>
                  <h3 className="font-medium text-sm">Analytics Available</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Track client progress and treatment outcomes
                  </p>
                  <Link href="/reports">
                    <Button variant="link" size="sm" className="text-xs p-0 h-auto mt-2">
                      View Reports →
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-background/80 backdrop-blur-sm rounded-lg p-4 border border-border/50">
              <div className="flex items-start space-x-3">
                <i className="fas fa-users text-blue-500 mt-1"></i>
                <div>
                  <h3 className="font-medium text-sm">Client Management</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Comprehensive client charts with AI insights
                  </p>
                  <Link href="/clients">
                    <Button variant="link" size="sm" className="text-xs p-0 h-auto mt-2">
                      Manage Clients →
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Documents and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Documents</CardTitle>
              <div className="flex items-center space-x-2">
                <Link href="/documents">
                  <Button variant="ghost" size="sm" data-testid="upload-new-doc">
                    Upload New
                  </Button>
                </Link>
                <Link href="/documents">
                  <Button variant="ghost" size="sm" data-testid="view-all-docs">
                    View All
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {documentsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : recentDocuments.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-file-medical text-4xl text-muted-foreground mb-4"></i>
                <p className="text-muted-foreground">No documents uploaded yet</p>
                <Link href="/documents">
                  <Button className="mt-4" data-testid="upload-first-doc">
                    <i className="fas fa-plus mr-2"></i>
                    Upload Documents
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentDocuments.map((document: any) => (
                  <div key={document.id} className="flex items-center space-x-4 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer" data-testid={`recent-document-${document.id}`}>
                    <div className="w-8 h-8 flex items-center justify-center">
                      <i className={getFileIcon(document.fileType)}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{document.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {formatDate(document.uploadDate)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {document.metadata?.analysis?.category && (
                        <Badge className={getCategoryColor(document.metadata.analysis.category)}>
                          {document.metadata.analysis.category}
                        </Badge>
                      )}
                      {document.isProcessed && (
                        <i className="fas fa-magic text-purple-500 text-xs" title="AI Processed"></i>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <i className="fas fa-clock text-4xl text-muted-foreground mb-4"></i>
              <p className="text-muted-foreground">Activity feed will appear here</p>
              <p className="text-xs text-muted-foreground mt-2">
                Start by creating clients and uploading documents
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
