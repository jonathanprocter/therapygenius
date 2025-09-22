import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Session AI Tagging Hooks
export function useSessionAITags(sessionId: string) {
  return useQuery({
    queryKey: ['/api/sessions', sessionId, 'ai-tags'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/sessions/${sessionId}/ai-tags`);
        const data = await response.json();
        return data;
      } catch (error: any) {
        // Enhanced error handling for queries
        if (error.message?.includes('404')) {
          return { hasAITags: false, tags: null };
        }
        throw new Error(`Failed to fetch session AI tags: ${error.message || 'Unknown error'}`);
      }
    },
    enabled: !!sessionId,
    retry: (failureCount, error: any) => {
      // Retry logic: retry on network errors, not on 4xx errors
      if (error.message?.includes('404') || error.message?.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useGenerateSessionAITags(sessionId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/sessions/${sessionId}/ai-tags/generate`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'ai-tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
      toast({
        title: 'AI Tags Generated',
        description: 'Session AI tags have been successfully generated.',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      let errorTitle = 'AI Tagging Failed';
      let errorDescription = 'Failed to generate session AI tags';
      
      if (error.message?.includes('401')) {
        errorTitle = 'Authentication Required';
        errorDescription = 'Please log in to generate AI tags';
      } else if (error.message?.includes('403')) {
        errorTitle = 'Access Denied';
        errorDescription = 'You do not have permission to generate AI tags for this session';
      } else if (error.message?.includes('404')) {
        errorTitle = 'Session Not Found';
        errorDescription = 'The session could not be found';
      } else if (error.message?.includes('500')) {
        errorTitle = 'Server Error';
        errorDescription = 'The AI tagging service is temporarily unavailable. Please try again later.';
      } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        errorTitle = 'Connection Error';
        errorDescription = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    },
  });
}

export function useRegenerateSessionAITags(sessionId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/sessions/${sessionId}/ai-tags/regenerate`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'ai-tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId] });
      toast({
        title: 'AI Tags Regenerated',
        description: 'Session AI tags have been successfully regenerated.',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      let errorTitle = 'AI Regeneration Failed';
      let errorDescription = 'Failed to regenerate session AI tags';
      
      if (error.message?.includes('401')) {
        errorTitle = 'Authentication Required';
        errorDescription = 'Please log in to regenerate AI tags';
      } else if (error.message?.includes('403')) {
        errorTitle = 'Access Denied';
        errorDescription = 'You do not have permission to regenerate AI tags for this session';
      } else if (error.message?.includes('404')) {
        errorTitle = 'Session Not Found';
        errorDescription = 'The session could not be found';
      } else if (error.message?.includes('500')) {
        errorTitle = 'Server Error';
        errorDescription = 'The AI tagging service is temporarily unavailable. Please try again later.';
      } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        errorTitle = 'Connection Error';
        errorDescription = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    },
  });
}

// Client AI Tagging Hooks
export function useClientAITags(clientId: string) {
  return useQuery({
    queryKey: ['/api/clients', clientId, 'ai-tags'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/clients/${clientId}/ai-tags`);
        const data = await response.json();
        return data;
      } catch (error: any) {
        // Enhanced error handling for queries
        if (error.message?.includes('404')) {
          return { hasAITags: false, tags: null };
        }
        throw new Error(`Failed to fetch client AI tags: ${error.message || 'Unknown error'}`);
      }
    },
    enabled: !!clientId,
    retry: (failureCount, error: any) => {
      // Retry logic: retry on network errors, not on 4xx errors
      if (error.message?.includes('404') || error.message?.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useGenerateClientAITags(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/clients/${clientId}/ai-tags/generate`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'ai-tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId] });
      toast({
        title: 'Client AI Tags Generated',
        description: 'Client AI tags have been successfully generated.',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      let errorTitle = 'Client AI Tagging Failed';
      let errorDescription = 'Failed to generate client AI tags';
      
      if (error.message?.includes('401')) {
        errorTitle = 'Authentication Required';
        errorDescription = 'Please log in to generate AI tags';
      } else if (error.message?.includes('403')) {
        errorTitle = 'Access Denied';
        errorDescription = 'You do not have permission to generate AI tags for this client';
      } else if (error.message?.includes('404')) {
        errorTitle = 'Client Not Found';
        errorDescription = 'The client could not be found';
      } else if (error.message?.includes('500')) {
        errorTitle = 'Server Error';
        errorDescription = 'The AI tagging service is temporarily unavailable. Please try again later.';
      } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        errorTitle = 'Connection Error';
        errorDescription = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    },
  });
}

export function useRegenerateClientAITags(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/clients/${clientId}/ai-tags/regenerate`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'ai-tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId] });
      toast({
        title: 'Client AI Tags Regenerated',
        description: 'Client AI tags have been successfully regenerated.',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      let errorTitle = 'Client AI Regeneration Failed';
      let errorDescription = 'Failed to regenerate client AI tags';
      
      if (error.message?.includes('401')) {
        errorTitle = 'Authentication Required';
        errorDescription = 'Please log in to regenerate AI tags';
      } else if (error.message?.includes('403')) {
        errorTitle = 'Access Denied';
        errorDescription = 'You do not have permission to regenerate AI tags for this client';
      } else if (error.message?.includes('404')) {
        errorTitle = 'Client Not Found';
        errorDescription = 'The client could not be found';
      } else if (error.message?.includes('500')) {
        errorTitle = 'Server Error';
        errorDescription = 'The AI tagging service is temporarily unavailable. Please try again later.';
      } else if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        errorTitle = 'Connection Error';
        errorDescription = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    },
  });
}

// Session Trends and Analytics Hooks
export function useSessionTrends(clientId: string, timeRange?: { startDate: string; endDate: string }) {
  const queryParams = new URLSearchParams();
  if (timeRange?.startDate) queryParams.append('startDate', timeRange.startDate);
  if (timeRange?.endDate) queryParams.append('endDate', timeRange.endDate);

  return useQuery({
    queryKey: ['/api/clients', clientId, 'session-trends', timeRange],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/clients/${clientId}/session-trends?${queryParams}`);
      return response.json();
    },
    enabled: !!clientId,
  });
}

export function useClientProgressInsights(clientId: string) {
  return useQuery({
    queryKey: ['/api/clients', clientId, 'progress-insights'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/clients/${clientId}/progress-insights`);
      return response.json();
    },
    enabled: !!clientId,
  });
}

