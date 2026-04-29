import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ListChecks,
  Snowflake,
  CloudSun,
  Package,
  Shield,
  LogOut,
  WifiOff,
  RefreshCw,
  CloudUpload,
  BarChart3,
  Disc3,
  UserCircle,
  Sun,
  Moon,
  Sparkles,
  Trophy,
  Radio,
  Watch,

  ChevronDown,
  EyeOff,
  Eye,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth, type UserPermissions } from "@/lib/auth";
import { useOffline } from "@/lib/offline-context";
import { useTheme } from "@/lib/theme";
import { AppLink } from "@/components/app-link";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
  color: string;
  activeColor: string;
  activeBg: string;
  permArea?: keyof UserPermissions;
  adminOnly?: boolean;
};

const nav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    testId: "link-dashboard",
    color: "text-muted-foreground",
    activeColor: "text-green-600",
    activeBg: "bg-green-50",
    permArea: "dashboard",
  },
  {
    href: "/tests",
    label: "Tests",
    icon: ListChecks,
    testId: "link-tests",
    color: "text-muted-foreground",
    activeColor: "text-emerald-600",
    activeBg: "bg-emerald-50",
    permArea: "tests",
  },
  {
    href: "/testskis",
    label: "Testskis",
    icon: Snowflake,
    testId: "link-testskis",
    color: "text-muted-foreground",
    activeColor: "text-sky-600",
    activeBg: "bg-sky-50",
    permArea: "testskis",
  },
  {
    href: "/products",
    label: "Products",
    icon: Package,
    testId: "link-products",
    color: "text-muted-foreground",
    activeColor: "text-amber-600",
    activeBg: "bg-amber-50",
    permArea: "products",
  },
  {
    href: "/weather",
    label: "Weather",
    icon: CloudSun,
    testId: "link-weather",
    color: "text-muted-foreground",
    activeColor: "text-violet-600",
    activeBg: "bg-violet-50",
    permArea: "weather",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    testId: "link-analytics",
    color: "text-muted-foreground",
    activeColor: "text-pink-600",
    activeBg: "bg-pink-50",
    permArea: "analytics",
  },
  {
    href: "/grinding",
    label: "Grinding",
    icon: Disc3,
    testId: "link-grinding",
    color: "text-muted-foreground",
    activeColor: "text-indigo-600",
    activeBg: "bg-indigo-50",
    permArea: "grinding",
  },
  {
    href: "/raceskis",
    label: "Raceskis",
    icon: Trophy,
    testId: "link-raceskis",
    color: "text-muted-foreground",
    activeColor: "text-orange-600",
    activeBg: "bg-orange-50",
    permArea: "raceskis",
  },
  {
    href: "/suggestions",
    label: "Suggestions",
    icon: Sparkles,
    testId: "link-suggestions",
    color: "text-muted-foreground",
    activeColor: "text-purple-600",
    activeBg: "bg-purple-50",
    permArea: "suggestions",
  },
  {
    href: "/live-runsheets",
    label: "Live Runsheets",
    icon: Radio,
    testId: "link-live-runsheets",
    color: "text-muted-foreground",
    activeColor: "text-green-600",
    activeBg: "bg-green-50",
    permArea: "liverunsheets",
  },
  {
    href: "/watch-queue",
    label: "Watch Queue",
    icon: Watch,
    testId: "link-watch-queue",
    color: "text-muted-foreground",
    activeColor: "text-sky-600",
    activeBg: "bg-sky-50",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    testId: "link-admin",
    color: "text-muted-foreground",
    activeColor: "text-rose-600",
    activeBg: "bg-rose-50",
    adminOnly: true,
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, can, isSuperAdmin, canManage, switchTeam, toggleIncognito, toggleStealth, isViewingOtherTeam, isStealthActive, userTeams } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
  const { theme, toggle: toggleTheme } = useTheme();

  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ["/api/teams"],
    enabled: isSuperAdmin,
  });

  const activeTeamId = user?.activeTeamId || user?.teamId || 1;
  const activeTeam = isSuperAdmin
    ? teams.find((t: any) => t.id === activeTeamId)
    : userTeams.find((t) => t.id === activeTeamId);

  const isViewingOwnTeam = !isSuperAdmin || activeTeamId === user?.teamId;

  const filteredNav = nav.filter((item) => {
    if (item.adminOnly) return canManage;
    if (isSuperAdmin && !isViewingOwnTeam && isStealthActive) {
      return true;
    }
    if (isSuperAdmin && !isViewingOwnTeam) {
      return false;
    }
    if (item.permArea) return can(item.permArea);
    return true;
  });

  const perms = user?.parsedPermissions;
  const visibleNav = [...filteredNav].sort((a, b) => {
    if (user?.isAdmin || user?.isTeamAdmin) return 0;
    if (!perms) return 0;
    const levelOrder = (item: NavItem) => {
      if (item.adminOnly) return 2;
      if (!item.permArea) return 0;
      const lvl = perms[item.permArea];
      if (lvl === "edit") return 0;
      if (lvl === "view") return 1;
      return 2;
    };
    return levelOrder(a) - levelOrder(b);
  });

  return (
    <div className="min-h-screen fs-grid">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-foreground">Glidr</span>
            <div className={cn(
              "h-2 w-2 rounded-full",
              isOnline ? "bg-emerald-500" : "bg-amber-500"
            )} />
            {isSuperAdmin && teams.length > 1 && (
              <Select
                value={String(activeTeamId)}
                onValueChange={(val) => switchTeam(parseInt(val))}
              >
                <SelectTrigger
                  className="h-8 w-auto min-w-[140px] border-border bg-muted/50 text-xs font-medium"
                  data-testid="select-team"
                >
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team: any) => (
                    <SelectItem key={team.id} value={String(team.id)}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!isSuperAdmin && userTeams.length > 1 && (
              <Select
                value={String(activeTeamId)}
                onValueChange={(val) => switchTeam(parseInt(val))}
              >
                <SelectTrigger
                  className="h-8 w-auto min-w-[140px] border-border bg-muted/50 text-xs font-medium"
                  data-testid="select-user-team"
                >
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {userTeams.map((team) => (
                    <SelectItem key={team.id} value={String(team.id)}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200" data-testid="badge-offline">
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}
            {pendingCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-sync"
                onClick={() => syncNow()}
                disabled={isSyncing || !isOnline}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              >
                {isSyncing ? (
                  <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="mr-1.5 h-4 w-4" />
                )}
                {pendingCount} pending
              </Button>
            )}
            {isSuperAdmin && isViewingOtherTeam && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-stealth-toggle"
                onClick={() => toggleStealth(!user?.stealth)}
                className={cn(
                  "text-muted-foreground hover:text-foreground hover:bg-muted",
                  isStealthActive && "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400"
                )}
                title={isStealthActive ? "Stealth mode ON (read-only)" : "Stealth mode"}
              >
                {isStealthActive ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </Button>
            )}
            {isSuperAdmin && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-incognito-toggle"
                onClick={() => toggleIncognito(!user?.incognito)}
                className={cn(
                  "text-muted-foreground hover:text-foreground hover:bg-muted",
                  user?.incognito && "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400"
                )}
                title={user?.incognito ? "Incognito mode ON" : "Incognito mode"}
              >
                {user?.incognito ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              data-testid="button-theme-toggle"
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <AppLink
              href="/profile"
              testId="link-profile"
              className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mr-1 transition-colors"
            >
              <UserCircle className="h-4 w-4" />
              <span>{user?.name}</span>
            </AppLink>
            <Button
              variant="ghost"
              size="sm"
              data-testid="button-logout"
              onClick={() => logout()}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 pb-3">
          <nav className="flex flex-wrap items-center gap-1" data-testid="nav-primary">
            {visibleNav.map((item) => {
              const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
              const Icon = item.icon;
              return (
                <AppLink
                  key={item.href}
                  href={item.href}
                  testId={item.testId}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150",
                    active
                      ? `${item.activeBg} ${item.activeColor} shadow-sm dark:bg-opacity-20`
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      active ? item.activeColor : item.color,
                    )}
                  />
                  <span>{item.label}</span>
                </AppLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-6">
        <div className="fs-card rounded-2xl p-4 sm:p-6">{children}</div>
      </main>

      <footer className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 pb-8">
        <div className="mb-3 h-px bg-border" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Glidr</span>
          <div className="flex items-center gap-3">
            <AppLink href="/what-is-glidr" testId="link-what-is-glidr" className="underline hover:text-foreground transition-colors">
              What is Glidr?
            </AppLink>
            <span className="text-border">|</span>
            <AppLink href="/pricing" testId="link-pricing" className="underline hover:text-foreground transition-colors">
              Pricing
            </AppLink>
            <span className="text-border">|</span>
            <AppLink href="/legal" testId="link-legal" className="underline hover:text-foreground transition-colors">
              Legal
            </AppLink>
            <span className="text-border">|</span>
            <AppLink href="/contact" testId="link-contact" className="underline hover:text-foreground transition-colors">
              Contact
            </AppLink>
          </div>
        </div>
      </footer>
    </div>
  );
}
