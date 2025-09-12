import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Building2, Users } from "lucide-react";
import { Group, InsertGroup, insertGroupSchema } from "@shared/schema";

// Form schema for creating groups
const createGroupSchema = insertGroupSchema.extend({
  name: z.string().min(1, "Name ist erforderlich"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Ungültiges Farbformat").default("#10b981")
});

// Form schema for editing groups
const editGroupSchema = createGroupSchema.partial().extend({
  name: z.string().min(1, "Name ist erforderlich").optional(),
});

export default function AdminGroups() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const { data: groups = [], isLoading: groupsLoading, error: groupsError } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    enabled: currentUser?.role === 'admin'
  });

  const createForm = useForm<z.infer<typeof createGroupSchema>>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#10b981",
      isActive: true
    }
  });

  const editForm = useForm<z.infer<typeof editGroupSchema>>({
    resolver: zodResolver(editGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#10b981",
      isActive: true
    }
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createGroupSchema>) => {
      const res = await apiRequest("POST", "/api/groups", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Gruppe erstellt",
        description: "Die neue Gruppe wurde erfolgreich erstellt."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Erstellen der Gruppe",
        variant: "destructive"
      });
    }
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof editGroupSchema> }) => {
      const res = await apiRequest("PUT", `/api/groups/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setEditingGroup(null);
      editForm.reset();
      toast({
        title: "Gruppe aktualisiert",
        description: "Die Gruppe wurde erfolgreich aktualisiert."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Aktualisieren der Gruppe",
        variant: "destructive"
      });
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Gruppe gelöscht",
        description: "Die Gruppe wurde erfolgreich gelöscht."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Löschen der Gruppe",
        variant: "destructive"
      });
    }
  });

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    editForm.reset({
      name: group.name,
      description: group.description || "",
      color: group.color || "#10b981",
      isActive: group.isActive ?? true
    });
  };

  const handleDelete = (group: Group) => {
    if (window.confirm(`Sind Sie sicher, dass Sie die Gruppe "${group.name}" löschen möchten?`)) {
      deleteGroupMutation.mutate(group.id);
    }
  };

  const onCreateSubmit = (data: z.infer<typeof createGroupSchema>) => {
    createGroupMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof editGroupSchema>) => {
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, data });
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive">Zugriff verweigert</h1>
            <p className="text-muted-foreground">Sie haben keine Berechtigung, diese Seite zu sehen.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Gruppenverwaltung</h1>
            <p className="text-muted-foreground" data-testid="text-page-description">
              Verwalten Sie Abteilungen und Gruppen für die Zeiterfassung
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-group">
                <Plus className="w-4 h-4 mr-2" />
                Neue Gruppe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Gruppe erstellen</DialogTitle>
                <DialogDescription>
                  Erstellen Sie eine neue Gruppe oder Abteilung für die Organisation der Benutzer.
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="z.B. Entwicklung, Marketing, Vertrieb"
                            data-testid="input-create-group-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beschreibung</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Beschreibung der Gruppe oder Abteilung"
                            data-testid="input-create-group-description"
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Farbe</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="color"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="w-16 h-10 p-1"
                              data-testid="input-create-group-color"
                            />
                            <Input 
                              {...field} 
                              placeholder="#10b981"
                              className="flex-1"
                              data-testid="input-create-group-color-text"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                      data-testid="button-cancel-create"
                    >
                      Abbrechen
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createGroupMutation.isPending}
                      data-testid="button-submit-create"
                    >
                      {createGroupMutation.isPending ? "Erstellen..." : "Erstellen"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Verfügbare Gruppen
              </CardTitle>
              <CardDescription>
                {groups.length} Gruppe{groups.length !== 1 ? 'n' : ''} insgesamt
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groupsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                      <div className="flex items-center gap-4">
                        <div className="w-4 h-4 bg-gray-300 rounded-full" />
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-300 rounded w-32" />
                          <div className="h-3 bg-gray-200 rounded w-48" />
                        </div>
                        <div className="h-6 bg-gray-300 rounded w-16" />
                      </div>
                      <div className="flex gap-2">
                        <div className="h-8 bg-gray-300 rounded w-20" />
                        <div className="h-8 bg-gray-300 rounded w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : groupsError ? (
                <div className="text-center py-8">
                  <div className="text-destructive mb-4">⚠️</div>
                  <h3 className="text-lg font-semibold text-destructive">Fehler beim Laden</h3>
                  <p className="text-muted-foreground">
                    Die Gruppen konnten nicht geladen werden. Versuchen Sie es später erneut.
                  </p>
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground">Keine Gruppen vorhanden</h3>
                  <p className="text-muted-foreground">
                    Erstellen Sie Ihre erste Gruppe, um Benutzer zu organisieren.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`card-group-${group.id}`}>
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: group.color || "#10b981" }}
                        />
                        <div>
                          <h3 className="font-semibold" data-testid={`text-group-name-${group.id}`}>{group.name}</h3>
                          {group.description && (
                            <p className="text-sm text-muted-foreground" data-testid={`text-group-description-${group.id}`}>
                              {group.description}
                            </p>
                          )}
                        </div>
                        <Badge variant={group.isActive ? "default" : "secondary"} data-testid={`badge-group-status-${group.id}`}>
                          {group.isActive ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(group)}
                          data-testid={`button-edit-group-${group.id}`}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Bearbeiten
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(group)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-group-${group.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Löschen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gruppe bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeiten Sie die Details der Gruppe.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="z.B. Entwicklung, Marketing, Vertrieb"
                          data-testid="input-edit-group-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beschreibung</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Beschreibung der Gruppe oder Abteilung"
                          data-testid="input-edit-group-description"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Farbe</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="color"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="w-16 h-10 p-1"
                            data-testid="input-edit-group-color"
                          />
                          <Input 
                            {...field} 
                            placeholder="#10b981"
                            className="flex-1"
                            data-testid="input-edit-group-color-text"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingGroup(null)}
                    data-testid="button-cancel-edit"
                  >
                    Abbrechen
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateGroupMutation.isPending}
                    data-testid="button-submit-edit"
                  >
                    {updateGroupMutation.isPending ? "Speichern..." : "Speichern"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}