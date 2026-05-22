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
  ChevronLeft,
  ChevronRight,
  Search,
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
import { getNavLayout, setNavLayout, type NavLayout } from "@/lib/nav-layout";

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
  section?: string; // i18n key for sidebar section heading
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
  // ── Data ──────────────────────────────────────────
  {
    href: "/tests",
    label: "Tests",
    icon: ListChecks,
    testId: "link-tests",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "tests",
    section: "nav.sectionData",
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
    href: "/weather",
    label: "Weather",
    icon: CloudSun,
    testId: "link-weather",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "weather",
  },
  // ── Equipment ─────────────────────────────────────
  {
    href: "/testskis",
    label: "Testskis",
    icon: Snowflake,
    testId: "link-testskis",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "testskis",
    section: "nav.sectionEquipment",
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
  // ── System ────────────────────────────────────────
  {
    href: "/live-runsheets",
    label: "Live Runsheets",
    icon: Radio,
    testId: "link-live-runsheets",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "liverunsheets",
    section: "nav.sectionSystem",
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

type Crumb = { label: string; href?: string };

const TOP_LABEL_MAP: Record<string, string> = {
  dashboard:        "nav.dashboard",
  tests:            "nav.tests",
  testskis:         "nav.testskis",
  products:         "nav.products",
  weather:          "nav.weather",
  analytics:        "nav.analytics",
  grinding:         "nav.grinding",
  raceskis:         "nav.raceskis",
  suggestions:      "nav.suggestions",
  "live-runsheets": "nav.liveRunsheets",
  "watch-queue":    "nav.watchQueue",
  admin:            "nav.admin",
  overview:         "nav.overview",
  inbox:            "shell.inbox",
  "my-account":     "shell.myAccount",
};

function buildBreadcrumbs(location: string, t: (k: string) => string): Crumb[] {
  const segments = location.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: t("nav.dashboard") }];

  const firstKey = segments[0];
  const firstLabel = TOP_LABEL_MAP[firstKey] ? t(TOP_LABEL_MAP[firstKey]) : firstKey;

  if (segments.length === 1) return [{ label: firstLabel }];

  // Nested route — first segment becomes a link
  const crumbs: Crumb[] = [{ label: firstLabel, href: `/${firstKey}` }];
  const rest = segments.slice(1);

  rest.forEach((seg, i) => {
    const isLast = i === rest.length - 1;
    const isNumeric = /^\d+$/.test(seg);
    const label = isNumeric ? `#${seg}` : seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const href = isLast ? undefined : `/${[firstKey, ...rest.slice(0, i + 1)].join("/")}`;
    crumbs.push({ label, href });
  });

  return crumbs;
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("glidr-sidebar-collapsed") === "true"; } catch { return false; }
  });
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("glidr-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  };
  const [navLayout, setNavLayoutState] = useState<NavLayout>(() => getNavLayout());

  // Expose toggle so my-account can call it
  useEffect(() => {
    const handler = () => setNavLayoutState(getNavLayout());
    window.addEventListener("glidr-nav-layout-change", handler);
    return () => window.removeEventListener("glidr-nav-layout-change", handler);
  }, []);

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

  // Sidebar nav list
  const SidebarNav = () => {
    let lastSection: string | undefined = undefined;
    return (
      <nav className="flex-1 overflow-y-auto py-2" data-testid="nav-primary">
        {visibleNav.map((item) => {
          const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
          const Icon = item.icon;
          const showSection = !sidebarCollapsed && item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          return (
            <div key={item.href}>
              {showSection && (
                <div className="px-3.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground/60 select-none">
                  {t(item.section!)}
                </div>
              )}
              <AppLink
                href={item.href}
                testId={item.testId}
                title={sidebarCollapsed ? navLabel(item.href) : undefined}
                className={cn(
                  "relative flex items-center gap-2 mx-1 rounded-md text-[12.5px] font-[450] transition-colors duration-100",
                  sidebarCollapsed ? "justify-center px-0 py-[7px]" : "px-3.5 py-[5px]",
                  active
                    ? `${item.activeBg} ${item.activeColor} font-medium`
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active && !sidebarCollapsed && (
                  <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-green-600 rounded-r-sm" />
                )}
                <Icon className={cn("shrink-0", sidebarCollapsed ? "h-[15px] w-[15px]" : "h-3.5 w-3.5", active ? item.activeColor : "opacity-55")} />
                {!sidebarCollapsed && <span className="flex-1 truncate">{navLabel(item.href)}</span>}
                {!sidebarCollapsed && item.href === "/watch-queue" && watchQueueCount > 0 && (
                  <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
                    {watchQueueCount}
                  </span>
                )}
                {sidebarCollapsed && item.href === "/watch-queue" && watchQueueCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white leading-none px-0.5">
                    {watchQueueCount}
                  </span>
                )}
              </AppLink>
            </div>
          );
        })}
      </nav>
    );
  };

  // Sidebar footer: user info + team name
  const SidebarFooter = () => (
    <div className="border-t border-border mt-auto">
      <AppLink
        href="/my-account"
        testId="link-profile"
        title={sidebarCollapsed ? user?.name : undefined}
        className={cn(
          "flex items-center gap-2 mx-1 my-1.5 rounded-md hover:bg-muted transition-colors",
          sidebarCollapsed ? "justify-center px-1 py-2" : "px-2 py-1.5",
        )}
      >
        <div className="h-[26px] w-[26px] shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white">
          {userInitials}
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-foreground leading-tight truncate">{user?.name}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">{userRole}</div>
            {activeTeam?.name && (
              <div className="text-[10px] text-muted-foreground/60 leading-tight truncate">{activeTeam.name}</div>
            )}
          </div>
        )}
      </AppLink>
    </div>
  );

  // Sidebar content (logo + nav + footer)
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className={cn(
        "flex items-center gap-2 border-b border-border shrink-0",
        sidebarCollapsed ? "px-2 py-3 justify-center" : "px-3.5 py-3",
      )}>
        {sidebarCollapsed ? (
          <button
            onClick={toggleSidebarCollapsed}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <>
            <GlidrIcon size={26} />
            <span className="font-bold text-[14px] tracking-[-0.3px] text-foreground">Glidr</span>
            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0 ml-0.5", isOnline ? "bg-emerald-500" : "bg-amber-500")} />
            {isSuperAdmin && teams.length > 1 && (
              <Select value={String(activeTeamId)} onValueChange={(val) => switchTeam(parseInt(val))}>
                <SelectTrigger className="h-6 ml-auto w-auto min-w-0 max-w-[80px] border-border bg-muted/50 text-[10px] font-medium px-2" data-testid="select-team">
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
                <SelectTrigger className="h-6 ml-auto w-auto min-w-0 max-w-[80px] border-border bg-muted/50 text-[10px] font-medium px-2" data-testid="select-user-team">
                  <SelectValue placeholder={t("shell.selectTeam")} />
                </SelectTrigger>
                <SelectContent>
                  {userTeams.map((team) => (
                    <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <button
              onClick={toggleSidebarCollapsed}
              className="ml-auto h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Search button */}
      {!sidebarCollapsed ? (
        <button
          onClick={() => window.dispatchEvent(new Event("glidr-open-search"))}
          className="flex items-center gap-2 mx-2 my-1.5 px-2.5 py-[7px] rounded-md border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-[12px] transition-colors shrink-0"
          data-testid="button-sidebar-search"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">{t("shell.search")}</span>
          <kbd className="rounded bg-background px-1 py-0.5 text-[9px] font-mono border border-border leading-none">⌘K</kbd>
        </button>
      ) : (
        <button
          onClick={() => window.dispatchEvent(new Event("glidr-open-search"))}
          className="flex items-center justify-center w-8 h-8 mx-auto my-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={t("shell.search")}
          data-testid="button-sidebar-search"
        >
          <Search className="h-[15px] w-[15px]" />
        </button>
      )}

      <SidebarNav />
      <SidebarFooter />
    </div>
  );

  // ── Shared header controls (right side) ──
  const HeaderControls = () => (
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
        <Button variant="ghost" size="sm" data-testid="button-sync"
          onClick={() => syncNow()} disabled={isSyncing || !isOnline}
          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 h-8"
        >
          {isSyncing ? <RefreshCw className="mr-1 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-1 h-4 w-4" />}
          <span className="hidden sm:inline text-xs">{`${pendingCount} ${t("shell.pending")}`}</span>
          <span className="sm:hidden text-xs">{pendingCount}</span>
        </Button>
      )}
      {isSuperAdmin && isViewingOtherTeam && (
        <Button variant="ghost" size="sm" data-testid="button-stealth-toggle"
          onClick={() => toggleStealth(!user?.stealth)}
          className={cn("h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted",
            isStealthActive && "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400")}
          title={isStealthActive ? t("shell.stealthOn") : t("shell.stealth")}
        >
          {isStealthActive ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </Button>
      )}
      {isSuperAdmin && (
        <Button variant="ghost" size="sm" data-testid="button-incognito-toggle"
          onClick={() => toggleIncognito(!user?.incognito)}
          className={cn("h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted",
            user?.incognito && "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400")}
          title={user?.incognito ? t("shell.incognitoOn") : t("shell.incognito")}
        >
          {user?.incognito ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      )}
      <div className="w-px h-5 bg-border mx-1 shrink-0" />
      {(isSuperAdmin || isTeamAdmin) && (
        <Button variant="ghost" size="sm" data-testid="button-mail"
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
      <Button variant="ghost" size="sm" data-testid="button-theme-toggle"
        onClick={toggleTheme}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="sm"
        onClick={() => setReportOpen(true)}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
        title={t("shell.reportProblem")} data-testid="link-report-problem"
      >
        <AlertTriangle className="h-4 w-4" />
      </Button>
      <div className="w-px h-5 bg-border mx-1 shrink-0" />
      <AppLink href="/my-account" testId="link-my-account"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title={t("shell.myAccount")}
      >
        <UserCircle className="h-4 w-4" />
      </AppLink>
      <Button variant="ghost" size="sm" data-testid="button-logout"
        onClick={() => logout()}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );

  // ── Shared page body (offline banner + children + footer) ──
  const PageBody = () => (
    <>
      {!isOnline && (
        <div className="shrink-0 bg-amber-500 text-white text-xs font-medium text-center py-1.5 px-4">
          You're offline — showing cached data. Changes will not be saved.
        </div>
      )}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
        <footer className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 pb-8 mt-auto">
          <div className="mb-3 h-px bg-border" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <GlidrLogo variant="dark" size={18} className="dark:hidden opacity-60" />
            <GlidrLogo variant="white" size={18} className="hidden dark:block opacity-60" />
            <div className="flex items-center gap-3">
              <AppLink href="/my-account" testId="link-footer-my-account" className="underline hover:text-foreground transition-colors">{t("shell.myAccount")}</AppLink>
              {commercializationEnabled && (<>
                <span className="text-border">|</span>
                <AppLink href="/what-is-glidr" testId="link-what-is-glidr" className="underline hover:text-foreground transition-colors">{t("shell.whatIsGlidr")}</AppLink>
                <span className="text-border">|</span>
                <AppLink href="/pricing" testId="link-pricing" className="underline hover:text-foreground transition-colors">{t("shell.pricing")}</AppLink>
              </>)}
              <span className="text-border">|</span>
              <AppLink href="/legal" testId="link-legal" className="underline hover:text-foreground transition-colors">{t("shell.legal")}</AppLink>
              <span className="text-border">|</span>
              <AppLink href="/contact" testId="link-contact" className="underline hover:text-foreground transition-colors">{t("shell.contact")}</AppLink>
            </div>
          </div>
        </footer>
      </main>
      {mobileNavEnabled && <div className="sm:hidden"><MobileNav watchQueueCount={watchQueueCount} /></div>}
    </>
  );

  // ══════════════════════════════════════════════════
  // TOP layout (classic top navigation bar)
  // ══════════════════════════════════════════════════
  if (navLayout === "top") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-lg overflow-x-hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-3 py-2.5 min-w-0">
              {/* Logo + team */}
              <div className="flex items-center gap-2 shrink-0">
                <GlidrLogo variant="dark" size={26} className="hidden sm:block dark:hidden" />
                <GlidrLogo variant="white" size={26} className="hidden dark:sm:block" />
                <GlidrIcon size={24} className="sm:hidden" />
                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", isOnline ? "bg-emerald-500" : "bg-amber-500")} />
                {isSuperAdmin && teams.length > 1 && (
                  <Select value={String(activeTeamId)} onValueChange={(val) => switchTeam(parseInt(val))}>
                    <SelectTrigger className="h-8 w-auto min-w-[140px] border-border bg-muted/50 text-xs font-medium" data-testid="select-team">
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
                    <SelectTrigger className="h-8 w-auto min-w-[140px] border-border bg-muted/50 text-xs font-medium" data-testid="select-user-team">
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
              {/* Nav — xl+ only */}
              <nav className={cn("hidden xl:flex flex-1 items-center justify-center gap-0.5", mobileNavEnabled && "!hidden")} data-testid="nav-primary">
                {visibleNav.map((item) => {
                  const active = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <AppLink key={item.href} href={item.href} testId={item.testId}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150",
                        active ? `${item.activeBg} ${item.activeColor} shadow-sm dark:bg-opacity-20` : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active ? item.activeColor : item.color)} />
                      <span>{navLabel(item.href)}</span>
                      {item.href === "/watch-queue" && watchQueueCount > 0 && (
                        <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">{watchQueueCount}</span>
                      )}
                    </AppLink>
                  );
                })}
              </nav>
              <div className="flex-1 xl:hidden" />
              <HeaderControls />
            </div>
          </div>
        </header>
        <div className="flex flex-col flex-1 overflow-hidden">
          <PageBody />
        </div>
        <ReportProblemDialog open={reportOpen} onClose={() => setReportOpen(false)} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // SIDEBAR layout (new design)
  // ══════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex bg-[#f4f4f6] dark:bg-zinc-950">

      {/* ── Desktop Sidebar (lg+) ── */}
      <aside className={cn(
        "hidden lg:flex flex-col shrink-0 h-screen sticky top-0 bg-card dark:bg-zinc-900 border-r border-border overflow-hidden transition-[width] duration-200",
        sidebarCollapsed ? "w-[52px]" : "w-[220px]",
      )}>
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Drawer (< lg) ── */}
      {sidebarOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setSidebarOpen(false)} />
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
              variant="ghost" size="sm"
              className="lg:hidden -ml-1 text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 p-0"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-sidebar-open"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground truncate">{pageTitle}</span>
          </div>

          <HeaderControls />
        </header>

        <PageBody />
      </div>

      <CommandSearch />
      <ReportProblemDialog open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}
