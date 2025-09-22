import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Document } from "@shared/schema";

export function useDocuments(limit?: number) {
  return useQuery<Document[]>({
    queryKey: limit ? [`/api/documents?limit=${limit}`] : ["/api/documents"],
  });
}

export function useClientDocuments(clientId: string) {
  return useQuery<Document[]>({
    queryKey: ["/api/documents/client", clientId],
    enabled: !!clientId,
  });
}

export function useSearchDocuments() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("GET", `/api/documents/search?q=${encodeURIComponent(query)}`);
      return response.json();
    },
    onError: (error) => {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUploadDocuments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ files, clientId }: { files: FileList; clientId?: string }) => {
      const formData = new FormData();
      
      Array.from(files).forEach(file => {
        formData.append("files", file);
      });
      
      if (clientId) {
        formData.append("clientId", clientId);
      }

      // Handle file upload with CSRF token
      const headers: Record<string, string> = {};
      
      // Fetch CSRF token for file upload
      try {
        const csrfResponse = await fetch("/api/csrf-token", {
          credentials: "include",
        });
        if (csrfResponse.ok) {
          const { csrfToken } = await csrfResponse.json();
          headers["X-CSRF-Token"] = csrfToken;
        }
      } catch (error) {
        console.error("Failed to fetch CSRF token for upload:", error);
      }
      
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        credentials: "include",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      // Also invalidate client-specific documents if uploading for a specific client
      if (variables.clientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/documents/client", variables.clientId] });
      }

      // Enhanced success messaging based on processing results
      const processingInfo = data.processingInfo;
      const successCount = processingInfo?.successfulUploads || data.results.length;
      const failedCount = processingInfo?.failedProcessing || 0;
      const autoLinkedCount = processingInfo?.autoLinkingPerformed || 0;
      const analysisType = processingInfo?.analysisType || 'Unknown';

      let description = `${successCount} file(s) uploaded successfully`;
      if (failedCount > 0) {
        description += `, ${failedCount} failed processing`;
      }
      if (autoLinkedCount > 0) {
        description += `, ${autoLinkedCount} auto-linked to sessions`;
      }
      description += ` (${analysisType} analysis)`;

      toast({
        title: "Upload Successful",
        description,
      });

      // Show additional notice if HIPAA AI is disabled
      if (data.notice) {
        setTimeout(() => {
          toast({
            title: "Processing Notice",
            description: data.notice,
            variant: "default",
          });
        }, 1000);
      }
    },
    onError: (error) => {
      // Enhanced error handling for HIPAA-specific errors
      let title = "Upload Failed";
      let description = error.message;
      
      if (error.message.includes("HIPAA")) {
        title = "HIPAA Compliance Issue";
        description = error.message;
      } else if (error.message.includes("Image uploads")) {
        title = "Image Upload Restricted";
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (documentId: string) => {
      await apiRequest("DELETE", `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document Deleted",
        description: "Document has been successfully deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
