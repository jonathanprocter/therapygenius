import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Link2, 
  Unlink, 
  Target, 
  Calendar, 
  User, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Brain,
  TrendingUp,
  FileText,
  Users
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Document, Session } from '@shared/schema';

interface DocumentAutoLinkingProps {
  document: Document;
  className?: string;
}

interface PotentialMatch {
  sessionId: string;
  confidence: number;
  matchReason: string;
  session: {
    id: string;
    sessionDate: string;
    clientName?: string;
    sessionType?: string;
    notes?: string;
  };
}

interface LinkingMetadata {
  documentId: string;
  sessionMatch?: {
    sessionId: string;
    confidence: number;
    matchReason: string;
  };
  analysisResults?: {
    category: string;
    themes: string[];
    dateReferences: string[];
    clientReferences: string[];
  };
  potentialMatches: PotentialMatch[];
  processingStatus: 'pending' | 'completed' | 'failed';
  errors: string[];
}

export function DocumentAutoLinking({ document, className }: DocumentAutoLinkingProps) {
  const [showPotentialMatches, setShowPotentialMatches] = useState(false);
  const { toast } = useToast();

  // Get potential session matches
  const { data: potentialMatches, isLoading: matchesLoading } = useQuery({
    queryKey: ['/api/documents', document.id, 'potential-matches'],
    enabled: !!document.id && !document.sessionId,
  });

  // Get auto-linking metadata
  const { data: linkingMetadata, isLoading: metadataLoading } = useQuery({
    queryKey: ['/api/documents', document.id, 'auto-linking-metadata'],
    enabled: !!document.id,
  });

  // Link document to session mutation
  const linkMutation = useMutation({
    mutationFn: async ({ sessionId, confidence }: { sessionId: string; confidence?: number }) => {
      const response = await apiRequest('POST', `/api/documents/${document.id}/link-session`, { sessionId, confidence });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Document Linked",
        description: `Document successfully linked to session`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
    onError: (error) => {
      toast({
        title: "Linking Error",
        description: error instanceof Error ? error.message : "Failed to link document",
        variant: "destructive",
      });
    },
  });

  // Unlink document mutation
  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/documents/${document.id}/unlink-session`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document Unlinked",
        description: "Document unlinked from session",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
    onError: (error) => {
      toast({
        title: "Unlinking Error",
        description: error instanceof Error ? error.message : "Failed to unlink document",
        variant: "destructive",
      });
    },
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800 border-green-200';
    if (confidence >= 0.7) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-orange-100 text-orange-800 border-orange-200';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.9) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (confidence >= 0.7) return <Target className="w-4 h-4 text-blue-600" />;
    if (confidence >= 0.5) return <TrendingUp className="w-4 h-4 text-yellow-600" />;
    return <AlertTriangle className="w-4 h-4 text-orange-600" />;
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.9) return 'High Confidence';
    if (confidence >= 0.7) return 'Good Confidence';
    if (confidence >= 0.5) return 'Moderate Confidence';
    return 'Low Confidence';
  };

  // Using Eastern Time formatting utilities for consistent timezone display  
  const formatDate = (dateString: string) => {
    const dateObj = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return dateObj.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const isCalendarLinked = document.sourceEventId || document.metadata?.sourceCalendar;
  const metadata: LinkingMetadata = linkingMetadata || {
    documentId: document.id,
    potentialMatches: potentialMatches?.potentialMatches || [],
    processingStatus: 'pending',
    errors: [],
  };

  return (
    <Card className={`${className} border-l-4 ${
      document.sessionId ? 'border-l-green-500' : 
      metadata.potentialMatches.length > 0 ? 'border-l-yellow-500' : 
      'border-l-gray-300'
    }`} data-testid="document-auto-linking">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            {document.sessionId ? (
              <Link2 className="w-5 h-5 text-green-600" />
            ) : metadata.potentialMatches.length > 0 ? (
              <Target className="w-5 h-5 text-yellow-600" />
            ) : (
              <Unlink className="w-5 h-5 text-gray-400" />
            )}
            <span>Session Linking</span>
            {isCalendarLinked && (
              <Badge className="bg-purple-100 text-purple-800 ml-2" data-testid="calendar-linked">
                <Calendar className="w-3 h-3 mr-1" />
                Calendar
              </Badge>
            )}
          </CardTitle>

          <div className="flex items-center space-x-2">
            {document.sessionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => unlinkMutation.mutate()}
                disabled={unlinkMutation.isPending}
                data-testid="unlink-document"
              >
                <Unlink className="w-4 h-4 mr-1" />
                Unlink
              </Button>
            )}
            
            {!document.sessionId && metadata.potentialMatches.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPotentialMatches(!showPotentialMatches)}
                data-testid="toggle-potential-matches"
              >
                <Users className="w-4 h-4 mr-1" />
                Show Matches ({metadata.potentialMatches.length})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Link Status */}
        {document.sessionId ? (
          <Alert className="border-green-200 bg-green-50" data-testid="linked-status">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-green-800">Document Successfully Linked</p>
                <div className="text-sm text-green-700">
                  <p>Session ID: {document.sessionId}</p>
                  {metadata.sessionMatch && (
                    <>
                      <p>Match Confidence: {(metadata.sessionMatch.confidence * 100).toFixed(1)}%</p>
                      <p>Reason: {metadata.sessionMatch.matchReason}</p>
                    </>
                  )}
                  {isCalendarLinked && (
                    <p>Source: Calendar Event ({document.sourceEventId})</p>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ) : metadata.potentialMatches.length > 0 ? (
          <Alert className="border-yellow-200 bg-yellow-50" data-testid="potential-matches-alert">
            <Target className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-yellow-800">Potential Session Matches Found</p>
                <p className="text-sm text-yellow-700">
                  {metadata.potentialMatches.length} potential session(s) found for automatic linking.
                  Review and confirm the best match below.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-gray-200 bg-gray-50" data-testid="no-matches-alert">
            <Brain className="h-4 w-4 text-gray-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-gray-800">No Session Matches</p>
                <p className="text-sm text-gray-700">
                  No suitable sessions found for automatic linking. The document can be manually associated with a session later.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Analysis Results */}
        {metadata.analysisResults && (
          <>
            <Separator />
            <div className="space-y-3" data-testid="analysis-results">
              <h4 className="font-medium flex items-center space-x-2">
                <Brain className="w-4 h-4 text-purple-600" />
                <span>AI Analysis Results</span>
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Document Category:</p>
                  <Badge className="mt-1">{metadata.analysisResults.category}</Badge>
                </div>
                
                {metadata.analysisResults.themes.length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground">Key Themes:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {metadata.analysisResults.themes.slice(0, 3).map((theme, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {metadata.analysisResults.dateReferences.length > 0 && (
                <div>
                  <p className="font-medium text-muted-foreground text-sm">Date References:</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {metadata.analysisResults.dateReferences.map((date, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {date}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Potential Matches */}
        {showPotentialMatches && metadata.potentialMatches.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3" data-testid="potential-matches">
              <h4 className="font-medium">Potential Session Matches</h4>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {metadata.potentialMatches.map((match) => (
                  <Card key={match.sessionId} className="relative border shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-2">
                            <Badge className={getConfidenceColor(match.confidence)} data-testid="confidence-badge">
                              {getConfidenceIcon(match.confidence)}
                              <span className="ml-1">{(match.confidence * 100).toFixed(0)}%</span>
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {getConfidenceText(match.confidence)}
                            </span>
                          </div>
                          
                          <div className="space-y-1">
                            <p className="font-medium text-sm">
                              {match.session.clientName} - {formatDate(match.session.sessionDate)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {match.session.sessionType} • {match.matchReason}
                            </p>
                            {match.session.notes && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {match.session.notes.substring(0, 100)}...
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          onClick={() => linkMutation.mutate({ 
                            sessionId: match.sessionId, 
                            confidence: match.confidence 
                          })}
                          disabled={linkMutation.isPending}
                          data-testid={`link-session-${match.sessionId}`}
                        >
                          <Link2 className="w-4 h-4 mr-1" />
                          Link
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Processing Status */}
        {metadata.processingStatus === 'pending' && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground" data-testid="processing-status">
            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <span>Analyzing document for session matches...</span>
          </div>
        )}

        {/* Errors */}
        {metadata.errors && metadata.errors.length > 0 && (
          <Alert variant="destructive" data-testid="linking-errors">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Processing Errors:</p>
                <ul className="text-sm space-y-1">
                  {metadata.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}