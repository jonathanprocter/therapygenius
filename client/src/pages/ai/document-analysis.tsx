import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Upload, 
  FileText, 
  Brain, 
  Eye, 
  Download, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  User, 
  Calendar, 
  BarChart3, 
  Target, 
  Zap, 
  FileCheck, 
  FileX, 
  Loader2,
  Plus,
  Filter,
  Search,
  Database,
  ClipboardList,
  TrendingUp,
  Activity,
  AlertTriangle
} from "lucide-react";
import { Link } from "wouter";
import { useClients } from "@/hooks/useClientData";
import { useDocuments } from "@/hooks/useDocuments";
import { useGenerateDocumentAssessments } from "@/hooks/useAITagging";
import { formatDateEastern } from "@/lib/utils";

interface DocumentAnalysis {
  id: string;
  documentId: string;
  fileName: string;
  clientId?: string;
  clientName?: string;
  analysisType: "assessment_extraction" | "content_analysis" | "risk_assessment" | "progress_tracking";
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  results?: {
    assessments?: any[];
    insights?: string[];
    risks?: string[];
    recommendations?: string[];
    confidence?: number;
  };
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface BulkAnalysisJob {
  id: string;
  name: string;
  documentCount: number;
  completedCount: number;
  analysisType: string;
  status: "running" | "completed" | "failed";
  createdAt: string;
}

export default function AIDocumentAnalysis() {
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [analysisType, setAnalysisType] = useState<string>("assessment_extraction");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("upload");
  const [bulkJobs, setBulkJobs] = useState<BulkAnalysisJob[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: documents, isLoading: documentsLoading } = useDocuments();
  const generateDocAssessments = useGenerateDocumentAssessments("dummy-doc-id");

  // Mock document analyses
  const documentAnalyses: DocumentAnalysis[] = useMemo(() => {
    if (!documents) return [];
    
    return documents.slice(0, 8).map((doc, index) => {
      const client = clients?.find(c => c.id === doc.clientId);
      const statuses: DocumentAnalysis['status'][] = ['completed', 'processing', 'pending', 'failed'];
      const analysisTypes: DocumentAnalysis['analysisType'][] = ['assessment_extraction', 'content_analysis', 'risk_assessment', 'progress_tracking'];
      const status = statuses[index % statuses.length];
      
      return {
        id: `analysis-${doc.id}`,
        documentId: doc.id,
        fileName: doc.fileName,
        clientId: doc.clientId || undefined,
        clientName: client ? `${client.firstName} ${client.lastName}` : undefined,
        analysisType: analysisTypes[index % analysisTypes.length],
        status,
        progress: status === 'completed' ? 100 : status === 'processing' ? Math.random() * 80 + 10 : status === 'failed' ? 0 : 0,
        results: status === 'completed' ? {
          assessments: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, i) => ({
            type: 'PHQ-9',
            score: Math.floor(Math.random() * 20) + 1,
            date: new Date().toISOString()
          })),
          insights: [
            'Patient shows signs of improvement in mood regulation',
            'Anxiety levels have decreased since last assessment',
            'Sleep patterns showing gradual improvement'
          ].slice(0, Math.floor(Math.random() * 3) + 1),
          risks: index % 3 === 0 ? ['Moderate risk for social isolation'] : [],
          recommendations: [
            'Continue current treatment protocol',
            'Schedule follow-up assessment in 2 weeks',
            'Consider adjunct therapy options'
          ].slice(0, Math.floor(Math.random() * 3) + 1),
          confidence: Math.random() * 0.3 + 0.7
        } : undefined,
        startedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        completedAt: status === 'completed' ? new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        error: status === 'failed' ? 'Document format not supported for analysis' : undefined
      };
    });
  }, [documents, clients]);

  // Filter analyses
  const filteredAnalyses = useMemo(() => {
    return documentAnalyses.filter(analysis => {
      const matchesSearch = analysis.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (analysis.clientName && analysis.clientName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesClient = selectedClient === "all" || analysis.clientId === selectedClient;
      return matchesSearch && matchesClient;
    });
  }, [documentAnalyses, searchTerm, selectedClient]);

  const handleSelectDocument = (documentId: string, checked: boolean) => {
    if (checked) {
      setSelectedDocuments([...selectedDocuments, documentId]);
    } else {
      setSelectedDocuments(selectedDocuments.filter(id => id !== documentId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const availableDocs = documents?.filter(doc => !documentAnalyses.some(a => a.documentId === doc.id)) || [];
      setSelectedDocuments(availableDocs.map(doc => doc.id));
    } else {
      setSelectedDocuments([]);
    }
  };

  const handleBulkAnalysis = async () => {
    if (selectedDocuments.length === 0) return;
    
    setIsAnalyzing(true);
    
    // Create new bulk job
    const newJob: BulkAnalysisJob = {
      id: `job-${Date.now()}`,
      name: `${analysisType.replace('_', ' ')} - ${selectedDocuments.length} documents`,
      documentCount: selectedDocuments.length,
      completedCount: 0,
      analysisType,
      status: "running",
      createdAt: new Date().toISOString()
    };
    
    setBulkJobs(prev => [newJob, ...prev]);
    
    // Simulate processing
    for (let i = 0; i < selectedDocuments.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setBulkJobs(prev => prev.map(job => 
        job.id === newJob.id 
          ? { ...job, completedCount: i + 1 }
          : job
      ));
    }
    
    // Mark as completed
    setBulkJobs(prev => prev.map(job => 
      job.id === newJob.id 
        ? { ...job, status: "completed" as const }
        : job
    ));
    
    setSelectedDocuments([]);
    setIsAnalyzing(false);
    setActiveTab("results");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getAnalysisTypeLabel = (type: string) => {
    switch (type) {
      case "assessment_extraction":
        return "Assessment Extraction";
      case "content_analysis":
        return "Content Analysis";
      case "risk_assessment":
        return "Risk Assessment";
      case "progress_tracking":
        return "Progress Tracking";
      default:
        return type;
    }
  };

  const isLoading = clientsLoading || documentsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="document-analysis-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const totalAnalyses = documentAnalyses.length;
  const completedAnalyses = documentAnalyses.filter(a => a.status === 'completed').length;
  const failedAnalyses = documentAnalyses.filter(a => a.status === 'failed').length;
  const processingAnalyses = documentAnalyses.filter(a => a.status === 'processing').length;

  return (
    <div className="space-y-6" data-testid="document-analysis-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center" data-testid="document-analysis-title">
            <Brain className="w-6 h-6 mr-2 text-primary" />
            AI Document Analysis
          </h1>
          <p className="text-sm text-muted-foreground">
            Bulk document processing with AI-powered assessment extraction and analysis
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" data-testid="refresh-analyses">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Analyses</p>
                <p className="text-2xl font-bold" data-testid="total-analyses">{totalAnalyses}</p>
              </div>
              <Database className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600" data-testid="completed-analyses">{completedAnalyses}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="processing-analyses">{processingAnalyses}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600" data-testid="failed-analyses">{failedAnalyses}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center" data-testid="tab-upload">
            <Upload className="w-4 h-4 mr-2" />
            Bulk Analysis
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center" data-testid="tab-results">
            <BarChart3 className="w-4 h-4 mr-2" />
            Results ({totalAnalyses})
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center" data-testid="tab-jobs">
            <Clock className="w-4 h-4 mr-2" />
            Jobs ({bulkJobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          {/* Analysis Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="w-5 h-5 mr-2" />
                Analysis Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Analysis Type</label>
                  <Select value={analysisType} onValueChange={setAnalysisType}>
                    <SelectTrigger data-testid="analysis-type-selector">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assessment_extraction">Assessment Extraction</SelectItem>
                      <SelectItem value="content_analysis">Content Analysis</SelectItem>
                      <SelectItem value="risk_assessment">Risk Assessment</SelectItem>
                      <SelectItem value="progress_tracking">Progress Tracking</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose the type of AI analysis to perform on selected documents
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Client Filter</label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger data-testid="client-filter">
                      <SelectValue />
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
                </div>
              </div>

              {selectedDocuments.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {selectedDocuments.length} document(s) selected for {getAnalysisTypeLabel(analysisType).toLowerCase()}.
                    Estimated processing time: {selectedDocuments.length * 2} minutes.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Document Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Document Selection
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedDocuments.length === (documents?.filter(doc => !documentAnalyses.some(a => a.documentId === doc.id)).length || 0) && selectedDocuments.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="select-all-documents"
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all available ({selectedDocuments.length} selected)
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {documents?.filter(doc => !documentAnalyses.some(a => a.documentId === doc.id)).map((doc) => {
                  const client = clients?.find(c => c.id === doc.clientId);
                  const isSelected = selectedDocuments.includes(doc.id);
                  
                  return (
                    <div key={doc.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectDocument(doc.id, checked as boolean)}
                        data-testid={`select-document-${doc.id}`}
                      />
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          {client ? `${client.firstName} ${client.lastName}` : "Unassigned"} • 
                          {formatDateEastern(doc.uploadDate)} • 
                          {doc.fileType}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {doc.isProcessed ? "Processed" : "Unprocessed"}
                      </Badge>
                    </div>
                  );
                })}
                
                {documents?.filter(doc => !documentAnalyses.some(a => a.documentId === doc.id)).length === 0 && (
                  <div className="text-center py-8">
                    <FileX className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No Documents Available</h3>
                    <p className="text-sm text-muted-foreground">
                      All documents have already been analyzed or no documents are available for analysis.
                    </p>
                  </div>
                )}
              </div>

              {selectedDocuments.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <Button 
                    onClick={handleBulkAnalysis} 
                    disabled={isAnalyzing}
                    className="w-full"
                    data-testid="start-bulk-analysis"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing {selectedDocuments.length} documents...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Start Bulk Analysis ({selectedDocuments.length} documents)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by document name or client..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="search-analyses"
                  />
                </div>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="w-48" data-testid="filter-analyses-client">
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
              </div>
            </CardContent>
          </Card>

          {/* Analysis Results */}
          {filteredAnalyses.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Analysis Results</h3>
                <p className="text-muted-foreground mb-4">
                  Start by selecting documents and running a bulk analysis to see results here.
                </p>
                <Button onClick={() => setActiveTab("upload")} data-testid="start-first-analysis">
                  <Plus className="w-4 h-4 mr-2" />
                  Start Analysis
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredAnalyses.map((analysis) => (
                <Card key={analysis.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          {getStatusIcon(analysis.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold truncate" data-testid={`analysis-title-${analysis.id}`}>
                              {analysis.fileName}
                            </h3>
                            <Badge className={getStatusColor(analysis.status)} data-testid={`analysis-status-${analysis.id}`}>
                              {analysis.status}
                            </Badge>
                            <Badge variant="outline">
                              {getAnalysisTypeLabel(analysis.analysisType)}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                            {analysis.clientName && (
                              <div className="flex items-center">
                                <User className="w-3 h-3 mr-1" />
                                <Link href={`/clients/${analysis.clientId}`}>
                                  <span className="hover:text-primary cursor-pointer">
                                    {analysis.clientName}
                                  </span>
                                </Link>
                              </div>
                            )}
                            <div className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              <span>Started {formatDateEastern(analysis.startedAt)}</span>
                            </div>
                            {analysis.completedAt && (
                              <div className="flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                <span>Completed {formatDateEastern(analysis.completedAt)}</span>
                              </div>
                            )}
                          </div>

                          {/* Progress Bar */}
                          {analysis.status === 'processing' && (
                            <div className="mb-3">
                              <div className="flex justify-between text-sm mb-1">
                                <span>Processing...</span>
                                <span>{Math.round(analysis.progress)}%</span>
                              </div>
                              <Progress value={analysis.progress} className="h-2" />
                            </div>
                          )}

                          {/* Results Summary */}
                          {analysis.results && (
                            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center">
                                <div className="text-lg font-semibold text-blue-600">
                                  {analysis.results.assessments?.length || 0}
                                </div>
                                <div className="text-xs text-muted-foreground">Assessments</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-green-600">
                                  {analysis.results.insights?.length || 0}
                                </div>
                                <div className="text-xs text-muted-foreground">Insights</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-orange-600">
                                  {analysis.results.risks?.length || 0}
                                </div>
                                <div className="text-xs text-muted-foreground">Risk Factors</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-purple-600">
                                  {Math.round((analysis.results.confidence || 0) * 100)}%
                                </div>
                                <div className="text-xs text-muted-foreground">Confidence</div>
                              </div>
                            </div>
                          )}

                          {/* Error Message */}
                          {analysis.error && (
                            <Alert className="mt-3">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{analysis.error}</AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                        <Button variant="outline" size="sm" data-testid={`view-analysis-${analysis.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {analysis.status === 'completed' && (
                          <Button variant="outline" size="sm" data-testid={`download-analysis-${analysis.id}`}>
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="outline" size="sm" data-testid={`delete-analysis-${analysis.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          {bulkJobs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Bulk Jobs</h3>
                <p className="text-muted-foreground mb-4">
                  Bulk analysis jobs will appear here once you start processing documents.
                </p>
                <Button onClick={() => setActiveTab("upload")} data-testid="start-bulk-job">
                  <Plus className="w-4 h-4 mr-2" />
                  Start Bulk Analysis
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {bulkJobs.map((job) => (
                <Card key={job.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {job.status === 'running' ? (
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                          ) : job.status === 'completed' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold" data-testid={`job-name-${job.id}`}>
                            {job.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Created {formatDateEastern(job.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className="text-lg font-semibold" data-testid={`job-progress-${job.id}`}>
                            {job.completedCount} / {job.documentCount}
                          </div>
                          <div className="text-sm text-muted-foreground">documents</div>
                        </div>
                        
                        <Badge className={getStatusColor(job.status)} data-testid={`job-status-${job.id}`}>
                          {job.status}
                        </Badge>
                      </div>
                    </div>

                    {job.status === 'running' && (
                      <div className="mt-4">
                        <Progress 
                          value={(job.completedCount / job.documentCount) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}