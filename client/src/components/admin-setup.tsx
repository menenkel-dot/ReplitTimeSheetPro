import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Database, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [setupComplete, setSetupComplete] = useState(false);

  const promoteToAdminMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Kein Benutzer angemeldet");
      
      const res = await fetch(`/api/users/${user.id}/promote`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Fehler beim Befördern zum Admin");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Admin-Rechte erhalten",
        description: "Sie wurden erfolgreich zum Administrator befördert."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const seedDataMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/seed", {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Fehler beim Erstellen der Seed-Daten");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setSetupComplete(true);
      toast({
        title: "Setup abgeschlossen",
        description: "Beispiel-Projekte wurden erstellt. Die App ist bereit zur Nutzung!"
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCompleteSetup = async () => {
    if (user?.role !== 'admin') {
      await promoteToAdminMutation.mutateAsync();
    }
    await seedDataMutation.mutateAsync();
  };

  // Don't show if already admin and setup is complete
  if (user?.role === 'admin' && setupComplete) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Shield className="w-5 h-5" />
          App-Setup erforderlich
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-orange-700">
          Willkommen bei der Zeiterfassung! Um die App vollständig zu nutzen, 
          müssen Sie zunächst Administrator-Rechte erhalten und Beispiel-Daten erstellen.
        </p>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {user?.role === 'admin' ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <Shield className="w-4 h-4 text-orange-600" />
            )}
            <span className={user?.role === 'admin' ? "text-green-700" : "text-orange-700"}>
              {user?.role === 'admin' ? "Administrator-Rechte erhalten" : "Administrator-Rechte erhalten"}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            {setupComplete ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <Database className="w-4 h-4 text-orange-600" />
            )}
            <span className={setupComplete ? "text-green-700" : "text-orange-700"}>
              {setupComplete ? "Beispiel-Projekte erstellt" : "Beispiel-Projekte erstellen"}
            </span>
          </div>
        </div>

        <Button 
          onClick={handleCompleteSetup}
          disabled={promoteToAdminMutation.isPending || seedDataMutation.isPending}
          className="w-full"
          data-testid="button-complete-setup"
        >
          {promoteToAdminMutation.isPending || seedDataMutation.isPending 
            ? "Setup läuft..." 
            : "Setup abschließen"}
        </Button>
      </CardContent>
    </Card>
  );
}