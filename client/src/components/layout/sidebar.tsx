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
  Gauge,
  Building2,
  Menu
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

export default function Sidebar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { path: "/dashboard", icon: Gauge, label: "Dashboard", roles: ['employee', 'admin'] },
    { path: "/timetracking", icon: Clock, label: "Zeiterfassung", roles: ['employee', 'admin'] },
    { path: "/reports", icon: BarChart, label: "Berichte", roles: ['employee', 'admin'] },
    { path: "/projects", icon: Folder, label: "Projekte", roles: ['employee', 'admin'] },
  ];

  const adminItems = [
    { path: "/admin/users", icon: Users, label: "Benutzer", roles: ['admin'] },
    { path: "/admin/groups", icon: Building2, label: "Gruppen", roles: ['admin'] },
    { path: "/admin/settings", icon: Settings, label: "Einstellungen", roles: ['admin'] },
  ];

  const isActiveLink = (path: string) => {
    return location === path || (path === "/dashboard" && location === "/");
  };

  const canAccessRoute = (roles: string[]) => {
    return user && roles.includes(user.role);
  };

  const SidebarContent = () => (
    <>
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
                  onClick={() => isMobile && setIsOpen(false)}
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
              <ul className="space-y-2">
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
                        onClick={() => isMobile && setIsOpen(false)}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          )}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            logoutMutation.mutate();
            isMobile && setIsOpen(false);
          }}
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-3" />
          <span>Abmelden</span>
        </Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-4 left-4 z-40 md:hidden"
              data-testid="button-menu-toggle"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menü öffnen</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Hauptnavigation der Zeiterfassungs-App</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col h-full bg-card">
              <SidebarContent />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col">
      <SidebarContent />
    </aside>
  );
}