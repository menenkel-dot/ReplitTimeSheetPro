import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import TimeTracking from "@/pages/time-tracking";
import Reports from "@/pages/reports";
import Projects from "@/pages/projects";
import AdminUsers from "@/pages/admin-users";
import AdminGroups from "@/pages/admin-groups";
import AdminSettings from "@/pages/admin-settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/timetracking" component={TimeTracking} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/projects" component={Projects} />
      <ProtectedRoute path="/users" component={AdminUsers} />
      <ProtectedRoute path="/groups" component={AdminGroups} />
      <ProtectedRoute path="/settings" component={AdminSettings} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
