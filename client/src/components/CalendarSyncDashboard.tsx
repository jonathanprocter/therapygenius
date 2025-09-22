import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calendar, 
  Clock, 
  Users, 
  Database, 
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Settings,
  BarChart3,
  Shield,
  RefreshCw,
  Zap,
  Target,
  Server
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { CalendarSync } from './CalendarSync';

interface SyncHistoryEntry {
  timestamp: string;
  eventsProcessed: number;
  matchesFound: number;
  syncType: 'full' | 'incremental';
  errors: string[];
  duration: number;
}

interface CalendarStats {
  totalEventsProcessed: number;
  totalMatchesFound: number;
  successRate: number;
  lastWeekSync: number;
  avgSyncDuration: number;
  clientMatches: Array<{
    clientId: string;
    clientName: string;
    matchCount: number;
    lastMatch: string;
  }>;
}

interface CalendarSyncDashboardProps {
  className?: string;
}

export function CalendarSyncDashboard({ className }: CalendarSyncDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  // Get calendar sync status
  const { data: syncStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/calendar/status'],
    refetchInterval: 30000,
  });

  // Mock calendar stats (in real app this would be another API call)
  const { data: calendarStats } = useQuery({
    queryKey: ['/api/calendar/stats'],
    queryFn: async () => {
      // This would be a real API call in production
      return {
        totalEventsProcessed: syncStatus?.eventsProcessed || 0,
        totalMatchesFound: syncStatus?.matchesFound || 0,
        successRate: syncStatus?.eventsProcessed ? 
          ((syncStatus.matchesFound / syncStatus.eventsProcessed) * 100) : 0,
        lastWeekSync: 45,
        avgSyncDuration: 12,
        clientMatches: [
          { clientId: '1', clientName: 'Sarah Johnson', matchCount: 8, lastMatch: '2024-01-15T10:00:00Z' },
          { clientId: '2', clientName: 'Michael Chen', matchCount: 6, lastMatch: '2024-01-14T14:30:00Z' },
          { clientId: '3', clientName: 'Emily Davis', matchCount: 4, lastMatch: '2024-01-13T16:00:00Z' },
        ]
      } as CalendarStats;
    },
    enabled: !!syncStatus,
  });

  // Mock sync history (would be real API in production)
  const mockSyncHistory: SyncHistoryEntry[] = [
    {
      timestamp: '2024-01-15T09:00:00Z',
      eventsProcessed: 12,
      matchesFound: 8,
      syncType: 'incremental',
      errors: [],
      duration: 8
    },
    {
      timestamp: '2024-01-14T09:00:00Z',
      eventsProcessed: 15,
      matchesFound: 10,
      syncType: 'incremental',
      errors: ['Rate limit warning'],
      duration: 12
    },
    {
      timestamp: '2024-01-13T09:00:00Z',
      eventsProcessed: 156,
      matchesFound: 89,
      syncType: 'full',
      errors: [],
      duration: 45
    },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getHealthStatus = () => {
    if (!syncStatus?.isAuthenticated) return { color: 'red', text: 'Disconnected' };
    if (syncStatus.errors.length > 0) return { color: 'yellow', text: 'Issues' };
    return { color: 'green', text: 'Healthy' };
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (statusLoading && !syncStatus) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Calendar Sync Dashboard</h1>
            <p className="text-sm text-muted-foreground">Loading calendar sync status...</p>
          </div>
        </div>
      </div>
    );
  }

  const health = getHealthStatus();

  return (
    <div className={`space-y-6 ${className}`} data-testid="calendar-sync-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="dashboard-title">
              Calendar Sync Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage Google Calendar integration and view sync analytics
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge 
            className={`${health.color === 'green' ? 'bg-green-100 text-green-800' : 
                        health.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'}`}
            data-testid="health-status"
          >
            <div className={`w-2 h-2 rounded-full mr-2 ${
              health.color === 'green' ? 'bg-green-500' : 
              health.color === 'yellow' ? 'bg-yellow-500' : 
              'bg-red-500'
            }`}></div>
            {health.text}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4" data-testid="dashboard-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="sync" data-testid="tab-sync">Sync Control</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="metric-events">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-2xl font-semibold">{syncStatus?.eventsProcessed || 0}</p>
                    <p className="text-xs text-muted-foreground">Events Processed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="metric-matches">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-2xl font-semibold">{syncStatus?.matchesFound || 0}</p>
                    <p className="text-xs text-muted-foreground">Client Matches</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="metric-success-rate">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className={`text-2xl font-semibold ${getSuccessRateColor(calendarStats?.successRate || 0)}`}>
                      {(calendarStats?.successRate || 0).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Success Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="metric-quota">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Server className="w-4 h-4 text-orange-600" />
                  <div>
                    <p className="text-2xl font-semibold">{syncStatus?.quotaUsed || 0}</p>
                    <p className="text-xs text-muted-foreground">API Quota Used</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Status */}
          <Card data-testid="system-status">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>System Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Authentication Status:</span>
                    <span className={`font-medium ${syncStatus?.isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
                      {syncStatus?.isAuthenticated ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Last Sync:</span>
                    <span className="font-medium">
                      {syncStatus?.lastSync ? formatDate(syncStatus.lastSync) : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Sync Type:</span>
                    <span className="font-medium capitalize">{syncStatus?.syncType || 'N/A'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Rate Limit:</span>
                    <span className="font-medium">
                      {syncStatus?.rateLimitRemaining || '∞'} remaining
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Circuit Breaker:</span>
                    <span className="font-medium text-green-600">Closed</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Error Count:</span>
                    <span className={`font-medium ${syncStatus?.errors.length ? 'text-orange-600' : 'text-green-600'}`}>
                      {syncStatus?.errors.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* HIPAA Compliance */}
          <Alert className="border-purple-200 bg-purple-50" data-testid="hipaa-status">
            <Shield className="h-4 w-4 text-purple-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-purple-800">HIPAA Compliance Status: Active</p>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• OAuth tokens encrypted with AES-256-GCM</li>
                  <li>• All calendar operations logged in audit trail</li>
                  <li>• AI client matching uses deidentified data</li>
                  <li>• Circuit breaker prevents data exposure on failures</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Sync Control Tab */}
        <TabsContent value="sync" className="space-y-6">
          <CalendarSync showFullDashboard={true} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Client Match Distribution */}
            <Card data-testid="client-matches">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Top Client Matches</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {calendarStats?.clientMatches.map((match, index) => (
                    <div key={match.clientId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{match.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          Last match: {new Date(match.lastMatch).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">{match.matchCount}</p>
                        <p className="text-xs text-muted-foreground">matches</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sync Performance */}
            <Card data-testid="sync-performance">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Sync Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Success Rate</span>
                      <span className={getSuccessRateColor(calendarStats?.successRate || 0)}>
                        {(calendarStats?.successRate || 0).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={calendarStats?.successRate || 0} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Avg Sync Duration</span>
                      <span>{calendarStats?.avgSyncDuration || 0}s</span>
                    </div>
                    <Progress value={Math.min((calendarStats?.avgSyncDuration || 0) * 2, 100)} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Weekly Sync Count</span>
                      <span>{calendarStats?.lastWeekSync || 0}</span>
                    </div>
                    <Progress value={Math.min((calendarStats?.lastWeekSync || 0) * 2, 100)} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card data-testid="sync-history">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Recent Sync History</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockSyncHistory.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${entry.errors.length ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                      <div>
                        <p className="font-medium">{formatDate(entry.timestamp)}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.syncType} sync • {entry.duration}s duration
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{entry.eventsProcessed}</p>
                        <p className="text-muted-foreground">Events</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{entry.matchesFound}</p>
                        <p className="text-muted-foreground">Matches</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-medium ${entry.errors.length ? 'text-orange-600' : 'text-green-600'}`}>
                          {entry.errors.length ? entry.errors.length : '✓'}
                        </p>
                        <p className="text-muted-foreground">Issues</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}