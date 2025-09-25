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
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDate, formatTime } from "@/lib/date-utils";
import type { TimeEntryWithRelations, Project } from "@shared/schema";
import { EditEntryModal } from "./edit-entry-modal";

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
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState({
    project: "all",
    employee: "all",
    startDate: "",
    endDate: ""
  });
  const [editingEntry, setEditingEntry] = useState<TimeEntryWithRelations | null>(null);

  // Build query parameters based on user role and showAllForAdmin prop
  const queryParams = new URLSearchParams();
  if (user?.role === 'admin' && showAllForAdmin === true) {
    queryParams.set('showAll', 'true');
  }

  const { data: timeEntries = [] } = useQuery<TimeEntryWithRelations[]>({
    queryKey: ["/api/time-entries", queryParams.toString(), user?.id],
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

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users", {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: user?.role === 'admin' && showAllForAdmin
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
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries", "", user?.id] }); // Also invalidate dashboard cache
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


  // Apply filters to entries
  const filteredEntries = timeEntries.filter(entry => {
    // Project filter
    if (filters.project !== "all" && entry.projectId !== filters.project) {
      return false;
    }

    // Employee filter (only for admins)
    if (user?.role === 'admin' && showAllForAdmin && filters.employee !== "all") {
      if (entry.userId !== filters.employee) {
        return false;
      }
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      const entryDate = new Date(entry.date);
      
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (entryDate < startDate) return false;
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        if (entryDate > endDate) return false;
      }
    }

    return true;
  });

  const displayEntries = limit ? filteredEntries.slice(0, limit) : filteredEntries;

  return (
    <Card>
      <CardHeader>
        <div className={`${isMobile ? "space-y-4" : "flex items-center justify-between"}`}>
          <CardTitle data-testid="text-table-title">{title}</CardTitle>
          {showFilters && (
            <div className={`${isMobile ? "space-y-3" : "flex items-center gap-2 flex-wrap"}`}>
              {/* Project Filter */}
              <Select value={filters.project} onValueChange={(value) => setFilters({...filters, project: value})}>
                <SelectTrigger className={`${isMobile ? "w-full" : "w-48"}`} data-testid="select-project-filter">
                  <SelectValue placeholder="Alle Projekte" />
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

              {/* Employee Filter (only for admins) */}
              {user?.role === 'admin' && showAllForAdmin && (
                <Select value={filters.employee} onValueChange={(value) => setFilters({...filters, employee: value})}>
                  <SelectTrigger className={`${isMobile ? "w-full" : "w-48"}`} data-testid="select-employee-filter">
                    <SelectValue placeholder="Alle Mitarbeiter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {`${u.firstName} ${u.lastName}`.trim() || u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Date Range Filters */}
              <div className={`${isMobile ? "grid grid-cols-2 gap-2" : "flex items-center gap-2"}`}>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  className={`px-3 py-2 border border-input bg-background rounded-md text-sm ${isMobile ? "col-span-1" : ""}`}
                  data-testid="input-start-date"
                />
                {!isMobile && <span className="text-sm text-muted-foreground">bis</span>}
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  className={`px-3 py-2 border border-input bg-background rounded-md text-sm ${isMobile ? "col-span-1" : ""}`}
                  data-testid="input-end-date"
                />
              </div>

              {/* Clear Filters Button */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setFilters({ project: "all", employee: "all", startDate: "", endDate: "" })}
                data-testid="button-clear-filters"
                className={`${isMobile ? "w-full" : ""}`}
              >
                Filter zurücksetzen
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {isMobile ? (
          // Mobile card layout
          <div className="space-y-3 p-4">
            {displayEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-accent/30 rounded-lg p-4 border border-border"
                data-testid={`card-entry-${entry.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{formatDate(entry.date)}</span>
                    {entry.isRunning && (
                      <Badge className="bg-orange-100 text-orange-800 text-xs">Läuft</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingEntry(entry)}
                      data-testid={`button-edit-${entry.id}`}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(entry.id)}
                      data-testid={`button-delete-${entry.id}`}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {/* Project */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Projekt:</span>
                    {entry.project ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: entry.project.color || '#3b82f6' }}
                        />
                        <span className="text-sm">{entry.project.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Kein Projekt</span>
                    )}
                  </div>
                  
                  {/* Time range */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Zeit:</span>
                    <span className="text-sm font-mono">
                      {formatTime(entry.startTime)} - {entry.isRunning ? 'Läuft' : (entry.endTime ? formatTime(entry.endTime) : '-')}
                    </span>
                  </div>
                  
                  {/* Duration */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Dauer:</span>
                    <span className="text-sm font-mono font-medium">
                      {entry.isRunning ? (
                        <span className="text-orange-600">
                          {formatDuration(calculateDuration(entry.startTime, new Date(), entry.breakMinutes || 0))}
                        </span>
                      ) : entry.endTime ? (
                        formatDuration(calculateDuration(entry.startTime, entry.endTime, entry.breakMinutes || 0))
                      ) : (
                        "-"
                      )}
                    </span>
                  </div>
                  
                  {/* Employee info for admins */}
                  {user?.role === 'admin' && showAllForAdmin && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Mitarbeiter:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-medium">
                          {entry.user?.firstName?.[0]}{entry.user?.lastName?.[0]}
                        </div>
                        <span className="text-sm">
                          {entry.user ? `${entry.user.firstName} ${entry.user.lastName}`.trim() : 'Unbekannt'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Desktop table layout
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted sticky top-0 z-10">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                    <Button variant="ghost" size="sm" className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground">
                      Datum <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </th>
                  {user?.role === 'admin' && showAllForAdmin && (
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Mitarbeiter</th>
                  )}
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
                    {user?.role === 'admin' && showAllForAdmin && (
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium">
                            {entry.user?.firstName?.[0]}{entry.user?.lastName?.[0]}
                          </div>
                          <span className="font-medium">
                            {entry.user ? `${entry.user.firstName} ${entry.user.lastName}`.trim() : 'Unbekannt'}
                          </span>
                        </div>
                      </td>
                    )}
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
                          onClick={() => setEditingEntry(entry)}
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
        )}
        
        {showPagination && (
          <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span data-testid="text-pagination-info">
              Zeige 1-{displayEntries.length} von {filteredEntries.length} Einträgen
              {filteredEntries.length !== timeEntries.length && ` (${timeEntries.length} gesamt)`}
            </span>
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
      
      <EditEntryModal 
        entry={editingEntry}
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
      />
    </Card>
  );
}
