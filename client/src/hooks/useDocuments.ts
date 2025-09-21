import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Document } from "@shared/schema";

export function useDocuments(limit?: number) {
  return useQuery({
    queryKey: ["/api/documents", limit],
    queryFn: () => {
      const url = limit ? `/api/documents?limit=${limit}` : "/api/documents";
      return fetch(url, { credentials: "include" }).then(res => res.json());
    },
  });
}

export function useClientDocuments(clientId: string) {
  return useQuery({
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

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
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