export function useClientComprehensiveReport(clientId: string) {
  return useQuery({
    queryKey: ['/api/clients', clientId, 'comprehensive-report'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/clients/${clientId}/comprehensive-report`);
      return response.json();
    },
    enabled: !!clientId,
  });
}

export function useSessionAnalysis(clientId: string) {
  return useQuery({
    queryKey: ['/api/clients', clientId, 'session-analysis'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/clients/${clientId}/session-analysis`);
      return response.json();
    },
    enabled: !!clientId,
  });
}

// Search and Filtering Hooks
export function useSearchSessionsByTags(tags: string[]) {
  const queryParams = new URLSearchParams();
  tags.forEach(tag => queryParams.append('tags', tag));

  return useQuery({
    queryKey: ['/api/search/sessions-by-tags', tags],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/search/sessions-by-tags?${queryParams}`);
      return response.json();
    },
    enabled: tags.length > 0,
  });
}

export function useSearchClientsByTags(tags: string[]) {
  const queryParams = new URLSearchParams();
  tags.forEach(tag => queryParams.append('tags', tag));

  return useQuery({
    queryKey: ['/api/search/clients-by-tags', tags],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/search/clients-by-tags?${queryParams}`);
      return response.json();
    },
    enabled: tags.length > 0,
  });
}

