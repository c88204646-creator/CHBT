import { useState } from "react";
import {
  Home,
  MessageSquare,
  Bot,
  Settings,
  Smartphone,
  LogOut,
  ChevronDown,
  Zap,
  Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ReactNode;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const mainMenuItems: MenuSection[] = [
  {
    title: "MAIN",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: <Home className="w-4 h-4" /> },
      { title: "Conversations", url: "/conversations", icon: <MessageSquare className="w-4 h-4" /> },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      { title: "WhatsApp Accounts", url: "/whatsapp", icon: <Smartphone className="w-4 h-4" /> },
      { title: "Chatbot Builder", url: "/chatbot", icon: <Bot className="w-4 h-4" /> },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      { title: "Settings", url: "/settings", icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

interface AppSidebarProps {
  user?: { username: string; email: string };
  onLogout?: () => void;
}

export function AppSidebar({ user, onLogout }: AppSidebarProps) {
  const [location] = useLocation();
  const { state } = useSidebar();
  const [expandedSections, setExpandedSections] = useState<string[]>(["MAIN", "BUSINESS", "MANAGEMENT"]);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((s) => s !== title) : [...prev, title]
    );
  };

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-r border-slate-200 dark:border-slate-800">
      <SidebarContent className="space-y-0">
        {/* Logo Section */}
        <div className="px-4 py-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700 flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h1 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  CRM Hub
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">WhatsApp Manager</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu Sections */}
        <div className="space-y-2 py-4">
          {mainMenuItems.map((section) => (
            <Collapsible
              key={section.title}
              open={expandedSections.includes(section.title)}
              onOpenChange={() => toggleSection(section.title)}
            >
              <div className="px-4">
                {!isCollapsed && (
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between py-2 px-2 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {section.title === "MAIN" && <Zap className="w-3 h-3" />}
                      {section.title === "BUSINESS" && <Users className="w-3 h-3" />}
                      {section.title === "MANAGEMENT" && <Settings className="w-3 h-3" />}
                      {section.title}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        expandedSections.includes(section.title) ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                  </button>
                )}
              </div>

              <CollapsibleContent>
                <SidebarMenu className="gap-1 px-2 py-2">
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        className={`rounded-lg transition-all duration-200 ${
                          location === item.url
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Link href={item.url} className={isCollapsed ? "gap-0" : "gap-3"}>
                          <div className="flex items-center justify-center flex-shrink-0">{item.icon}</div>
                          {!isCollapsed && (
                            <span className="font-medium text-sm">{item.title}</span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </SidebarContent>

      {/* User Footer */}
      {user && (
        <SidebarFooter className="p-3 border-t border-slate-200 dark:border-slate-800 bg-gradient-to-t from-slate-50 to-transparent dark:from-slate-900/50 dark:to-transparent">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={`w-full justify-start gap-3 h-auto p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 ${
                  isCollapsed ? "px-2 justify-center" : ""
                }`}
                data-testid="button-user-menu"
              >
                <Avatar className="w-9 h-9 border-2 border-slate-200 dark:border-slate-700 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white text-xs font-bold">
                    {user.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {user.username}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={onLogout}
                data-testid="button-logout"
                className="cursor-pointer text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
