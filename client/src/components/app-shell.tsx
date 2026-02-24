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
import { useAuth } from "@/lib/auth";
import { useOffline } from "@/lib/offline-context";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { AppLink } from "@/components/app-link";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
  color: string;
  activeColor: string;
  activeBg: string;
  adminOnly?: boolean;
  grindingOnly?: boolean;
  raceSkisOnly?: boolean;
  hideForRaceSkiOnly?: boolean;
};

const nav: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    testId: "link-dashboard",
    color: "text-gray-500",
    activeColor: "text-blue-600",
    activeBg: "bg-blue-50",
    hideForRaceSkiOnly: true,
  },
  {
    href: "/tests",
    labelKey: "nav.tests",
    icon: ListChecks,
    testId: "link-tests",
    color: "text-gray-500",
    activeColor: "text-emerald-600",
    activeBg: "bg-emerald-50",
    hideForRaceSkiOnly: true,
  },
  {
    href: "/testskis",
    labelKey: "nav.testskis",
    icon: Snowflake,
    testId: "link-testskis",
    color: "text-gray-500",
    activeColor: "text-sky-600",
    activeBg: "bg-sky-50",
    hideForRaceSkiOnly: true,
  },
  {
    href: "/products",
    labelKey: "nav.products",
    icon: Package,
    testId: "link-products",
    color: "text-gray-500",
    activeColor: "text-amber-600",
    activeBg: "bg-amber-50",
    hideForRaceSkiOnly: true,
  },
  {
    href: "/weather",
    labelKey: "nav.weather",
    icon: CloudSun,
    testId: "link-weather",
    color: "text-gray-500",
    activeColor: "text-violet-600",
    activeBg: "bg-violet-50",
  },
  {
    href: "/analytics",
    labelKey: "nav.analytics",
    icon: BarChart3,
    testId: "link-analytics",
    color: "text-gray-500",
    activeColor: "text-pink-600",
    activeBg: "bg-pink-50",
    hideForRaceSkiOnly: true,
  },
  {
    href: "/grinding",
    labelKey: "nav.grinding",
    icon: Disc3,
    testId: "link-grinding",
    color: "text-gray-500",
    activeColor: "text-indigo-600",
    activeBg: "bg-indigo-50",
    grindingOnly: true,
  },
  {
    href: "/raceskis",
    labelKey: "nav.raceskis",
    icon: Trophy,
    testId: "link-raceskis",
    color: "text-gray-500",
    activeColor: "text-orange-600",
    activeBg: "bg-orange-50",
    raceSkisOnly: true,
  },
  {
    href: "/suggestions",
    labelKey: "nav.suggestions",
    icon: Sparkles,
    testId: "link-suggestions",
    color: "text-gray-500",
    activeColor: "text-purple-600",
    activeBg: "bg-purple-50",
    hideForRaceSkiOnly: true,
  },
  {
    href: "/admin",
    labelKey: "nav.admin",
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
  const { user, logout } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
  const { theme, toggle: toggleTheme } = useTheme();
  const { t } = useI18n();

  const isRaceSkiOnlyUser = !user?.isAdmin && user?.canAccessRaceSkis && !user?.canAccessGrinding &&
    user?.groupScope?.split(",").map((s: string) => s.trim()).filter(Boolean).length === 0;

  const isRaceSkiUser = user?.isAdmin || !!user?.canAccessRaceSkis;

  const visibleNav = nav.filter((item) => {
    if (item.adminOnly && !user?.isAdmin) return false;
    if (item.grindingOnly && !user?.isAdmin && !user?.canAccessGrinding) return false;
    if (item.raceSkisOnly && !isRaceSkiUser) return false;
    if (item.hideForRaceSkiOnly && isRaceSkiOnlyUser) return false;
    return true;
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
                  <span>{t(item.labelKey)}</span>
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
