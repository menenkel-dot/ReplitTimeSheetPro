import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Users, BarChart, Shield } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    email: "",
    firstName: "",
    lastName: "",
  });

  // Redirect if already logged in - moved after all hook calls
  if (user) {
    setLocation("/");
    return null;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginForm);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(registerForm);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold">Zeiterfassung</CardTitle>
            </div>
            <CardDescription>
              Melden Sie sich an oder erstellen Sie ein Konto
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" data-testid="tab-login">Anmelden</TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">Registrieren</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Benutzername</Label>
                    <Input
                      id="login-username"
                      data-testid="input-login-username"
                      type="text"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Passwort</Label>
                    <Input
                      id="login-password"
                      data-testid="input-login-password"
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    data-testid="button-login-submit"
                    className="w-full"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "Anmeldung..." : "Anmelden"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-firstName">Vorname</Label>
                      <Input
                        id="register-firstName"
                        data-testid="input-register-firstName"
                        type="text"
                        value={registerForm.firstName}
                        onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-lastName">Nachname</Label>
                      <Input
                        id="register-lastName"
                        data-testid="input-register-lastName"
                        type="text"
                        value={registerForm.lastName}
                        onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-username">Benutzername</Label>
                    <Input
                      id="register-username"
                      data-testid="input-register-username"
                      type="text"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">E-Mail</Label>
                    <Input
                      id="register-email"
                      data-testid="input-register-email"
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Passwort</Label>
                    <Input
                      id="register-password"
                      data-testid="input-register-password"
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    data-testid="button-register-submit"
                    className="w-full"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? "Registrierung..." : "Registrieren"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Right side - Hero section */}
      <div className="flex-1 bg-primary/5 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-primary-foreground" />
          </div>
          
          <h2 className="text-3xl font-bold mb-4">
            Professionelle Zeiterfassung
          </h2>
          
          <p className="text-muted-foreground mb-8">
            Erfassen und verwalten Sie Ihre Arbeitszeiten effizient. 
            Mit automatischer Saldo-Berechnung und umfassenden Reports.
          </p>

          <div className="grid grid-cols-1 gap-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm">Benutzer- und Rollenverwaltung</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <BarChart className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm">Detaillierte Reports und Exporte</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm">Sichere Datenverwaltung</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
