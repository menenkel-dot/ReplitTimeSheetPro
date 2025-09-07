import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Calendar } from "lucide-react";
import { useState } from "react";

export default function Reports() {
  const [reportFilters, setReportFilters] = useState({
    startDate: "",
    endDate: "",
    groupBy: "day",
    format: "csv"
  });

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

                <Button className="w-full" data-testid="button-generate-report">
                  <Download className="w-4 h-4 mr-2" />
                  Report generieren
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
                >
                  Heute
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-report-week"
                >
                  Diese Woche
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-report-month"
                >
                  Dieser Monat
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-report-year"
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
