import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Folder, Clock, Euro, PieChart, DollarSign } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { Project, InsertProject, TimeEntryWithRelations } from "@shared/schema";

export default function Projects() {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<Partial<InsertProject>>({
    name: "",
    description: "",
    color: "#3b82f6"
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch all time entries for admins to calculate charts
  const { data: timeEntries = [] } = useQuery<TimeEntryWithRelations[]>({
    queryKey: ["/api/time-entries", "showAll=true", user?.id],
    queryFn: async () => {
      const response = await fetch('/api/time-entries?showAll=true', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch time entries');
      return response.json();
    },
    enabled: user?.role === 'admin'
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Fehler beim Erstellen des Projekts");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsDialogOpen(false);
      setFormData({ name: "", description: "", color: "#3b82f6" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertProject> }) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Fehler beim Aktualisieren des Projekts");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsDialogOpen(false);
      setEditingProject(null);
      setFormData({ name: "", description: "", color: "#3b82f6" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Fehler beim Löschen des Projekts");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: formData });
    } else {
      createMutation.mutate(formData as InsertProject);
    }
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || "",
      color: project.color || "#3b82f6"
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingProject(null);
    setFormData({ name: "", description: "", color: "#3b82f6" });
    setIsDialogOpen(true);
  };

  // Calculate hours per project for pie charts
  const calculateHours = (startTime: Date | string, endTime: Date | string, breakMinutes: number = 0) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.max(0, hours - (breakMinutes / 60));
  };

  // Prepare data for hours pie chart
  const hoursData = projects.map(project => {
    const projectEntries = timeEntries.filter(entry => entry.projectId === project.id && entry.startTime && entry.endTime);
    const totalHours = projectEntries.reduce((sum, entry) => {
      return sum + calculateHours(entry.startTime!, entry.endTime!, entry.breakMinutes || 0);
    }, 0);
    
    return {
      name: project.name,
      value: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
      color: project.color || '#3b82f6'
    };
  }).filter(item => item.value > 0); // Only show projects with hours

  // Prepare data for costs pie chart
  const costsData = projects.map(project => {
    const projectEntries = timeEntries.filter(entry => entry.projectId === project.id && entry.startTime && entry.endTime);
    const totalCosts = projectEntries.reduce((sum, entry) => {
      const hours = calculateHours(entry.startTime!, entry.endTime!, entry.breakMinutes || 0);
      const hourlyRate = parseFloat(entry.user?.hourlyRate || '0');
      return sum + (hours * hourlyRate);
    }, 0);
    
    return {
      name: project.name,
      value: Math.round(totalCosts * 100) / 100, // Round to 2 decimal places
      color: project.color || '#3b82f6'
    };
  }).filter(item => item.value > 0); // Only show projects with costs

  const chartConfig = {
    hours: {
      label: "Stunden",
    },
    costs: {
      label: "Kosten (€)",
    },
  };

  return (
    <MainLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-projects-title">Projekte</h1>
              <p className="text-muted-foreground">
                Verwalten Sie Ihre Projekte und Kostenstellen
              </p>
            </div>
            {user?.role === 'admin' && (
              <Button onClick={openNewDialog} data-testid="button-new-project">
                <Plus className="w-4 h-4 mr-2" />
                Neues Projekt
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          {user?.role === 'admin' && (hoursData.length > 0 || costsData.length > 0) && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4" data-testid="text-charts-title">Projekt-Übersicht</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hours Pie Chart */}
                {hoursData.length > 0 && (
                  <Card data-testid="card-hours-chart">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="w-5 h-5" />
                        Geleistete Stunden pro Projekt
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={chartConfig}
                        className="mx-auto aspect-square max-h-[300px]"
                      >
                        <RechartsPieChart>
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                          />
                          <Pie
                            data={hoursData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            label={(entry) => `${entry.name}: ${entry.value}h`}
                          >
                            {hoursData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Costs Pie Chart */}
                {costsData.length > 0 && (
                  <Card data-testid="card-costs-chart">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Personalkosten pro Projekt
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={chartConfig}
                        className="mx-auto aspect-square max-h-[300px]"
                      >
                        <RechartsPieChart>
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                          />
                          <Pie
                            data={costsData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            label={(entry) => `${entry.name}: €${entry.value.toFixed(2)}`}
                          >
                            {costsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} data-testid={`card-project-${project.id}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: project.color || '#3b82f6' }}
                      />
                      <span>{project.name}</span>
                    </div>
                    {user?.role === 'admin' && (
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditDialog(project)}
                          data-testid={`button-edit-${project.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteMutation.mutate(project.id)}
                          data-testid={`button-delete-${project.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {project.description || "Keine Beschreibung"}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      {project.isActive ? "Aktiv" : "Inaktiv"}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Folder className="w-3 h-3" />
                      <span>Projekt</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-project-form">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Projekt bearbeiten" : "Neues Projekt"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Projektname *</Label>
              <Input
                id="name"
                data-testid="input-project-name"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Input
                id="description"
                data-testid="input-project-description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Farbe</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="color"
                  type="color"
                  data-testid="input-project-color"
                  value={formData.color || "#3b82f6"}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-10 p-1 border rounded"
                />
                <Input
                  value={formData.color || "#3b82f6"}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#3b82f6"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                data-testid="button-cancel"
              >
                Abbrechen
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                {editingProject ? "Aktualisieren" : "Erstellen"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
