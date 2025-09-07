import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Calendar, Clock, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

export default function AdminSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    defaultWorkingHours: 8,
    breakDuration: 30,
    overtimeThreshold: 40,
    currency: "EUR"
  });

  if (user?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Settings className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Zugriff verweigert</h2>
              <p className="text-muted-foreground">
                Sie haben keine Berechtigung für diesen Bereich.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-settings-title">Einstellungen</h1>
              <p className="text-muted-foreground">
                Systemweite Konfiguration und Einstellungen
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Arbeitszeit-Einstellungen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultHours">Standard Arbeitszeit (Stunden/Tag)</Label>
                  <Input
                    id="defaultHours"
                    type="number"
                    min="1"
                    max="24"
                    value={settings.defaultWorkingHours}
                    onChange={(e) => setSettings({
                      ...settings,
                      defaultWorkingHours: parseInt(e.target.value)
                    })}
                    data-testid="input-default-hours"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="breakDuration">Standard Pausenzeit (Minuten)</Label>
                  <Input
                    id="breakDuration"
                    type="number"
                    min="0"
                    max="480"
                    value={settings.breakDuration}
                    onChange={(e) => setSettings({
                      ...settings,
                      breakDuration: parseInt(e.target.value)
                    })}
                    data-testid="input-break-duration"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overtimeThreshold">Überstunden-Schwelle (Stunden/Woche)</Label>
                  <Input
                    id="overtimeThreshold"
                    type="number"
                    min="1"
                    max="168"
                    value={settings.overtimeThreshold}
                    onChange={(e) => setSettings({
                      ...settings,
                      overtimeThreshold: parseInt(e.target.value)
                    })}
                    data-testid="input-overtime-threshold"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Abrechnungs-Einstellungen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Währung</Label>
                  <Input
                    id="currency"
                    value={settings.currency}
                    onChange={(e) => setSettings({
                      ...settings,
                      currency: e.target.value
                    })}
                    data-testid="input-currency"
                  />
                </div>

                <div className="pt-4">
                  <h4 className="text-sm font-medium mb-2">Rundungsregeln</h4>
                  <p className="text-sm text-muted-foreground">
                    Zeiteinträge werden auf die nächsten 15 Minuten gerundet.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Feiertags-Verwaltung
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Verwalten Sie gesetzliche Feiertage für die Arbeitszeit-Berechnung.
                </p>
                <Button variant="outline" className="w-full" data-testid="button-manage-holidays">
                  Feiertage verwalten
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Systemstatus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Datenbank</span>
                    <span className="text-sm text-green-600">Online</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Backup-Status</span>
                    <span className="text-sm text-green-600">Aktuell</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Version</span>
                    <span className="text-sm text-muted-foreground">1.0.0</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <Button data-testid="button-save-settings">
              Einstellungen speichern
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
