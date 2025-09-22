import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navigationItems = [
  { path: "/", icon: "fas fa-chart-line", label: "Dashboard" },
  { path: "/clients", icon: "fas fa-users", label: "Clients" },
  { path: "/calendar/settings", icon: "fas fa-calendar-alt", label: "Calendar Sync" },
  { path: "/documents", icon: "fas fa-file-medical", label: "Documents" },
  { path: "/assessments", icon: "fas fa-clipboard-list", label: "Assessments" },
  { path: "/reports", icon: "fas fa-chart-bar", label: "Reports" },
];

const aiToolsItems = [
  { path: "/ai/document-analysis", icon: "fas fa-magic", label: "Document Analysis" },
  { path: "/ai/case-insights", icon: "fas fa-lightbulb", label: "Case Insights" },
  { path: "/ai/smart-search", icon: "fas fa-search", label: "Smart Search" },
  { path: "/calendar/settings", icon: "fas fa-sync-alt", label: "Calendar Sync" },
];

export function Sidebar() {
  const [location, setLocation] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/";
    }
    return location.startsWith(path);
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col" data-testid="sidebar">
      {/* Logo Section */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-brain text-primary-foreground text-sm"></i>
          </div>
          <span className="text-xl font-semibold">TherapyFlow</span>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => (
            <li key={item.path}>
              <Link
                href={item.path}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive(item.path)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <i className={cn(item.icon, "w-4")}></i>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        
        {/* AI Features Section */}
        <div className="mt-8">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">AI Tools</h3>
          <ul className="space-y-2">
            {aiToolsItems.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive(item.path)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  data-testid={`ai-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <i className={cn(item.icon, "w-4")}></i>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      
      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            <i className="fas fa-user text-muted-foreground text-sm"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="user-name">
              Dr. Smith
            </p>
            <p className="text-xs text-muted-foreground truncate">Licensed Therapist</p>
          </div>
          <button className="text-muted-foreground hover:text-foreground" data-testid="user-settings">
            <i className="fas fa-cog text-sm"></i>
          </button>
        </div>
      </div>
    </aside>
  );
}
