import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCaseConceptualization } from "@/hooks/useClientData";

interface CaseConceptualizationProps {
  clientId: string;
  clientName: string;
}

export function CaseConceptualization({ clientId, clientName }: CaseConceptualizationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const conceptualizationMutation = useCaseConceptualization(clientId);

  const handleGenerate = () => {
    conceptualizationMutation.mutate();
    setIsExpanded(true);
  };

  const data = conceptualizationMutation.data;

  return (
    <Card className="ai-glow" data-testid="case-conceptualization">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <i className="fas fa-brain text-white text-sm"></i>
            </div>
            <CardTitle>AI Case Conceptualization</CardTitle>
            <Badge className="bg-purple-100 text-purple-800">AI Powered</Badge>
          </div>
          {!data && (
            <Button 
              onClick={handleGenerate}
              disabled={conceptualizationMutation.isPending}
              data-testid="generate-conceptualization"
            >
              {conceptualizationMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Analyzing...
                </>
              ) : (
                <>
                  <i className="fas fa-magic mr-2"></i>
                  Generate Analysis
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {conceptualizationMutation.isPending ? (
          <div className="space-y-4">
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Case Formulation */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center">
                <i className="fas fa-user-md mr-2 text-blue-600"></i>
                Case Formulation
              </h3>
              <div className="bg-background/80 backdrop-blur-sm rounded-lg p-4 border border-border/50">
                <p className="text-sm leading-relaxed" data-testid="conceptualization-text">
                  {data.conceptualization}
                </p>
              </div>
            </div>

            {/* Patterns Identified */}
            {data.patterns && data.patterns.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center">
                  <i className="fas fa-chart-line mr-2 text-green-600"></i>
                  Patterns Identified
                </h3>
                <div className="space-y-2">
                  {data.patterns.map((pattern: string, index: number) => (
                    <div
                      key={index}
                      className="bg-background/80 backdrop-blur-sm rounded-lg p-3 border border-border/50"
                      data-testid={`pattern-${index}`}
                    >
                      <p className="text-sm">{pattern}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Risk Factors */}
              {data.riskFactors && data.riskFactors.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center">
                    <i className="fas fa-exclamation-triangle mr-2 text-orange-600"></i>
                    Risk Factors
                  </h3>
                  <div className="space-y-2">
                    {data.riskFactors.map((risk: string, index: number) => (
                      <div
                        key={index}
                        className="bg-orange-50 border border-orange-200 rounded-lg p-3"
                        data-testid={`risk-factor-${index}`}
                      >
                        <p className="text-sm text-orange-800">{risk}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {data.strengths && data.strengths.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center">
                    <i className="fas fa-star mr-2 text-green-600"></i>
                    Client Strengths
                  </h3>
                  <div className="space-y-2">
                    {data.strengths.map((strength: string, index: number) => (
                      <div
                        key={index}
                        className="bg-green-50 border border-green-200 rounded-lg p-3"
                        data-testid={`strength-${index}`}
                      >
                        <p className="text-sm text-green-800">{strength}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recommendations */}
            {data.recommendations && data.recommendations.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center">
                  <i className="fas fa-lightbulb mr-2 text-blue-600"></i>
                  Clinical Recommendations
                </h3>
                <div className="space-y-2">
                  {data.recommendations.map((recommendation: string, index: number) => (
                    <div
                      key={index}
                      className="bg-blue-50 border border-blue-200 rounded-lg p-3"
                      data-testid={`recommendation-${index}`}
                    >
                      <p className="text-sm text-blue-800">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={handleGenerate}
                disabled={conceptualizationMutation.isPending}
                data-testid="regenerate-conceptualization"
              >
                <i className="fas fa-redo mr-2"></i>
                Regenerate Analysis
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <i className="fas fa-brain text-4xl text-purple-300 mb-4"></i>
            <h3 className="text-lg font-medium mb-2">Generate AI Case Analysis</h3>
            <p className="text-muted-foreground mb-4">
              Get comprehensive clinical insights and recommendations for {clientName} based on all available data
            </p>
            <Button onClick={handleGenerate} data-testid="initial-generate">
              <i className="fas fa-magic mr-2"></i>
              Generate Case Conceptualization
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
