import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, X } from "lucide-react";
import type { Project, InsertTimeEntry } from "@shared/schema";

interface NewEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewEntryModal({ isOpen, onClose }: NewEntryModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    projectId: "",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 30,
    description: ""
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertTimeEntry) => {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Fehler beim Erstellen des Zeiteintrags");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({
        title: "Zeiteintrag erstellt",
        description: "Der Zeiteintrag wurde erfolgreich gespeichert."
      });
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      projectId: "",
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
      description: ""
    });
  };

  const calculateDuration = () => {
    if (!formData.startTime || !formData.endTime) return "0:00h";
    
    const [startHour, startMin] = formData.startTime.split(':').map(Number);
    const [endHour, endMin] = formData.endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    let totalMinutes = endMinutes - startMinutes - (formData.breakMinutes || 0);
    if (totalMinutes < 0) totalMinutes = 0;
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}h`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const entryDate = new Date(formData.date);
    const startDateTime = new Date(formData.date + 'T' + formData.startTime + ':00');
    const endDateTime = new Date(formData.date + 'T' + formData.endTime + ':00');

    const entryData: Partial<InsertTimeEntry> = {
      date: entryDate,
      startTime: startDateTime,
      endTime: endDateTime,
      breakMinutes: formData.breakMinutes,
      description: formData.description,
      projectId: formData.projectId || null,
      status: 'draft',
      isRunning: false
    };

    createMutation.mutate(entryData as InsertTimeEntry);
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-new-entry">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Neuer Zeiteintrag</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-modal">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Datum *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                data-testid="input-entry-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="project">Projekt *</Label>
              <Select 
                value={formData.projectId} 
                onValueChange={(value) => setFormData({ ...formData, projectId: value })}
              >
                <SelectTrigger data-testid="select-entry-project">
                  <SelectValue placeholder="Projekt auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Startzeit *</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
                data-testid="input-start-time"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endTime">Endzeit *</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
                data-testid="input-end-time"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="breakMinutes">Pause (Min.)</Label>
              <Input
                id="breakMinutes"
                type="number"
                min="0"
                max="480"
                step="15"
                value={formData.breakMinutes}
                onChange={(e) => setFormData({ ...formData, breakMinutes: parseInt(e.target.value) || 0 })}
                data-testid="input-break-minutes"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              placeholder="Beschreibung der Tätigkeit..."
              className="h-20"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              data-testid="textarea-description"
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Berechnete Arbeitszeit:</span>
              <span className="font-mono font-medium text-lg" data-testid="text-calculated-duration">
                {calculateDuration()}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel-entry"
            >
              Abbrechen
            </Button>
            <Button 
              type="submit"
              disabled={createMutation.isPending}
              data-testid="button-save-entry"
            >
              <Save className="w-4 h-4 mr-2" />
              {createMutation.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
