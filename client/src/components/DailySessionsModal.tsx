import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X, Loader2, Brain, AlertCircle, TrendingUp, Target, Lightbulb, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Session {
  id: string;
  clientId: string;
  sessionDate: string | Date;
  sessionType: string;
  status: string;
  notes: string | null;
  prepNotes: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface SessionPrep {
  sessionId: string;
  previousSessionThemes: string[];
  topicsToRevisit: string[];
  progressMarkers: string[];
  concernsToAddress: string[];
  prepSummary: string;
  confidence: number;
}

interface ClientInsights {
  therapeuticEngagement: {
    level: string;
    description: string;
    trends: string[];
  };
  caseConceptualization: {
    presentingIssues: string[];
    coreConcerns: string[];
    strengths: string[];
    therapeuticApproach: string;
    progressSummary: string;
  };
  recentProgress: string[];
  areasOfFocus: string[];
}

interface DailySessionsModalProps {
  date: Date;
  open: boolean;
  onClose: () => void;
}

export function DailySessionsModal({ date, open, onClose }: DailySessionsModalProps) {
  const queryClient = useQueryClient();
  const dateString = format(date, 'yyyy-MM-dd');

  // Fetch sessions for the selected date
  const { data: sessions, isLoading: sessionsLoading, error: sessionsError, refetch } = useQuery<Session[]>({
    queryKey: ['sessions', 'date', dateString],
    queryFn: async () => {
      const response = await fetch(`/api/sessions/date/${dateString}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      return response.json();
    },
    enabled: open,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  const handleRefresh = () => {
    refetch();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">
                Sessions for {format(date, 'EEEE, MMMM d, yyyy')}
              </DialogTitle>
              <DialogDescription>
                AI-powered session preparation and insights for today's appointments
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={sessionsLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${sessionsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)] pr-4">
          {sessionsError ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-50" />
              <p className="text-destructive font-medium mb-2">Error loading sessions</p>
              <p className="text-sm text-muted-foreground mb-4">
                {sessionsError instanceof Error ? sessionsError.message : 'Unknown error'}
              </p>
              <Button onClick={handleRefresh} variant="outline">
                Try Again
              </Button>
            </div>
          ) : sessionsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : sessions && sessions.length > 0 ? (
            <div className="space-y-6">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sessions scheduled for this date</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SessionCard({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const [prepNotes, setPrepNotes] = useState(session.prepNotes || '');
  const [activeTab, setActiveTab] = useState<'prep' | 'insights'>('prep');

  // Update prepNotes when session changes
  useEffect(() => {
    setPrepNotes(session.prepNotes || '');
  }, [session.prepNotes]);

  // Fetch session prep
  const { data: prep, isLoading: prepLoading, error: prepError, refetch: refetchPrep } = useQuery<SessionPrep>({
    queryKey: ['session-prep', session.id],
    queryFn: async () => {
      const response = await fetch(`/api/sessions/${session.id}/prep`);
      if (!response.ok) {
        throw new Error('Failed to fetch session prep');
      }
      return response.json();
    },
    staleTime: 60000, // Consider data fresh for 1 minute
  });

  // Fetch client insights
  const { data: insights, isLoading: insightsLoading, error: insightsError, refetch: refetchInsights } = useQuery<ClientInsights>({
    queryKey: ['client-insights', session.clientId],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${session.clientId}/insights`);
      if (!response.ok) {
        throw new Error('Failed to fetch client insights');
      }
      return response.json();
    },
    enabled: activeTab === 'insights',
    staleTime: 300000, // Consider data fresh for 5 minutes
  });

  // Mutation to save prep notes
  const savePrepNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      const response = await fetch(`/api/sessions/${session.id}/prep-notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prepNotes: notes }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save prep notes');
      }
      return response.json();
    },
    onSuccess: () => {
      const dateString = format(new Date(session.sessionDate), 'yyyy-MM-dd');
      queryClient.invalidateQueries({ queryKey: ['sessions', 'date', dateString] });
    },
  });

  const handleSavePrepNotes = () => {
    if (prepNotes !== session.prepNotes) {
      savePrepNotesMutation.mutate(prepNotes);
    }
  };

  const sessionTime = format(new Date(session.sessionDate), 'h:mm a');

  // Handle missing client gracefully
  if (!session.client) {
    return (
      <Card className="p-6">
        <div className="text-center py-6 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Client information not available</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Left Column: Client Info & Time */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-bold">
              {session.client.firstName} {session.client.lastName}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {sessionTime} • {session.sessionType}
            </p>
            <Badge variant={session.status === 'completed' ? 'default' : 'secondary'} className="mt-2">
              {session.status}
            </Badge>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'prep' | 'insights')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="prep">Session Prep</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Middle Column: AI-Generated Key Themes */}
        <div className="space-y-4">
          {activeTab === 'prep' ? (
            prepError ? (
              <div className="text-center py-6">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive opacity-50" />
                <p className="text-sm text-destructive mb-2">Error loading prep</p>
                <Button onClick={() => refetchPrep()} variant="outline" size="sm">
                  Retry
                </Button>
              </div>
            ) : prepLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : prep ? (
              <div className="space-y-4">
                {prep.previousSessionThemes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">Previous Session Themes</h4>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {prep.previousSessionThemes.map((theme, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{theme}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {prep.topicsToRevisit.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-blue-500" />
                      <h4 className="font-semibold text-sm">Topics to Revisit</h4>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {prep.topicsToRevisit.map((topic, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {prep.progressMarkers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <h4 className="font-semibold text-sm">Progress Markers</h4>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {prep.progressMarkers.map((marker, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          <span>{marker}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {prep.concernsToAddress.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <h4 className="font-semibold text-sm">Concerns to Address</h4>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {prep.concernsToAddress.map((concern, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-orange-500 mt-1">•</span>
                          <span>{concern}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No prep data available</p>
            )
          ) : insightsError ? (
            <div className="text-center py-6">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive opacity-50" />
              <p className="text-sm text-destructive mb-2">Error loading insights</p>
              <Button onClick={() => refetchInsights()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          ) : insightsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : insights ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  <h4 className="font-semibold text-sm">Therapeutic Engagement</h4>
                </div>
                <Badge variant="outline" className="mb-2">
                  {insights.therapeuticEngagement.level}
                </Badge>
                <p className="text-sm">{insights.therapeuticEngagement.description}</p>
                {insights.therapeuticEngagement.trends.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {insights.therapeuticEngagement.trends.map((trend, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-yellow-500 mt-1">•</span>
                        <span>{trend}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {insights.recentProgress.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <h4 className="font-semibold text-sm">Recent Progress</h4>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {insights.recentProgress.map((progress, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        <span>{progress}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.areasOfFocus.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">Areas of Focus</h4>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {insights.areasOfFocus.map((area, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No insights available</p>
          )}
        </div>

        {/* Right Column: Therapist's Prep Notes */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Your Prep Notes</h4>
          <Textarea
            placeholder="Add your own preparation notes here..."
            value={prepNotes}
            onChange={(e) => setPrepNotes(e.target.value)}
            className="min-h-[200px] resize-none"
          />
          {prepNotes && (
            <div className="space-y-2">
              <Button
                onClick={handleSavePrepNotes}
                disabled={savePrepNotesMutation.isPending || prepNotes === session.prepNotes}
                className="w-full"
                size="sm"
              >
                {savePrepNotesMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Notes'
                )}
              </Button>
              {savePrepNotesMutation.isError && (
                <p className="text-xs text-destructive">
                  {savePrepNotesMutation.error instanceof Error
                    ? savePrepNotesMutation.error.message
                    : 'Failed to save notes'}
                </p>
              )}
              {savePrepNotesMutation.isSuccess && !savePrepNotesMutation.isPending && (
                <p className="text-xs text-green-600">Notes saved successfully</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
