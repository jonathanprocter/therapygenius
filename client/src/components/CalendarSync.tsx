import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  Shield,
  Users,
  Database,
  Zap
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDateTimeEastern } from '@/lib/utils';

interface CalendarSyncStatus {
  isAuthenticated: boolean;
  lastSync?: string;
  eventsProcessed: number;
  matchesFound: number;
  errors: string[];
  nextSync?: string;
  syncType: 'full' | 'incremental';
  syncToken?: string;
  rateLimitRemaining?: number;
  quotaUsed?: number;
}

interface CalendarSyncProps {
  className?: string;
  showFullDashboard?: boolean;
}

export function CalendarSync({ className, showFullDashboard = false }: CalendarSyncProps) {
  const [authUrl, setAuthUrl] = useState<string>('');
  const { toast } = useToast();

  // Get calendar sync status
  const { data: syncStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<CalendarSyncStatus>({
    queryKey: ['/api/calendar/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get auth URL mutation
  const getAuthUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/calendar/auth');
      return response.json();
    },
    onSuccess: (data) => {
      setAuthUrl(data.authUrl);
    },
    onError: (error) => {
      toast({
        title: "Authentication Error",
        description: error instanceof Error ? error.message : "Failed to generate auth URL",
        variant: "destructive",
      });
    },
  });

  // Calendar sync mutation
  const syncMutation = useMutation({
    mutationFn: async (forceFullSync: boolean = false) => {
      const response = await apiRequest('POST', '/api/calendar/sync', { forceFullSync });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Calendar Sync Complete",
        description: `Processed ${data.eventsProcessed} events, found ${data.matchesFound} matches`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
    onError: (error) => {
      toast({
        title: "Sync Error",
        description: error instanceof Error ? error.message : "Calendar sync failed",
        variant: "destructive",
      });
      refetchStatus();
    },
  });

  // Disconnect calendar mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/calendar/disconnect');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Calendar Disconnected",
        description: "Google Calendar has been disconnected successfully",
      });
      setAuthUrl('');
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/status'] });
    },
    onError: (error) => {
      toast({
        title: "Disconnect Error",
        description: error instanceof Error ? error.message : "Failed to disconnect calendar",
        variant: "destructive",
      });
    },
  });

  const handleConnectCalendar = () => {
    getAuthUrlMutation.mutate();
  };

  const handleAuthClick = () => {
    if (authUrl) {
      window.open(authUrl, '_blank', 'width=600,height=600');
      
      // Poll for authentication completion
      const pollInterval = setInterval(() => {
        refetchStatus().then((result) => {
          if (result.data?.isAuthenticated) {
            clearInterval(pollInterval);
            toast({
              title: "Authentication Successful",
              description: "Google Calendar connected successfully",
            });
            setAuthUrl('');
          }
        });
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 300000);
    }
  };

  const status: CalendarSyncStatus = syncStatus || {
    isAuthenticated: false,
    eventsProcessed: 0,
    matchesFound: 0,
    errors: [],
    syncType: 'full'
  };

  // Using Eastern Time formatting for consistent timezone display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return formatDateTimeEastern(dateString);
  };

  const getStatusColor = () => {
    if (!status.isAuthenticated) return 'bg-gray-100 text-gray-800';
    if (status.errors.length > 0) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = () => {
    if (!status.isAuthenticated) return 'Disconnected';
    if (status.errors.length > 0) return 'Sync Issues';
    return 'Connected';
  };

  if (statusLoading && !syncStatus) {
    return (
      <Card className={className} data-testid="calendar-sync-loading">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Google Calendar Integration</CardTitle>
              <p className="text-sm text-muted-foreground">Loading sync status...</p>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={`${className} ${status.isAuthenticated ? 'border-green-200' : 'border-gray-200'}`} data-testid="calendar-sync">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              status.isAuthenticated ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <Calendar className={`w-4 h-4 ${
                status.isAuthenticated ? 'text-green-600' : 'text-gray-600'
              }`} />
            </div>
            <div>
              <CardTitle className="text-lg">Google Calendar Integration</CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className={getStatusColor()} data-testid="sync-status">
                  {getStatusText()}
                </Badge>
                {status.isAuthenticated && (
                  <Badge variant="outline" className="text-xs" data-testid="sync-type">
                    {status.syncType} sync
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {status.isAuthenticated ? (
              <>
                <Button
                  onClick={() => syncMutation.mutate(false)}
                  disabled={syncMutation.isPending}
                  size="sm"
                  data-testid="sync-calendar"
                >
                  {syncMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync Now
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  size="sm"
                  data-testid="disconnect-calendar"
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnectCalendar}
                disabled={getAuthUrlMutation.isPending}
                data-testid="connect-calendar"
              >
                {getAuthUrlMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect Calendar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Authentication Flow */}
        {authUrl && (
          <Alert className="border-blue-200 bg-blue-50" data-testid="auth-alert">
            <ExternalLink className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="text-blue-800">
                  Click the button below to authenticate with Google Calendar (jonathan.procter@gmail.com, 2015-2030 EST/EDT):
                </p>
                <Button onClick={handleAuthClick} className="w-full" data-testid="auth-button">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Authenticate with Google
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {status.errors.length > 0 && (
          <Alert variant="destructive" data-testid="sync-errors">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Sync Issues:</p>
                <ul className="text-sm space-y-1">
                  {status.errors.map((error, index) => (
                    <li key={index} className="text-red-700">• {error}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* HIPAA Compliance Notice */}
        <Alert className="border-purple-200 bg-purple-50" data-testid="hipaa-notice">
          <Shield className="h-4 w-4 text-purple-600" />
          <AlertDescription>
            <div className="text-purple-800">
              <p className="font-medium mb-1">HIPAA Compliance Active</p>
              <p className="text-sm">
                All calendar data is processed with encrypted storage and audit logging. 
                AI operations use deidentified matching for client privacy protection.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Sync Statistics */}
        {status.isAuthenticated && (
          <>
            <Separator />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center space-y-1" data-testid="events-processed">
                <div className="text-2xl font-semibold text-blue-600">
                  {status.eventsProcessed.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Events Processed</div>
              </div>
              
              <div className="text-center space-y-1" data-testid="matches-found">
                <div className="text-2xl font-semibold text-green-600">
                  {status.matchesFound.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Matches Found</div>
              </div>
              
              <div className="text-center space-y-1" data-testid="quota-usage">
                <div className="text-2xl font-semibold text-orange-600">
                  {status.quotaUsed?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-muted-foreground">API Quota Used</div>
              </div>
              
              <div className="text-center space-y-1" data-testid="rate-limit">
                <div className="text-2xl font-semibold text-purple-600">
                  {status.rateLimitRemaining?.toLocaleString() || '∞'}
                </div>
                <div className="text-xs text-muted-foreground">Rate Limit</div>
              </div>
            </div>

            <div className="space-y-3" data-testid="sync-timing">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Last Sync:
                </span>
                <span className="font-medium">{formatDate(status.lastSync)}</span>
              </div>
              
              {status.nextSync && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center">
                    <Zap className="w-4 h-4 mr-1" />
                    Next Sync:
                  </span>
                  <span className="font-medium">{formatDate(status.nextSync)}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Quick Actions for Full Dashboard */}
        {showFullDashboard && status.isAuthenticated && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate(true)}
                disabled={syncMutation.isPending}
                data-testid="force-full-sync"
              >
                <Database className="w-4 h-4 mr-2" />
                Force Full Sync
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchStatus()}
                data-testid="refresh-status"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Status
              </Button>
            </div>
          </>
        )}

        {/* Getting Started Guide */}
        {!status.isAuthenticated && !authUrl && (
          <div className="text-center py-6 space-y-4" data-testid="getting-started">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Connect Your Calendar</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Automatically sync your Google Calendar appointments and create therapy sessions 
                with AI-powered client matching.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-sm">
              <div className="flex flex-col items-center space-y-2 p-3 bg-muted/50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-center">
                  <div className="font-medium">1. Authenticate</div>
                  <div className="text-muted-foreground">Connect with Google OAuth</div>
                </div>
              </div>
              
              <div className="flex flex-col items-center space-y-2 p-3 bg-muted/50 rounded-lg">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-green-600" />
                </div>
                <div className="text-center">
                  <div className="font-medium">2. AI Matching</div>
                  <div className="text-muted-foreground">Events matched to clients</div>
                </div>
              </div>
              
              <div className="flex flex-col items-center space-y-2 p-3 bg-muted/50 rounded-lg">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Database className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-center">
                  <div className="font-medium">3. Auto Sessions</div>
                  <div className="text-muted-foreground">Sessions created automatically</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}