import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Database,
  Search,
  Filter,
  Download,
  Eye,
  XCircle,
  Activity,
  BarChart3,
  Timer,
  AlertCircle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, isAfter, isBefore } from 'date-fns';

interface SyncHistoryItem {
  id: string;
  startTime: string;
  endTime?: string;
  status: 'completed' | 'failed' | 'running';
  syncType: 'incremental' | 'full';
  triggerSource: 'automatic' | 'user_manual' | 'api';
  processingTimeMs?: number;
  eventsTotal: number;
  eventsMatched: number;
  eventsRejected: number;
  eventsError: number;
  sessionsCreated: number;
  sessionsUpdated: number;
  errors?: Array<{
    message: string;
    eventId?: string;
    eventTitle?: string;
  }>;
  syncDetails?: any;
}

export default function CalendarSyncDashboard() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [statusFilter, setStatusFilter] = useState('all');
  const [triggerFilter, setTriggerFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get enhanced sync status with detailed history
  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ['/api/calendar/sync-status'],
    refetchInterval: 5000,
  });

  // Filter sync history based on selected criteria
  const filteredHistory = ((syncStatus as any)?.recentHistory || []).filter((sync: SyncHistoryItem) => {
    // Time range filter
    const syncDate = new Date(sync.startTime);
    const daysAgo = parseInt(selectedTimeRange.replace('d', ''));
    const cutoffDate = subDays(new Date(), daysAgo);
    
    if (selectedTimeRange !== 'all' && isBefore(syncDate, cutoffDate)) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all' && sync.status !== statusFilter) {
      return false;
    }

    // Trigger filter
    if (triggerFilter !== 'all' && sync.triggerSource !== triggerFilter) {
      return false;
    }

    // Search filter
    if (searchQuery && !sync.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !sync.syncType.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !sync.triggerSource.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Calculate metrics for filtered data
  const metrics = {
    totalSyncs: filteredHistory.length,
    successfulSyncs: filteredHistory.filter((s: SyncHistoryItem) => s.status === 'completed').length,
    failedSyncs: filteredHistory.filter((s: SyncHistoryItem) => s.status === 'failed').length,
    avgProcessingTime: filteredHistory.reduce((acc: number, s: SyncHistoryItem) => 
      acc + (s.processingTimeMs || 0), 0) / filteredHistory.length || 0,
    totalEventsProcessed: filteredHistory.reduce((acc: number, s: SyncHistoryItem) => 
      acc + s.eventsTotal, 0),
    totalEventsMatched: filteredHistory.reduce((acc: number, s: SyncHistoryItem) => 
      acc + s.eventsMatched, 0),
    totalErrors: filteredHistory.reduce((acc: number, s: SyncHistoryItem) => 
      acc + (s.errors ? s.errors.length : 0), 0),
  };

  // Get error details for failed syncs
  const errorDetails = filteredHistory
    .filter((s: SyncHistoryItem) => s.errors && s.errors.length > 0)
    .flatMap((s: SyncHistoryItem) => s.errors?.map(error => ({ ...error, syncId: s.id, syncTime: s.startTime })) || []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'running': return <RefreshCw className="w-4 h-4 text-yellow-600 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTriggerBadge = (trigger: string) => {
    const variants: { [key: string]: { variant: any; label: string } } = {
      'automatic': { variant: 'secondary', label: 'Auto' },
      'user_manual': { variant: 'default', label: 'Manual' },
      'api': { variant: 'outline', label: 'API' },
    };
    
    const config = variants[trigger] || { variant: 'outline', label: trigger };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="sync-dashboard">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Calendar Sync Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive view of calendar synchronization history and outcomes
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" data-testid="export-data">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline" size="sm" data-testid="refresh-data">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filters & Search</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time-range">Time Range</Label>
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger data-testid="time-range-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger-filter">Trigger Source</Label>
              <Select value={triggerFilter} onValueChange={setTriggerFilter}>
                <SelectTrigger data-testid="trigger-filter-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="user_manual">Manual</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search syncs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Syncs</p>
                <p className="text-2xl font-bold">{metrics.totalSyncs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {metrics.totalSyncs > 0 ? Math.round((metrics.successfulSyncs / metrics.totalSyncs) * 100) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Timer className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Time</p>
                <p className="text-2xl font-bold">{Math.round(metrics.avgProcessingTime / 1000)}s</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Events Processed</p>
                <p className="text-2xl font-bold">{metrics.totalEventsProcessed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="history" className="space-y-6">
        <TabsList>
          <TabsTrigger value="history" data-testid="history-tab">Sync History</TabsTrigger>
          <TabsTrigger value="errors" data-testid="errors-tab">Error Details</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="analytics-tab">Analytics</TabsTrigger>
        </TabsList>

        {/* Sync History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Sync History ({filteredHistory.length} records)</span>
                </div>
                {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No sync records found for the selected criteria</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHistory.map((sync: SyncHistoryItem) => (
                      <div key={sync.id} className="border rounded-lg p-4 space-y-3" data-testid={`sync-record-${sync.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(sync.status)}
                            <div>
                              <p className="font-medium text-sm">{sync.syncType} sync</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(sync.startTime), 'MMM dd, yyyy HH:mm:ss')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {getTriggerBadge(sync.triggerSource)}
                            <Badge variant={sync.status === 'completed' ? 'outline' : 'destructive'} className="text-xs">
                              {sync.status}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Events Total</p>
                            <p className="font-medium">{sync.eventsTotal}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Matched</p>
                            <p className="font-medium text-green-600">{sync.eventsMatched}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Rejected</p>
                            <p className="font-medium text-orange-600">{sync.eventsRejected}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Processing Time</p>
                            <p className="font-medium">
                              {sync.processingTimeMs ? `${Math.round(sync.processingTimeMs / 1000)}s` : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {sync.errors && sync.errors.length > 0 && (
                          <Alert className="border-red-200 bg-red-50">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800">
                              {sync.errors.length} error(s) occurred during this sync
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="text-xs text-muted-foreground">
                            Sessions: {sync.sessionsCreated} created, {sync.sessionsUpdated} updated
                          </div>
                          <Button variant="ghost" size="sm" data-testid={`view-details-${sync.id}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Details Tab */}
        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span>Error Details ({errorDetails.length} errors)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {errorDetails.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <p className="text-muted-foreground">No errors found for the selected time range</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {errorDetails.map((error: any, index: number) => (
                    <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50" data-testid={`error-${index}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-red-900">{error.message}</p>
                          {error.eventTitle && (
                            <p className="text-sm text-red-700 mt-1">Event: {error.eventTitle}</p>
                          )}
                          <p className="text-xs text-red-600 mt-2">
                            Sync: {error.syncId} • {format(new Date(error.syncTime), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 ml-3" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Performance Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-lg font-semibold text-green-600">
                      {metrics.totalEventsMatched}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Events Matched</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-lg font-semibold text-orange-600">
                      {metrics.totalEventsProcessed - metrics.totalEventsMatched}
                    </div>
                    <div className="text-xs text-muted-foreground">Events Rejected</div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Match Rate:</span>
                    <span className="font-medium">
                      {metrics.totalEventsProcessed > 0 ? 
                        Math.round((metrics.totalEventsMatched / metrics.totalEventsProcessed) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Processing Time:</span>
                    <span className="font-medium">{Math.round(metrics.avgProcessingTime / 1000)}s</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Error Rate:</span>
                    <span className={`font-medium ${metrics.totalErrors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {metrics.totalSyncs > 0 ? 
                        Math.round((metrics.failedSyncs / metrics.totalSyncs) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>System Health</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Overall System Status</span>
                    <Badge variant={metrics.failedSyncs === 0 ? 'default' : 'destructive'}>
                      {metrics.failedSyncs === 0 ? 'Healthy' : 'Issues Detected'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Recent Sync Success Rate</span>
                    <span className={`font-medium ${
                      metrics.totalSyncs > 0 && (metrics.successfulSyncs / metrics.totalSyncs) >= 0.9 ? 
                        'text-green-600' : 'text-orange-600'
                    }`}>
                      {metrics.totalSyncs > 0 ? Math.round((metrics.successfulSyncs / metrics.totalSyncs) * 100) : 0}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Errors</span>
                    <span className={`font-medium ${metrics.totalErrors === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.totalErrors}
                    </span>
                  </div>
                </div>

                {metrics.totalErrors > 0 && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      Recent sync operations have encountered errors. Check the Error Details tab for more information.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}