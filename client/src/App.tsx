import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

// Pages
import Dashboard from "@/pages/dashboard";
import ClientChart from "@/pages/client-chart";
import Documents from "@/pages/documents";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

function AppHeader({ user }: { user?: any }) {
  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.firstName ? `Dr. ${user.firstName}` : user?.username || "User"}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Search Bar */}
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search clients, documents..." 
              className="w-80 pl-10 pr-4 py-2 bg-muted border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="global-search"
            />
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm"></i>
          </div>
          
          {/* Notifications */}
          <button className="relative p-2 text-muted-foreground hover:text-foreground" data-testid="notifications">
            <i className="fas fa-bell"></i>
          </button>
          
          {/* Quick Actions */}
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="new-session">
            <i className="fas fa-plus mr-2"></i>
            New Session
          </button>
        </div>
      </div>
    </header>
  );
}

function AuthenticatedApp({ user }: { user: any }) {
  return (
    <div className="min-h-screen flex" data-testid="authenticated-app">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/client-chart/:id" component={ClientChart} />
            <Route path="/documents" component={Documents} />
            <Route path="/clients" component={() => <div>Clients page coming soon</div>} />
            <Route path="/schedule" component={() => <div>Schedule page coming soon</div>} />
            <Route path="/assessments" component={() => <div>Assessments page coming soon</div>} />
            <Route path="/reports" component={() => <div>Reports page coming soon</div>} />
            <Route path="/ai/document-analysis" component={() => <div>AI Document Analysis coming soon</div>} />
            <Route path="/ai/case-insights" component={() => <div>AI Case Insights coming soon</div>} />
            <Route path="/ai/smart-search" component={() => <div>AI Smart Search coming soon</div>} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function Router() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Handle unauthorized errors globally
    const handleUnauthorized = () => {
      toast({
        title: "Session Expired",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
    };

    // Listen for unauthorized errors from React Query
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.state.error && isUnauthorizedError(event.query.state.error as Error)) {
        handleUnauthorized();
      }
    });

    return unsubscribe;
  }, [toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-screen">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-brain text-primary-foreground text-2xl"></i>
          </div>
          <div className="text-lg font-medium mb-2">TherapyFlow</div>
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <i className="fas fa-spinner fa-spin"></i>
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <AuthenticatedApp user={user} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
