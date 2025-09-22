import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Brain, RefreshCw, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useClientAITags, useGenerateClientAITags, useRegenerateClientAITags } from '@/hooks/useAITagging';

interface ClientAITagsProps {
  clientId: string;
  clientName: string;
  className?: string;
}

export function ClientAITags({ clientId, clientName, className }: ClientAITagsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['trajectory', 'themes']));
  const { data, isLoading } = useClientAITags(clientId);
  const generateMutation = useGenerateClientAITags(clientId);
  const regenerateMutation = useRegenerateClientAITags(clientId);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const handleRegenerate = () => {
    regenerateMutation.mutate();
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-600" />;
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'improving') return 'bg-green-100 text-green-800';
    if (trend === 'declining') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getRiskColor = (risk: string) => {
    if (risk === 'high') return 'bg-red-100 text-red-800 border-red-200';
    if (risk === 'moderate' || risk === 'medium') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (risk === 'low') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getResponseColor = (response: string) => {
    if (response === 'excellent' || response === 'positive') return 'bg-green-100 text-green-800';
    if (response === 'good' || response === 'moderate') return 'bg-blue-100 text-blue-800';
    if (response === 'fair' || response === 'mixed') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (isLoading) {
    return (
      <Card className={className} data-testid="client-ai-tags-loading">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="h-6 w-48" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const tags = data?.tags;
  const hasAITags = data?.hasAITags;

  if (!hasAITags && !generateMutation.isPending) {
    return (
      <Card className={`${className} border-dashed`} data-testid="client-ai-tags-empty">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-blue-600" />
              </div>
              <CardTitle className="text-lg">Client AI Profile</CardTitle>
            </div>
            <Button 
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              size="sm"
              data-testid="generate-client-tags"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate AI Profile
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm">Generate comprehensive AI insights for {clientName}</p>
            <p className="text-xs mt-2">Analyze therapy trajectory, patterns, and treatment response across all sessions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} ai-glow`} data-testid="client-ai-tags">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Client AI Profile</CardTitle>
              <p className="text-sm text-muted-foreground">
                Comprehensive insights for {clientName}
              </p>
            </div>
            <Badge className="bg-blue-100 text-blue-800">AI Analysis</Badge>
          </div>
          <Button 
            onClick={handleRegenerate}
            disabled={regenerateMutation.isPending}
            size="sm"
            variant="outline"
            data-testid="regenerate-client-tags"
          >
            {regenerateMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Therapy Trajectory */}
        <Collapsible 
          open={expandedSections.has('trajectory')} 
          onOpenChange={() => toggleSection('trajectory')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              {expandedSections.has('trajectory') ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
              <h4 className="font-semibold">Therapy Trajectory</h4>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2">
            {tags?.therapyTrajectory ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    {getTrendIcon(tags.therapyTrajectory.overallProgress)}
                    <div>
                      <p className="text-sm font-medium">Overall Progress</p>
                      <Badge className={getTrendColor(tags.therapyTrajectory.overallProgress)}>
                        {tags.therapyTrajectory.overallProgress}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Phase</p>
                    <Badge variant="outline">{tags.therapyTrajectory.currentPhase}</Badge>
                  </div>
                </div>
                {tags.therapyTrajectory.keyMilestones && tags.therapyTrajectory.keyMilestones.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Key Milestones</h5>
                    <div className="space-y-2">
                      {tags.therapyTrajectory.keyMilestones.map((milestone: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <span className="text-sm">{milestone}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tags.therapyTrajectory.progressIndicators && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Progress Indicators</h5>
                    <p className="text-sm text-muted-foreground">{tags.therapyTrajectory.progressIndicators}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No therapy trajectory data available</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Risk Profile */}
        <Collapsible 
          open={expandedSections.has('risk')} 
          onOpenChange={() => toggleSection('risk')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              {expandedSections.has('risk') ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
              <h4 className="font-semibold">Risk Profile</h4>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2">
            {tags?.riskProfile ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Overall Risk Level</p>
                    <Badge className={getRiskColor(tags.riskProfile.overallRiskLevel)} variant="outline">
                      {tags.riskProfile.overallRiskLevel}
                    </Badge>
                  </div>
                  {tags.riskProfile.riskTrend && (
                    <div className="flex items-center space-x-3">
                      {getTrendIcon(tags.riskProfile.riskTrend)}
                      <div>
                        <p className="text-sm font-medium">Risk Trend</p>
                        <Badge className={getTrendColor(tags.riskProfile.riskTrend)}>
                          {tags.riskProfile.riskTrend}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
                {tags.riskProfile.primaryConcerns && tags.riskProfile.primaryConcerns.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Primary Concerns</h5>
                    <div className="flex flex-wrap gap-2">
                      {tags.riskProfile.primaryConcerns.map((concern: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {concern}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {tags.riskProfile.protectiveFactors && tags.riskProfile.protectiveFactors.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-green-700 mb-2">Protective Factors</h5>
                    <div className="space-y-1">
                      {tags.riskProfile.protectiveFactors.map((factor: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-sm">{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No risk profile data available</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Client Strengths */}
        <Collapsible 
          open={expandedSections.has('strengths')} 
          onOpenChange={() => toggleSection('strengths')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              {expandedSections.has('strengths') ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
              <h4 className="font-semibold">Client Strengths</h4>
            </div>
            {tags?.clientStrengths && (
              <Badge variant="secondary">{tags.clientStrengths.identifiedStrengths?.length || 0}</Badge>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2">
            {tags?.clientStrengths ? (
              <div className="space-y-4">
                {tags.clientStrengths.identifiedStrengths && tags.clientStrengths.identifiedStrengths.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-green-700 mb-2">Identified Strengths</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {tags.clientStrengths.identifiedStrengths.map((strength: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-sm">{strength}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tags.clientStrengths.copingStrategies && tags.clientStrengths.copingStrategies.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Effective Coping Strategies</h5>
                    <div className="flex flex-wrap gap-2">
                      {tags.clientStrengths.copingStrategies.map((strategy: string, index: number) => (
                        <Badge key={index} variant="outline" className="bg-green-50 text-green-700">
                          {strategy}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {tags.clientStrengths.supportSystems && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Support Systems</h5>
                    <p className="text-sm text-muted-foreground">{tags.clientStrengths.supportSystems}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No client strengths data available</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Treatment Response */}
        <Collapsible 
          open={expandedSections.has('treatment')} 
          onOpenChange={() => toggleSection('treatment')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              {expandedSections.has('treatment') ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
              <h4 className="font-semibold">Treatment Response</h4>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2">
            {tags?.treatmentResponse ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium">Overall Response:</span>
                  <Badge className={getResponseColor(tags.treatmentResponse.overallResponse)}>
                    {tags.treatmentResponse.overallResponse}
                  </Badge>
                </div>
                {tags.treatmentResponse.effectiveInterventions && tags.treatmentResponse.effectiveInterventions.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-green-700 mb-2">Most Effective Interventions</h5>
                    <div className="space-y-2">
                      {tags.treatmentResponse.effectiveInterventions.map((intervention: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-sm">{intervention}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tags.treatmentResponse.challengingAreas && tags.treatmentResponse.challengingAreas.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-orange-700 mb-2">Challenging Areas</h5>
                    <div className="space-y-2">
                      {tags.treatmentResponse.challengingAreas.map((area: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full" />
                          <span className="text-sm">{area}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tags.treatmentResponse.recommendedAdjustments && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Recommended Adjustments</h5>
                    <p className="text-sm text-muted-foreground">{tags.treatmentResponse.recommendedAdjustments}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No treatment response data available</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Recurring Themes */}
        <Collapsible 
          open={expandedSections.has('themes')} 
          onOpenChange={() => toggleSection('themes')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              {expandedSections.has('themes') ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
              <h4 className="font-semibold">Recurring Themes</h4>
            </div>
            {tags?.recurringThemes && (
              <Badge variant="secondary">{tags.recurringThemes.primaryThemes?.length || 0}</Badge>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2">
            {tags?.recurringThemes ? (
              <div className="space-y-4">
                {tags.recurringThemes.primaryThemes && tags.recurringThemes.primaryThemes.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Primary Themes</h5>
                    <div className="flex flex-wrap gap-2">
                      {tags.recurringThemes.primaryThemes.map((theme: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {tags.recurringThemes.emotionalPatterns && tags.recurringThemes.emotionalPatterns.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Emotional Patterns</h5>
                    <div className="flex flex-wrap gap-2">
                      {tags.recurringThemes.emotionalPatterns.map((pattern: string, index: number) => (
                        <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                          {pattern}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {tags.recurringThemes.behavioralPatterns && tags.recurringThemes.behavioralPatterns.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Behavioral Patterns</h5>
                    <div className="flex flex-wrap gap-2">
                      {tags.recurringThemes.behavioralPatterns.map((pattern: string, index: number) => (
                        <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                          {pattern}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recurring themes data available</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Clinical Recommendations */}
        {tags?.clinicalRecommendations && (
          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-3">AI Clinical Recommendations</h4>
            <div className="space-y-3">
              {tags.clinicalRecommendations.suggestedInterventions && tags.clinicalRecommendations.suggestedInterventions.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-blue-700 mb-2">Suggested Interventions</h5>
                  <div className="space-y-1">
                    {tags.clinicalRecommendations.suggestedInterventions.map((intervention: string, index: number) => (
                      <div key={index} className="flex items-start space-x-2">
                        <span className="text-blue-600 mt-1">→</span>
                        <span className="text-sm">{intervention}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tags.clinicalRecommendations.focusAreas && tags.clinicalRecommendations.focusAreas.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-orange-700 mb-2">Recommended Focus Areas</h5>
                  <div className="flex flex-wrap gap-2">
                    {tags.clinicalRecommendations.focusAreas.map((area: string, index: number) => (
                      <Badge key={index} variant="outline" className="bg-orange-50 text-orange-700 text-xs">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {tags.clinicalRecommendations.sessionFrequency && (
                <div>
                  <h5 className="text-sm font-medium mb-1">Recommended Session Frequency</h5>
                  <p className="text-sm text-muted-foreground">{tags.clinicalRecommendations.sessionFrequency}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}