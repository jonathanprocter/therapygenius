import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Search, 
  Filter, 
  Download, 
  FileText, 
  Calendar, 
  User, 
  TrendingUp, 
  BarChart3, 
  Eye, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  FileBarChart,
  Users,
  Brain,
  Activity
} from "lucide-react";
import { Link } from "wouter";
import { useClients } from "@/hooks/useClientData";
import { useAllClientReports, useGenerateClientReport } from "@/hooks/useAITagging";
import { formatDateEastern } from "@/lib/utils";

interface Report {
  id: string;
  clientId: string;
  clientName: string;
  reportType: string;
  generatedAt: string;
  status: "generated" | "pending" | "failed";
  insights: any;
  recommendations: string[];
  keyFindings: string[];
}

export default function Reports() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedReportType, setSelectedReportType] = useState<string>("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: clients, isLoading: clientsLoading } = useClients();

  // Get all client reports data using the new aggregated hook
  const clientIds = clients?.map(c => c.id) || [];
  const { data: allReportsData, isLoading: reportsLoading, hasError: reportsHasError } = useAllClientReports(clientIds);

  const allReports: Report[] = useMemo(() => {
    const reports: Report[] = [];
    
    // Process data from the new useAllClientReports hook
    if (allReportsData) {
      allReportsData.forEach((clientReportData) => {
        const { clientId, reports: clientReports } = clientReportData;
        if (clientReports && clientReports.length > 0) {
          const client = clients?.find(c => c.id === clientId);
          const clientName = client ? `${client.firstName} ${client.lastName}` : "Unknown Client";
          
          clientReports.forEach((report: any) => {
            reports.push({
              id: report.id || `${clientId}-${Date.now()}`,
              clientId,
              clientName,
              reportType: report.reportType || "Comprehensive Report",
              generatedAt: report.generatedAt || new Date().toISOString(),
              status: report.status || "generated",
              insights: report.insights || {},
              recommendations: report.recommendations || [],
              keyFindings: report.keyFindings || [],
            });
          });
        }
      });
    }
    
    return reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }, [allReportsData, clients]);

  const isLoading = clientsLoading || reportsLoading;

  // Filter reports
  const filteredReports = useMemo(() => {
    return allReports.filter(report => {
      const matchesSearch = report.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           report.reportType.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClient = selectedClient === "all" || report.clientId === selectedClient;
      const matchesType = selectedReportType === "all" || report.reportType === selectedReportType;
      
      let matchesTimeRange = true;
      if (selectedTimeRange !== "all") {
        const reportDate = new Date(report.generatedAt);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24));
        
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
      
      return matchesSearch && matchesClient && matchesType && matchesTimeRange;
    });
  }, [allReports, searchTerm, selectedClient, selectedReportType, selectedTimeRange]);

  const reportTypes = Array.from(new Set(allReports.map(r => r.reportType)));
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "generated":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
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
      case "generated":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="reports-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="reports-title">Client Reports</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive AI-generated clinical reports and analytics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" data-testid="refresh-reports">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button data-testid="generate-new-report">
            <FileBarChart className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
                <p className="text-2xl font-bold" data-testid="total-reports">{allReports.length}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Generated Reports</p>
                <p className="text-2xl font-bold" data-testid="generated-reports">
                  {allReports.filter(r => r.status === "generated").length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clients Analyzed</p>
                <p className="text-2xl font-bold" data-testid="analyzed-clients">
                  {new Set(allReports.map(r => r.clientId)).size}
                </p>
              </div>
              <Users className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Insights</p>
                <p className="text-2xl font-bold" data-testid="avg-insights">
                  {allReports.length > 0 ? Math.round(allReports.reduce((sum, r) => sum + (r.keyFindings?.length || 0), 0) / allReports.length) : 0}
                </p>
              </div>
              <Brain className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search reports by client name or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-reports"
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

            {/* Report Type Filter */}
            <Select value={selectedReportType} onValueChange={setSelectedReportType}>
              <SelectTrigger className="w-48" data-testid="filter-report-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {reportTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
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
        </CardContent>
      </Card>

      {/* Results */}
      {filteredReports.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Reports Found</h3>
            <p className="text-muted-foreground mb-4">
              {allReports.length === 0 
                ? "No reports have been generated yet. Create your first client report to get started."
                : "No reports match your current filters. Try adjusting your search criteria."
              }
            </p>
            <Button data-testid="generate-first-report">
              <FileBarChart className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="reports-count">
              Showing {filteredReports.length} of {allReports.length} reports
            </p>
          </div>

          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReports.map((report) => (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center">
                        {getStatusIcon(report.status)}
                        <span className="ml-2 truncate">{report.reportType}</span>
                      </CardTitle>
                      <Badge className={getStatusColor(report.status)} data-testid={`status-${report.id}`}>
                        {report.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                        <User className="w-4 h-4 mr-1" />
                        <Link href={`/clients/${report.clientId}`}>
                          <span className="hover:text-primary cursor-pointer" data-testid={`client-${report.id}`}>
                            {report.clientName}
                          </span>
                        </Link>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-1" />
                        <span data-testid={`date-${report.id}`}>
                          {formatDateEastern(report.generatedAt)}
                        </span>
                      </div>
                    </div>

                    {report.keyFindings && report.keyFindings.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Key Findings</p>
                        <div className="space-y-1">
                          {report.keyFindings.slice(0, 2).map((finding, index) => (
                            <p key={index} className="text-xs text-muted-foreground">
                              • {finding.length > 60 ? `${finding.substring(0, 60)}...` : finding}
                            </p>
                          ))}
                          {report.keyFindings.length > 2 && (
                            <p className="text-xs text-muted-foreground">
                              +{report.keyFindings.length - 2} more findings
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        <span>{report.recommendations?.length || 0} recommendations</span>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" data-testid={`view-${report.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" data-testid={`download-${report.id}`}>
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
                <CardTitle>Reports List</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredReports.map((report) => (
                    <div key={report.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {getStatusIcon(report.status)}
                          <div>
                            <h3 className="font-medium" data-testid={`list-title-${report.id}`}>
                              {report.reportType}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              <Link href={`/clients/${report.clientId}`}>
                                <span className="hover:text-primary cursor-pointer">
                                  {report.clientName}
                                </span>
                              </Link>
                              {" • "}
                              {formatDateEastern(report.generatedAt)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <Badge className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <TrendingUp className="w-4 h-4 mr-1" />
                            <span>{report.recommendations?.length || 0} recommendations</span>
                          </div>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" data-testid={`list-view-${report.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" data-testid={`list-download-${report.id}`}>
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