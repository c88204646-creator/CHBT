import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Smartphone, Bot, TrendingUp } from "lucide-react";

interface DashboardStats {
  totalSessions: number;
  connectedSessions: number;
  totalConversations: number;
  activeChatbots: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const statCards = [
    {
      title: "WhatsApp Connections",
      value: stats?.connectedSessions ?? 0,
      total: stats?.totalSessions ?? 0,
      icon: Smartphone,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Active Conversations",
      value: stats?.totalConversations ?? 0,
      icon: MessageSquare,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      title: "Chatbot Rules",
      value: stats?.activeChatbots ?? 0,
      icon: Bot,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Response Rate",
      value: "98%",
      icon: TrendingUp,
      color: "text-whatsapp",
      bgColor: "bg-whatsapp/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your WhatsApp business operations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover-elevate" data-testid={`card-stat-${stat.title.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="space-y-1">
                  <p className="text-2xl font-semibold text-foreground" data-testid={`text-stat-value-${stat.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    {stat.total ? `${stat.value}/${stat.total}` : stat.value}
                  </p>
                  {stat.total && (
                    <p className="text-xs text-muted-foreground">
                      {stat.value} connected
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="/whatsapp"
              className="flex items-center gap-3 p-4 rounded-lg border border-border hover-elevate transition-all"
              data-testid="link-quick-connect-whatsapp"
            >
              <div className="w-10 h-10 rounded-lg bg-whatsapp/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-whatsapp" />
              </div>
              <div>
                <p className="font-medium text-foreground">Connect WhatsApp</p>
                <p className="text-sm text-muted-foreground">Link a new WhatsApp account</p>
              </div>
            </a>
            <a
              href="/chatbot"
              className="flex items-center gap-3 p-4 rounded-lg border border-border hover-elevate transition-all"
              data-testid="link-quick-create-chatbot"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-medium text-foreground">Create Chatbot Rule</p>
                <p className="text-sm text-muted-foreground">Set up automated responses</p>
              </div>
            </a>
            <a
              href="/conversations"
              className="flex items-center gap-3 p-4 rounded-lg border border-border hover-elevate transition-all"
              data-testid="link-quick-view-conversations"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">View Conversations</p>
                <p className="text-sm text-muted-foreground">Manage your messages</p>
              </div>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from your accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No recent activity</p>
                <p className="text-xs mt-1">Connect a WhatsApp account to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
