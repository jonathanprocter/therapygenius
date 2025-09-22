import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Filter, 
  Brain, 
  User, 
  FileText, 
  Calendar, 
  ClipboardList, 
  Sparkles, 
  Clock, 
  Eye, 
  Tag, 
  Target, 
  TrendingUp,
  Users,
  Files,
  BookOpen,
  Activity,
  Lightbulb,
  Database,
  ArrowRight,
  X
} from "lucide-react";
import { Link } from "wouter";
import { useClients } from "@/hooks/useClientData";
import { useDocuments } from "@/hooks/useDocuments";
import { 
  useSearchSessionsByTags,
  useSearchClientsByTags,
  useClinicalInsightsSummary
} from "@/hooks/useAITagging";
import { formatDateEastern } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "client" | "document" | "session" | "assessment";
  title: string;
  description: string;
  relevanceScore: number;
  highlights: string[];
  metadata: any;
  aiSuggested?: boolean;
}

interface SearchSuggestion {
  query: string;
  category: string;
  reasoning: string;
  confidence: number;
}

export default function AISmartSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["all"]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("results");
  const [searchFilters, setSearchFilters] = useState({
    timeRange: "all",
    riskLevel: "all",
    clientStatus: "all"
  });

  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: documents, isLoading: documentsLoading } = useDocuments();
  const { data: clinicalSummary } = useClinicalInsightsSummary();

  // Mock AI suggestions
  const aiSuggestions: SearchSuggestion[] = [
    {
      query: "high risk clients with recent assessments",
      category: "Risk Assessment",
      reasoning: "Based on clinical patterns, you may want to review high-risk clients",
      confidence: 0.92
    },
    {
      query: "anxiety treatment outcomes last 30 days",
      category: "Treatment Progress",
      reasoning: "Trending topic based on recent session notes and assessments",
      confidence: 0.87
    },
    {
      query: "clients with incomplete treatment plans",
      category: "Care Management",
      reasoning: "Administrative pattern detected - may need attention",
      confidence: 0.81
    },
    {
      query: "PTSD assessments showing improvement",
      category: "Positive Outcomes",
      reasoning: "Success patterns identified for case study opportunities",
      confidence: 0.78
    }
  ];

  // Simulate AI-powered search
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setActiveSearchQuery("");
      return;
    }

    setIsSearching(true);
    setActiveSearchQuery(query);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock search results
    const mockResults: SearchResult[] = [];

    // Client results
    if (clients && (selectedCategories.includes("all") || selectedCategories.includes("clients"))) {
      const clientResults = clients
        .filter(client => 
          `${client.firstName} ${client.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
          (client.email && client.email.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 3)
        .map(client => ({
          id: `client-${client.id}`,
          type: "client" as const,
          title: `${client.firstName} ${client.lastName}`,
          description: `Client • ${client.email || "No email"} • Created ${formatDateEastern(client.createdAt)}`,
          relevanceScore: Math.random() * 0.3 + 0.7,
          highlights: [`${client.firstName} ${client.lastName}`],
          metadata: { clientId: client.id, ...client },
          aiSuggested: Math.random() > 0.6
        }));
      mockResults.push(...clientResults);
    }

    // Document results
    if (documents && (selectedCategories.includes("all") || selectedCategories.includes("documents"))) {
      const docResults = documents
        .filter(doc => 
          doc.fileName.toLowerCase().includes(query.toLowerCase()) ||
          (doc.content && doc.content.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 4)
        .map(doc => ({
          id: `document-${doc.id}`,
          type: "document" as const,
          title: doc.fileName,
          description: `Document • ${doc.fileType} • Uploaded ${formatDateEastern(doc.uploadDate)}`,
          relevanceScore: Math.random() * 0.3 + 0.6,
          highlights: [doc.fileName],
          metadata: { documentId: doc.id, ...doc },
          aiSuggested: Math.random() > 0.7
        }));
      mockResults.push(...docResults);
    }

    // Mock session and assessment results
    if (selectedCategories.includes("all") || selectedCategories.includes("sessions")) {
      for (let i = 0; i < 3; i++) {
        const client = clients?.[Math.floor(Math.random() * (clients?.length || 1))];
        if (client) {
          mockResults.push({
            id: `session-${i}`,
            type: "session" as const,
            title: `Session with ${client.firstName} ${client.lastName}`,
            description: `Session Note • ${formatDateEastern(new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString())} • Individual Therapy`,
            relevanceScore: Math.random() * 0.3 + 0.5,
            highlights: [`Session with ${client.firstName} ${client.lastName}`],
            metadata: { clientId: client.id, sessionType: "individual" },
            aiSuggested: Math.random() > 0.8
          });
        }
      }
    }

    if (selectedCategories.includes("all") || selectedCategories.includes("assessments")) {
      const assessmentTypes = ["PHQ-9", "GAD-7", "PTSD Checklist", "Beck Depression Inventory"];
      for (let i = 0; i < 2; i++) {
        const client = clients?.[Math.floor(Math.random() * (clients?.length || 1))];
        const assessmentType = assessmentTypes[Math.floor(Math.random() * assessmentTypes.length)];
        if (client) {
          mockResults.push({
            id: `assessment-${i}`,
            type: "assessment" as const,
            title: `${assessmentType} Assessment`,
            description: `Assessment • ${client.firstName} ${client.lastName} • ${formatDateEastern(new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString())}`,
            relevanceScore: Math.random() * 0.3 + 0.6,
            highlights: [assessmentType, `${client.firstName} ${client.lastName}`],
            metadata: { clientId: client.id, assessmentType },
            aiSuggested: Math.random() > 0.7
          });
        }
      }
    }

    // Sort by relevance and AI suggestions
    mockResults.sort((a, b) => {
      if (a.aiSuggested && !b.aiSuggested) return -1;
      if (!a.aiSuggested && b.aiSuggested) return 1;
      return b.relevanceScore - a.relevanceScore;
    });

    setSearchResults(mockResults);
    setIsSearching(false);
  };

  const handleSearch = () => {
    performSearch(searchQuery);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setSearchQuery(suggestion.query);
    performSearch(suggestion.query);
    setActiveTab("results");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case "client":
        return <User className="w-5 h-5 text-blue-600" />;
      case "document":
        return <FileText className="w-5 h-5 text-green-600" />;
      case "session":
        return <Calendar className="w-5 h-5 text-purple-600" />;
      case "assessment":
        return <ClipboardList className="w-5 h-5 text-orange-600" />;
      default:
        return <Search className="w-5 h-5 text-gray-600" />;
    }
  };

  const getResultLink = (result: SearchResult) => {
    switch (result.type) {
      case "client":
        return `/clients/${result.metadata.clientId}`;
      case "document":
        return `/documents?id=${result.metadata.documentId}`;
      case "session":
        return `/clients/${result.metadata.clientId}`;
      case "assessment":
        return `/clients/${result.metadata.clientId}`;
      default:
        return "#";
    }
  };

  const isLoading = clientsLoading || documentsLoading;

  useEffect(() => {
    setSuggestions(aiSuggestions);
  }, []);

  return (
    <div className="space-y-6" data-testid="ai-smart-search-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center" data-testid="smart-search-title">
            <Brain className="w-6 h-6 mr-2 text-primary" />
            AI Smart Search
          </h1>
          <p className="text-sm text-muted-foreground">
            Intelligent search across all clinical data with AI-powered suggestions
          </p>
        </div>
      </div>

      {/* Search Interface */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Main Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search clients, documents, sessions, assessments... (e.g., 'high risk clients with recent assessments')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-12 pr-20 h-12 text-lg"
                data-testid="smart-search-input"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <Button onClick={handleSearch} disabled={isSearching} data-testid="smart-search-button">
                  {isSearching ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Search Categories */}
            <div className="flex flex-wrap gap-2">
              <ToggleGroup 
                type="multiple" 
                value={selectedCategories} 
                onValueChange={setSelectedCategories}
                className="flex-wrap"
              >
                <ToggleGroupItem value="all" data-testid="category-all">
                  <Database className="w-4 h-4 mr-2" />
                  All
                </ToggleGroupItem>
                <ToggleGroupItem value="clients" data-testid="category-clients">
                  <Users className="w-4 h-4 mr-2" />
                  Clients
                </ToggleGroupItem>
                <ToggleGroupItem value="documents" data-testid="category-documents">
                  <Files className="w-4 h-4 mr-2" />
                  Documents
                </ToggleGroupItem>
                <ToggleGroupItem value="sessions" data-testid="category-sessions">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Sessions
                </ToggleGroupItem>
                <ToggleGroupItem value="assessments" data-testid="category-assessments">
                  <Activity className="w-4 h-4 mr-2" />
                  Assessments
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Search Filters */}
            <div className="flex flex-wrap gap-4">
              <Select value={searchFilters.timeRange} onValueChange={(value) => setSearchFilters({...searchFilters, timeRange: value})}>
                <SelectTrigger className="w-40" data-testid="filter-time-range">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="90days">Last 90 days</SelectItem>
                  <SelectItem value="1year">Last year</SelectItem>
                </SelectContent>
              </Select>

              <Select value={searchFilters.riskLevel} onValueChange={(value) => setSearchFilters({...searchFilters, riskLevel: value})}>
                <SelectTrigger className="w-40" data-testid="filter-risk-level">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                  <SelectItem value="moderate">Moderate Risk</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                </SelectContent>
              </Select>

              <Select value={searchFilters.clientStatus} onValueChange={(value) => setSearchFilters({...searchFilters, clientStatus: value})}>
                <SelectTrigger className="w-40" data-testid="filter-client-status">
                  <SelectValue placeholder="Client Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results and Suggestions */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="suggestions" className="flex items-center" data-testid="tab-suggestions">
            <Lightbulb className="w-4 h-4 mr-2" />
            AI Suggestions ({suggestions.length})
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center" data-testid="tab-results">
            <Search className="w-4 h-4 mr-2" />
            Search Results ({searchResults.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-4">
          {suggestions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Lightbulb className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No AI Suggestions Available</h3>
                <p className="text-muted-foreground">
                  AI suggestions will appear here based on your clinical data patterns and workflow.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {suggestions.map((suggestion, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSuggestionClick(suggestion)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center">
                        <Sparkles className="w-5 h-5 mr-2 text-primary" />
                        {suggestion.category}
                      </CardTitle>
                      <Badge variant="secondary" data-testid={`suggestion-confidence-${index}`}>
                        {Math.round(suggestion.confidence * 100)}% match
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-muted/50 rounded-md">
                      <p className="font-medium text-primary" data-testid={`suggestion-query-${index}`}>
                        "{suggestion.query}"
                      </p>
                    </div>
                    
                    <p className="text-sm text-muted-foreground" data-testid={`suggestion-reasoning-${index}`}>
                      {suggestion.reasoning}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        AI Confidence: {Math.round(suggestion.confidence * 100)}%
                      </div>
                      <Button variant="outline" size="sm" data-testid={`suggestion-search-${index}`}>
                        <Search className="w-4 h-4 mr-2" />
                        Search
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {/* Search Status */}
          {activeSearchQuery && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {isSearching ? "Searching..." : `Results for "${activeSearchQuery}"`}
                    </span>
                  </div>
                  {activeSearchQuery && !isSearching && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSearchQuery("");
                        setActiveSearchQuery("");
                        setSearchResults([]);
                      }}
                      data-testid="clear-search"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {isSearching && (
                  <Progress value={75} className="mt-2" />
                )}
              </CardContent>
            </Card>
          )}

          {/* Search Results */}
          {!activeSearchQuery && !isSearching ? (
            <Card>
              <CardContent className="text-center py-12">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Start Your Search</h3>
                <p className="text-muted-foreground mb-4">
                  Enter your search query above or try one of the AI suggestions to find relevant clinical information.
                </p>
                <Button variant="outline" onClick={() => setActiveTab("suggestions")} data-testid="view-suggestions">
                  <Lightbulb className="w-4 h-4 mr-2" />
                  View AI Suggestions
                </Button>
              </CardContent>
            </Card>
          ) : searchResults.length === 0 && !isSearching ? (
            <Card>
              <CardContent className="text-center py-12">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                <p className="text-muted-foreground mb-4">
                  No results match your search criteria. Try adjusting your search terms or filters.
                </p>
                <Button variant="outline" onClick={() => setActiveTab("suggestions")} data-testid="try-suggestions">
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Try AI Suggestions
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {searchResults.map((result) => (
                <Card key={result.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          {getResultIcon(result.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <Link href={getResultLink(result)}>
                              <h3 className="font-semibold hover:text-primary cursor-pointer truncate" data-testid={`result-title-${result.id}`}>
                                {result.title}
                              </h3>
                            </Link>
                            {result.aiSuggested && (
                              <Badge variant="secondary" className="ml-2">
                                <Sparkles className="w-3 h-3 mr-1" />
                                AI Suggested
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2" data-testid={`result-description-${result.id}`}>
                            {result.description}
                          </p>
                          {result.highlights.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {result.highlights.map((highlight, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {highlight}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {Math.round(result.relevanceScore * 100)}% match
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {result.type}
                          </div>
                        </div>
                        <Link href={getResultLink(result)}>
                          <Button variant="outline" size="sm" data-testid={`view-result-${result.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
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