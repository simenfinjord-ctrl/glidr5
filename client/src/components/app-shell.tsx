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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useOffline } from "@/lib/offline-context";
import { AppLink } from "@/components/app-link";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
  color: string;
  activeColor: string;
  activeBg: string;
  adminOnly?: boolean;
  grindingOnly?: boolean;
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
  },
  {
    href: "/tests",
    label: "Tests",
    icon: ListChecks,
    testId: "link-tests",
    color: "text-gray-500",
    activeColor: "text-emerald-600",
    activeBg: "bg-emerald-50",
  },
  {
    href: "/testskis",
    label: "TestSkis",
    icon: Snowflake,
    testId: "link-testskis",
    color: "text-gray-500",
    activeColor: "text-sky-600",
    activeBg: "bg-sky-50",
  },
  {
    href: "/products",
    label: "Products",
    icon: Package,
    testId: "link-products",
    color: "text-gray-500",
    activeColor: "text-amber-600",
    activeBg: "bg-amber-50",
  },
  {
    href: "/weather",
    label: "Weather",
    icon: CloudSun,
    testId: "link-weather",
    color: "text-gray-500",
    activeColor: "text-violet-600",
    activeBg: "bg-violet-50",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    testId: "link-analytics",
    color: "text-gray-500",
    activeColor: "text-pink-600",
    activeBg: "bg-pink-50",
  },
  {
    href: "/grinding",
    label: "Grinding",
    icon: Disc3,
    testId: "link-grinding",
    color: "text-gray-500",
    activeColor: "text-indigo-600",
    activeBg: "bg-indigo-50",
    grindingOnly: true,
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
  const { user, logout } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();

  const visibleNav = nav.filter((item) => {
    if (item.adminOnly && !user?.isAdmin) return false;
    if (item.grindingOnly && !user?.isAdmin && !(user as any)?.canAccessGrinding) return false;
    return true;
  });

  return (
    <div className="min-h-screen fs-grid">
      <header className="sticky top-0 z-40 border-b border-border bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center text-white font-bold text-base shadow-sm">G</div>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              )} />
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold tracking-tight text-gray-900">Glidr</span>
              <div className="text-[11px] text-gray-400 leading-tight">Ski testing & documentation</div>
            </div>
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
            <AppLink
              href="/profile"
              testId="link-profile"
              className="hidden sm:flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mr-1 transition-colors"
            >
              <UserCircle className="h-4 w-4" />
              <span>{user?.name}</span>
            </AppLink>
            <Button
              variant="ghost"
              size="sm"
              data-testid="button-logout"
              onClick={() => logout()}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100"
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
                      ? `${item.activeBg} ${item.activeColor} shadow-sm`
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100",
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
        <div className="mb-3 h-px bg-gray-100" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
          <span className="font-medium">Glidr</span>
          <span>Ski testing & documentation</span>
        </div>
      </footer>
    </div>
  );
}
