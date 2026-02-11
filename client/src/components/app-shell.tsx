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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { AppLink } from "@/components/app-link";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
};

const nav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    testId: "link-dashboard",
  },
  { href: "/tests", label: "Tests", icon: ListChecks, testId: "link-tests" },
  {
    href: "/testskis",
    label: "TestSkis",
    icon: Snowflake,
    testId: "link-testskis",
  },
  {
    href: "/products",
    label: "Products",
    icon: Package,
    testId: "link-products",
  },
  {
    href: "/weather",
    label: "Weather",
    icon: CloudSun,
    testId: "link-weather",
  },
  { href: "/admin", label: "Admin", icon: Shield, testId: "link-admin" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen fs-grid">
      <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-accent" />
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/30" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-semibold tracking-tight">FastSki</span>
                <span className="rounded-full border bg-card/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                  US Ski Team
                </span>
              </div>
              <div className="text-xs text-muted-foreground">Testing + documentation</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              data-testid="button-logout"
              onClick={() => logout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pb-3">
          <nav className="flex flex-wrap items-center gap-2" data-testid="nav-primary">
            {nav.map((item) => {
              const active = location === item.href;
              const Icon = item.icon;
              return (
                <AppLink
                  key={item.href}
                  href={item.href}
                  testId={item.testId}
                  className={cn(
                    "group inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                    "bg-card/60 hover:bg-card/90",
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border/80 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground",
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
        <Separator className="mb-4" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>FastSki prototype (frontend-only)</span>
          <span>Designed for fast tablet entry</span>
        </div>
      </footer>
    </div>
  );
}
