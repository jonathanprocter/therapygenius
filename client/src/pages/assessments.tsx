import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Filter, 
  Download, 
  BarChart3, 
  Calendar, 
  User, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Eye, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  ClipboardList,
  Users,
  Activity,
  PlusCircle,
  FileText,
  ArrowUpDown,
  Upload
} from "lucide-react";
import { Link } from "wouter";
import { useClients } from "@/hooks/useClientData";
import { useBulkGenerateClientTags } from "@/hooks/useAITagging";
import { formatDateEastern } from "@/lib/utils";
import type { Assessment } from "@shared/schema";

// Mock assessment data - in a real app this would come from hooks
interface EnhancedAssessment extends Assessment {
  clientName: string;
  trend?: "up" | "down" | "stable";
  riskLevel?: "low" | "moderate" | "high";
  completionPercentage?: number;
}

export default function Assessments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<string>("all");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedAssessments, setSelectedAssessments] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"date" | "type" | "risk" | "client">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: clients, isLoading: clientsLoading } = useClients();
  const bulkGenerateClientTags = useBulkGenerateClientTags();

  // Mock assessments data - in a real app, this would come from API
  const mockAssessments: EnhancedAssessment[] = useMemo(() => {
    if (!clients) return [];
    
    const assessmentTypes = ["PHQ-9", "GAD-7", "PTSD Checklist", "Beck Depression Inventory", "Brief Assessment", "Clinical Interview"];
    const riskLevels = ["low", "moderate", "high"];
    const trends = ["up", "down", "stable"];
    
    return clients.flatMap((client, clientIndex) => 
      Array.from({ length: Math.floor(Math.random() * 4) + 1 }, (_, index) => ({
        id: `${client.id}-assessment-${index}`,
        clientId: client.id,
        therapistId: client.therapistId,
        clientName: `${client.firstName} ${client.lastName}`,
        assessmentType: assessmentTypes[Math.floor(Math.random() * assessmentTypes.length)],
        assessmentDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        scores: {
          total: Math.floor(Math.random() * 30) + 1,
          severity: Math.floor(Math.random() * 4) + 1,
          subscales: {
            anxiety: Math.floor(Math.random() * 15) + 1,
            depression: Math.floor(Math.random() * 15) + 1,
          }
        },
        interpretation: `Based on the scores, the client shows ${riskLevels[Math.floor(Math.random() * riskLevels.length)]} level symptoms.`,
        recommendations: "Continue monitoring. Consider additional interventions if symptoms worsen.",
        riskLevel: riskLevels[Math.floor(Math.random() * riskLevels.length)] as "low" | "moderate" | "high",
        trend: trends[Math.floor(Math.random() * trends.length)] as "up" | "down" | "stable",
        completionPercentage: Math.floor(Math.random() * 30) + 70,
        metadata: {
          sourceDocumentId: `doc-${Math.random().toString(36).substr(2, 9)}`,
          model: "gpt-4",
          confidence: Math.random() * 0.3 + 0.7
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    ).sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime());
  }, [clients]);

  const isLoading = clientsLoading;

  // Filter assessments
  const filteredAssessments = useMemo(() => {
    let filtered = mockAssessments.filter(assessment => {
      const matchesSearch = assessment.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           assessment.assessmentType.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClient = selectedClient === "all" || assessment.clientId === selectedClient;
      const matchesType = selectedAssessmentType === "all" || assessment.assessmentType === selectedAssessmentType;
      const matchesRisk = selectedRiskLevel === "all" || assessment.riskLevel === selectedRiskLevel;
      
      let matchesTimeRange = true;
      if (selectedTimeRange !== "all") {
        const assessmentDate = new Date(assessment.assessmentDate);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - assessmentDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (selectedTimeRange) {
          case "7days":
            matchesTimeRange = daysDiff <= 7;
            break;
          case "30days":
            matchesTimeRange = daysDiff <= 30;
            break;
          case "90days":
            matchesTimeRange = daysDiff <= 90;
            break;
        }
      }
      
      return matchesSearch && matchesClient && matchesType && matchesRisk && matchesTimeRange;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "date":
          comparison = new Date(a.assessmentDate).getTime() - new Date(b.assessmentDate).getTime();
          break;
        case "type":
          comparison = a.assessmentType.localeCompare(b.assessmentType);
          break;
        case "risk":
          const riskOrder = { low: 1, moderate: 2, high: 3 };
          comparison = (riskOrder[a.riskLevel || "low"]) - (riskOrder[b.riskLevel || "low"]);
          break;
        case "client":
          comparison = a.clientName.localeCompare(b.clientName);
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [mockAssessments, searchTerm, selectedClient, selectedAssessmentType, selectedRiskLevel, selectedTimeRange, sortBy, sortOrder]);

  const assessmentTypes = Array.from(new Set(mockAssessments.map(a => a.assessmentType)));
  
  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "low":
        return "bg-green-100 text-green-800";
      case "moderate":
        return "bg-yellow-100 text-yellow-800";
      case "high":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case "stable":
        return <Minus className="w-4 h-4 text-gray-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAssessments(filteredAssessments.map(a => a.id));
    } else {
      setSelectedAssessments([]);
    }
  };

  const handleSelectAssessment = (assessmentId: string, checked: boolean) => {
    if (checked) {
      setSelectedAssessments([...selectedAssessments, assessmentId]);
    } else {
      setSelectedAssessments(selectedAssessments.filter(id => id !== assessmentId));
    }
  };

  const handleBulkGenerateInsights = async () => {
    const clientIds = Array.from(new Set(
      filteredAssessments
        .filter(a => selectedAssessments.includes(a.id))
        .map(a => a.clientId)
    ));
    
    if (clientIds.length > 0) {
      await bulkGenerateClientTags.mutateAsync(clientIds);
      setSelectedAssessments([]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="assessments-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const totalAssessments = mockAssessments.length;
  const highRiskCount = mockAssessments.filter(a => a.riskLevel === "high").length;
  const uniqueClientsWithAssessments = new Set(mockAssessments.map(a => a.clientId)).size;
  const avgCompletionRate = totalAssessments > 0 ? 
    Math.round(mockAssessments.reduce((sum, a) => sum + (a.completionPercentage || 0), 0) / totalAssessments) : 0;

  return (
    <div className="space-y-6" data-testid="assessments-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="assessments-title">Client Assessments</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive assessment management and analytics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" data-testid="upload-assessments">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <Button variant="outline" data-testid="refresh-assessments">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button data-testid="new-assessment">
            <PlusCircle className="w-4 h-4 mr-2" />
            New Assessment
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Assessments</p>
                <p className="text-2xl font-bold" data-testid="total-assessments">{totalAssessments}</p>
              </div>
              <ClipboardList className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Risk Clients</p>
                <p className="text-2xl font-bold text-red-600" data-testid="high-risk-count">{highRiskCount}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clients Assessed</p>
                <p className="text-2xl font-bold" data-testid="assessed-clients">{uniqueClientsWithAssessments}</p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Completion</p>
                <p className="text-2xl font-bold" data-testid="avg-completion">{avgCompletionRate}%</p>
              </div>
              <Activity className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search assessments by client name or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-assessments"
              />
            </div>

            {/* Client Filter */}
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-48" data-testid="filter-client">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.firstName} {client.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Assessment Type Filter */}
            <Select value={selectedAssessmentType} onValueChange={setSelectedAssessmentType}>
              <SelectTrigger className="w-48" data-testid="filter-assessment-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {assessmentTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Risk Level Filter */}
            <Select value={selectedRiskLevel} onValueChange={setSelectedRiskLevel}>
              <SelectTrigger className="w-40" data-testid="filter-risk-level">
                <SelectValue placeholder="All Risk Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="moderate">Moderate Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
              </SelectContent>
            </Select>

            {/* Time Range Filter */}
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-40" data-testid="filter-time-range">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="90days">Last 90 days</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as "grid" | "list")}>
              <ToggleGroupItem value="grid" data-testid="view-grid">
                <BarChart3 className="w-4 h-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" data-testid="view-list">
                <FileText className="w-4 h-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Sorting and Bulk Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedAssessments.length === filteredAssessments.length && filteredAssessments.length > 0}
                  onCheckedChange={handleSelectAll}
                  data-testid="select-all-assessments"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedAssessments.length > 0 ? `${selectedAssessments.length} selected` : "Select all"}
                </span>
              </div>
              
              {selectedAssessments.length > 0 && (
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleBulkGenerateInsights}
                    disabled={bulkGenerateClientTags.isPending}
                    data-testid="bulk-generate-insights"
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Generate Insights
                  </Button>
                  <Button variant="outline" size="sm" data-testid="bulk-export">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="w-32" data-testid="sort-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="risk">Risk Level</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                data-testid="sort-order"
              >
                <ArrowUpDown className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {filteredAssessments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <ClipboardList className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Assessments Found</h3>
            <p className="text-muted-foreground mb-4">
              {totalAssessments === 0 
                ? "No assessments have been completed yet. Start by creating your first client assessment."
                : "No assessments match your current filters. Try adjusting your search criteria."
              }
            </p>
            <Button data-testid="create-first-assessment">
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Assessment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="assessments-count">
              Showing {filteredAssessments.length} of {totalAssessments} assessments
            </p>
          </div>

          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssessments.map((assessment) => (
                <Card key={assessment.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedAssessments.includes(assessment.id)}
                          onCheckedChange={(checked) => handleSelectAssessment(assessment.id, checked as boolean)}
                          data-testid={`select-${assessment.id}`}
                        />
                        <CardTitle className="text-lg truncate">{assessment.assessmentType}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(assessment.trend || "stable")}
                        <Badge className={getRiskLevelColor(assessment.riskLevel || "low")} data-testid={`risk-${assessment.id}`}>
                          {assessment.riskLevel}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                        <User className="w-4 h-4 mr-1" />
                        <Link href={`/clients/${assessment.clientId}`}>
                          <span className="hover:text-primary cursor-pointer" data-testid={`client-${assessment.id}`}>
                            {assessment.clientName}
                          </span>
                        </Link>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-1" />
                        <span data-testid={`date-${assessment.id}`}>
                          {formatDateEastern(assessment.assessmentDate.toISOString())}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Score: {assessment.scores?.total}</span>
                        <span className="text-sm text-muted-foreground">{assessment.completionPercentage}% complete</span>
                      </div>
                      <Progress value={assessment.completionPercentage || 0} className="h-2" />
                    </div>

                    {assessment.interpretation && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {assessment.interpretation}
                      </p>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        AI Confidence: {Math.round((assessment.metadata?.confidence || 0) * 100)}%
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" data-testid={`view-${assessment.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" data-testid={`download-${assessment.id}`}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Assessments List</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredAssessments.map((assessment) => (
                    <div key={assessment.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Checkbox
                            checked={selectedAssessments.includes(assessment.id)}
                            onCheckedChange={(checked) => handleSelectAssessment(assessment.id, checked as boolean)}
                            data-testid={`list-select-${assessment.id}`}
                          />
                          <div>
                            <h3 className="font-medium" data-testid={`list-title-${assessment.id}`}>
                              {assessment.assessmentType}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              <Link href={`/clients/${assessment.clientId}`}>
                                <span className="hover:text-primary cursor-pointer">
                                  {assessment.clientName}
                                </span>
                              </Link>
                              {" • "}
                              {formatDateEastern(assessment.assessmentDate.toISOString())}
                              {" • "}
                              Score: {assessment.scores?.total}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          {getTrendIcon(assessment.trend || "stable")}
                          <Badge className={getRiskLevelColor(assessment.riskLevel || "low")}>
                            {assessment.riskLevel}
                          </Badge>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" data-testid={`list-view-${assessment.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" data-testid={`list-download-${assessment.id}`}>
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}