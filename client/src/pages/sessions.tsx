import { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calendar,
  Clock,
  User,
  Search,
  FileText,
  ExternalLink,
  Filter
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '@shared/schema';
import { formatDateEastern, formatTimeEastern } from '@/lib/utils';

interface SessionWithClient extends Session {
  clientName: string;
  clientId: string;
}

export default function Sessions() {
  const [searchQuery, setSearchQuery] = useState('');

  // Get all sessions
  const { data: sessions, isLoading } = useQuery<SessionWithClient[]>({
    queryKey: ['/api/sessions'],
  });

  const filteredSessions = sessions?.filter(session => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.clientName?.toLowerCase().includes(query) ||
      session.sessionType?.toLowerCase().includes(query) ||
      session.notes?.toLowerCase().includes(query)
    );
  }) || [];

  // Using Eastern Time formatting utilities for consistent timezone display
  const formatDate = (dateString: string) => {
    return formatDateEastern(dateString);
  };

  const formatTime = (dateString: string) => {
    return formatTimeEastern(dateString);
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

  const cleanCalendarImportText = (notes: string) => {
    // Remove verbose calendar import information and just show the appointment name
    const calendarImportPattern = /^Imported from Google Calendar \([^)]+\):\s*/;
    return notes.replace(calendarImportPattern, '').trim();
  };

  const getCleanSessionTitle = (session: SessionWithClient) => {
    // If the session has notes that look like calendar import text, extract the clean appointment name
    if (session.notes && session.notes.includes('Imported from Google Calendar')) {
      const cleanedNotes = cleanCalendarImportText(session.notes);
      // If the cleaned notes look like an appointment name, use that instead of client name
      if (cleanedNotes && cleanedNotes.includes('Appointment')) {
        return cleanedNotes.replace(' Appointment', '');
      }
    }
    return session.clientName;
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="sessions-loading">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="sessions-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground">
            All therapy sessions across clients
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
              data-testid="session-search"
            />
          </div>
        </div>
      </div>

      {/* Session Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{sessions?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Unique Clients</p>
                <p className="text-2xl font-bold">
                  {sessions ? new Set(sessions.map(s => s.clientId)).size : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">With Documents</p>
                <p className="text-2xl font-bold">
                  {sessions?.filter(s => (s as any).documentCount > 0).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {filteredSessions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? 'No sessions found' : 'No sessions yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery 
                  ? 'Try adjusting your search terms' 
                  : 'Sessions will appear here once they are synced from your calendar'
                }
              </p>
              {!searchQuery && (
                <Link href="/calendar/sync-dashboard">
                  <Button>
                    <Calendar className="w-4 h-4 mr-2" />
                    Setup Calendar Sync
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredSessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow" data-testid={`session-card-${session.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    {/* Session Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold flex items-center space-x-2">
                          <span data-testid={`session-client-${session.id}`}>{getCleanSessionTitle(session)}</span>
                          {session.externalEventId && (
                            <Badge variant="outline" className="text-xs">
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Calendar
                            </Badge>
                          )}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span data-testid={`session-date-${session.id}`}>{formatDate(session.sessionDate)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatTime(session.sessionDate)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span>{formatDuration(session.duration)}</span>
                          </div>
                        </div>
                      </div>
                      <Link href={`/session/${session.id}`}>
                        <Button variant="outline" size="sm" data-testid={`view-session-${session.id}`}>
                          View Details
                        </Button>
                      </Link>
                    </div>

                    {/* Session Type */}
                    {session.sessionType && (
                      <Badge variant="secondary" className="w-fit">
                        {session.sessionType}
                      </Badge>
                    )}

                    {/* Session Notes Preview */}
                    {session.notes && (
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {(() => {
                            const cleanedNotes = cleanCalendarImportText(session.notes);
                            return cleanedNotes.length > 150 
                              ? `${cleanedNotes.substring(0, 150)}...` 
                              : cleanedNotes;
                          })()}
                        </p>
                      </div>
                    )}

                    {/* Session Meta */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center space-x-4">
                        {(session as any).documentCount > 0 && (
                          <div className="flex items-center space-x-1">
                            <FileText className="w-3 h-3" />
                            <span>{(session as any).documentCount} documents</span>
                          </div>
                        )}
                        {session.sourceCalendar && (
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>From Calendar</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}