// Enhanced Case Conceptualization Hook
export function useEnhancedCaseConceptualization(clientId: string) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/clients/${clientId}/case-conceptualization`);
      return response.json();
    },
    onError: (error: any) => {
      toast({
        title: 'Enhanced Case Conceptualization Failed',
        description: error.message || 'Failed to generate enhanced case conceptualization',
        variant: 'destructive',
      });
    },
  });
}

// Clinical Insights Summary Hook
export function useClinicalInsightsSummary() {
  return useQuery({
    queryKey: ['/api/ai-insights/clinical-summary'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/ai-insights/clinical-summary');
      return response.json();
    },
  });
}

// Bulk Operations Hooks
export function useBulkGenerateSessionTags() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sessionIds: string[]) => {
      const response = await apiRequest('POST', '/api/ai-tags/bulk/sessions', { sessionIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      toast({
        title: 'Bulk Session Tagging Complete',
        description: `Processed ${data.processed} sessions: ${data.successCount} successful, ${data.failureCount} failed`,
        variant: 'default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk Session Tagging Failed',
        description: error.message || 'Failed to perform bulk session tagging',
        variant: 'destructive',
      });
    },
  });
}

export function useBulkGenerateClientTags() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientIds: string[]) => {
      const response = await apiRequest('POST', '/api/ai-tags/bulk/clients', { clientIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({
        title: 'Bulk Client Tagging Complete',
        description: `Processed ${data.processed} clients: ${data.successCount} successful, ${data.failureCount} failed`,
        variant: 'default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk Client Tagging Failed',
        description: error.message || 'Failed to perform bulk client tagging',
        variant: 'destructive',
      });
    },
  });
}

// Document Assessment Generation Hooks
export function useGenerateDocumentAssessments(documentId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/documents/${documentId}/generate-assessments`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', documentId] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      // Invalidate assessments for the client if document is linked to one
      if (data.clientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/clients', data.clientId, 'assessments'] });
        queryClient.invalidateQueries({ queryKey: ['/api/clients', data.clientId, 'insights'] });
      }
      toast({
        title: 'Assessments Generated',
        description: `Successfully extracted ${data.assessmentsFound || 0} assessments from document.`,
        variant: 'default',
      });
    },
    onError: (error: any) => {
      let errorTitle = 'Assessment Generation Failed';
      let errorDescription = 'Failed to generate assessments from document';
      
      if (error.message?.includes('401')) {
        errorTitle = 'Authentication Required';
        errorDescription = 'Please log in to generate assessments';
      } else if (error.message?.includes('403')) {
        errorTitle = 'Access Denied';
        errorDescription = 'You do not have permission to generate assessments for this document';
      } else if (error.message?.includes('404')) {
        errorTitle = 'Document Not Found';
        errorDescription = 'The document could not be found';
      } else if (error.message?.includes('500')) {
        errorTitle = 'Server Error';
        errorDescription = 'The assessment generation service is temporarily unavailable. Please try again later.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    },
  });
}

// Client Assessment Generation Hooks (Batch)
export function useGenerateClientAssessments(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/clients/${clientId}/generate-assessments`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'assessments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'insights'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: 'Batch Assessment Generation Complete',
        description: `Successfully processed ${data.documentsProcessed || 0} documents and generated ${data.assessmentsCreated || 0} assessments.`,
        variant: 'default',
      });
    },
    onError: (error: any) => {
      let errorTitle = 'Batch Assessment Generation Failed';
      let errorDescription = 'Failed to generate assessments for client';
      
      if (error.message?.includes('401')) {
        errorTitle = 'Authentication Required';
        errorDescription = 'Please log in to generate assessments';
      } else if (error.message?.includes('403')) {
        errorTitle = 'Access Denied';
        errorDescription = 'You do not have permission to generate assessments for this client';
      } else if (error.message?.includes('404')) {
        errorTitle = 'Client Not Found';
        errorDescription = 'The client could not be found';
      } else if (error.message?.includes('500')) {
        errorTitle = 'Server Error';
        errorDescription = 'The assessment generation service is temporarily unavailable. Please try again later.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    },
  });
}

// Client Insights Hooks
export function useClientInsights(clientId: string) {
  return useQuery({
    queryKey: ['/api/clients', clientId, 'insights'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/clients/${clientId}/insights`);
        const data = await response.json();
        return data;
      } catch (error: any) {
        if (error.message?.includes('404')) {
          return { insights: null, hasInsights: false };
        }
        throw new Error(`Failed to fetch client insights: ${error.message || 'Unknown error'}`);
      }
    },
    enabled: !!clientId,
    retry: (failureCount, error: any) => {
      if (error.message?.includes('404') || error.message?.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useRecomputeClientInsights(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/clients/${clientId}/insights/recompute`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'insights'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/clinical-insights/summary'] });
      toast({
        title: 'Insights Recomputed',
        description: 'Client insights have been successfully recomputed with the latest data.',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      let errorTitle = 'Insights Recomputation Failed';
      let errorDescription = 'Failed to recompute client insights';
      
      if (error.message?.includes('401')) {
        errorTitle = 'Authentication Required';
        errorDescription = 'Please log in to recompute insights';
      } else if (error.message?.includes('403')) {
        errorTitle = 'Access Denied';
        errorDescription = 'You do not have permission to recompute insights for this client';
      } else if (error.message?.includes('404')) {
        errorTitle = 'Client Not Found';
        errorDescription = 'The client could not be found';
      } else if (error.message?.includes('500')) {
        errorTitle = 'Server Error';
        errorDescription = 'The insights service is temporarily unavailable. Please try again later.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    },
  });
}

// Client Recommendations Hooks
export function useGenerateClientRecommendations(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/clients/${clientId}/recommendations`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'insights'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId] });
      toast({
        title: 'Recommendations Generated',
        description: 'AI-powered treatment recommendations have been generated successfully.',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      let errorTitle = 'Recommendation Generation Failed';
      let errorDescription = 'Failed to generate treatment recommendations';
      
      if (error.message?.includes('401')) {
        errorTitle = 'Authentication Required';
        errorDescription = 'Please log in to generate recommendations';
      } else if (error.message?.includes('403')) {
        errorTitle = 'Access Denied';
        errorDescription = 'You do not have permission to generate recommendations for this client';
      } else if (error.message?.includes('404')) {
        errorTitle = 'Client Not Found';
        errorDescription = 'The client could not be found';
      } else if (error.message?.includes('500')) {
        errorTitle = 'Server Error';
        errorDescription = 'The recommendation service is temporarily unavailable. Please try again later.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    },
  });
}

