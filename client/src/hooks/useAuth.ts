import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

export function useAuth() {
  const [location] = useLocation();
  
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
    enabled: location !== "/login", // Don't make auth requests on login page
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false, // Prevent excessive refetching
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
  };
}
