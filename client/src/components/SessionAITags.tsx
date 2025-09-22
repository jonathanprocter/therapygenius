import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Brain, RefreshCw, Sparkles } from 'lucide-react';
import { useSessionAITags, useGenerateSessionAITags, useRegenerateSessionAITags } from '@/hooks/useAITagging';

interface SessionAITagsProps {
  sessionId: string;
  sessionDate: string;
  className?: string;
}

export function SessionAITags({ sessionId, sessionDate, className }: SessionAITagsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['themes']));
  const { data, isLoading } = useSessionAITags(sessionId);
  const generateMutation = useGenerateSessionAITags(sessionId);
  const regenerateMutation = useRegenerateSessionAITags(sessionId);

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

  const getMoodColor = (mood: string) => {
    const colors: Record<string, string> = {
      'anxious': 'bg-orange-100 text-orange-800',
      'anxiety': 'bg-orange-100 text-orange-800',
      'depressed': 'bg-blue-100 text-blue-800',
      'depression': 'bg-blue-100 text-blue-800',
      'sad': 'bg-blue-100 text-blue-800',
      'sadness': 'bg-blue-100 text-blue-800',
      'angry': 'bg-red-100 text-red-800',
      'anger': 'bg-red-100 text-red-800',
      'frustrated': 'bg-red-100 text-red-800',
      'frustration': 'bg-red-100 text-red-800',
      'calm': 'bg-green-100 text-green-800',
      'peaceful': 'bg-green-100 text-green-800',
      'excited': 'bg-yellow-100 text-yellow-800',
      'excitement': 'bg-yellow-100 text-yellow-800',
      'hopeful': 'bg-emerald-100 text-emerald-800',
      'hope': 'bg-emerald-100 text-emerald-800',
      'optimistic': 'bg-emerald-100 text-emerald-800',
      'stressed': 'bg-purple-100 text-purple-800',
      'stress': 'bg-purple-100 text-purple-800',
      'overwhelmed': 'bg-purple-100 text-purple-800',
      'confused': 'bg-gray-100 text-gray-800',
      'neutral': 'bg-gray-100 text-gray-800',
      'stable': 'bg-slate-100 text-slate-800',
    };
    return colors[mood?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const getRiskColor = (risk: string) => {
    if (risk === 'high') return 'bg-red-100 text-red-800 border-red-200';
    if (risk === 'moderate' || risk === 'medium') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (risk === 'low') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getEngagementColor = (level: string) => {
    const normalizedLevel = level?.toLowerCase();
    if (normalizedLevel === 'excellent') return 'bg-green-500';
    if (normalizedLevel === 'good') return 'bg-blue-500';
    if (normalizedLevel === 'moderate') return 'bg-yellow-500';
    if (normalizedLevel === 'limited') return 'bg-orange-500';
    if (normalizedLevel === 'minimal') return 'bg-red-500';
    return 'bg-gray-500';
  };

  const getEngagementPercentage = (level: string) => {
    const normalizedLevel = level?.toLowerCase();
    if (normalizedLevel === 'excellent') return 90;
    if (normalizedLevel === 'good') return 70;
    if (normalizedLevel === 'moderate') return 50;
    if (normalizedLevel === 'limited') return 30;
    if (normalizedLevel === 'minimal') return 10;
    return 0;
  };

  const getEngagementBadgeColor = (level: string) => {
    const normalizedLevel = level?.toLowerCase();
    if (normalizedLevel === 'excellent') return 'bg-green-100 text-green-800';
    if (normalizedLevel === 'good') return 'bg-blue-100 text-blue-800';
    if (normalizedLevel === 'moderate') return 'bg-yellow-100 text-yellow-800';
    if (normalizedLevel === 'limited') return 'bg-orange-100 text-orange-800';
    if (normalizedLevel === 'minimal') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <Card className={className} data-testid="session-ai-tags-loading">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="h-6 w-48" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-14" />
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
      <Card className={`${className} border-dashed`} data-testid="session-ai-tags-empty">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-purple-600" />
              </div>
              <CardTitle className="text-lg">Session AI Insights</CardTitle>
            </div>
            <Button 
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              size="sm"
              data-testid="generate-session-tags"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate AI Tags
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm">Generate AI-powered insights for this session</p>
            <p className="text-xs mt-2">Extract themes, mood, engagement, and clinical observations</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} ai-glow`} data-testid="session-ai-tags">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Session AI Insights</CardTitle>
              <p className="text-sm text-muted-foreground">
                Session from {new Date(sessionDate).toLocaleDateString()}
              </p>
            </div>
            <Badge className="bg-purple-100 text-purple-800">AI Powered</Badge>
          </div>
          <Button 
            onClick={handleRegenerate}
            disabled={regenerateMutation.isPending}
            size="sm"
            variant="outline"
            data-testid="regenerate-session-tags"
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
        {/* Session Themes */}
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
              <h4 className="font-semibold">Session Themes</h4>
            </div>
            {tags?.sessionThemes && (
              <Badge variant="secondary">{tags.sessionThemes.length}</Badge>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2">
            <div className="flex flex-wrap gap-2">
              {tags?.sessionThemes?.map((theme: string, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {theme}
                </Badge>
              )) || <p className="text-sm text-muted-foreground">No themes identified</p>}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Client Mood */}
        <Collapsible 
          open={expandedSections.has('mood')} 
          onOpenChange={() => toggleSection('mood')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              {expandedSections.has('mood') ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
              <h4 className="font-semibold">Client Mood</h4>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2">
            {tags?.clientMood ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-4">
                  <Badge className={getMoodColor(tags.clientMood.primary)}>
                    {tags.clientMood.primary}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Intensity: {tags.clientMood.intensity || 'Not specified'}
                  </span>
                </div>
                {tags.clientMood.secondary && tags.clientMood.secondary.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Secondary moods:</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.clientMood.secondary.map((mood: string, index: number) => (
                        <Badge key={index} variant="outline" className={getMoodColor(mood)}>
                          {mood}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No mood data available</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Client Engagement */}
        <Collapsible 
          open={expandedSections.has('engagement')} 
          onOpenChange={() => toggleSection('engagement')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              {expandedSections.has('engagement') ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
              <h4 className="font-semibold">Client Engagement</h4>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2">
            {tags?.clientEngagement ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium">Level:</span>
                  <Badge className={getEngagementBadgeColor(tags.clientEngagement.level)}>
                    {tags.clientEngagement.level}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Engagement Score</span>
                    <span>{getEngagementPercentage(tags.clientEngagement.level)}%</span>
                  </div>
                  <Progress 
                    value={getEngagementPercentage(tags.clientEngagement.level)} 
                    className="h-2"
                  />
                </div>
                {tags.clientEngagement.indicators && tags.clientEngagement.indicators.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Engagement indicators:</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.clientEngagement.indicators.map((indicator: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {indicator}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No engagement data available</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Risk Factors */}
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
              <h4 className="font-semibold">Risk Assessment</h4>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2">
            {tags?.riskFactors ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Suicide Risk:</span>
                    <Badge className={getRiskColor(tags.riskFactors.suicideRisk)} variant="outline">
                      {tags.riskFactors.suicideRisk || 'none'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Self-Harm:</span>
                    <Badge className={getRiskColor(tags.riskFactors.selfHarm)} variant="outline">
                      {tags.riskFactors.selfHarm || 'none'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Substance Use:</span>
                    <Badge className={getRiskColor(tags.riskFactors.substanceUse)} variant="outline">
                      {tags.riskFactors.substanceUse || 'none'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Violence Risk:</span>
                    <Badge className={getRiskColor(tags.riskFactors.violenceRisk)} variant="outline">
                      {tags.riskFactors.violenceRisk || 'none'}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No risk assessment data available</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Progress Markers */}
        <Collapsible 
          open={expandedSections.has('progress')} 
          onOpenChange={() => toggleSection('progress')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              {expandedSections.has('progress') ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
              <h4 className="font-semibold">Progress Markers</h4>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2">
            {tags?.progressMarkers ? (
              <div className="space-y-4">
                {tags.progressMarkers.improvements && tags.progressMarkers.improvements.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-green-700 mb-2">Improvements</h5>
                    <div className="space-y-1">
                      {tags.progressMarkers.improvements.map((improvement: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-sm">{improvement}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tags.progressMarkers.challenges && tags.progressMarkers.challenges.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-orange-700 mb-2">Challenges</h5>
                    <div className="space-y-1">
                      {tags.progressMarkers.challenges.map((challenge: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full" />
                          <span className="text-sm">{challenge}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tags.progressMarkers.goalProgress && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">Goal Progress</h5>
                    <p className="text-sm text-muted-foreground">{tags.progressMarkers.goalProgress}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No progress markers available</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Intervention Effectiveness */}
        <Collapsible 
          open={expandedSections.has('interventions')} 
          onOpenChange={() => toggleSection('interventions')}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              {expandedSections.has('interventions') ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
              <h4 className="font-semibold">Intervention Effectiveness</h4>
            </div>
            {tags?.interventionEffectiveness && (
              <Badge variant="secondary">{tags.interventionEffectiveness.length}</Badge>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 pt-2">
            {tags?.interventionEffectiveness && tags.interventionEffectiveness.length > 0 ? (
              <div className="space-y-3">
                {tags.interventionEffectiveness.map((item: any, index: number) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{item.intervention}</span>
                      <Badge 
                        className={
                          item.effectiveness === 'high' ? 'bg-green-100 text-green-800' :
                          item.effectiveness === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }
                      >
                        {item.effectiveness}
                      </Badge>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground">{item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No intervention effectiveness data available</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Clinical Observations */}
        {tags?.clinicalObservations && tags.clinicalObservations.length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Clinical Observations</h4>
            <ul className="space-y-1">
              {tags.clinicalObservations.map((observation: string, index: number) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{observation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Session Quality and Therapeutic Relationship */}
        <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
          {tags?.sessionQuality && (
            <div>
              <h5 className="text-sm font-medium mb-1">Session Quality</h5>
              <Badge variant="outline">{tags.sessionQuality}</Badge>
            </div>
          )}
          {tags?.therapeuticRelationship && (
            <div>
              <h5 className="text-sm font-medium mb-1">Therapeutic Relationship</h5>
              <Badge variant="outline">{tags.therapeuticRelationship}</Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}