import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Edit, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Holiday, InsertHoliday } from "@shared/schema";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const holidaySchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  date: z.string().min(1, "Datum ist erforderlich")
});

export default function HolidaysManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["/api/holidays"]
  });

  const createForm = useForm<z.infer<typeof holidaySchema>>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      name: "",
      date: ""
    }
  });

  const editForm = useForm<z.infer<typeof holidaySchema>>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      name: "",
      date: ""
    }
  });

  const createHolidayMutation = useMutation({
    mutationFn: async (data: z.infer<typeof holidaySchema>) => {
      const res = await apiRequest("POST", "/api/holidays", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Feiertag erstellt",
        description: "Der neue Feiertag wurde erfolgreich erstellt."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Erstellen des Feiertags",
        variant: "destructive"
      });
    }
  });

  const updateHolidayMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof holidaySchema> }) => {
      const res = await apiRequest("PUT", `/api/holidays/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      setEditingHoliday(null);
      editForm.reset();
      toast({
        title: "Feiertag aktualisiert",
        description: "Der Feiertag wurde erfolgreich aktualisiert."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Aktualisieren des Feiertags",
        variant: "destructive"
      });
    }
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/holidays/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      toast({
        title: "Feiertag gelöscht",
        description: "Der Feiertag wurde erfolgreich gelöscht."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Löschen des Feiertags",
        variant: "destructive"
      });
    }
  });

  const handleCreateHoliday = (data: z.infer<typeof holidaySchema>) => {
    createHolidayMutation.mutate(data);
  };

  const handleEditHoliday = (data: z.infer<typeof holidaySchema>) => {
    if (editingHoliday) {
      updateHolidayMutation.mutate({ id: editingHoliday.id, data });
    }
  };

  const openEditDialog = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    editForm.reset({
      name: holiday.name,
      date: format(new Date(holiday.date), "yyyy-MM-dd")
    });
  };

  const handleDeleteHoliday = (id: string) => {
    if (confirm("Sind Sie sicher, dass Sie diesen Feiertag löschen möchten?")) {
      deleteHolidayMutation.mutate(id);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" data-testid="button-manage-holidays">
          Feiertage verwalten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Feiertags-Verwaltung
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Verwalten Sie gesetzliche Feiertage für die Arbeitszeit-Berechnung.
            </p>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-holiday">
                  <Plus className="w-4 h-4 mr-2" />
                  Feiertag hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neuen Feiertag erstellen</DialogTitle>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(handleCreateHoliday)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name des Feiertags</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="z.B. Neujahr" data-testid="input-holiday-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Datum</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-holiday-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCreateDialogOpen(false)}
                        data-testid="button-holiday-cancel"
                      >
                        Abbrechen
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createHolidayMutation.isPending}
                        data-testid="button-holiday-submit"
                      >
                        {createHolidayMutation.isPending ? "Erstelle..." : "Erstellen"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {holidays.map((holiday) => (
              <Card key={holiday.id} data-testid={`card-holiday-${holiday.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{holiday.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(holiday)}
                        data-testid={`button-edit-holiday-${holiday.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteHoliday(holiday.id)}
                        data-testid={`button-delete-holiday-${holiday.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary" className="w-full justify-center">
                    {format(new Date(holiday.date), "EEEE, dd. MMMM yyyy", { locale: de })}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {holidays.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine Feiertage definiert.</p>
              <p>Fügen Sie Feiertage hinzu, um sie bei der Arbeitszeit-Berechnung zu berücksichtigen.</p>
            </div>
          )}
        </div>

        {/* Edit Holiday Dialog */}
        <Dialog open={!!editingHoliday} onOpenChange={() => setEditingHoliday(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Feiertag bearbeiten</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditHoliday)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name des Feiertags</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="z.B. Neujahr" data-testid="input-edit-holiday-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Datum</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-edit-holiday-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingHoliday(null)}
                    data-testid="button-edit-holiday-cancel"
                  >
                    Abbrechen
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateHolidayMutation.isPending}
                    data-testid="button-edit-holiday-submit"
                  >
                    {updateHolidayMutation.isPending ? "Speichere..." : "Speichern"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}