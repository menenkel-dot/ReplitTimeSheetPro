import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Calendar } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { de } from "date-fns/locale";

export default function Reports() {
  const [reportFilters, setReportFilters] = useState({
    startDate: "",
    endDate: "",
    groupBy: "day",
    format: "csv"
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

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
        format: filters.format
      });

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
