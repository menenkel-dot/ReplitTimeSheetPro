import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Play, ArrowUpDown } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatTime } from "@/lib/date-utils";
import type { TimeEntryWithRelations, Project } from "@shared/schema";

interface TimeEntriesTableProps {
  title: string;
  showFilters?: boolean;
  showPagination?: boolean;
  limit?: number;
  showAllForAdmin?: boolean; // New prop to control if admins see all entries
}

export default function TimeEntriesTable({ 
  title, 
  showFilters = false, 
  showPagination = false,
  limit,
  showAllForAdmin = false
}: TimeEntriesTableProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    project: "all",
    period: "week"
  });

  // Build query parameters based on user role and showAllForAdmin prop
  const queryParams = new URLSearchParams();
  if (user?.role === 'admin' && showAllForAdmin) {
    queryParams.set('showAll', 'true');
  }

  const { data: timeEntries = [] } = useQuery<TimeEntryWithRelations[]>({
    queryKey: ["/api/time-entries", queryParams.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/time-entries?${queryParams}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch time entries');
      return response.json();
    }
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/time-entries/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Fehler beim Löschen des Eintrags");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries", ""] }); // Also invalidate dashboard cache
      toast({
        title: "Eintrag gelöscht",
        description: "Der Zeiteintrag wurde erfolgreich gelöscht."
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

  const calculateDuration = (startTime: Date | string, endTime: Date | string | null, breakMinutes: number = 0) => {
    if (!endTime) return 0;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const breakHours = breakMinutes / 60;
    
    return Math.max(0, diffHours - breakHours);
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}h`;
  };


  const displayEntries = limit ? timeEntries.slice(0, limit) : timeEntries;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle data-testid="text-table-title">{title}</CardTitle>
          {showFilters && (
            <div className="flex items-center gap-2">
              <Select value={filters.project} onValueChange={(value) => setFilters({...filters, project: value})}>
                <SelectTrigger className="w-48" data-testid="select-project-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Projekte</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filters.period} onValueChange={(value) => setFilters({...filters, period: value})}>
                <SelectTrigger className="w-36" data-testid="select-period-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Heute</SelectItem>
                  <SelectItem value="week">Diese Woche</SelectItem>
                  <SelectItem value="month">Dieser Monat</SelectItem>
                  <SelectItem value="7days">Letzten 7 Tage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted sticky top-0 z-10">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                  <Button variant="ghost" size="sm" className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground">
                    Datum <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Projekt</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Start</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Ende</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Pause</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Dauer</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {displayEntries.map((entry) => (
                <tr 
                  key={entry.id} 
                  className="border-b border-border hover:bg-accent/50"
                  data-testid={`row-entry-${entry.id}`}
                >
                  <td className="py-3 px-4">
                    {formatDate(entry.date)}
                  </td>
                  <td className="py-3 px-4">
                    {entry.project ? (
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: entry.project.color || '#3b82f6' }}
                        />
                        <span>{entry.project.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Kein Projekt</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm">
                    {formatTime(entry.startTime)}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm">
                    {entry.isRunning ? (
                      <Badge className="bg-orange-100 text-orange-800">Läuft</Badge>
                    ) : entry.endTime ? (
                      formatTime(entry.endTime)
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm">
                    {entry.breakMinutes ? `${entry.breakMinutes} min` : "-"}
                  </td>
                  <td className="py-3 px-4 font-mono text-sm font-medium">
                    {entry.isRunning ? (
                      <span className="text-orange-600">
                        {formatDuration(calculateDuration(entry.startTime, new Date(), entry.breakMinutes || 0))}
                      </span>
                    ) : entry.endTime ? (
                      formatDuration(calculateDuration(entry.startTime, entry.endTime, entry.breakMinutes || 0))
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        data-testid={`button-edit-${entry.id}`}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteMutation.mutate(entry.id)}
                        data-testid={`button-delete-${entry.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {showPagination && (
          <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span data-testid="text-pagination-info">Zeige 1-{displayEntries.length} von {timeEntries.length} Einträgen</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled data-testid="button-page-prev">
                Zurück
              </Button>
              <Button variant="outline" size="sm" className="bg-primary text-primary-foreground" data-testid="button-page-1">
                1
              </Button>
              <Button variant="outline" size="sm" data-testid="button-page-next">
                Weiter
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
