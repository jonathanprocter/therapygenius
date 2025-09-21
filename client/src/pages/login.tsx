import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/auth/simple-login", { password });
      const data = await response.json();
      
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      toast({
        title: "Access Granted",
        description: "Welcome to your therapy practice management system!",
      });
      
      setLocation("/");
    } catch (error) {
      toast({
        title: "Access Denied",
        description: "Incorrect password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" data-testid="login-page">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-brain text-primary-foreground text-2xl"></i>
          </div>
          <h1 className="text-3xl font-bold">TherapyFlow</h1>
          <p className="text-muted-foreground mt-2">
            Professional therapy practice management with AI-powered insights
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Access Your Practice</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="practice-password">Practice Password</Label>
                <Input
                  id="practice-password"
                  type="password"
                  placeholder="Enter your practice password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="practice-password"
                  autoFocus
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="login-submit"
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Accessing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt mr-2"></i>
                    Access Practice
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>
            Secure access to your therapy practice management system
          </p>
        </div>
      </div>
    </div>
  );
}