// Client Reports Hooks
export function useClientReports(clientId: string) {
  return useQuery({
    queryKey: ['/api/clients', clientId, 'reports'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/clients/${clientId}/reports`);
        const data = await response.json();
        return data;
      } catch (error: any) {
        if (error.message?.includes('404')) {
          return { reports: [], hasReports: false };
        }
        throw new Error(`Failed to fetch client reports: ${error.message || 'Unknown error'}`);
      }
    },
    enabled: !!clientId,
    retry: (failureCount, error: any) => {
      if (error.message?.includes('404') || error.message?.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

// All Client Reports Hook - Uses useQueries to avoid Rules of Hooks violations
export function useAllClientReports(clientIds: string[]) {
  const queries = useQueries({
    queries: (clientIds || []).map((clientId) => ({
      queryKey: ['/api/clients', clientId, 'reports'],
      queryFn: async () => {
        try {
          const response = await apiRequest('GET', `/api/clients/${clientId}/reports`);
          const data = await response.json();
          return { clientId, ...data };
        } catch (error: any) {
          if (error.message?.includes('404')) {
            return { clientId, reports: [], hasReports: false };
          }
          throw new Error(`Failed to fetch client reports: ${error.message || 'Unknown error'}`);
        }
      },
      enabled: !!clientId,
      retry: (failureCount: number, error: any) => {
        if (error.message?.includes('404') || error.message?.includes('403')) {
          return false;
        }
        return failureCount < 2;
      },
    }))
  });

  // Aggregate results from all queries
  const isLoading = queries.some(query => query.isLoading);
  const hasError = queries.some(query => query.error);
  const errors = queries.filter(query => query.error).map(query => query.error);
  
  // Combine all reports from successful queries
  const allReportsData = queries
    .filter(query => query.data && !query.error)
    .map(query => query.data)
    .filter(data => data && data.reports);

  return {
    data: allReportsData,
    isLoading,
    hasError,
    errors,
    queries // Expose individual queries if needed for more granular control
  };
}

export function useGenerateClientReport(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (reportType: string = 'progress_report') => {
      const response = await apiRequest('POST', `/api/clients/${clientId}/reports/generate`, { reportType });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: 'Report Generated',
        description: `Clinical report has been generated successfully and saved as a document.`,
        variant: 'default',
      });
    },
    onError: (error: any) => {
      let errorTitle = 'Report Generation Failed';
      let errorDescription = 'Failed to generate clinical report';
      
      if (error.message?.includes('401')) {
        errorTitle = 'Authentication Required';
        errorDescription = 'Please log in to generate reports';
      } else if (error.message?.includes('403')) {
        errorTitle = 'Access Denied';
        errorDescription = 'You do not have permission to generate reports for this client';
      } else if (error.message?.includes('404')) {
        errorTitle = 'Client Not Found';
        errorDescription = 'The client could not be found';
      } else if (error.message?.includes('500')) {
        errorTitle = 'Server Error';
        errorDescription = 'The report generation service is temporarily unavailable. Please try again later.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    },
  });
}