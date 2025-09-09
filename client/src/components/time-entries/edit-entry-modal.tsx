
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { TimeEntryWithRelations, Project } from "@shared/schema";

interface EditEntryModalProps {
  entry: TimeEntryWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditEntryModal({ entry, isOpen, onClose }: EditEntryModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    date: "",
    projectId: "",
    startTime: "",
    endTime: "",
    breakMinutes: "",
    description: ""
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  useEffect(() => {
    if (entry) {
      const startTime = entry.startTime ? new Date(entry.startTime) : null;
      const endTime = entry.endTime ? new Date(entry.endTime) : null;
      
      setFormData({
        date: new Date(entry.date).toISOString().split('T')[0],
        projectId: entry.projectId || "",
        startTime: startTime ? startTime.toTimeString().slice(0, 5) : "",
        endTime: endTime ? endTime.toTimeString().slice(0, 5) : "",
        breakMinutes: entry.breakMinutes?.toString() || "",
        description: entry.description || ""
      });
    }
  }, [entry]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!entry) throw new Error("No entry to update");
      
      const updateData = {
        date: data.date,
        projectId: data.projectId || null,
        startTime: data.startTime ? `${data.date}T${data.startTime}:00` : null,
        endTime: data.endTime ? `${data.date}T${data.endTime}:00` : null,
        breakMinutes: data.breakMinutes ? parseInt(data.breakMinutes) : null,
        description: data.description
      };

      const res = await fetch(`/api/time-entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
        credentials: "include"
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Fehler beim Aktualisieren des Eintrags");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({
        title: "Eintrag aktualisiert",
        description: "Der Zeiteintrag wurde erfolgreich aktualisiert."
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.startTime) {
      toast({
        title: "Fehler",
        description: "Datum und Startzeit sind erforderlich.",
        variant: "destructive"
      });
      return;
    }

    updateMutation.mutate(formData);
  };

  if (!entry) return null;

  // Check if user can edit this entry
  const canEdit = user?.role === 'admin' || entry.userId === user?.id;
  
  if (!canEdit) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zugriff verweigert</DialogTitle>
          </DialogHeader>
          <p>Sie haben keine Berechtigung, diesen Eintrag zu bearbeiten.</p>
          <Button onClick={onClose}>Schließen</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Zeiteintrag bearbeiten</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="date">Datum *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="project">Projekt</Label>
            <Select value={formData.projectId} onValueChange={(value) => setFormData({ ...formData, projectId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Projekt auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Kein Projekt</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Startzeit *</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="endTime">Endzeit</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="breakMinutes">Pause (Minuten)</Label>
            <Input
              id="breakMinutes"
              type="number"
              min="0"
              value={formData.breakMinutes}
              onChange={(e) => setFormData({ ...formData, breakMinutes: e.target.value })}
              placeholder="0"
            />
          </div>

          <div>
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Beschreibung der Tätigkeit..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
