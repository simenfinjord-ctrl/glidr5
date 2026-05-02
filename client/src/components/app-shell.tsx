import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth, type UserPermissions } from "@/lib/auth";
import { useOffline } from "@/lib/offline-context";
import { useTheme } from "@/lib/theme";
import { AppLink } from "@/components/app-link";
import { MobileNav, useMobileNav } from "@/components/mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
  color: string;
  activeColor: string;
  activeBg: string;
  permArea?: keyof UserPermissions;
  featureArea?: string;
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
    featureArea: "garmin_watch",
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

function ReportProblemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/report-problem", { subject, body }),
    onSuccess: () => {
      toast({ title: "Report sent", description: "Thank you — your report has been forwarded to the support team." });
      setSubject("");
      setBody("");
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to send report", description: err?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report a Problem</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rp-subject">Subject</Label>
            <Input
              id="rp-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of the issue"
              maxLength={200}
              required
              data-testid="input-report-subject"
            />
            <span className="text-right text-[11px] text-muted-foreground">{subject.length}/200</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rp-body">Details</Label>
            <Textarea
              id="rp-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe what happened, what you expected, and any steps to reproduce…"
              maxLength={2000}
              rows={6}
              required
              data-testid="input-report-body"
            />
            <span className="text-right text-[11px] text-muted-foreground">{body.length}/2000</span>
          </div>
          <Button
            type="submit"
            disabled={mutation.isPending || !subject.trim() || !body.trim()}
            data-testid="button-report-submit"
          >
            {mutation.isPending ? "Sending…" : "Submit Report"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, logout, can, isSuperAdmin, canManage, switchTeam, toggleIncognito, toggleStealth, isViewingOtherTeam, isStealthActive, userTeams, userTeamsLoading } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
  const { theme, toggle: toggleTheme } = useTheme();
  const [reportOpen, setReportOpen] = useState(false);

  const [adminMode, setAdminMode] = useState<boolean>(() => {
    try { return localStorage.getItem("glidr-sa-admin-mode") === "true"; } catch { return false; }
  });

  // Sync adminMode when localStorage changes (e.g. toggled from admin page)
  useEffect(() => {
    const handler = () => {
      try { setAdminMode(localStorage.getItem("glidr-sa-admin-mode") === "true"); } catch {}
    };
    window.addEventListener("storage", handler);
    // Also poll on focus in case toggle happened in same tab
    window.addEventListener("focus", handler);
    return () => { window.removeEventListener("storage", handler); window.removeEventListener("focus", handler); };
  }, []);

  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ["/api/teams"],
    enabled: isSuperAdmin,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/inbox/unread-count"],
    enabled: !!user && isSuperAdmin,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const activeTeamId = user?.activeTeamId || user?.teamId || 1;
  const activeTeam = isSuperAdmin
    ? teams.find((t: any) => t.id === activeTeamId)
    : userTeams.find((t) => t.id === activeTeamId);

  // Own team = primary team OR any explicitly-assigned team.
  // While userTeams is still loading, treat as own team to avoid hiding nav prematurely.
  const isViewingOwnTeam = !isSuperAdmin || userTeamsLoading || userTeams.some((t) => t.id === activeTeamId);

  const hasGarminWatch = can("garmin_watch");
  const mobileNavStore = useMobileNav();
  const [mobileNavEnabled, setMobileNavEnabled] = useState(false);
  useEffect(() => { setMobileNavEnabled(mobileNavStore.get()); }, []);

  const { data: watchQueue = [] } = useQuery<{ id: number; status: string }[]>({
    queryKey: ["/api/watch/queue"],
    enabled: !!user && hasGarminWatch,
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const watchQueueCount = watchQueue.filter((q) => q.status === "active").length;

  const filteredNav = nav.filter((item) => {
    if (item.adminOnly) return canManage;
    if (isSuperAdmin && !isViewingOwnTeam && isStealthActive) {
      return true;
    }
    if (isSuperAdmin && !isViewingOwnTeam) {
      return false;
    }
    if (item.featureArea && !can(item.featureArea)) return false;
    if (item.permArea) return can(item.permArea);
    return true;
  });

  const perms = user?.parsedPermissions;
  const sortedNav = [...filteredNav].sort((a, b) => {
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

  const overviewNavItem: NavItem = {
    href: "/overview",
    label: "Overview",
    icon: Eye,
    testId: "link-overview",
    color: "text-muted-foreground",
    activeColor: "text-purple-600",
    activeBg: "bg-purple-50",
    adminOnly: true,
  };

  const visibleNav = isSuperAdmin && adminMode
    ? [overviewNavItem, ...sortedNav]
    : sortedNav;

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
            {/* Mail/Inbox button — SA only */}
            {isSuperAdmin && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-mail"
                onClick={() => navigate("/inbox")}
                className="relative text-muted-foreground hover:text-foreground hover:bg-muted"
                title="SA Inbox"
              >
                <Mail className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
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
              href="/my-account"
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
        <div className={cn("mx-auto w-full max-w-[1600px] px-4 sm:px-6 pb-3", mobileNavEnabled && "hidden sm:block")}>
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
                  {item.href === "/watch-queue" && watchQueueCount > 0 && (
                    <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
                      {watchQueueCount}
                    </span>
                  )}
                </AppLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-6">
        <div className="fs-card rounded-2xl p-4 sm:p-6">{children}</div>
      </main>

      {mobileNavEnabled && (
        <div className="sm:hidden">
          <MobileNav watchQueueCount={watchQueueCount} />
        </div>
      )}

      <footer className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 pb-8">
        <div className="mb-3 h-px bg-border" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Glidr</span>
          <div className="flex items-center gap-3">
            <AppLink href="/my-account" testId="link-my-account" className="underline hover:text-foreground transition-colors">
              My Account
            </AppLink>
            <span className="text-border">|</span>
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
            <span className="text-border">|</span>
            <button
              onClick={() => setReportOpen(true)}
              className="underline hover:text-foreground transition-colors flex items-center gap-1"
              data-testid="link-report-problem"
            >
              <Mail className="h-3 w-3" />
              Report a Problem
            </button>
          </div>
        </div>
      </footer>
      <ReportProblemDialog open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}
