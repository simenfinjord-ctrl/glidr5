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
  adminOnly?: boolean;
};

const nav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    testId: "link-dashboard",
    color: "text-blue-400/70",
    activeColor: "text-blue-400",
  },
  {
    href: "/tests",
    label: "Tests",
    icon: ListChecks,
    testId: "link-tests",
    color: "text-emerald-400/70",
    activeColor: "text-emerald-400",
  },
  {
    href: "/testskis",
    label: "TestSkis",
    icon: Snowflake,
    testId: "link-testskis",
    color: "text-sky-400/70",
    activeColor: "text-sky-400",
  },
  {
    href: "/products",
    label: "Products",
    icon: Package,
    testId: "link-products",
    color: "text-amber-400/70",
    activeColor: "text-amber-400",
  },
  {
    href: "/weather",
    label: "Weather",
    icon: CloudSun,
    testId: "link-weather",
    color: "text-violet-400/70",
    activeColor: "text-violet-400",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    testId: "link-analytics",
    color: "text-pink-400/70",
    activeColor: "text-pink-400",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    testId: "link-admin",
    color: "text-rose-400/70",
    activeColor: "text-rose-400",
    adminOnly: true,
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();

  const visibleNav = nav.filter((item) => !item.adminOnly || user?.isAdmin);

  return (
    <div className="min-h-screen fs-grid">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src="/logo.png" alt="US Ski Team" className="h-10 w-10 object-contain" />
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background",
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              )} />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold tracking-tight bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">Glidr</span>
                <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
                  US Ski Team
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">A US Ski Team database</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-400 ring-1 ring-amber-500/30" data-testid="badge-offline">
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
                className="text-amber-400 hover:text-amber-300"
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
              data-testid="button-logout"
              onClick={() => logout()}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pb-3">
          <nav className="flex flex-wrap items-center gap-1.5" data-testid="nav-primary">
            {visibleNav.map((item) => {
              const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
              const Icon = item.icon;
              return (
                <AppLink
                  key={item.href}
                  href={item.href}
                  testId={item.testId}
                  className={cn(
                    "group inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-card/80 shadow-sm ring-1 ring-border/60 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/40",
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

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="fs-card rounded-3xl p-4 sm:p-6">{children}</div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-10">
        <div className="mb-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Glidr · US Ski Team</span>
          <span>Designed for fast tablet entry</span>
        </div>
      </footer>
    </div>
  );
}
