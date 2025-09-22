import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { DocumentUpload } from "./DocumentUpload";
import { DocumentAutoLinking } from "./DocumentAutoLinking";
import { useDocuments, useSearchDocuments, useDeleteDocument } from "@/hooks/useDocuments";
import { useGenerateDocumentAssessments } from "@/hooks/useAITagging";
import { cn } from "@/lib/utils";
import { Link2, Calendar, Target, AlertTriangle, Brain, CheckCircle, Clock, Zap } from "lucide-react";
import type { Document } from "@shared/schema";

export function DocumentsView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: documents, isLoading } = useDocuments();
  const searchMutation = useSearchDocuments();
  const deleteMutation = useDeleteDocument();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const displayDocuments = searchMutation.data || documents || [];

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

  const getDocumentStatusIcon = (document: Document) => {
    if (document.sessionId) {
      return <Link2 className="w-4 h-4 text-green-600" title="Linked to session" />;
    }
    if (document.sourceEventId) {
      return <Calendar className="w-4 h-4 text-purple-600" title="From calendar" />;
    }
    if (document.metadata?.potentialMatches && document.metadata.potentialMatches.length > 0) {
      return <Target className="w-4 h-4 text-yellow-600" title="Has potential matches" />;
    }
    return null;
  };

  const getConfidenceIndicator = (document: Document) => {
    if (document.sessionId && document.metadata?.linkingConfidence) {
      const confidence = document.metadata.linkingConfidence;
      const percentage = Math.round(confidence * 100);
      const color = confidence >= 0.9 ? 'text-green-600' : 
                   confidence >= 0.7 ? 'text-blue-600' : 
                   confidence >= 0.5 ? 'text-yellow-600' : 'text-orange-600';
      return (
        <Badge variant="outline" className={`text-xs ${color} border-current`}>
          {percentage}% match
        </Badge>
      );
    }
    return null;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Assessment status helper functions
  const getAssessmentStatusIcon = (document: Document) => {
    const assessmentMetadata = document.metadata?.assessmentExtraction;
    
    if (assessmentMetadata?.assessmentsFound && assessmentMetadata.assessmentsFound.length > 0) {
      return <CheckCircle className="w-4 h-4 text-green-600" title={`${assessmentMetadata.assessmentsFound.length} assessments found`} />;
    }
    
    if (assessmentMetadata?.processingStatus === 'processing') {
      return <Clock className="w-4 h-4 text-blue-600" title="Processing assessments..." />;
    }
    
    if (assessmentMetadata?.hasAssessmentContent) {
      return <Brain className="w-4 h-4 text-purple-600" title="Contains assessment content" />;
    }
    
    return null;
  };

  const getAssessmentStatusBadge = (document: Document) => {
    const assessmentMetadata = document.metadata?.assessmentExtraction;
    
    if (assessmentMetadata?.assessmentsFound && assessmentMetadata.assessmentsFound.length > 0) {
      return (
        <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
          {assessmentMetadata.assessmentsFound.length} Assessment{assessmentMetadata.assessmentsFound.length > 1 ? 's' : ''}
        </Badge>
      );
    }
    
    if (assessmentMetadata?.processingStatus === 'processing') {
      return (
        <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">
          Processing...
        </Badge>
      );
    }
    
    return null;
  };

  const canGenerateAssessments = (document: Document) => {
    const assessmentMetadata = document.metadata?.assessmentExtraction;
    const isProcessing = assessmentMetadata?.processingStatus === 'processing';
    const hasAssessments = assessmentMetadata?.assessmentsFound && assessmentMetadata.assessmentsFound.length > 0;
    
    // Can generate if document has content and isn't currently processing
    return document.content && !isProcessing && document.metadata?.analysis?.category !== 'Other';
  };

  const DocumentAssessmentButton = ({ document }: { document: Document }) => {
    const generateAssessments = useGenerateDocumentAssessments(document.id);
    
    if (!canGenerateAssessments(document)) {
      return null;
    }

    return (
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          generateAssessments.mutate();
        }}
        disabled={generateAssessments.isPending}
        className="text-xs px-2 py-1 h-auto"
        data-testid={`generate-assessments-${document.id}`}
      >
        {generateAssessments.isPending ? (
          <>
            <Clock className="w-3 h-3 mr-1" />
            Processing...
          </>
        ) : (
          <>
            <Brain className="w-3 h-3 mr-1" />
            Extract Assessments
          </>
        )}
      </Button>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="documents-view">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Manage and analyze client documents with AI-powered insights
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            data-testid="toggle-view-mode"
          >
            <i className={`fas fa-${viewMode === "grid" ? "list" : "th"} mr-2`}></i>
            {viewMode === "grid" ? "List" : "Grid"}
          </Button>
          <Button onClick={() => setIsUploadOpen(true)} data-testid="upload-documents">
            <i className="fas fa-plus mr-2"></i>
            Upload Documents
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex space-x-2">
        <div className="relative flex-1">
          <Input
            placeholder="Search documents, content, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="search-input"
          />
          <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm"></i>
        </div>
        <Button
          type="submit"
          disabled={searchMutation.isPending}
          data-testid="search-button"
        >
          {searchMutation.isPending ? (
            <i className="fas fa-spinner fa-spin"></i>
          ) : (
            <i className="fas fa-search"></i>
          )}
        </Button>
        {searchMutation.data && (
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              searchMutation.reset();
            }}
            data-testid="clear-search"
          >
            Clear
          </Button>
        )}
      </form>

      {/* Documents Grid/List */}
      {displayDocuments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <i className="fas fa-file-medical text-4xl text-muted-foreground mb-4"></i>
            <h3 className="text-lg font-medium mb-2">No documents found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "No documents match your search criteria" : "Upload your first document to get started"}
            </p>
            <Button onClick={() => setIsUploadOpen(true)} data-testid="empty-state-upload">
              <i className="fas fa-plus mr-2"></i>
              Upload Documents
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-2"
          )}
          data-testid="documents-container"
        >
          {displayDocuments.map((document: Document) => (
            <Card
              key={document.id}
              className={cn(
                "hover:shadow-md transition-shadow cursor-pointer",
                viewMode === "list" && "flex items-center p-4"
              )}
              data-testid={`document-${document.id}`}
            >
              <CardContent className={cn("p-4", viewMode === "list" && "flex items-center space-x-4 flex-1 p-0")}>
                {viewMode === "grid" ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <i className={cn(getFileIcon(document.fileType), "text-lg")}></i>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getDocumentStatusIcon(document)}
                        {getAssessmentStatusIcon(document)}
                        {document.metadata?.analysis?.category && (
                          <Badge 
                            className={getCategoryColor(document.metadata.analysis.category)}
                            data-testid="document-category"
                          >
                            {document.metadata.analysis.category}
                          </Badge>
                        )}
                        {getAssessmentStatusBadge(document)}
                        {document.isProcessed && (
                          <i className="fas fa-magic text-purple-500 text-xs" title="AI Processed"></i>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-sm line-clamp-2" data-testid="document-name">
                        {document.fileName}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Uploaded {formatDate(document.uploadDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(document.fileSize)}
                      </p>
                    </div>

                    {document.metadata?.analysis?.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {document.metadata.analysis.summary}
                      </p>
                    )}

                    {document.metadata?.analysis?.tags && (
                      <div className="flex flex-wrap gap-1">
                        {document.metadata.analysis.tags.slice(0, 3).map((tag: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {document.metadata.analysis.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{document.metadata.analysis.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Status and Actions */}
                    <div className="space-y-2">
                      {/* Auto-linking Status */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          {document.sessionId ? (
                            <div className="flex items-center text-green-600">
                              <Link2 className="w-3 h-3 mr-1" />
                              <span>Linked</span>
                            </div>
                          ) : document.sourceEventId ? (
                            <div className="flex items-center text-purple-600">
                              <Calendar className="w-3 h-3 mr-1" />
                              <span>Calendar</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-muted-foreground">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              <span>Unlinked</span>
                            </div>
                          )}
                        </div>
                        {getConfidenceIndicator(document)}
                      </div>
                      
                      {/* Assessment Actions */}
                      <div className="flex items-center justify-end">
                        <DocumentAssessmentButton document={document} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 flex items-center justify-center">
                      <i className={cn(getFileIcon(document.fileType), "text-lg")}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate" data-testid="document-name">
                        {document.fileName}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(document.uploadDate)} • {formatFileSize(document.fileSize)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getDocumentStatusIcon(document)}
                      {getAssessmentStatusIcon(document)}
                      {document.metadata?.analysis?.category && (
                        <Badge 
                          className={getCategoryColor(document.metadata.analysis.category)}
                          data-testid="document-category"
                        >
                          {document.metadata.analysis.category}
                        </Badge>
                      )}
                      {getAssessmentStatusBadge(document)}
                      {getConfidenceIndicator(document)}
                      {document.isProcessed && (
                        <i className="fas fa-magic text-purple-500 text-xs" title="AI Processed"></i>
                      )}
                      <DocumentAssessmentButton document={document} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DocumentUpload
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />
    </div>
  );
}
