import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Users, UserCheck, UserX, Shield, Plus, Edit } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, InsertUser } from "@shared/schema";

const userSchema = z.object({
  username: z.string().min(3, "Benutzername muss mindestens 3 Zeichen lang sein"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Ungültige E-Mail-Adresse").optional().or(z.literal("")),
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen lang sein"),
  role: z.enum(["employee", "admin"]),
  hourlyRate: z.coerce.number().min(0, "Stundenlohn muss positiv sein").optional(),
  targetHoursPerDay: z.number().min(0, "Zielstunden pro Tag müssen positiv sein").default(8),
  isActive: z.boolean()
});

const editUserSchema = userSchema.extend({
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen lang sein").optional().or(z.literal(""))
});

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: currentUser?.role === 'admin'
  });

  const createForm = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "employee" as const,
      hourlyRate: undefined,
      targetHoursPerDay: 8,
      isActive: true
    }
  });

  const editForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "employee",
      hourlyRate: undefined,
      isActive: true
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema>) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Benutzer erstellt",
        description: "Der neue Benutzer wurde erfolgreich erstellt."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Erstellen des Benutzers",
        variant: "destructive"
      });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof editUserSchema> }) => {
      const updateData = { ...data };
      if (!updateData.password) {
        delete updateData.password;
      }
      const res = await apiRequest("PUT", `/api/users/${id}`, updateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      editForm.reset();
      toast({
        title: "Benutzer aktualisiert",
        description: "Die Benutzerdaten wurden erfolgreich aktualisiert."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Aktualisieren des Benutzers",
        variant: "destructive"
      });
    }
  });

  const handleCreateUser = (data: z.infer<typeof userSchema>) => {
    createUserMutation.mutate(data);
  };

  const handleEditUser = (data: z.infer<typeof editUserSchema>) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    editForm.reset({
      username: user.username,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      password: "",
      role: user.role,
      hourlyRate: user.hourlyRate ? Number(user.hourlyRate) : undefined,
      isActive: user.isActive === null ? true : user.isActive
    });
  };

  if (currentUser?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Zugriff verweigert</h2>
              <p className="text-muted-foreground">
                Sie haben keine Berechtigung für diesen Bereich.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-users-title">Benutzer</h1>
              <p className="text-muted-foreground">
                Verwalten Sie Benutzer und deren Berechtigungen
              </p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-user">
                  <Plus className="w-4 h-4 mr-2" />
                  Benutzer hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Benutzername</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vorname</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-firstname" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nachname</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-lastname" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={createForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-Mail</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passwort</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} data-testid="input-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rolle</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-role">
                                  <SelectValue placeholder="Rolle auswählen" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="employee">Mitarbeiter</SelectItem>
                                <SelectItem value="admin">Administrator</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="hourlyRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stundenlohn (€)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                value={field.value || ""}
                                data-testid="input-hourly-rate" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="targetHoursPerDay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Zielstunden pro Tag</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="1"
                                {...field}
                                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                value={field.value || ""}
                                data-testid="input-targetHoursPerDay" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={createForm.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Aktiver Benutzer</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Benutzer kann sich anmelden und das System verwenden
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-active"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCreateDialogOpen(false)}
                        data-testid="button-cancel"
                      >
                        Abbrechen
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createUserMutation.isPending}
                        data-testid="button-submit"
                      >
                        {createUserMutation.isPending ? "Erstelle..." : "Erstellen"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Benutzer bearbeiten</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditUser)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Benutzername</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vorname</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nachname</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="input-edit-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Neues Passwort (leer lassen für keine Änderung)</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} data-testid="input-edit-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rolle</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-role">
                              <SelectValue placeholder="Rolle auswählen" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="employee">Mitarbeiter</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="hourlyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stundenlohn (€)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            {...field}
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            value={field.value || ""}
                            data-testid="input-edit-hourly-rate" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                  control={editForm.control}
                  name="targetHoursPerDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zielstunden pro Tag</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="1"
                          {...field}
                          onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          value={field.value || ""}
                          data-testid="input-edit-targetHoursPerDay" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Aktiver Benutzer</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Benutzer kann sich anmelden und das System verwenden
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-edit-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingUser(null)}
                    data-testid="button-edit-cancel"
                  >
                    Abbrechen
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateUserMutation.isPending}
                    data-testid="button-edit-submit"
                  >
                    {updateUserMutation.isPending ? "Speichere..." : "Speichern"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <div className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Gesamt Benutzer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="text-2xl font-bold" data-testid="text-total-users">
                    {users.length}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Aktive Benutzer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-green-500" />
                  <span className="text-2xl font-bold" data-testid="text-active-users">
                    {users.filter(u => u.isActive).length}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Administratoren
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-500" />
                  <span className="text-2xl font-bold" data-testid="text-admin-users">
                    {users.filter(u => u.role === 'admin').length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Benutzerliste</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Name</th>
                      <th className="text-left py-2">Benutzername</th>
                      <th className="text-left py-2">E-Mail</th>
                      <th className="text-left py-2">Rolle</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Stundenlohn</th>
                      <th className="text-left py-2">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b" data-testid={`row-user-${user.id}`}>
                        <td className="py-3">
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : "-"}
                        </td>
                        <td className="py-3 font-mono text-sm">{user.username}</td>
                        <td className="py-3">{user.email || "-"}</td>
                        <td className="py-3">
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge variant={user.isActive ? 'default' : 'destructive'}>
                            {user.isActive ? 'Aktiv' : 'Inaktiv'}
                          </Badge>
                        </td>
                        <td className="py-3">
                          {user.hourlyRate ? `${user.hourlyRate}€/h` : "-"}
                        </td>
                        <td className="py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Bearbeiten
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}