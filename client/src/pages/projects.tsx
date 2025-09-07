import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Folder } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Project, InsertProject } from "@shared/schema";

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
