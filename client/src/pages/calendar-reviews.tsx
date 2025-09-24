import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Link } from "lucide-react";

interface CalendarEventReview {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventDescription?: string;
  eventLocation?: string;
  eventDuration?: number;
  suggestedClientId?: string;
  status: 'pending' | 'approved' | 'rejected';
  therapistNotes?: string;
  rejectionReason?: string;
  aiMatchData?: any;
  createdAt: string;
  updatedAt: string;
  suggestedClient?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export default function CalendarReviews() {
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [assignmentNotes, setAssignmentNotes] = useState<Record<string, string>>({});
  const [clientAssignments, setClientAssignments] = useState<Record<string, string>>({});
  const [createAliasDialogOpen, setCreateAliasDialogOpen] = useState<string | null>(null);
  const [aliasPattern, setAliasPattern] = useState('');
  const [aliasMatchType, setAliasMatchType] = useState<'exact' | 'contains' | 'starts_with' | 'ends_with' | 'regex'>('contains');
  const [aliasClientId, setAliasClientId] = useState('');
  const [aliasNotes, setAliasNotes] = useState('');
  const [aliasIsActive, setAliasIsActive] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending reviews
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["/api/calendar/pending-reviews"],
  });

  // Fetch clients for assignment dropdown
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Approve event mutation
  const approveEventMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      return apiRequest(`/api/calendar/approve-event/${reviewId}`, {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Event Approved",
        description: "Event approved and session created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/pending-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/pending-count"] });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve event",
        variant: "destructive",
      });
    },
  });

  // Reject event mutation
  const rejectEventMutation = useMutation({
    mutationFn: async ({ reviewId, notes }: { reviewId: string; notes?: string }) => {
      return apiRequest(`/api/calendar/reject-event/${reviewId}`, {
        method: "POST",
        body: JSON.stringify({ therapistNotes: notes }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Event Rejected",
        description: "Event rejected successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/pending-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/pending-count"] });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject event",
        variant: "destructive",
      });
    },
  });

  // Assign client mutation
  const assignClientMutation = useMutation({
    mutationFn: async ({ reviewId, clientId, notes }: { reviewId: string; clientId: string; notes?: string }) => {
      return apiRequest(`/api/calendar/assign-client/${reviewId}`, {
        method: "PUT",
        body: JSON.stringify({ clientId, therapistNotes: notes }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Client Assigned",
        description: "Client assigned to event successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/pending-reviews"] });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign client",
        variant: "destructive",
      });
    },
  });

  // Create alias mutation
  const createAliasMutation = useMutation({
    mutationFn: async (aliasData: {
      aliasPattern: string;
      matchType: 'exact' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
      clientId: string;
      isActive: boolean;
      notes?: string;
      createdFromEventId?: string;
    }) => {
      return apiRequest("/api/calendar/aliases", {
        method: "POST",
        body: JSON.stringify(aliasData),
      });
    },
    onSuccess: () => {
      toast({
        title: "Alias Created",
        description: "Calendar alias created successfully! Future similar events will be automatically matched.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/aliases"] });
      setCreateAliasDialogOpen(null);
      resetAliasForm();
    },
    onError: (error: any) => {
      toast({
        title: "Alias Creation Failed",
        description: error.message || "Failed to create calendar alias",
        variant: "destructive",
      });
    },
  });

  const handleSelectEvent = (eventId: string, checked: boolean) => {
    const newSelected = new Set(selectedEvents);
    if (checked) {
      newSelected.add(eventId);
    } else {
      newSelected.delete(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEvents(new Set(reviews.map((review: CalendarEventReview) => review.id)));
    } else {
      setSelectedEvents(new Set());
    }
  };

  const handleApproveEvent = async (reviewId: string) => {
    const review = reviews.find((r: CalendarEventReview) => r.id === reviewId);
    if (!review?.suggestedClientId && !clientAssignments[reviewId]) {
      toast({
        title: "Client Required",
        description: "Please assign a client before approving the event",
        variant: "destructive",
      });
      return;
    }

    // If there's a client assignment, assign it first
    if (clientAssignments[reviewId] && clientAssignments[reviewId] !== review?.suggestedClientId) {
      await assignClientMutation.mutateAsync({
        reviewId,
        clientId: clientAssignments[reviewId],
        notes: assignmentNotes[reviewId],
      });
    }

    await approveEventMutation.mutateAsync(reviewId);
  };

  const handleRejectEvent = (reviewId: string) => {
    rejectEventMutation.mutate({
      reviewId,
      notes: assignmentNotes[reviewId],
    });
  };

  const handleAssignClient = (reviewId: string, clientId: string) => {
    setClientAssignments(prev => ({ ...prev, [reviewId]: clientId }));
  };

  const handleNotesChange = (reviewId: string, notes: string) => {
    setAssignmentNotes(prev => ({ ...prev, [reviewId]: notes }));
  };

  // Helper functions for alias creation
  const resetAliasForm = () => {
    setAliasPattern('');
    setAliasMatchType('contains');
    setAliasClientId('');
    setAliasNotes('');
    setAliasIsActive(true);
  };

  const autoSuggestPattern = (eventTitle: string, clientName?: string) => {
    // Try to extract patterns from event title
    const title = eventTitle.toLowerCase().trim();
    
    if (clientName) {
      const fullName = clientName.toLowerCase();
      const firstName = fullName.split(' ')[0];
      const lastName = fullName.split(' ')[1];
      
      // Check if event contains client name patterns
      if (title.includes(fullName)) {
        return { pattern: fullName, matchType: 'contains' as const };
      } else if (title.includes(firstName) && firstName.length > 2) {
        return { pattern: firstName, matchType: 'contains' as const };
      } else if (lastName && title.includes(lastName) && lastName.length > 2) {
        return { pattern: lastName, matchType: 'contains' as const };
      }
    }
    
    // Check for common therapy-related patterns
    const commonPatterns = [
      { pattern: 'therapy', matchType: 'contains' as const },
      { pattern: 'session', matchType: 'contains' as const },
      { pattern: 'appointment', matchType: 'contains' as const },
      { pattern: 'consultation', matchType: 'contains' as const },
    ];
    
    for (const { pattern, matchType } of commonPatterns) {
      if (title.includes(pattern)) {
        return { pattern, matchType };
      }
    }
    
    // Default to the event title with contains matching
    return { pattern: eventTitle, matchType: 'contains' as const };
  };

  const handleCreateAlias = (reviewId: string) => {
    const review = reviews.find((r: CalendarEventReview) => r.id === reviewId);
    const assignedClient = getAssignedClient(review);
    
    if (review && assignedClient) {
      const suggestion = autoSuggestPattern(
        review.eventTitle, 
        `${assignedClient.firstName} ${assignedClient.lastName}`
      );
      
      setAliasPattern(suggestion.pattern);
      setAliasMatchType(suggestion.matchType);
      setAliasClientId(assignedClient.id);
      setAliasNotes(`Auto-created from calendar review: ${review.eventTitle}`);
      setCreateAliasDialogOpen(reviewId);
    }
  };

  const handleSubmitAlias = () => {
    const reviewId = createAliasDialogOpen;
    const review = reviews.find((r: CalendarEventReview) => r.id === reviewId);
    
    if (!aliasPattern || !aliasClientId) {
      toast({
        title: "Missing Information",
        description: "Please provide both a pattern and select a client",
        variant: "destructive",
      });
      return;
    }

    createAliasMutation.mutate({
      aliasPattern,
      matchType: aliasMatchType,
      clientId: aliasClientId,
      isActive: aliasIsActive,
      notes: aliasNotes || undefined,
      createdFromEventId: review?.eventId,
    });
  };

  const getClientFullName = (client: Client) => `${client.firstName} ${client.lastName}`;

  const getAssignedClient = (review: CalendarEventReview) => {
    const assignedClientId = clientAssignments[review.id] || review.suggestedClientId;
    return clients.find((client: Client) => client.id === assignedClientId);
  };

  const formatEventDateTime = (dateString: string, duration?: number) => {
    const date = new Date(dateString);
    const timeStr = format(date, "MMM d, yyyy 'at' h:mm a");
    return duration ? `${timeStr} (${duration} min)` : timeStr;
  };

  const getBadgeVariant = (reason?: string) => {
    switch (reason) {
      case 'no_match': return 'destructive';
      case 'ambiguous': return 'secondary';
      case 'non_therapy': return 'outline';
      default: return 'default';
    }
  };

  const getBadgeText = (reason?: string) => {
    switch (reason) {
      case 'no_match': return 'No Match Found';
      case 'ambiguous': return 'Ambiguous Match';
      case 'non_therapy': return 'Non-Therapy';
      default: return 'Needs Review';
    }
  };

  const bulkActions = [
    {
      label: "Bulk Reject Selected",
      onClick: () => {
        selectedEvents.forEach(reviewId => {
          handleRejectEvent(reviewId);
        });
        setSelectedEvents(new Set());
      },
      variant: "destructive" as const,
    },
  ];

  if (reviewsLoading || clientsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Calendar Reviews</h1>
          <p className="text-muted-foreground">Review and manage rejected calendar events</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Calendar Reviews</h1>
          <p className="text-muted-foreground">
            Review and manually assign rejected calendar events to clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="pending-count">
            {reviews.length} Pending
          </Badge>
        </div>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">No Events Need Review</h3>
              <p className="text-muted-foreground">
                All calendar events have been processed successfully or there are no rejected events to review.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bulk Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedEvents.size === reviews.length && reviews.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="select-all-checkbox"
                  />
                  <span>Select All ({selectedEvents.size} selected)</span>
                </div>
                <div className="flex gap-2">
                  {bulkActions.map((action) => (
                    <Button
                      key={action.label}
                      variant={action.variant}
                      onClick={action.onClick}
                      disabled={selectedEvents.size === 0}
                      data-testid={`bulk-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Event Reviews List */}
          <div className="space-y-4">
            {reviews.map((review: CalendarEventReview) => {
              const assignedClient = getAssignedClient(review);
              
              return (
                <Card key={review.id} className="w-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedEvents.has(review.id)}
                          onCheckedChange={(checked) => handleSelectEvent(review.id, checked as boolean)}
                          data-testid={`event-checkbox-${review.id}`}
                        />
                        <div className="space-y-1">
                          <CardTitle className="text-lg" data-testid={`event-title-${review.id}`}>
                            {review.eventTitle}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground" data-testid={`event-date-${review.id}`}>
                            {formatEventDateTime(review.eventDate, review.eventDuration)}
                          </p>
                          {review.eventLocation && (
                            <p className="text-sm text-muted-foreground">
                              📍 {review.eventLocation}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant={getBadgeVariant(review.rejectionReason)} 
                        data-testid={`rejection-reason-${review.id}`}
                      >
                        {getBadgeText(review.rejectionReason)}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {review.eventDescription && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">Description</h4>
                        <p className="text-sm text-muted-foreground">{review.eventDescription}</p>
                      </div>
                    )}

                    <Separator />

                    {/* Client Assignment */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Client Assignment</h4>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <Select
                            value={clientAssignments[review.id] || review.suggestedClientId || ""}
                            onValueChange={(value) => handleAssignClient(review.id, value)}
                            data-testid={`client-select-${review.id}`}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a client..." />
                            </SelectTrigger>
                            <SelectContent>
                              {clients.map((client: Client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {getClientFullName(client)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <Textarea
                            placeholder="Add notes (optional)..."
                            value={assignmentNotes[review.id] || ""}
                            onChange={(e) => handleNotesChange(review.id, e.target.value)}
                            className="min-h-[40px]"
                            data-testid={`notes-textarea-${review.id}`}
                          />
                        </div>
                      </div>
                      
                      {assignedClient && (
                        <div className="text-sm text-muted-foreground">
                          ✓ Assigned to: {getClientFullName(assignedClient)}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => handleRejectEvent(review.id)}
                        disabled={rejectEventMutation.isPending}
                        data-testid={`reject-button-${review.id}`}
                      >
                        Reject
                      </Button>
                      {assignedClient && (
                        <Button
                          variant="outline"
                          onClick={() => handleCreateAlias(review.id)}
                          disabled={createAliasMutation.isPending}
                          data-testid={`create-alias-button-${review.id}`}
                        >
                          <Link className="h-4 w-4 mr-2" />
                          Create Alias
                        </Button>
                      )}
                      <Button
                        onClick={() => handleApproveEvent(review.id)}
                        disabled={approveEventMutation.isPending}
                        data-testid={`approve-button-${review.id}`}
                      >
                        {approveEventMutation.isPending ? "Approving..." : "Approve & Create Session"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Create Alias Dialog */}
      {createAliasDialogOpen && (
        <Dialog open={!!createAliasDialogOpen} onOpenChange={() => setCreateAliasDialogOpen(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Event Alias</DialogTitle>
              <DialogDescription>
                Create a pattern to automatically match similar calendar events to this client in future syncs.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="aliasPattern">Pattern</Label>
                <Input
                  id="aliasPattern"
                  value={aliasPattern}
                  onChange={(e) => setAliasPattern(e.target.value)}
                  placeholder="Pattern to match against event titles"
                  data-testid="input-alias-pattern"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  This pattern will be used to match similar calendar events
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="aliasMatchType">Match Type</Label>
                  <Select
                    value={aliasMatchType}
                    onValueChange={(value) => setAliasMatchType(value as any)}
                  >
                    <SelectTrigger data-testid="select-alias-match-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact Match</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="starts_with">Starts With</SelectItem>
                      <SelectItem value="ends_with">Ends With</SelectItem>
                      <SelectItem value="regex">Regular Expression</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="aliasClient">Client</Label>
                  <Select
                    value={aliasClientId}
                    onValueChange={setAliasClientId}
                  >
                    <SelectTrigger data-testid="select-alias-client">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client: Client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {getClientFullName(client)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="aliasNotes">Notes (Optional)</Label>
                <Textarea
                  id="aliasNotes"
                  value={aliasNotes}
                  onChange={(e) => setAliasNotes(e.target.value)}
                  placeholder="Optional notes about this alias..."
                  data-testid="textarea-alias-notes"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="aliasIsActive"
                  checked={aliasIsActive}
                  onCheckedChange={setAliasIsActive}
                  data-testid="switch-alias-active"
                />
                <Label htmlFor="aliasIsActive">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Active aliases will be used for automatic matching
                </p>
              </div>

              {/* Pattern Explanation */}
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="text-sm font-medium mb-2">Pattern Explanation</h4>
                <p className="text-sm text-muted-foreground">
                  {aliasMatchType === 'exact' && `Event title must match "${aliasPattern}" exactly`}
                  {aliasMatchType === 'contains' && `Event title must contain "${aliasPattern}"`}
                  {aliasMatchType === 'starts_with' && `Event title must start with "${aliasPattern}"`}
                  {aliasMatchType === 'ends_with' && `Event title must end with "${aliasPattern}"`}
                  {aliasMatchType === 'regex' && `Event title must match the regular expression: ${aliasPattern}`}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateAliasDialogOpen(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitAlias}
                disabled={createAliasMutation.isPending || !aliasPattern || !aliasClientId}
                data-testid="button-submit-alias"
              >
                {createAliasMutation.isPending ? "Creating..." : "Create Alias"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}