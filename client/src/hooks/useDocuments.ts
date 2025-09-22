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
      toast({
        title: "Upload Successful",
        description: `${data.results.length} file(s) uploaded and processing`,
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
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
