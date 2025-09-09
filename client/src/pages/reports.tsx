import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Download, Calendar, Users } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { de } from "date-fns/locale";
import type { User } from "@shared/schema";

export default function Reports() {
  const { user } = useAuth();
  const [reportFilters, setReportFilters] = useState({
    startDate: "",
    endDate: "",
    groupBy: "day",
    format: "csv",
    userId: "",
    includeCosts: false,
    detailedReport: false
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Fetch users for admin dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === 'admin',
  });

  const generateReport = async (filters = reportFilters) => {
    if (!filters.startDate || !filters.endDate) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie ein Start- und Enddatum aus.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy: filters.groupBy,
        format: filters.format,
        includeCosts: filters.includeCosts.toString(),
        detailedReport: filters.detailedReport.toString()
      });

      if (filters.userId && filters.userId !== 'all') {
        params.append('userId', filters.userId);
      }

      const response = await fetch(`/api/reports/export?${params}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Fehler beim Generieren des Reports');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `report-${filters.startDate}-${filters.endDate}.${filters.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Erfolg",
        description: "Report wurde erfolgreich generiert und heruntergeladen.",
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Generieren des Reports. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateQuickReport = (period: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'today':
        startDate = now;
        endDate = now;
        break;
      case 'week':
        startDate = startOfWeek(now, { locale: de });
        endDate = endOfWeek(now, { locale: de });
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
    }

    const quickFilters = {
      ...reportFilters,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd')
    };

    generateReport(quickFilters);
  };

  return (
    <MainLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-reports-title">Berichte</h1>
              <p className="text-muted-foreground">
                Exportieren Sie Ihre Zeiteinträge und Auswertungen
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Report-Einstellungen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Startdatum</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={reportFilters.startDate}
                      onChange={(e) => setReportFilters({
                        ...reportFilters,
                        startDate: e.target.value
                      })}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Enddatum</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={reportFilters.endDate}
                      onChange={(e) => setReportFilters({
                        ...reportFilters,
                        endDate: e.target.value
                      })}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                {user?.role === 'admin' && (
                  <div className="space-y-2">
                    <Label htmlFor="userId">Mitarbeiter (optional)</Label>
                    <Select
                      value={reportFilters.userId}
                      onValueChange={(value) => setReportFilters({
                        ...reportFilters,
                        userId: value
                      })}
                    >
                      <SelectTrigger data-testid="select-user">
                        <SelectValue placeholder="Alle Mitarbeiter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="groupBy">Gruppierung</Label>
                  <Select
                    value={reportFilters.groupBy}
                    onValueChange={(value) => setReportFilters({
                      ...reportFilters,
                      groupBy: value
                    })}
                  >
                    <SelectTrigger data-testid="select-group-by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Nach Tag</SelectItem>
                      <SelectItem value="project">Nach Projekt</SelectItem>
                      <SelectItem value="week">Nach Woche</SelectItem>
                      <SelectItem value="month">Nach Monat</SelectItem>
                      {user?.role === 'admin' && (
                        <SelectItem value="user">Nach Mitarbeiter</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="format">Format</Label>
                  <Select
                    value={reportFilters.format}
                    onValueChange={(value) => setReportFilters({
                      ...reportFilters,
                      format: value
                    })}
                  >
                    <SelectTrigger data-testid="select-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {user?.role === 'admin' && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeCosts"
                        checked={reportFilters.includeCosts}
                        onCheckedChange={(checked) => setReportFilters({
                          ...reportFilters,
                          includeCosts: checked as boolean
                        })}
                        data-testid="checkbox-include-costs"
                      />
                      <Label htmlFor="includeCosts" className="text-sm">
                        Personalkosten einbeziehen
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="detailedReport"
                        checked={reportFilters.detailedReport}
                        onCheckedChange={(checked) => setReportFilters({
                          ...reportFilters,
                          detailedReport: checked as boolean
                        })}
                        data-testid="checkbox-detailed-report"
                      />
                      <Label htmlFor="detailedReport" className="text-sm">
                        Detaillierter Report (einzelne Einträge mit Mitarbeiter und Projekt)
                      </Label>
                    </div>
                  </>
                )}

                <Button 
                  className="w-full" 
                  data-testid="button-generate-report"
                  onClick={() => generateReport()}
                  disabled={isGenerating}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isGenerating ? "Generiere..." : "Report generieren"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Schnellberichte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-report-today"
                  onClick={() => generateQuickReport('today')}
                  disabled={isGenerating}
                >
                  Heute
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-report-week"
                  onClick={() => generateQuickReport('week')}
                  disabled={isGenerating}
                >
                  Diese Woche
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-report-month"
                  onClick={() => generateQuickReport('month')}
                  disabled={isGenerating}
                >
                  Dieser Monat
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-report-year"
                  onClick={() => generateQuickReport('year')}
                  disabled={isGenerating}
                >
                  Dieses Jahr
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
