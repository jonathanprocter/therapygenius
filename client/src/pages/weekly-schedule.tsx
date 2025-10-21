import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import { formatTimeEastern, getEasternHours, isSameDayEastern } from "@/lib/utils";
import { startOfWeek, addDays, format, addWeeks, subWeeks, isSameDay } from "date-fns";

type SessionWithClient = {
  id: string;
  clientId: string;
  sessionDate: string;
  duration: number | null;
  sessionType: string | null;
  notes: string | null;
  clientName: string;
};

export default function WeeklySchedule() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  // Get Monday of the current week
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // 1 = Monday
  
  // Generate array of 7 days starting from Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  // Time slots from 7 AM to 10 PM (22:00)
  const timeSlots = Array.from({ length: 15 }, (_, i) => i + 7); // 7, 8, 9, ..., 21

  // Fetch sessions for the week
  const { data: sessions, isLoading } = useQuery<SessionWithClient[]>({
    queryKey: ["/api/sessions", "week", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const response = await fetch(`/api/sessions?limit=1000`);
      if (!response.ok) throw new Error("Failed to fetch sessions");
      const allSessions = await response.json();
      
      // Filter sessions for current week using Eastern Time
      return allSessions.filter((session: SessionWithClient) => {
        const sessionDate = new Date(session.sessionDate);
        return weekDays.some(day => isSameDayEastern(sessionDate, day));
      });
    },
  });

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(new Date());
  };

  const getSessionsForDayAndHour = (day: Date, hour: number) => {
    if (!sessions) return [];
    
    return sessions.filter(session => {
      const sessionDate = new Date(session.sessionDate);
      const sessionHour = getEasternHours(sessionDate); // Get hour in Eastern Time
      
      return isSameDayEastern(sessionDate, day) && sessionHour === hour;
    });
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
  };

  const isToday = (day: Date) => isSameDayEastern(day, new Date());

  return (
    <div className="space-y-6" data-testid="weekly-schedule">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Weekly Schedule</h1>
          <p className="text-muted-foreground mt-1">
            {format(weekStart, "MMMM d")} - {format(addDays(weekStart, 6), "MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={goToPreviousWeek}
            data-testid="button-previous-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline"
            onClick={goToCurrentWeek}
            data-testid="button-current-week"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            This Week
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={goToNextWeek}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekly Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-96 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Day Headers */}
                <div className="grid grid-cols-8 border-b border-border bg-muted/30">
                  <div className="p-3 border-r border-border">
                    <span className="text-sm font-medium text-muted-foreground">Time</span>
                  </div>
                  {weekDays.map((day) => (
                    <Link 
                      key={day.toString()} 
                      href={`/calendar?date=${format(day, 'yyyy-MM-dd')}`}
                    >
                      <div 
                        className={`p-3 border-r border-border last:border-r-0 text-center cursor-pointer hover:bg-primary/20 transition-colors ${
                          isToday(day) ? 'bg-primary/10' : ''
                        }`}
                        data-testid={`day-header-${format(day, 'yyyy-MM-dd')}`}
                      >
                        <div className="text-sm font-semibold">
                          {format(day, "EEE")}
                        </div>
                        <div className={`text-lg font-bold ${isToday(day) ? 'text-primary' : ''}`}>
                          {format(day, "d")}
                        </div>
                        {isToday(day) && (
                          <Badge variant="default" className="text-xs mt-1">Today</Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Time Slots */}
                <div>
                  {timeSlots.map((hour) => (
                    <div key={hour} className="grid grid-cols-8 border-b border-border last:border-b-0">
                      {/* Hour Label */}
                      <div className="p-3 border-r border-border bg-muted/20">
                        <span className="text-sm font-medium text-muted-foreground">
                          {formatHour(hour)}
                        </span>
                      </div>
                      
                      {/* Day Cells */}
                      {weekDays.map((day) => {
                        const daySessions = getSessionsForDayAndHour(day, hour);
                        
                        return (
                          <div 
                            key={`${day.toString()}-${hour}`}
                            className={`p-2 border-r border-border last:border-r-0 min-h-[80px] ${
                              isToday(day) ? 'bg-primary/5' : ''
                            }`}
                            data-testid={`time-slot-${format(day, "yyyy-MM-dd")}-${hour}`}
                          >
                            <div className="space-y-1">
                              {daySessions.map((session) => (
                                <Link 
                                  key={session.id}
                                  href={`/client-chart/${session.clientId}`}
                                >
                                  <div 
                                    className="bg-primary/10 border-l-4 border-primary rounded p-2 cursor-pointer hover:bg-primary/20 transition-colors"
                                    data-testid={`session-${session.id}`}
                                  >
                                    <div className="text-xs font-semibold text-primary line-clamp-1">
                                      {session.clientName}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatTimeEastern(session.sessionDate)}
                                    </div>
                                    {session.duration && (
                                      <div className="text-xs text-muted-foreground">
                                        {session.duration} min
                                      </div>
                                    )}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {sessions && (
        <Card>
          <CardHeader>
            <CardTitle>Week Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{sessions.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">
                  {Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unique Clients</p>
                <p className="text-2xl font-bold">
                  {new Set(sessions.map(s => s.clientId)).size}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {sessions.length > 0 
                    ? Math.round(sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length)
                    : 0} min
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
