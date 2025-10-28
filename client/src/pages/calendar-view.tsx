import { useState, useEffect } from "react";
import { format, addDays, subDays, startOfToday, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Users, Clock, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendarEvents, type CalendarEvent } from "@/hooks/useCalendarEvents";
import { formatTimeEastern } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useLocation } from "wouter";
import { DailySessionsModal } from "@/components/DailySessionsModal";

function EventCard({ event }: { event: CalendarEvent }) {
  const startTime = formatTimeEastern(event.start);
  const endTime = formatTimeEastern(event.end);
  
  // Calculate duration in minutes
  const durationMs = event.end.getTime() - event.start.getTime();
  const durationMinutes = Math.round(durationMs / (1000 * 60));
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;
  
  const durationText = durationHours > 0 
    ? `${durationHours}h ${remainingMinutes > 0 ? `${remainingMinutes}m` : ''}`
    : `${durationMinutes}m`;

  return (
    <Card 
      className={event.isTherapySession ? "border-primary/50" : "border-border"}
      data-testid={`event-card-${event.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium" data-testid={`event-time-${event.id}`}>
                {startTime} - {endTime}
              </span>
              <Badge variant="outline" className="text-xs">
                {durationText}
              </Badge>
            </div>
            <h3 className="text-lg font-semibold" data-testid={`event-title-${event.id}`}>
              {event.title}
            </h3>
            {event.isTherapySession && event.clientName && (
              <p className="text-sm text-muted-foreground" data-testid={`event-client-${event.id}`}>
                Client: {event.clientName}
              </p>
            )}
          </div>
          <Badge 
            variant={event.isTherapySession ? "default" : "secondary"}
            data-testid={`event-badge-${event.id}`}
          >
            {event.isTherapySession ? "Therapy Session" : "Meeting"}
          </Badge>
        </div>
      </CardHeader>
      
      {(event.description || event.location || event.attendees) && (
        <CardContent className="pt-0 space-y-2">
          {event.description && (
            <p className="text-sm text-muted-foreground" data-testid={`event-description-${event.id}`}>
              {event.description}
            </p>
          )}
          
          {event.location && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span data-testid={`event-location-${event.id}`}>{event.location}</span>
            </div>
          )}
          
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span data-testid={`event-attendees-${event.id}`}>
                {event.attendees.join(", ")}
              </span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function CalendarView() {
  const [location] = useLocation();
  
  // Get date from URL parameter if provided
  const getInitialDate = () => {
    const urlParams = new URLSearchParams(location.split('?')[1]);
    const dateParam = urlParams.get('date');
    if (dateParam) {
      try {
        return parseISO(dateParam);
      } catch {
        return startOfToday();
      }
    }
    return startOfToday();
  };
  
  const [selectedDate, setSelectedDate] = useState<Date>(getInitialDate());
  const [showDailyPrep, setShowDailyPrep] = useState(false);

  // Update selected date when URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1]);
    const dateParam = urlParams.get('date');
    if (dateParam) {
      try {
        setSelectedDate(parseISO(dateParam));
      } catch {
        // Invalid date format, ignore
      }
    }
  }, [location]);
  
  const { data, isLoading, error } = useCalendarEvents(selectedDate);

  const goToPreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const goToNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const goToToday = () => {
    setSelectedDate(startOfToday());
  };

  const goToSpecificDate = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const formattedDate = format(selectedDate, 'EEEE, MMMM d, yyyy');
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(startOfToday(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6" data-testid="calendar-view">
      {/* Header with navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="calendar-title">Calendar</h1>
          <p className="text-muted-foreground mt-1">View all your events and therapy sessions</p>
        </div>
        <Button 
          onClick={goToToday} 
          variant={isToday ? "outline" : "default"}
          disabled={isToday}
          data-testid="button-today"
        >
          Today
        </Button>
      </div>

      {/* Date navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousDay}
                data-testid="button-previous-day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="min-w-[280px] justify-start text-left font-normal"
                    data-testid="button-date-picker"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span data-testid="text-selected-date">{formattedDate}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={goToSpecificDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextDay}
                data-testid="button-next-day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Event count summary */}
            {data && (
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-4 text-sm" data-testid="event-summary">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <span data-testid="count-therapy-sessions">
                      {data.therapySessions} Therapy Session{data.therapySessions !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-secondary"></div>
                    <span data-testid="count-other-events">
                      {data.otherEvents} Other Event{data.otherEvents !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                {data.therapySessions > 0 && (
                  <Button
                    onClick={() => setShowDailyPrep(true)}
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    AI Session Prep
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Events list */}
      <div className="space-y-4">
        {isLoading && (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        )}

        {error && (
          <Card className="border-destructive" data-testid="error-message">
            <CardContent className="pt-6">
              <p className="text-destructive">
                Failed to load calendar events. Please try again later.
              </p>
            </CardContent>
          </Card>
        )}

        {data && data.events.length === 0 && (
          <Card data-testid="no-events-message">
            <CardContent className="pt-6 text-center">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No events scheduled</h3>
              <p className="text-muted-foreground">
                You don't have any events on {format(selectedDate, 'MMMM d, yyyy')}
              </p>
            </CardContent>
          </Card>
        )}

        {data && data.events.length > 0 && (
          <div className="space-y-3" data-testid="events-list">
            {data.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* Daily Session Prep Modal */}
      <DailySessionsModal
        date={selectedDate}
        open={showDailyPrep}
        onClose={() => setShowDailyPrep(false)}
      />
    </div>
  );
}
