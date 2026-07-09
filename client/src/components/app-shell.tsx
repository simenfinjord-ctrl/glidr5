// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ListChecks,
  Layers,
  Boxes,
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
  Footprints,
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
  MessageSquare,
  Users,
  Smartphone,
  PanelLeft,
  PanelTop,
  X,
  Bell,
  Trash2,
  ChevronDown,
  Flag,
  CheckCheck,
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
import { useGlobalShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { MobileNav, useMobileNav } from "@/components/mobile-nav";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAppSettings } from "@/lib/app-settings";
import { GlidrIcon, GlidrLogo } from "@/components/glidr-logo";
import { getNavLayout, setNavLayout, type NavLayout } from "@/lib/nav-layout";
import { getAccentColor, onAccentChange, type AccentColor, ACCENT_NAV } from "@/lib/accent-color";
import { WhatsNewModal, WhatsNewDot } from "@/components/whats-new-modal";

const PRESET_AVATARS = [
  "https://api.dicebear.com/7.x/adventurer/svg?seed=alpine",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=nordic",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=glacier",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=summit",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=telemark",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=slalom",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=freeride",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=mogul",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=downhill",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=biathlon",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=powder",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=couloir",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=traverse",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=carving",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=skijump",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=snowplow",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=schuss",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=herringbone",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=kickturn",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=langlauf",
];

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
  multiTeamOnly?: boolean; // only shown when the user belongs to more than one team
  section?: string; // i18n key for sidebar section heading
  tourTarget?: string; // data-tour attribute for guided tour
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
    tourTarget: "nav-tests",
  },
  {
    href: "/all-teams-tests",
    label: "All teams",
    icon: Layers,
    testId: "link-all-teams-tests",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "tests",
    multiTeamOnly: true,
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
    tourTarget: "nav-analytics",
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
    tourTarget: "nav-weather",
  },
  // ── Equipment ─────────────────────────────────────
  {
    href: "/testskis",
    label: "Testfleets",
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
    tourTarget: "nav-products",
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
    href: "/race-fleet",
    label: "Race fleets",
    icon: Boxes,
    testId: "link-race-fleet",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "raceskis",
    featureArea: "para_team",
  },
  {
    href: "/kick",
    label: "Kick",
    icon: Footprints,
    testId: "link-kick",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "kick",
  },
  {
    href: "/raceprep",
    label: "Raceprep",
    icon: Flag,
    testId: "link-raceprep",
    color: "text-muted-foreground",
    activeColor: "text-green-700",
    activeBg: "bg-green-50 dark:bg-green-900/20",
    permArea: "raceprep",
    tourTarget: "nav-racepreps",
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
    "/kick": "nav.kick",
    "/raceprep": "nav.raceprep",
    "/suggestions": "nav.suggestions",
    "/live-runsheets": "nav.liveRunsheets",
    "/watch-queue": "nav.watchQueue",
    "/admin": "nav.admin",
    "/overview": "nav.overview",
    "/inbox": "shell.inbox",
    "/my-account": "shell.myAccount",
    "/my-team": "team.title",
    "/all-teams-tests": "nav.allTeamsTests",
    "/race-fleet": "nav.raceFleet",
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
  kick:             "nav.kick",
  raceprep:         "nav.raceprep",
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

// ── Mobile-mode prompt ──────────────────────────────────────────────────────────
const MOBILE_PROMPT_KEY = "glidr-mobile-prompt-seen";
const DESKTOP_ONBOARDING_KEY = "glidr-desktop-onboarding-seen";

function MobileModePrompt({ onActivate, onDismiss }: { onActivate: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-0">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onDismiss} />

      {/* Sheet / card */}
      <div className="relative w-full sm:max-w-sm bg-card rounded-2xl shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-400" />

        <div className="px-6 pt-6 pb-7 space-y-4">
          {/* Icon + heading */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-base font-semibold text-foreground leading-snug">
              Mobile device detected
            </h2>
          </div>

          {/* Body */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            We noticed you're using a mobile device. Enable{" "}
            <span className="font-medium text-foreground">Mobile Mode</span> for a touch-friendly
            bottom navigation bar — optimised for smaller screens.
          </p>
          <p className="text-xs text-muted-foreground/70">
            You can always change this later in{" "}
            <span className="font-medium text-foreground">My Account → Preferences</span>.
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onDismiss}
              className="flex-1 rounded-xl border border-border py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Later
            </button>
            <button
              onClick={onActivate}
              className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white py-2 text-sm font-semibold transition-colors"
            >
              Enable now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopOnboardingPrompt({ onKeepSidebar, onSwitchTop }: { onKeepSidebar: () => void; onSwitchTop: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Card */}
      <div className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-sky-500 to-indigo-500" />

        <div className="px-6 pt-6 pb-7 space-y-5">
          {/* Heading */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
              <PanelLeft className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground leading-snug">Choose your navigation style</h2>
              <p className="text-xs text-muted-foreground mt-0.5">You can always change this in My Account → Preferences</p>
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            {/* Sidebar option */}
            <button
              onClick={onKeepSidebar}
              className="group flex flex-col items-center gap-2 rounded-xl border-2 border-sky-500 bg-sky-50 dark:bg-sky-900/20 p-4 transition-colors hover:bg-sky-100 dark:hover:bg-sky-900/40"
            >
              <div className="flex h-14 w-full rounded-lg overflow-hidden border border-border bg-background shadow-sm">
                <div className="w-5 bg-sky-500/20 flex flex-col gap-1 p-1 shrink-0">
                  <div className="h-1.5 rounded bg-sky-400" />
                  <div className="h-1.5 rounded bg-sky-300/60" />
                  <div className="h-1.5 rounded bg-sky-300/60" />
                </div>
                <div className="flex-1 p-1.5">
                  <div className="h-1.5 rounded bg-muted-foreground/20 mb-1 w-3/4" />
                  <div className="h-1.5 rounded bg-muted-foreground/10 w-1/2" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1 justify-center">
                  <PanelLeft className="h-3 w-3" /> Sidebar
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Default — recommended</p>
              </div>
            </button>

            {/* Top nav option */}
            <button
              onClick={onSwitchTop}
              className="group flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-muted/30 p-4 transition-colors hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            >
              <div className="flex flex-col h-14 w-full rounded-lg overflow-hidden border border-border bg-background shadow-sm">
                <div className="h-4 bg-indigo-500/20 flex items-center gap-1 px-1.5 shrink-0">
                  <div className="h-1.5 w-4 rounded bg-indigo-400" />
                  <div className="h-1.5 w-3 rounded bg-indigo-300/60" />
                  <div className="h-1.5 w-3 rounded bg-indigo-300/60" />
                </div>
                <div className="flex-1 p-1.5">
                  <div className="h-1.5 rounded bg-muted-foreground/20 mb-1 w-3/4" />
                  <div className="h-1.5 rounded bg-muted-foreground/10 w-1/2" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 justify-center">
                  <PanelTop className="h-3 w-3" /> Top nav
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Classic layout</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children, activeNav }: { children: ReactNode; activeNav?: string }) {
  const [location, navigate] = useLocation();
  const { user, logout, can, isSuperAdmin, isTeamAdmin, canManage, switchTeam, toggleIncognito, toggleStealth, isViewingOtherTeam, isStealthActive, userTeams, userTeamsLoading } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
  const { theme, toggle: toggleTheme } = useTheme();
  const { t } = useI18n();
  useGlobalShortcuts();
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

  // Resizable sidebar width (desktop only)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try { return Math.max(180, Math.min(360, parseInt(localStorage.getItem("glidr-sidebar-width") || "220"))) || 220; } catch { return 220; }
  });
  const sidebarWidthRef = useRef(sidebarWidth);
  useEffect(() => { sidebarWidthRef.current = sidebarWidth; }, [sidebarWidth]);

  const startSidebarDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidthRef.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(180, Math.min(360, startW + ev.clientX - startX));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      try { localStorage.setItem("glidr-sidebar-width", String(sidebarWidthRef.current)); } catch {}
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // Text scale: grows linearly as sidebar widens; clamped to [1, 1.35]
  const sidebarScale = sidebarCollapsed ? 1 : Math.min(1.35, Math.max(1, sidebarWidth / 220));
  const [navLayout, setNavLayoutState] = useState<NavLayout>(() => getNavLayout());
  const [navAccent, setNavAccent] = useState<AccentColor>(() => getAccentColor());
  useEffect(() => onAccentChange(setNavAccent), []);

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

  // Fetch current team data (for all users, to get teamLogo etc.)
  const { data: myTeamList = [] } = useQuery<any[]>({
    queryKey: ["/api/my-team-info"],
    queryFn: async () => {
      const res = await fetch("/api/teams", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && !isSuperAdmin,
    staleTime: 60_000,
  });
  const teamLogo: string | null = (() => {
    const tid = user?.activeTeamId || user?.teamId;
    const list = isSuperAdmin ? teams : myTeamList;
    return (list.find((t: any) => t.id === tid)?.teamLogo as string | undefined) ?? null;
  })();

  const { data: feedbackButton } = useQuery<{ enabled: boolean; url: string | null }>({
    queryKey: ["/api/feedback-button"],
    enabled: !!user,
    staleTime: 120_000,
  });
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/inbox/unread-count"],
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const unreadCount = unreadData?.count ?? 0;

  // ── What's New modal ──
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  // ── Inbox drawer ──
  const [inboxOpen, setInboxOpen] = useState(false);
  const [expandedMsgId, setExpandedMsgId] = useState<number | null>(null);
  const { data: inboxMessages = [], refetch: refetchInbox } = useQuery<any[]>({
    queryKey: ["/api/inbox"],
    enabled: !!user && inboxOpen,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!inboxOpen) return;
    const timer = setTimeout(async () => {
      const hasUnread = inboxMessages.some((m: any) => !m.isRead);
      if (hasUnread) {
        try {
          await apiRequest("PUT", "/api/inbox/read-all", {});
          refetchInbox();
          queryClient.invalidateQueries({ queryKey: ["/api/inbox/unread-count"] });
        } catch {}
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [inboxOpen, inboxMessages]);

  async function deleteInboxMessage(id: number) {
    try {
      await apiRequest("DELETE", `/api/inbox/${id}`, undefined);
      refetchInbox();
    } catch {}
  }

  const activeTeamId = user?.activeTeamId || user?.teamId || 1;
  const activeTeam = isSuperAdmin
    ? teams.find((t: any) => t.id === activeTeamId)
    : userTeams.find((t) => t.id === activeTeamId);

  const isViewingOwnTeam = !isSuperAdmin || userTeamsLoading || userTeams.some((t) => t.id === activeTeamId);

  const hasGarminWatch = can("garmin_watch");
  const mobileNavStore = useMobileNav();
  const [mobileNavEnabled, setMobileNavEnabled] = useState(false);
  useEffect(() => { setMobileNavEnabled(mobileNavStore.get()); }, []);

  // ── First-time mobile mode prompt ──
  // Obsolete: the bottom nav is now always available on small screens, so we no
  // longer prompt users to "enable mobile mode". Kept as a no-op for the dialog.
  const [showMobilePrompt, setShowMobilePrompt] = useState(false);

  function handleMobilePromptActivate() {
    mobileNavStore.set(true);
    setMobileNavEnabled(true);
    try { localStorage.setItem(MOBILE_PROMPT_KEY, "1"); } catch {}
    setShowMobilePrompt(false);
    window.dispatchEvent(new Event("glidr-nav-layout-change"));
  }

  function handleMobilePromptDismiss() {
    try { localStorage.setItem(MOBILE_PROMPT_KEY, "1"); } catch {}
    setShowMobilePrompt(false);
  }

  // ── First-time desktop layout onboarding ──
  const [showDesktopOnboarding, setShowDesktopOnboarding] = useState(false);
  useEffect(() => {
    if (!user) return;
    try {
      const alreadySeen = localStorage.getItem(DESKTOP_ONBOARDING_KEY);
      if (alreadySeen) return;
      const isMobile = window.innerWidth < 1024 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (!isMobile) setShowDesktopOnboarding(true);
    } catch {}
  }, [user]);

  function handleKeepSidebar() {
    setNavLayout("sidebar");
    setNavLayoutState("sidebar");
    try { localStorage.setItem(DESKTOP_ONBOARDING_KEY, "1"); } catch {}
    setShowDesktopOnboarding(false);
  }

  function handleSwitchToTop() {
    setNavLayout("top");
    setNavLayoutState("top");
    try { localStorage.setItem(DESKTOP_ONBOARDING_KEY, "1"); } catch {}
    setShowDesktopOnboarding(false);
    window.dispatchEvent(new Event("glidr-nav-layout-change"));
  }

  const { data: watchQueue = [] } = useQuery<{ id: number; status: string }[]>({
    queryKey: ["/api/watch/queue"],
    enabled: !!user && hasGarminWatch,
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const watchQueueCount = watchQueue.filter((q) => q.status === "active").length;

  const filteredNav = nav.filter((item) => {
    // "All teams" needs the TA-granted permission AND >1 team; a Super Admin
    // always sees it (they can access every team inherently).
    if (item.multiTeamOnly && !(isSuperAdmin || (user?.canViewAllTeams && userTeams.length > 1))) return false;
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
      "/all-teams-tests": "nav.allTeamsTests",
      "/race-fleet": "nav.raceFleet",
      "/testskis": "nav.testskis",
      "/products": "nav.products",
      "/weather": "nav.weather",
      "/analytics": "nav.analytics",
      "/grinding": "nav.grinding",
      "/raceskis": "nav.raceskis",
      "/kick": "nav.kick",
      "/raceprep": "nav.raceprep",
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
          const active = activeNav ? item.href === activeNav : (location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href + "/")));
          const Icon = item.icon;
          const showSection = !sidebarCollapsed && item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          return (
            <div key={item.href}>
              {showSection && (
                <div
                  className="px-3.5 pt-4 pb-1 font-semibold uppercase tracking-[0.07em] text-muted-foreground/60 select-none"
                  style={{ fontSize: `${10 * sidebarScale}px` }}
                >
                  {t(item.section!)}
                </div>
              )}
              <AppLink
                href={item.href}
                testId={item.testId}
                dataTour={item.tourTarget}
                title={sidebarCollapsed ? navLabel(item.href) : undefined}
                className={cn(
                  "relative flex items-center gap-2 mx-1 rounded-md font-[450] transition-colors duration-100",
                  sidebarCollapsed ? "justify-center px-0 py-[7px]" : "px-3.5 py-[5px]",
                  active
                    ? `${ACCENT_NAV[navAccent].activeBg} ${ACCENT_NAV[navAccent].activeColor} font-medium`
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                style={{ fontSize: `${12.5 * sidebarScale}px` }}
              >
                {active && !sidebarCollapsed && (
                  <span className="absolute left-0 top-1 bottom-1 w-[2.5px] rounded-r-sm" style={{ backgroundColor: `hsl(var(--primary))` }} />
                )}
                <Icon className={cn("shrink-0", sidebarCollapsed ? "h-[15px] w-[15px]" : "h-3.5 w-3.5", active ? ACCENT_NAV[navAccent].activeColor : "opacity-55")} />
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
      {/* Feedback button (#44) — opens the team's configured Google sheet */}
      {feedbackButton?.enabled && feedbackButton.url && !sidebarCollapsed && (
        <a
          href={feedbackButton.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 mx-2 mt-2 -mb-0.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800 hover:bg-emerald-100 transition-colors shrink-0 w-[calc(100%-16px)]"
          style={{ fontSize: `${12 * sidebarScale}px` }}
          data-testid="button-sidebar-feedback"
        >
          <MessageSquare className="h-3 w-3 shrink-0 opacity-70" />
          <span className="flex-1 text-left font-medium">Feedback</span>
        </a>
      )}
      {/* Search button */}
      {!sidebarCollapsed ? (
        <button
          onClick={() => window.dispatchEvent(new Event("glidr-open-search"))}
          className="flex items-center gap-1.5 mx-2 mt-2 mb-1 px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 w-[calc(100%-16px)]"
          style={{ fontSize: `${12 * sidebarScale}px` }}
          data-testid="button-sidebar-search"
        >
          <Search className="h-3 w-3 shrink-0 opacity-60" />
          <span className="flex-1 text-left">Search</span>
          <span className="opacity-50 font-mono" style={{ fontSize: `${10 * sidebarScale}px` }}>Ctrl+K</span>
        </button>
      ) : (
        <button
          onClick={() => window.dispatchEvent(new Event("glidr-open-search"))}
          className="flex items-center justify-center w-8 h-8 mx-auto mt-2 mb-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={t("shell.search")}
          data-testid="button-sidebar-search"
        >
          <Search className="h-[15px] w-[15px]" />
        </button>
      )}
      <AppLink
        href="/my-account"
        testId="link-profile"
        title={sidebarCollapsed ? user?.name : undefined}
        className={cn(
          "flex items-center gap-2 mx-1 my-1.5 rounded-md hover:bg-muted transition-colors",
          sidebarCollapsed ? "justify-center px-1 py-2" : "px-2 py-1.5",
        )}
      >
        <div className="h-[26px] w-[26px] shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white">
          {(user as any)?.avatarUrl ? (
            <img src={(user as any).avatarUrl} alt={user?.name} className="h-full w-full object-cover" />
          ) : (
            userInitials
          )}
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <div className="font-semibold text-foreground leading-tight truncate" style={{ fontSize: `${12 * sidebarScale}px` }}>{user?.name}</div>
            <div className="text-muted-foreground leading-tight" style={{ fontSize: `${10 * sidebarScale}px` }}>{userRole}</div>
            {activeTeam?.name && (
              <div className="text-muted-foreground/60 leading-tight truncate" style={{ fontSize: `${10 * sidebarScale}px` }}>{activeTeam.name}</div>
            )}
          </div>
        )}
      </AppLink>
      {!sidebarCollapsed && (
        <AppLink
          href="/my-team"
          className="flex items-center gap-2 mx-1 mb-1 px-2 py-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          style={{ fontSize: `${11 * sidebarScale}px` }}
        >
          <Users className="h-3 w-3 shrink-0" />
          My Team
        </AppLink>
      )}
    </div>
  );

  // Sidebar content (logo + nav + footer)
  const SidebarContent = ({ isMobileDrawer = false }: { isMobileDrawer?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo area — exactly h-12 to align with the top header border */}
      <div className={cn(
        "flex items-center gap-2 border-b border-border shrink-0 h-12",
        sidebarCollapsed && !isMobileDrawer ? "px-2 justify-center" : "px-3.5",
      )}>
        {sidebarCollapsed && !isMobileDrawer ? (
          <button
            onClick={toggleSidebarCollapsed}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <>
            {teamLogo ? (
              <img src={teamLogo} alt="Team logo" className="h-7 w-7 object-contain rounded" />
            ) : (
              <GlidrIcon size={26} />
            )}
            <span
              className="font-bold tracking-[-0.3px] text-foreground"
              style={{ fontSize: `${14 * sidebarScale}px` }}
            >
              Glidr
            </span>
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
            {/* On mobile drawer: X to close; on desktop: collapse chevron */}
            {isMobileDrawer ? (
              <button
                onClick={() => setSidebarOpen(false)}
                className="ml-auto h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Close sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={toggleSidebarCollapsed}
                className="ml-auto h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>

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
      <Button variant="ghost" size="sm"
        onClick={() => setWhatsNewOpen(true)}
        className="relative h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
        title="Hva er nytt?"
        data-tour="whats-new"
      >
        <Sparkles className="h-4 w-4" />
        <WhatsNewDot />
      </Button>
      {!!user && (
        <Button variant="ghost" size="sm" data-testid="button-mail"
          onClick={() => setInboxOpen(true)}
          className="relative h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          title={t("shell.inbox")}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      )}
      <WhatsNewModal open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
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
  // NOTE: This is a JSX variable, NOT a component. Defining it as `const PageBody = () => (...)`
  // creates a new component type on every render, causing React to unmount+remount the entire
  // subtree (destroying focused inputs, state, etc.) on every AppShell re-render.
  const pageBodyContent = (
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
          <p className="mt-2 text-[10px] text-muted-foreground/50 text-center">
            © 2025 Glidr. All rights reserved.
          </p>
        </footer>
      </main>
      {/* Bottom nav is always available on small screens (mobile-by-default). */}
      <div className="lg:hidden"><MobileNav watchQueueCount={watchQueueCount} /></div>
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
                {teamLogo ? (
                  <img src={teamLogo} alt="Team logo" className="h-6 w-6 object-contain rounded sm:hidden" />
                ) : (
                  <GlidrIcon size={24} className="sm:hidden" />
                )}
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
                  const active = activeNav ? item.href === activeNav : (location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href + "/")));
                  const Icon = item.icon;
                  return (
                    <AppLink key={item.href} href={item.href} testId={item.testId}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150",
                        active ? `${ACCENT_NAV[navAccent].activeBg} ${ACCENT_NAV[navAccent].activeColor} shadow-sm dark:bg-opacity-20` : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active ? ACCENT_NAV[navAccent].activeColor : item.color)} />
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
          {pageBodyContent}
        </div>
        <ReportProblemDialog open={reportOpen} onClose={() => setReportOpen(false)} />
        {showMobilePrompt && (
          <MobileModePrompt onActivate={handleMobilePromptActivate} onDismiss={handleMobilePromptDismiss} />
        )}
        {showDesktopOnboarding && (
          <DesktopOnboardingPrompt onKeepSidebar={handleKeepSidebar} onSwitchTop={handleSwitchToTop} />
        )}
        <InboxDrawer
          open={inboxOpen}
          onClose={() => setInboxOpen(false)}
          messages={inboxMessages}
          expandedMsgId={expandedMsgId}
          setExpandedMsgId={setExpandedMsgId}
          onDelete={deleteInboxMessage}
        />
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // SIDEBAR layout (new design)
  // ══════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex bg-[#f4f4f6] dark:bg-zinc-950">

      {/* ── Desktop Sidebar (lg+) ── */}
      <aside
        style={{ width: sidebarCollapsed ? "52px" : `${sidebarWidth}px` }}
        className="hidden lg:flex flex-col relative shrink-0 h-screen sticky top-0 bg-card dark:bg-zinc-900 border-r border-border overflow-hidden"
      >
        <SidebarContent />
        {/* Drag-to-resize handle */}
        {!sidebarCollapsed && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 group hover:bg-primary/20 transition-colors"
            onMouseDown={startSidebarDrag}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-10 bg-border rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </aside>

      {/* ── Mobile Sidebar Drawer (< lg) ── */}
      {sidebarOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[240px] max-w-[82vw] flex flex-col bg-card dark:bg-zinc-900 border-r border-border shadow-xl overflow-hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <SidebarContent isMobileDrawer />
          </aside>
        </>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Top header (48px) ── */}
        <header
          className="h-12 shrink-0 flex items-center gap-2 px-4 bg-card dark:bg-zinc-900 border-b border-border sticky top-0 z-30"
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
            <AthleteSwitcher />
          </div>

          <HeaderControls />
        </header>

        {pageBodyContent}
      </div>

      <CommandSearch />
      <ReportProblemDialog open={reportOpen} onClose={() => setReportOpen(false)} />
      {showMobilePrompt && (
        <MobileModePrompt onActivate={handleMobilePromptActivate} onDismiss={handleMobilePromptDismiss} />
      )}
      {showDesktopOnboarding && (
        <DesktopOnboardingPrompt onKeepSidebar={handleKeepSidebar} onSwitchTop={handleSwitchToTop} />
      )}
      <InboxDrawer
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        messages={inboxMessages}
        expandedMsgId={expandedMsgId}
        setExpandedMsgId={setExpandedMsgId}
        onDelete={deleteInboxMessage}
      />
    </div>
  );
}

// ── Inbox drawer (slide-in panel) ───────────────────────────────────────────
type InboxMessage = {
  id: number;
  toUserId: number;
  fromUserId?: number;
  fromName?: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  teamName?: string;
  actionType?: string;
  actionData?: string;
};

function relTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// For share-view (athlete-access) accounts holding more than one athlete:
// a header dropdown to switch which athlete is currently active.
function AthleteSwitcher() {
  const { user } = useAuth();
  const isAthleteAccess = !!(user as any)?.isAthleteAccess;
  const { data } = useQuery<{ athletes: { id: number; name: string }[]; activeAthleteId: number | null }>({
    queryKey: ["/api/my/athletes"],
    enabled: isAthleteAccess,
  });
  if (!isAthleteAccess || !data || data.athletes.length <= 1) return null;
  const switchAthlete = async (id: string) => {
    try {
      await apiRequest("POST", "/api/my/active-athlete", { athleteId: parseInt(id) });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries();
    } catch {}
  };
  return (
    <Select value={String(data.activeAthleteId ?? "")} onValueChange={switchAthlete}>
      <SelectTrigger className="h-8 w-auto gap-1 text-xs" data-testid="athlete-switcher"><SelectValue /></SelectTrigger>
      <SelectContent>
        {data.athletes.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function InboxDrawer({
  open, onClose, messages, expandedMsgId, setExpandedMsgId, onDelete,
}: {
  open: boolean;
  onClose: () => void;
  messages: InboxMessage[];
  expandedMsgId: number | null;
  setExpandedMsgId: (id: number | null) => void;
  onDelete: (id: number) => void;
}) {
  const [, navigate] = useLocation();
  if (!open) return null;

  // Resolve a click-through target from the message's action metadata.
  const actionHref = (msg: InboxMessage): string | null => {
    if (!msg.actionType) return null;
    try {
      const d = JSON.parse(msg.actionData ?? "");
      if (msg.actionType === "test_comment" && d.testId) return `/tests/${d.testId}`;
      if (msg.actionType === "athlete_feedback" && d.athleteId) return `/raceskis/${d.athleteId}`;
    } catch {}
    return null;
  };

  const avatarColors = [
    "bg-indigo-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-sky-500", "bg-violet-500",
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/30"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-[100] w-full max-w-md bg-card shadow-2xl flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingRight: "env(safe-area-inset-right)" }}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 className="text-sm font-semibold truncate">Notifications</h2>
            {messages.filter(m => !m.isRead).length > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shrink-0">
                {messages.filter(m => !m.isRead).length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={async () => {
                try {
                  await apiRequest("PUT", "/api/inbox/read-all", {});
                  queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/inbox/unread-count"] });
                } catch {}
              }}
            >
              <span className="hidden sm:inline">Mark all read</span>
              <CheckCheck className="h-4 w-4 sm:hidden" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onClose} aria-label="Close" data-testid="inbox-close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
              <Bell className="h-10 w-10 opacity-20" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {messages.map((msg) => {
                const isExpanded = expandedMsgId === msg.id;
                const initial = (msg.fromName || "?")[0].toUpperCase();
                const colorIdx = (msg.fromUserId ?? 0) % avatarColors.length;

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "px-5 py-3.5 transition-colors",
                      !msg.isRead ? "bg-primary/5" : "bg-transparent",
                    )}
                  >
                    <div
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => setExpandedMsgId(isExpanded ? null : msg.id)}
                    >
                      {/* Avatar */}
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white mt-0.5", avatarColors[colorIdx])}>
                        {initial}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold leading-snug truncate">
                            {!msg.isRead && <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary mr-1.5 align-middle" />}
                            {msg.subject}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{relTimeAgo(msg.createdAt)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{msg.fromName ?? "System"}</p>
                        {!isExpanded && (
                          <p className="text-xs text-foreground/70 mt-1 line-clamp-2">{msg.body}</p>
                        )}
                        {isExpanded && (
                          <p className="text-xs text-foreground mt-2 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                        )}
                        {isExpanded && actionHref(msg) && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(actionHref(msg)!); onClose(); }}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                            data-testid={`inbox-goto-${msg.id}`}
                          >
                            {msg.actionType === "athlete_feedback" ? "Go to athlete" : "Go to test"} →
                          </button>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500 shrink-0 mt-0.5"
                        onClick={(e) => { e.stopPropagation(); onDelete(msg.id); }}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
