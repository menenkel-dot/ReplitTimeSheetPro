import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, UserX, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/schema";

export default function AdminUsers() {
  const { user: currentUser } = useAuth();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: currentUser?.role === 'admin'
  });

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
          </div>
        </header>

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
