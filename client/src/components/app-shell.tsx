import { ReactNode, useState, useEffect } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
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
  EyeOff,
  Eye,
  Lock,
  Unlock,
  Mail,
  Menu,
  AlertTriangle,
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
import { CommandSearch } from "@/components/command-search";
import { MobileNav, useMobileNav } from "@/components/mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAppSettings } from "@/lib/app-settings";
import { GlidrIcon, GlidrLogo } from "@/components/glidr-logo";

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
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "dashboard",
  },
  {
    href: "/tests",
    label: "Tests",
    icon: ListChecks,
    testId: "link-tests",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "tests",
  },
  {
    href: "/testskis",
    label: "Testskis",
    icon: Snowflake,
    testId: "link-testskis",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "testskis",
  },
  {
    href: "/products",
    label: "Products",
    icon: Package,
    testId: "link-products",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "products",
  },
  {
    href: "/weather",
    label: "Weather",
    icon: CloudSun,
    testId: "link-weather",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "weather",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    testId: "link-analytics",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "analytics",
  },
  {
    href: "/grinding",
    label: "Grinding",
    icon: Disc3,
    testId: "link-grinding",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "grinding",
  },
  {
    href: "/raceskis",
    label: "Raceskis",
    icon: Trophy,
    testId: "link-raceskis",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "raceskis",
  },
  {
    href: "/suggestions",
    label: "Suggestions",
    icon: Sparkles,
    testId: "link-suggestions",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "suggestions",
  },
  {
    href: "/live-runsheets",
    label: "Live Runsheets",
    icon: Radio,
    testId: "link-live-runsheets",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "liverunsheets",
  },
  {
    href: "/watch-queue",
    label: "Watch Queue",
    icon: Watch,
    testId: "link-watch-queue",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    featureArea: "garmin_watch",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    testId: "link-admin",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    adminOnly: true,
  },
];

function ReportProblemDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/report-problem", { subject, body }),
    onSuccess: () => {
      toast({ title: t("report.successTitle"), description: t("report.successDesc") });
      setSubject("");
      setBody("");
      onClose();
    },
    onError: (err: any) => {
      toast({ title: t("report.errorTitle"), description: err?.message ?? "Please try again.", variant: "destructive" });
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
          <DialogTitle>{t("report.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rp-subject">{t("report.subject")}</Label>
            <Input
              id="rp-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("report.subjectPlaceholder")}
              maxLength={200}
              required
              data-testid="input-report-subject"
            />
            <span className="text-right text-[11px] text-muted-foreground">{subject.length}/200</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rp-body">{t("report.details")}</Label>
            <Textarea
              id="rp-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("report.detailsPlaceholder")}
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
            {mutation.isPending ? t("report.sending") : t("report.submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Page title derived from current location
function usePageTitle(location: string, visibleNav: NavItem[], t: (k: string) => string): string {
  const navLabelMap: Record<string, string> = {
    "/dashboard": "nav.dashboard",
    "/tests": "nav.tests",
    "/testskis": "nav.testskis",
    "/products": "nav.products",
    "/weather": "nav.weather",
    "/analytics": "nav.analytics",
    "/grinding": "nav.grinding",
    "/raceskis": "nav.raceskis",
    "/suggestions": "nav.suggestions",
    "/live-runsheets": "nav.liveRunsheets",
    "/watch-queue": "nav.watchQueue",
    "/admin": "nav.admin",
    "/overview": "nav.overview",
    "/inbox": "shell.inbox",
    "/my-account": "shell.myAccount",
  };

  // Exact match first
  if (navLabelMap[location]) return t(navLabelMap[location]);

  // Prefix match (e.g. /tests/123)
  for (const item of visibleNav) {
    if (item.href !== "/dashboard" && location.startsWith(item.href)) {
      return t(navLabelMap[item.href] ?? "nav.dashboard");
    }
  }
  return t("nav.dashboard");
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, logout, can, isSuperAdmin, isTeamAdmin, canManage, switchTeam, toggleIncognito, toggleStealth, isViewingOtherTeam, isStealthActive, userTeams, userTeamsLoading } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
  const { theme, toggle: toggleTheme } = useTheme();
  const { t } = useI18n();
  const [reportOpen, setReportOpen] = useState(false);
  const { commercializationEnabled } = useAppSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [adminMode, setAdminMode] = useState<boolean>(() => {
    try { return localStorage.getItem("glidr-sa-admin-mode") === "true"; } catch { return false; }
  });

  // Sync adminMode when localStorage changes (e.g. toggled from admin page)
  useEffect(() => {
    const handler = () => {
      try { setAdminMode(localStorage.getItem("glidr-sa-admin-mode") === "true"); } catch {}
    };
    window.addEventListener("storage", handler);
    window.addEventListener("focus", handler);
    return () => { window.removeEventListener("storage", handler); window.removeEventListener("focus", handler); };
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ["/api/teams"],
    enabled: isSuperAdmin,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/inbox/unread-count"],
    enabled: !!user && (isSuperAdmin || isTeamAdmin),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const activeTeamId = user?.activeTeamId || user?.teamId || 1;
  const activeTeam = isSuperAdmin
    ? teams.find((t: any) => t.id === activeTeamId)
    : userTeams.find((t) => t.id === activeTeamId);

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
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    adminOnly: true,
  };

  const visibleNav = isSuperAdmin && adminMode
    ? [overviewNavItem, ...sortedNav]
    : sortedNav;

  const navLabel = (href: string) => {
    const map: Record<string, string> = {
      "/dashboard": "nav.dashboard",
      "/tests": "nav.tests",
      "/testskis": "nav.testskis",
      "/products": "nav.products",
      "/weather": "nav.weather",
      "/analytics": "nav.analytics",
      "/grinding": "nav.grinding",
      "/raceskis": "nav.raceskis",
      "/suggestions": "nav.suggestions",
      "/live-runsheets": "nav.liveRunsheets",
      "/watch-queue": "nav.watchQueue",
      "/admin": "nav.admin",
      "/overview": "nav.overview",
    };
    return t(map[href] ?? "nav.dashboard");
  };

  const pageTitle = usePageTitle(location, visibleNav, t);

  // User initials for avatar
  const userInitials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  // User role label
  const userRole = isSuperAdmin ? "Super Admin" : isTeamAdmin ? "Team Admin" : "Member";

  // Sidebar nav list (shared between desktop sidebar and mobile drawer)
  const SidebarNav = () => (
    <nav className="flex-1 overflow-y-auto py-2" data-testid="nav-primary">
      {visibleNav.map((item) => {
        const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
        const Icon = item.icon;
        return (
          <AppLink
            key={item.href}
            href={item.href}
            testId={item.testId}
            className={cn(
              "relative flex items-center gap-2 px-3.5 py-[5px] mx-1 rounded-md text-[12.5px] font-[450] transition-colors duration-100",
              active
                ? `${item.activeBg} ${item.activeColor} font-medium`
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {/* Active indicator bar */}
            {active && (
              <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-green-600 rounded-r-sm" />
            )}
            <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? item.activeColor : "opacity-55")} />
            <span className="flex-1 truncate">{navLabel(item.href)}</span>
            {item.href === "/watch-queue" && watchQueueCount > 0 && (
              <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
                {watchQueueCount}
              </span>
            )}
          </AppLink>
        );
      })}
    </nav>
  );

  // Sidebar footer: user info
  const SidebarFooter = () => (
    <div className="border-t border-border mt-auto">
      <AppLink
        href="/my-account"
        testId="link-profile"
        className="flex items-center gap-2 mx-1 my-1.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
      >
        <div className="h-[26px] w-[26px] shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white">
          {userInitials}
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-foreground leading-tight truncate">{user?.name}</div>
          <div className="text-[10px] text-muted-foreground">{userRole}</div>
        </div>
      </AppLink>
    </div>
  );

  // Sidebar content (logo + nav + footer)
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border shrink-0">
        <GlidrIcon size={26} />
        <span className="font-bold text-[14px] tracking-[-0.3px] text-foreground">Glidr</span>
        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0 ml-0.5", isOnline ? "bg-emerald-500" : "bg-amber-500")} />
        {/* Team selector for super admin or multi-team */}
        {isSuperAdmin && teams.length > 1 && (
          <Select value={String(activeTeamId)} onValueChange={(val) => switchTeam(parseInt(val))}>
            <SelectTrigger className="h-6 ml-auto w-auto min-w-0 max-w-[90px] border-border bg-muted/50 text-[10px] font-medium px-2" data-testid="select-team">
              <SelectValue placeholder={t("shell.selectTeam")} />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team: any) => (
                <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!isSuperAdmin && userTeams.length > 1 && (
          <Select value={String(activeTeamId)} onValueChange={(val) => switchTeam(parseInt(val))}>
            <SelectTrigger className="h-6 ml-auto w-auto min-w-0 max-w-[90px] border-border bg-muted/50 text-[10px] font-medium px-2" data-testid="select-user-team">
              <SelectValue placeholder={t("shell.selectTeam")} />
            </SelectTrigger>
            <SelectContent>
              {userTeams.map((team) => (
                <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <SidebarNav />
      <SidebarFooter />
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#f4f4f6] dark:bg-zinc-950">

      {/* ── Desktop Sidebar (lg+) ── */}
      <aside className="hidden lg:flex flex-col w-[220px] shrink-0 h-screen sticky top-0 bg-card dark:bg-zinc-900 border-r border-border overflow-hidden">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Drawer (< lg) ── */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[220px] flex flex-col bg-card dark:bg-zinc-900 border-r border-border shadow-xl overflow-hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Top header (48px) ── */}
        <header
          className="h-12 shrink-0 flex items-center gap-2 px-4 bg-card dark:bg-zinc-900 border-b border-border"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          {/* Left: hamburger (mobile) + page title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden -ml-1 text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 p-0"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-sidebar-open"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground truncate">{pageTitle}</span>
          </div>

          {/* Right: status indicators + action buttons */}
          <div className="flex items-center gap-0.5 shrink-0">
            {!isOnline && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-700"
                data-testid="badge-offline"
              >
                <WifiOff className="h-3 w-3" />
                <span className="hidden sm:inline">{t("shell.offline")}</span>
              </span>
            )}
            {pendingCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-sync"
                onClick={() => syncNow()}
                disabled={isSyncing || !isOnline}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 h-8"
              >
                {isSyncing ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-1 h-4 w-4" />}
                <span className="hidden sm:inline text-xs">{`${pendingCount} ${t("shell.pending")}`}</span>
                <span className="sm:hidden text-xs">{pendingCount}</span>
              </Button>
            )}
            {isSuperAdmin && isViewingOtherTeam && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-stealth-toggle"
                onClick={() => toggleStealth(!user?.stealth)}
                className={cn(
                  "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted",
                  isStealthActive && "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400"
                )}
                title={isStealthActive ? t("shell.stealthOn") : t("shell.stealth")}
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
                  "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted",
                  user?.incognito && "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400"
                )}
                title={user?.incognito ? t("shell.incognitoOn") : t("shell.incognito")}
              >
                {user?.incognito ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-1 shrink-0" />

            {(isSuperAdmin || isTeamAdmin) && (
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-mail"
                onClick={() => navigate("/inbox")}
                className="relative h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                title={t("shell.inbox")}
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
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReportOpen(true)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
              title={t("shell.reportProblem")}
              data-testid="link-report-problem"
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-1 shrink-0" />

            <AppLink
              href="/my-account"
              testId="link-my-account"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={t("shell.myAccount")}
            >
              <UserCircle className="h-4 w-4" />
            </AppLink>
            <Button
              variant="ghost"
              size="sm"
              data-testid="button-logout"
              onClick={() => logout()}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Offline banner */}
        {!isOnline && (
          <div className="shrink-0 bg-amber-500 text-white text-xs font-medium text-center py-1.5 px-4">
            You're offline — showing cached data. Changes will not be saved.
          </div>
        )}

        {/* ── Scrollable content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>

          {/* Footer */}
          <footer className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 pb-8">
            <div className="mb-3 h-px bg-border" />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <GlidrLogo variant="dark" size={18} className="dark:hidden opacity-60" />
              <GlidrLogo variant="white" size={18} className="hidden dark:block opacity-60" />
              <div className="flex items-center gap-3">
                <AppLink href="/my-account" testId="link-footer-my-account" className="underline hover:text-foreground transition-colors">
                  {t("shell.myAccount")}
                </AppLink>
                {commercializationEnabled && (
                  <>
                    <span className="text-border">|</span>
                    <AppLink href="/what-is-glidr" testId="link-what-is-glidr" className="underline hover:text-foreground transition-colors">
                      {t("shell.whatIsGlidr")}
                    </AppLink>
                    <span className="text-border">|</span>
                    <AppLink href="/pricing" testId="link-pricing" className="underline hover:text-foreground transition-colors">
                      {t("shell.pricing")}
                    </AppLink>
                  </>
                )}
                <span className="text-border">|</span>
                <AppLink href="/legal" testId="link-legal" className="underline hover:text-foreground transition-colors">
                  {t("shell.legal")}
                </AppLink>
                <span className="text-border">|</span>
                <AppLink href="/contact" testId="link-contact" className="underline hover:text-foreground transition-colors">
                  {t("shell.contact")}
                </AppLink>
              </div>
            </div>
          </footer>
        </main>

        {/* Mobile bottom nav (when enabled) */}
        {mobileNavEnabled && (
          <div className="sm:hidden">
            <MobileNav watchQueueCount={watchQueueCount} />
          </div>
        )}
      </div>

      <ReportProblemDialog open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}
