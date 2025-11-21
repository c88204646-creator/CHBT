import { useState, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import WhatsAppConnectionsPage from "@/pages/whatsapp-connections";
import ConversationsPage from "@/pages/conversations";
import ChatbotBuilderPage from "@/pages/chatbot-builder";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";
import type { LoginCredentials } from "@shared/schema";

interface User {
  id: string;
  username: string;
  email: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (credentials: LoginCredentials) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    const userData = await response.json();
    setUser(userData);
  };

  const handleRegister = async (data: {
    username: string;
    email: string;
    password: string;
  }) => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Registration failed");
    }

    const userData = await response.json();
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      setLocation("/login");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {!user ? (
          <Switch>
            <Route path="/login">
              <LoginPage onLogin={handleLogin} />
            </Route>
            <Route path="/register">
              <RegisterPage onRegister={handleRegister} />
            </Route>
            <Route path="*">
              <Redirect to="/login" />
            </Route>
          </Switch>
        ) : (
          <SidebarProvider style={sidebarStyle}>
            <div className="flex h-screen w-full">
              <AppSidebar user={user} onLogout={handleLogout} />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center gap-4 p-4 border-b border-border bg-background">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                </header>
                <main className="flex-1 overflow-auto p-8 bg-background">
                  <Switch>
                    <Route path="/dashboard">
                      <DashboardPage />
                    </Route>
                    <Route path="/whatsapp">
                      <WhatsAppConnectionsPage />
                    </Route>
                    <Route path="/conversations">
                      <ConversationsPage />
                    </Route>
                    <Route path="/chatbot">
                      <ChatbotBuilderPage />
                    </Route>
                    <Route path="/settings">
                      <SettingsPage user={user} />
                    </Route>
                    <Route path="/">
                      <Redirect to="/dashboard" />
                    </Route>
                    <Route component={NotFound} />
                  </Switch>
                </main>
              </div>
            </div>
          </SidebarProvider>
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
