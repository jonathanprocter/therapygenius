import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Client, Session, Assessment, TreatmentPlan } from "@shared/schema";

export function useClients() {
  return useQuery({
    queryKey: ["/api/clients"],
  });
}

export function useClient(clientId: string) {
  return useQuery({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId,
  });
}

export function useClientSessions(clientId: string) {
  return useQuery({
    queryKey: ["/api/sessions/client", clientId],
    enabled: !!clientId,
  });
}

export function useClientAssessments(clientId: string) {
  return useQuery({
    queryKey: ["/api/assessments/client", clientId],
    enabled: !!clientId,
  });
}

export function useClientTreatmentPlans(clientId: string) {
  return useQuery({
    queryKey: ["/api/treatment-plans/client", clientId],
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientData: Partial<Client>) => {
      const response = await apiRequest("POST", "/api/clients", clientData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client Created",
        description: "New client has been successfully added",
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Client> }) => {
      const response = await apiRequest("PUT", `/api/clients/${id}`, data);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", variables.id] });
      toast({
        title: "Client Updated",
        description: "Client information has been successfully updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sessionData: Partial<Session>) => {
      const response = await apiRequest("POST", "/api/sessions", sessionData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/client", data.clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/recent"] });
      toast({
        title: "Session Created",
        description: "Session note has been successfully saved",
      });
    },
    onError: (error) => {
      toast({
        title: "Session Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["/api/dashboard/stats"],
  });
}

export function useCaseConceptualization(clientId: string) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/ai/case-conceptualization/${clientId}`);
      return response.json();
    },
    onError: (error) => {
      toast({
        title: "AI Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
