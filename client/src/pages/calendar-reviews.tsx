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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

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
    </div>
  );
}