import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft,
  Calendar,
  Clock,
  User,
  FileText,
  Brain,
  ExternalLink,
  Edit,
  Save,
  X,
  Target,
  Shield,
  Link2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { SessionAITags } from '@/components/SessionAITags';
import { DocumentAutoLinking } from '@/components/DocumentAutoLinking';
import { SessionDocumentUpload } from '@/components/SessionDocumentUpload';
import type { Session, Document } from '@shared/schema';

export default function SessionDetail() {
  const { id } = useParams();
  const sessionId = id as string;
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);

  // Get session details
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['/api/sessions', sessionId],
    enabled: !!sessionId,
  });

  // Get client details
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['/api/clients', session?.clientId],
    enabled: !!session?.clientId,
  });

  // Get session documents
  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/sessions', sessionId, 'documents'],
    enabled: !!sessionId,
  });

  if (sessionLoading || clientLoading) {
    return (
      <div className="space-y-6" data-testid="session-detail-loading">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-8 h-8 rounded" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="lg:col-span-2 h-96" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested session could not be found.</p>
          <Link href="/clients">
            <Button data-testid="back-to-clients">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Clients
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'Not specified';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const isCalendarSession = session.externalEventId || session.sourceCalendar;
  const hasDocuments = documents && documents.length > 0;
  const linkedDocuments = documents?.filter((doc: Document) => doc.sessionId === session.id) || [];
  const unlinkedDocuments = documents?.filter((doc: Document) => !doc.sessionId) || [];

  return (
    <div className="space-y-6" data-testid="session-detail">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/client-chart/${session.clientId}`}>
            <Button variant="outline" size="sm" data-testid="back-to-client">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Client
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold flex items-center space-x-3" data-testid="session-title">
              <span>Session Details</span>
              {isCalendarSession && (
                <Badge className="bg-purple-100 text-purple-800" data-testid="calendar-session-badge">
                  <Calendar className="w-3 h-3 mr-1" />
                  From Calendar
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {client ? `${client.firstName} ${client.lastName}` : 'Loading client...'} • {formatDate(session.sessionDate)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setIsEditing(!isEditing)}
            data-testid="edit-session"
          >
            {isEditing ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </>
            )}
          </Button>
          <Button data-testid="save-session">
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Session Info Sidebar */}
        <div className="space-y-6">
          {/* Basic Information */}
          <Card data-testid="session-info">
            <CardHeader>
              <CardTitle className="text-base">Session Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Date & Time:</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">{formatDate(session.sessionDate)}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(session.sessionDate)}</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration:</span>
                  <span className="text-sm font-medium">{formatDuration(session.duration)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Type:</span>
                  <Badge variant="outline" className="text-xs">
                    {session.sessionType || 'Individual'}
                  </Badge>
                </div>

                {isCalendarSession && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Source:</span>
                        <span className="text-sm font-medium">{session.sourceCalendar || 'Google Calendar'}</span>
                      </div>
                      
                      {session.externalEventId && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Event ID:</span>
                          <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                            {session.externalEventId.substring(0, 12)}...
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Client Quick Info */}
          {client && (
            <Card data-testid="client-quick-info">
              <CardHeader>
                <CardTitle className="text-base flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>Client</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{client.firstName} {client.lastName}</p>
                    <p className="text-sm text-muted-foreground">
                      {client.email || 'No email on file'}
                    </p>
                    <Link href={`/client-chart/${client.id}`}>
                      <Button variant="link" className="p-0 h-auto text-xs" data-testid="view-client-chart">
                        View Client Chart <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents Summary */}
          <Card data-testid="documents-summary">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Documents</span>
                </span>
                <Badge variant="outline" className="text-xs">
                  {documents?.length || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Linked:</span>
                  <span className="font-medium text-green-600">{linkedDocuments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available:</span>
                  <span className="font-medium text-blue-600">{unlinkedDocuments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">{documents?.length || 0}</span>
                </div>
              </div>
              
              {hasDocuments && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setActiveTab('documents')}
                  data-testid="view-session-documents"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Documents
                </Button>
              )}
            </CardContent>
          </Card>

          {/* HIPAA Compliance Notice */}
          <Alert className="border-purple-200 bg-purple-50" data-testid="session-hipaa-notice">
            <Shield className="h-4 w-4 text-purple-600" />
            <AlertDescription>
              <div className="text-purple-800">
                <p className="font-medium text-xs">HIPAA Protected Session</p>
                <p className="text-xs mt-1">
                  All AI analysis and calendar integration maintains full compliance with audit logging.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4" data-testid="session-tabs">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="ai-insights" data-testid="tab-ai-insights">AI Insights</TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents">
                Documents {hasDocuments && <span className="ml-1">({documents.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Session Notes */}
              <Card data-testid="session-notes-overview">
                <CardHeader>
                  <CardTitle>Session Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {session.notes ? (
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap">{session.notes}</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm">No session notes recorded</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card data-testid="interventions-used">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Brain className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-lg font-semibold">
                          {session.interventionsUsed ? Object.keys(session.interventionsUsed).length : 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Interventions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card data-testid="homework-assigned">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Target className="w-4 h-4 text-green-600" />
                      <div>
                        <p className="text-lg font-semibold">
                          {session.homework ? 'Yes' : 'No'}
                        </p>
                        <p className="text-xs text-muted-foreground">Homework</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card data-testid="documents-linked">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Link2 className="w-4 h-4 text-purple-600" />
                      <div>
                        <p className="text-lg font-semibold">{linkedDocuments.length}</p>
                        <p className="text-xs text-muted-foreground">Linked Docs</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Homework Section */}
              {session.homework && (
                <Card data-testid="homework-details">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>Homework Assignment</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap">{session.homework}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Next Session Plan */}
              {session.nextSessionPlan && (
                <Card data-testid="next-session-plan">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5" />
                      <span>Next Session Plan</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap">{session.nextSessionPlan}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* AI Insights Tab */}
            <TabsContent value="ai-insights" className="space-y-6">
              <SessionAITags 
                sessionId={session.id} 
                sessionDate={session.sessionDate}
              />
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-6">
              {/* Document Upload Section */}
              <SessionDocumentUpload 
                sessionId={session.id}
                clientId={session.clientId}
                onUploadComplete={() => {
                  // Refresh session documents when upload completes
                  window.location.reload();
                }}
              />
              
              {hasDocuments ? (
                <div className="space-y-4">
                  {/* Linked Documents */}
                  {linkedDocuments.length > 0 && (
                    <Card data-testid="linked-documents">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Link2 className="w-5 h-5 text-green-600" />
                          <span>Linked Documents ({linkedDocuments.length})</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {linkedDocuments.map((document: Document) => (
                          <DocumentAutoLinking 
                            key={document.id} 
                            document={document}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Available Documents */}
                  {unlinkedDocuments.length > 0 && (
                    <Card data-testid="available-documents">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <span>Available for Linking ({unlinkedDocuments.length})</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {unlinkedDocuments.map((document: Document) => (
                          <DocumentAutoLinking 
                            key={document.id} 
                            document={document}
                          />
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="text-center py-8">
                      <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <h4 className="text-lg font-medium mb-2">No Documents Linked Yet</h4>
                      <p className="text-muted-foreground text-sm">
                        Upload documents above or link existing documents from your document library.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-6">
              <Card data-testid="session-notes-detail">
                <CardHeader>
                  <CardTitle>Detailed Session Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {session.notes ? (
                    <div className="prose max-w-none">
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{session.notes}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-lg font-medium mb-2">No Detailed Notes</h3>
                      <p className="text-sm">Session notes have not been recorded yet.</p>
                      {isEditing && (
                        <Button className="mt-4" data-testid="add-notes">
                          <Edit className="w-4 h-4 mr-2" />
                          Add Notes
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Interventions Used */}
              {session.interventionsUsed && Object.keys(session.interventionsUsed).length > 0 && (
                <Card data-testid="interventions-detail">
                  <CardHeader>
                    <CardTitle>Interventions Used</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(session.interventionsUsed).map(([intervention, details]) => (
                        <div key={intervention} className="p-3 bg-muted/50 rounded-lg">
                          <h4 className="font-medium text-sm">{intervention}</h4>
                          {typeof details === 'string' && (
                            <p className="text-sm text-muted-foreground mt-1">{details}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}