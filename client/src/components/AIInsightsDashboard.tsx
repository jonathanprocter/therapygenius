import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  FileText, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Target,
  Activity
} from 'lucide-react';
import { useClinicalInsightsSummary } from '@/hooks/useAITagging';

interface AIInsightsDashboardProps {
  className?: string;
}

export function AIInsightsDashboard({ className }: AIInsightsDashboardProps) {
  const { data, isLoading } = useClinicalInsightsSummary();

  const getRiskColor = (risk: string) => {
    if (risk === 'high') return 'text-red-600 bg-red-100';
    if (risk === 'moderate' || risk === 'medium') return 'text-orange-600 bg-orange-100';
    if (risk === 'low') return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`} data-testid="ai-insights-dashboard-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const summary = data?.summary;

  if (!summary) {
    return (
      <Card className={className} data-testid="ai-insights-dashboard-empty">
        <CardContent className="text-center py-12">
          <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">No AI Insights Available</h3>
          <p className="text-muted-foreground mb-4">
            Generate AI tags for your clients and sessions to see comprehensive insights here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid="ai-insights-dashboard">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                <p className="text-2xl font-bold">{summary.overview?.totalClients || 0}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                {summary.overview?.clientsWithAITags || 0} with AI tags
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tagged Sessions</p>
                <p className="text-2xl font-bold">{summary.overview?.totalTaggedSessions || 0}</p>
              </div>
              <FileText className="w-8 h-8 text-green-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                {summary.overview?.totalSessions || 0} total sessions
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Risk Clients</p>
                <p className="text-2xl font-bold text-red-600">{summary.riskSummary?.highRiskClients || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                Require immediate attention
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Improving Clients</p>
                <p className="text-2xl font-bold text-green-600">{summary.progressSummary?.improvingClients || 0}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                Showing positive progress
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="risk-analysis" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="risk-analysis">Risk Analysis</TabsTrigger>
          <TabsTrigger value="progress-trends">Progress Trends</TabsTrigger>
          <TabsTrigger value="intervention-effectiveness">Interventions</TabsTrigger>
          <TabsTrigger value="clinical-insights">Clinical Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="risk-analysis" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <span>Risk Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.riskSummary ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <p className="text-2xl font-bold text-red-600">{summary.riskSummary.highRiskClients}</p>
                        <p className="text-sm text-red-700">High Risk</p>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <p className="text-2xl font-bold text-orange-600">{summary.riskSummary.moderateRiskClients}</p>
                        <p className="text-sm text-orange-700">Moderate Risk</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <p className="text-2xl font-bold text-yellow-600">{summary.riskSummary.lowRiskClients}</p>
                        <p className="text-sm text-yellow-700">Low Risk</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{summary.riskSummary.minimalRiskClients}</p>
                        <p className="text-sm text-green-700">Minimal Risk</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No risk data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <span>Primary Risk Factors</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.riskSummary?.commonRiskFactors && summary.riskSummary.commonRiskFactors.length > 0 ? (
                  <div className="space-y-2">
                    {summary.riskSummary.commonRiskFactors.map((factor: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{factor.factor}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground">{factor.count} clients</span>
                          <Progress value={(factor.count / (summary.overview?.totalClients || 1)) * 100} className="w-20 h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No risk factors data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="progress-trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-green-600" />
                  <span>Progress Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.progressSummary ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-center mb-2">
                          <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="text-xl font-bold text-green-600">{summary.progressSummary.improvingClients}</p>
                        <p className="text-xs text-green-700">Improving</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-center mb-2">
                          <Clock className="w-6 h-6 text-gray-600" />
                        </div>
                        <p className="text-xl font-bold text-gray-600">{summary.progressSummary.stableClients}</p>
                        <p className="text-xs text-gray-700">Stable</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg">
                        <div className="flex items-center justify-center mb-2">
                          <TrendingDown className="w-6 h-6 text-red-600" />
                        </div>
                        <p className="text-xl font-bold text-red-600">{summary.progressSummary.decliningClients}</p>
                        <p className="text-xs text-red-700">Declining</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No progress data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span>Treatment Milestones</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.progressSummary?.recentMilestones && summary.progressSummary.recentMilestones.length > 0 ? (
                  <div className="space-y-3">
                    {summary.progressSummary.recentMilestones.map((milestone: any, index: number) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">{milestone.clientName}</p>
                          <p className="text-xs text-muted-foreground">{milestone.milestone}</p>
                          <p className="text-xs text-blue-600">{new Date(milestone.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No recent milestones available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="intervention-effectiveness" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-purple-600" />
                <span>Most Effective Interventions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.interventionSummary?.topInterventions && summary.interventionSummary.topInterventions.length > 0 ? (
                <div className="space-y-3">
                  {summary.interventionSummary.topInterventions.map((intervention: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{intervention.name}</p>
                        <p className="text-xs text-muted-foreground">Used in {intervention.usage} sessions</p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          className={
                            intervention.effectiveness >= 80 ? 'bg-green-100 text-green-800' :
                            intervention.effectiveness >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }
                        >
                          {intervention.effectiveness}% effective
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No intervention data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clinical-insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="w-5 h-5 text-indigo-600" />
                  <span>Common Themes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.themesSummary?.commonThemes && summary.themesSummary.commonThemes.length > 0 ? (
                  <div className="space-y-2">
                    {summary.themesSummary.commonThemes.map((theme: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-indigo-50 rounded">
                        <span className="text-sm font-medium">{theme.theme}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground">{theme.frequency}x</span>
                          <Progress value={(theme.frequency / 10) * 100} className="w-16 h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No theme data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-orange-600" />
                  <span>AI Recommendations</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.recommendationsSummary?.topRecommendations && summary.recommendationsSummary.topRecommendations.length > 0 ? (
                  <div className="space-y-3">
                    {summary.recommendationsSummary.topRecommendations.map((rec: any, index: number) => (
                      <div key={index} className="p-3 bg-orange-50 rounded-lg">
                        <p className="text-sm font-medium">{rec.recommendation}</p>
                        <p className="text-xs text-orange-600">Suggested for {rec.clientCount} clients</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No recommendations available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}