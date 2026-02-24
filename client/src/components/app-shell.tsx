import { ReactNode } from "react";
import { useLocation } from "wouter";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
    color: "text-gray-500",
    activeColor: "text-blue-600",
    activeBg: "bg-blue-50",
    permArea: "dashboard",
  },
  {
    href: "/tests",
    label: "Tests",
    icon: ListChecks,
    testId: "link-tests",
    color: "text-gray-500",
    activeColor: "text-emerald-600",
    activeBg: "bg-emerald-50",
    permArea: "tests",
  },
  {
    href: "/testskis",
    label: "TestSkis",
    icon: Snowflake,
    testId: "link-testskis",
    color: "text-gray-500",
    activeColor: "text-sky-600",
    activeBg: "bg-sky-50",
    permArea: "testskis",
  },
  {
    href: "/products",
    label: "Products",
    icon: Package,
    testId: "link-products",
    color: "text-gray-500",
    activeColor: "text-amber-600",
    activeBg: "bg-amber-50",
    permArea: "products",
  },
  {
    href: "/weather",
    label: "Weather",
    icon: CloudSun,
    testId: "link-weather",
    color: "text-gray-500",
    activeColor: "text-violet-600",
    activeBg: "bg-violet-50",
    permArea: "weather",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    testId: "link-analytics",
    color: "text-gray-500",
    activeColor: "text-pink-600",
    activeBg: "bg-pink-50",
    permArea: "analytics",
  },
  {
    href: "/grinding",
    label: "Grinding",
    icon: Disc3,
    testId: "link-grinding",
    color: "text-gray-500",
    activeColor: "text-indigo-600",
    activeBg: "bg-indigo-50",
    permArea: "grinding",
  },
  {
    href: "/raceskis",
    label: "Race Skis",
    icon: Trophy,
    testId: "link-raceskis",
    color: "text-gray-500",
    activeColor: "text-orange-600",
    activeBg: "bg-orange-50",
    permArea: "raceskis",
  },
  {
    href: "/suggestions",
    label: "Suggestions",
    icon: Sparkles,
    testId: "link-suggestions",
    color: "text-gray-500",
    activeColor: "text-purple-600",
    activeBg: "bg-purple-50",
    permArea: "suggestions",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    testId: "link-admin",
    color: "text-gray-500",
    activeColor: "text-rose-600",
    activeBg: "bg-rose-50",
    adminOnly: true,
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, can } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
  const { theme, toggle: toggleTheme } = useTheme();

  const filteredNav = nav.filter((item) => {
    if (item.adminOnly) return !!user?.isAdmin;
    if (item.permArea) return can(item.permArea);
    return true;
  });

  const perms = user?.parsedPermissions;
  const visibleNav = [...filteredNav].sort((a, b) => {
    if (user?.isAdmin) return 0;
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
      <header className="sticky top-0 z-40 border-b border-border bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Glidr</span>
            <div className={cn(
              "h-2 w-2 rounded-full",
              isOnline ? "bg-emerald-500" : "bg-amber-500"
            )} />
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
            <Button
              variant="ghost"
              size="sm"
              data-testid="button-theme-toggle"
              onClick={toggleTheme}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <AppLink
              href="/profile"
              testId="link-profile"
              className="hidden sm:flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mr-1 transition-colors"
            >
              <UserCircle className="h-4 w-4" />
              <span>{user?.name}</span>
            </AppLink>
            <Button
              variant="ghost"
              size="sm"
              data-testid="button-logout"
              onClick={() => logout()}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-3">
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
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800",
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

      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-6">
        <div className="fs-card rounded-2xl p-4 sm:p-6">{children}</div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-8">
        <div className="mb-3 h-px bg-gray-100 dark:bg-gray-800" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span className="font-medium">Glidr</span>
          <span>A glide and performance database</span>
        </div>
      </footer>
    </div>
  );
}
