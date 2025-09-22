import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Brain, 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  BarChart3, 
  PieChart, 
  LineChart, 
  Target, 
  Clock, 
  Lightbulb, 
  RefreshCw, 
  Download, 
  Eye, 
  ArrowUpRight, 
  ArrowDownRight,
  Minus,
  Heart,
  Shield,
  Zap,
  BookOpen,
  FileText,
  Calendar,
  User
} from "lucide-react";
import { Link } from "wouter";
import { useClients } from "@/hooks/useClientData";
import { useClinicalInsightsSummary } from "@/hooks/useAITagging";
import { formatDateEastern } from "@/lib/utils";

interface InsightMetric {
  id: string;
  title: string;
  value: number;
  change: number;
  changeType: "increase" | "decrease" | "stable";
  context: string;
  severity: "low" | "moderate" | "high";
  trend: number[];
}

interface ClinicalPattern {
  id: string;
  pattern: string;
  frequency: number;
  confidence: number;
  impact: "positive" | "negative" | "neutral";
  description: string;
  affectedClients: number;
  recommendations: string[];
}

interface RiskFactor {
  id: string;
  factor: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  prevalence: number;
  description: string;
  affectedClients: string[];
  interventions: string[];
}

export default function AICaseInsights() {
  const [selectedTimeRange, setSelectedTimeRange] = useState("30days");
  const [selectedMetric, setSelectedMetric] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: clinicalSummary, isLoading: summaryLoading } = useClinicalInsightsSummary();

  // Mock insight metrics
  const insightMetrics: InsightMetric[] = useMemo(() => [
    {
      id: "treatment-effectiveness",
      title: "Treatment Effectiveness",
      value: 78.2,
      change: 5.4,
      changeType: "increase",
      context: "Overall improvement in treatment outcomes",
      severity: "low",
      trend: [65, 68, 72, 74, 76, 78.2]
    },
    {
      id: "risk-assessment-accuracy",
      title: "Risk Assessment Accuracy",
      value: 92.1,
      change: 2.1,
      changeType: "increase",
      context: "AI-assisted risk assessments showing higher accuracy",
      severity: "low",
      trend: [88, 89, 90, 91, 92, 92.1]
    },
    {
      id: "client-engagement",
      title: "Client Engagement Rate",
      value: 84.7,
      change: -3.2,
      changeType: "decrease",
      context: "Slight decrease in session attendance",
      severity: "moderate",
      trend: [88, 87, 86, 85, 84.7]
    },
    {
      id: "crisis-prediction",
      title: "Crisis Prediction Accuracy",
      value: 89.3,
      change: 0.8,
      changeType: "stable",
      context: "Consistent early warning system performance",
      severity: "low",
      trend: [88.5, 89, 89.2, 89.1, 89.3]
    }
  ], []);

  // Mock clinical patterns
  const clinicalPatterns: ClinicalPattern[] = useMemo(() => [
    {
      id: "anxiety-depression-comorbidity",
      pattern: "Anxiety-Depression Comorbidity",
      frequency: 68,
      confidence: 94.2,
      impact: "negative",
      description: "High correlation between anxiety and depression symptoms in active caseload",
      affectedClients: 23,
      recommendations: [
        "Implement integrated treatment protocols",
        "Consider dual-diagnosis approach",
        "Monitor medication interactions"
      ]
    },
    {
      id: "cbt-effectiveness",
      pattern: "CBT Effectiveness in Trauma Cases",
      frequency: 82,
      confidence: 91.7,
      impact: "positive",
      description: "Cognitive Behavioral Therapy showing strong results for trauma-related cases",
      affectedClients: 15,
      recommendations: [
        "Continue CBT protocols",
        "Consider EMDR integration",
        "Regular outcome assessments"
      ]
    },
    {
      id: "session-frequency-outcomes",
      pattern: "Session Frequency Impact",
      frequency: 74,
      confidence: 87.3,
      impact: "positive",
      description: "Weekly sessions show better outcomes than bi-weekly for acute cases",
      affectedClients: 31,
      recommendations: [
        "Optimize session scheduling",
        "Prioritize high-risk clients",
        "Consider intensive outpatient options"
      ]
    }
  ], []);

  // Mock risk factors
  const riskFactors: RiskFactor[] = useMemo(() => [
    {
      id: "social-isolation",
      factor: "Social Isolation",
      riskLevel: "high",
      prevalence: 34,
      description: "Clients showing limited social support systems",
      affectedClients: clients?.slice(0, 5).map(c => c.id) || [],
      interventions: [
        "Group therapy sessions",
        "Community resource referrals",
        "Social skills training"
      ]
    },
    {
      id: "medication-adherence",
      factor: "Medication Non-Adherence",
      riskLevel: "moderate",
      prevalence: 28,
      description: "Inconsistent medication compliance patterns detected",
      affectedClients: clients?.slice(2, 6).map(c => c.id) || [],
      interventions: [
        "Medication management education",
        "Collaboration with prescribers",
        "Adherence monitoring tools"
      ]
    },
    {
      id: "financial-stress",
      factor: "Financial Stressors",
      riskLevel: "moderate",
      prevalence: 45,
      description: "Economic concerns impacting treatment engagement",
      affectedClients: clients?.slice(1, 7).map(c => c.id) || [],
      interventions: [
        "Financial counseling resources",
        "Sliding scale fee discussions",
        "Community assistance programs"
      ]
    }
  ], [clients]);

  const isLoading = clientsLoading || summaryLoading;

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case "increase":
        return <ArrowUpRight className="w-4 h-4 text-green-600" />;
      case "decrease":
        return <ArrowDownRight className="w-4 h-4 text-red-600" />;
      case "stable":
        return <Minus className="w-4 h-4 text-gray-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "bg-green-100 text-green-800";
      case "moderate":
        return "bg-yellow-100 text-yellow-800";
      case "high":
        return "bg-red-100 text-red-800";
      case "critical":
        return "bg-red-200 text-red-900";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "low":
        return "bg-green-100 text-green-800";
      case "moderate":
        return "bg-yellow-100 text-yellow-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "critical":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case "positive":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "negative":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "neutral":
        return <Minus className="w-4 h-4 text-gray-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="case-insights-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="case-insights-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center" data-testid="case-insights-title">
            <Brain className="w-6 h-6 mr-2 text-primary" />
            AI Case Insights
          </h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive analytics and patterns across your clinical practice
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-40" data-testid="time-range-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="90days">Last 90 days</SelectItem>
              <SelectItem value="6months">Last 6 months</SelectItem>
              <SelectItem value="1year">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" data-testid="refresh-insights">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button data-testid="export-insights">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {insightMetrics.map((metric) => (
          <Card key={metric.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium text-sm truncate">{metric.title}</h3>
                  <Badge className={getSeverityColor(metric.severity)} data-testid={`severity-${metric.id}`}>
                    {metric.severity}
                  </Badge>
                </div>
                {getChangeIcon(metric.changeType)}
              </div>
              
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold" data-testid={`metric-value-${metric.id}`}>
                    {metric.value}%
                  </p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    {getChangeIcon(metric.changeType)}
                    <span className="ml-1" data-testid={`metric-change-${metric.id}`}>
                      {Math.abs(metric.change)}% vs last period
                    </span>
                  </div>
                </div>
                <div className="w-16 h-8 bg-muted rounded">
                  {/* Mini trend chart placeholder */}
                  <div className="w-full h-full flex items-end space-x-1 p-1">
                    {metric.trend.slice(-5).map((value, index) => (
                      <div
                        key={index}
                        className="bg-primary rounded-sm flex-1"
                        style={{ height: `${(value / 100) * 100}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2" data-testid={`metric-context-${metric.id}`}>
                {metric.context}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex items-center" data-testid="tab-patterns">
            <Activity className="w-4 h-4 mr-2" />
            Patterns ({clinicalPatterns.length})
          </TabsTrigger>
          <TabsTrigger value="risks" className="flex items-center" data-testid="tab-risks">
            <Shield className="w-4 h-4 mr-2" />
            Risk Factors ({riskFactors.length})
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center" data-testid="tab-recommendations">
            <Lightbulb className="w-4 h-4 mr-2" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Treatment Effectiveness Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <LineChart className="w-5 h-5 mr-2" />
                  Treatment Effectiveness Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span>Current Period</span>
                    <span className="font-semibold text-green-600">78.2% (+5.4%)</span>
                  </div>
                  <Progress value={78.2} className="h-3" />
                  
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">34</p>
                      <p className="text-xs text-muted-foreground">Improved Cases</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">12</p>
                      <p className="text-xs text-muted-foreground">Stable Cases</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="w-5 h-5 mr-2" />
                  Risk Level Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Low Risk</span>
                    </div>
                    <span className="text-sm font-semibold">42% (18 clients)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm">Moderate Risk</span>
                    </div>
                    <span className="text-sm font-semibold">35% (15 clients)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm">High Risk</span>
                    </div>
                    <span className="text-sm font-semibold">23% (10 clients)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Insights Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="w-5 h-5 mr-2" />
                Weekly Insights Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Treatment Progress</p>
                    <p className="text-sm text-muted-foreground">3 clients showing significant improvement</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Risk Alerts</p>
                    <p className="text-sm text-muted-foreground">2 clients require increased monitoring</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Goal Achievement</p>
                    <p className="text-sm text-muted-foreground">87% of treatment goals on track</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          {clinicalPatterns.map((pattern) => (
            <Card key={pattern.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    {getImpactIcon(pattern.impact)}
                    <span className="ml-2">{pattern.pattern}</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" data-testid={`pattern-frequency-${pattern.id}`}>
                      {pattern.frequency}% frequency
                    </Badge>
                    <Badge variant="secondary" data-testid={`pattern-confidence-${pattern.id}`}>
                      {pattern.confidence}% confidence
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground" data-testid={`pattern-description-${pattern.id}`}>
                  {pattern.description}
                </p>
                
                <div className="flex items-center justify-between text-sm">
                  <span>Affected Clients: {pattern.affectedClients}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    pattern.impact === 'positive' ? 'bg-green-100 text-green-800' :
                    pattern.impact === 'negative' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {pattern.impact} impact
                  </span>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">AI Recommendations:</p>
                  <ul className="space-y-1">
                    {pattern.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start">
                        <span className="mr-2">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" data-testid={`view-pattern-${pattern.id}`}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          {riskFactors.map((risk) => (
            <Card key={risk.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                    {risk.factor}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge className={getRiskLevelColor(risk.riskLevel)} data-testid={`risk-level-${risk.id}`}>
                      {risk.riskLevel} risk
                    </Badge>
                    <Badge variant="outline" data-testid={`risk-prevalence-${risk.id}`}>
                      {risk.prevalence}% prevalence
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground" data-testid={`risk-description-${risk.id}`}>
                  {risk.description}
                </p>

                <div>
                  <p className="text-sm font-medium mb-2">Affected Clients ({risk.affectedClients.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {risk.affectedClients.slice(0, 3).map((clientId) => {
                      const client = clients?.find(c => c.id === clientId);
                      return client ? (
                        <Link key={clientId} href={`/clients/${clientId}`}>
                          <Badge variant="outline" className="hover:bg-muted cursor-pointer" data-testid={`risk-client-${risk.id}-${clientId}`}>
                            <User className="w-3 h-3 mr-1" />
                            {client.firstName} {client.lastName}
                          </Badge>
                        </Link>
                      ) : null;
                    })}
                    {risk.affectedClients.length > 3 && (
                      <Badge variant="outline">
                        +{risk.affectedClients.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Recommended Interventions:</p>
                  <ul className="space-y-1">
                    {risk.interventions.map((intervention, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-start">
                        <span className="mr-2">•</span>
                        <span>{intervention}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" data-testid={`view-risk-${risk.id}`}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Action Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Priority Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Priority Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 border-l-4 border-red-500 bg-red-50 rounded">
                    <p className="font-medium text-sm">High Priority</p>
                    <p className="text-sm text-muted-foreground">Schedule additional sessions for 3 high-risk clients</p>
                    <div className="flex items-center mt-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 mr-1" />
                      Action needed within 48 hours
                    </div>
                  </div>
                  <div className="p-3 border-l-4 border-yellow-500 bg-yellow-50 rounded">
                    <p className="font-medium text-sm">Medium Priority</p>
                    <p className="text-sm text-muted-foreground">Review medication adherence protocols</p>
                    <div className="flex items-center mt-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 mr-1" />
                      Action needed within 1 week
                    </div>
                  </div>
                  <div className="p-3 border-l-4 border-green-500 bg-green-50 rounded">
                    <p className="font-medium text-sm">Low Priority</p>
                    <p className="text-sm text-muted-foreground">Implement group therapy sessions for social isolation</p>
                    <div className="flex items-center mt-2 text-xs text-muted-foreground">
                      <BookOpen className="w-3 h-3 mr-1" />
                      Planning phase
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resource Optimization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  Resource Optimization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                    <div>
                      <p className="font-medium text-sm">Session Scheduling</p>
                      <p className="text-sm text-muted-foreground">Optimize for better outcomes</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">85% efficiency</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                    <div>
                      <p className="font-medium text-sm">Treatment Modalities</p>
                      <p className="text-sm text-muted-foreground">CBT showing best results</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">92% effectiveness</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                    <div>
                      <p className="font-medium text-sm">Assessment Tools</p>
                      <p className="text-sm text-muted-foreground">AI-assisted evaluations</p>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800">89% accuracy</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Suggested Action Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="w-5 h-5 border-2 border-primary rounded mt-0.5"></div>
                  <div className="flex-1">
                    <p className="font-medium">Review high-risk client treatment plans</p>
                    <p className="text-sm text-muted-foreground">AI detected concerning patterns in 3 client cases</p>
                    <div className="flex items-center mt-2 space-x-4 text-sm text-muted-foreground">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Due: Today
                      </span>
                      <span className="flex items-center">
                        <FileText className="w-3 h-3 mr-1" />
                        3 clients
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="w-5 h-5 border-2 border-primary rounded mt-0.5"></div>
                  <div className="flex-1">
                    <p className="font-medium">Update crisis intervention protocols</p>
                    <p className="text-sm text-muted-foreground">Based on recent pattern analysis and best practices</p>
                    <div className="flex items-center mt-2 space-x-4 text-sm text-muted-foreground">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Due: This week
                      </span>
                      <span className="flex items-center">
                        <Shield className="w-3 h-3 mr-1" />
                        Safety protocols
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="w-5 h-5 border-2 border-primary rounded mt-0.5"></div>
                  <div className="flex-1">
                    <p className="font-medium">Schedule team consultation</p>
                    <p className="text-sm text-muted-foreground">Discuss complex cases and treatment coordination</p>
                    <div className="flex items-center mt-2 space-x-4 text-sm text-muted-foreground">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Due: Next week
                      </span>
                      <span className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        Team meeting
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}