import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

// Pages
import Dashboard from "@/pages/dashboard";
import ClientChart from "@/pages/client-chart";
import SessionDetail from "@/pages/session-detail";
import Documents from "@/pages/documents";
import Clients from "@/pages/clients";
import CalendarSettings from "@/pages/calendar-settings";
import CalendarSyncDashboard from "@/pages/calendar-sync-dashboard";
import NotFound from "@/pages/not-found";
import Reports from "@/pages/reports";
import Assessments from "@/pages/assessments";
import AISmartSearch from "@/pages/ai/smart-search";
import AICaseInsights from "@/pages/ai/case-insights";
import AIDocumentAnalysis from "@/pages/ai/document-analysis";
import CalendarReviews from "@/pages/calendar-reviews";
import CalendarAliases from "@/pages/calendar-aliases";

function AppHeader({ onMenuToggle, isMobileMenuOpen }: { onMenuToggle?: () => void; isMobileMenuOpen?: boolean }) {
  const isMobile = useIsMobile();
  
  return (
    <header className="bg-card border-b border-border safe-area-top" data-testid="app-header">
      <div className="px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          {/* Mobile menu button and title */}
          <div className="flex items-center space-x-3">
            {isMobile && (
              <button
                onClick={onMenuToggle}
                className="touch-target p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="mobile-menu-toggle"
                aria-label="Toggle navigation menu"
              >
                <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-lg`}></i>
              </button>
            )}
            <div>
              <h1 className="text-xl lg:text-2xl font-semibold" data-testid="page-title">
                {isMobile ? "TherapyFlow" : "Dashboard"}
              </h1>
              {!isMobile && (
                <p className="text-sm text-muted-foreground">
                  Welcome back, Dr. Jonathan Procter
                </p>
              )}
            </div>
          </div>
          
          {/* Desktop actions */}
          {!isMobile && (
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
              <button className="relative touch-target p-2 text-muted-foreground hover:text-foreground transition-colors" data-testid="notifications">
                <i className="fas fa-bell"></i>
              </button>
              
              {/* Quick Actions */}
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors touch-target" data-testid="new-session">
                <i className="fas fa-plus mr-2"></i>
                New Session
              </button>
            </div>
          )}
          
          {/* Mobile actions */}
          {isMobile && (
            <div className="flex items-center space-x-2">
              <button className="touch-target p-2 text-muted-foreground hover:text-foreground transition-colors" data-testid="mobile-search">
                <i className="fas fa-search text-lg"></i>
              </button>
              <button className="touch-target p-2 text-muted-foreground hover:text-foreground transition-colors" data-testid="mobile-notifications">
                <i className="fas fa-bell text-lg"></i>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MobileNavigation({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigationItems = [
    { path: "/", icon: "fas fa-chart-line", label: "Dashboard" },
    { path: "/clients", icon: "fas fa-users", label: "Clients" },
    { path: "/calendar/settings", icon: "fas fa-calendar-alt", label: "Calendar Sync" },
    { path: "/calendar/sync-dashboard", icon: "fas fa-analytics", label: "Sync Dashboard" },
    { path: "/calendar/reviews", icon: "fas fa-exclamation-triangle", label: "Calendar Reviews" },
    { path: "/calendar/aliases", icon: "fas fa-link", label: "Calendar Aliases" },
    { path: "/documents", icon: "fas fa-file-medical", label: "Documents" },
    { path: "/assessments", icon: "fas fa-clipboard-list", label: "Assessments" },
    { path: "/reports", icon: "fas fa-chart-bar", label: "Reports" },
  ];

  const aiToolsItems = [
    { path: "/ai/document-analysis", icon: "fas fa-magic", label: "Document Analysis" },
    { path: "/ai/case-insights", icon: "fas fa-lightbulb", label: "Case Insights" },
    { path: "/ai/smart-search", icon: "fas fa-search", label: "Smart Search" },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
        onClick={onClose}
        data-testid="mobile-nav-backdrop"
      />
      
      {/* Mobile Navigation */}
      <nav className="fixed top-0 left-0 h-full w-80 bg-card border-r border-border z-50 lg:hidden safe-area-inset scroll-smooth-ios" data-testid="mobile-navigation">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-brain text-primary-foreground text-sm"></i>
              </div>
              <span className="text-xl font-semibold">TherapyFlow</span>
            </div>
            <button 
              onClick={onClose}
              className="touch-target p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="mobile-nav-close"
            >
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {/* Main Navigation */}
          <ul className="space-y-2 mb-8">
            {navigationItems.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  onClick={onClose}
                  className="mobile-nav-item text-muted-foreground hover:text-foreground hover:bg-muted"
                  data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <i className={`${item.icon} w-5 mr-4`}></i>
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          
          {/* AI Tools Section */}
          <div>
            <h3 className="px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">AI Tools</h3>
            <ul className="space-y-2">
              {aiToolsItems.map((item) => (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    onClick={onClose}
                    className="mobile-nav-item text-muted-foreground hover:text-foreground hover:bg-muted"
                    data-testid={`mobile-nav-ai-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <i className={`${item.icon} w-5 mr-4`}></i>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* User Section */}
        <div className="p-4 border-t border-border safe-area-bottom">
          <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-medium text-sm">JP</span>
            </div>
            <div>
              <p className="font-medium text-sm">Dr. Jonathan Procter</p>
              <p className="text-xs text-muted-foreground">Licensed Therapist</p>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

function MainApp() {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };
  
  return (
    <div className="min-h-screen flex bg-background" data-testid="main-app">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}
      
      {/* Mobile Navigation */}
      <MobileNavigation isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader 
          onMenuToggle={toggleMobileMenu} 
          isMobileMenuOpen={isMobileMenuOpen}
        />
        
        <main className={`flex-1 overflow-y-auto scroll-smooth-ios ${
          isMobile ? 'p-4 safe-area-bottom' : 'p-6'
        }`}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/client-chart/:id" component={ClientChart} />
            <Route path="/session/:id" component={SessionDetail} />
            <Route path="/documents" component={Documents} />
            <Route path="/clients" component={Clients} />
            <Route path="/calendar/settings" component={CalendarSettings} />
            <Route path="/calendar/sync-dashboard" component={CalendarSyncDashboard} />
            <Route path="/calendar/reviews" component={CalendarReviews} />
            <Route path="/calendar/aliases" component={CalendarAliases} />
            <Route path="/schedule" component={() => <div>Schedule page coming soon</div>} />
            <Route path="/assessments" component={Assessments} />
            <Route path="/reports" component={Reports} />
            <Route path="/ai/document-analysis" component={AIDocumentAnalysis} />
            <Route path="/ai/case-insights" component={AICaseInsights} />
            <Route path="/ai/smart-search" component={AISmartSearch} />
            <Route component={NotFound} />
          </Switch>
        </main>
        
        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <nav className="bg-card border-t border-border safe-area-bottom" data-testid="mobile-bottom-nav">
            <div className="flex justify-around py-2">
              <Link href="/" className="flex flex-col items-center py-2 px-4 text-primary" data-testid="bottom-nav-dashboard">
                <i className="fas fa-chart-line text-lg mb-1"></i>
                <span className="text-xs font-medium">Dashboard</span>
              </Link>
              <Link href="/clients" className="flex flex-col items-center py-2 px-4 text-muted-foreground hover:text-foreground transition-colors" data-testid="bottom-nav-clients">
                <i className="fas fa-users text-lg mb-1"></i>
                <span className="text-xs font-medium">Clients</span>
              </Link>
              <Link href="/documents" className="flex flex-col items-center py-2 px-4 text-muted-foreground hover:text-foreground transition-colors" data-testid="bottom-nav-documents">
                <i className="fas fa-file-medical text-lg mb-1"></i>
                <span className="text-xs font-medium">Documents</span>
              </Link>
              <button 
                className="flex flex-col items-center py-2 px-4 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="bottom-nav-new-session"
              >
                <i className="fas fa-plus-circle text-lg mb-1"></i>
                <span className="text-xs font-medium">New</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

function Router() {
  return <MainApp />;
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
