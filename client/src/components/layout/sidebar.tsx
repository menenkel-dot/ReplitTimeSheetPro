import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { 
  Clock, 
  BarChart, 
  Folder, 
  Users, 
  Settings, 
  LogOut,
  Gauge
} from "lucide-react";

export default function Sidebar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const menuItems = [
    { path: "/dashboard", icon: Gauge, label: "Dashboard", roles: ['employee', 'admin'] },
    { path: "/timetracking", icon: Clock, label: "Zeiterfassung", roles: ['employee', 'admin'] },
    { path: "/reports", icon: BarChart, label: "Berichte", roles: ['employee', 'admin'] },
    { path: "/projects", icon: Folder, label: "Projekte", roles: ['employee', 'admin'] },
  ];

  const adminItems = [
    { path: "/users", icon: Users, label: "Benutzer", roles: ['admin'] },
    { path: "/settings", icon: Settings, label: "Einstellungen", roles: ['admin'] },
  ];

  const isActiveLink = (path: string) => {
    return location === path || (path === "/dashboard" && location === "/");
  };

  const canAccessRoute = (roles: string[]) => {
    return user && roles.includes(user.role);
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-lg" data-testid="text-app-title">Zeiterfassung</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-user-name">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user?.username}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            if (!canAccessRoute(item.roles)) return null;
            
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <Link 
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActiveLink(item.path)
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  data-testid={`link-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
          
          {user?.role === 'admin' && (
            <li className="pt-4">
              <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                Administration
              </div>
            </li>
          )}
          
          {adminItems.map((item) => {
            if (!canAccessRoute(item.roles)) return null;
            
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <Link 
                  href={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActiveLink(item.path)
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  data-testid={`link-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-3" />
          <span>Abmelden</span>
        </Button>
      </div>
    </aside>
  );
}
