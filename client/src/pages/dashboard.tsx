// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { useState, useEffect, useRef } from "react";
import { CalendarPlus, PackagePlus, Snowflake, Plus, ListChecks, Zap, CloudSun, Trophy, Package, Watch, MapPin, Settings2, Award, Activity, X, User, Disc3, Flag, BarChart2, Layers, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { cn, fmtDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { loadWidgetPrefs, saveWidgetPrefs, WIDGET_REGISTRY, type WidgetId, type WidgetPref } from "@/lib/dashboard-widgets";

// ── Dashboard shortcuts ───────────────────────────────────────────────────────

const SHORTCUT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ListChecks, Snowflake, PackagePlus, CalendarPlus, Trophy, BarChart2, Disc3, Flag, Layers, MapPin, Watch, Award, Settings2, User, Activity,
};

// A saved shortcut — stores everything needed to render the pinned card
type SavedShortcut = {
  uid: string;        // unique id for this saved entry (parent id + optional suffix)
  label: string;
  description: string;
  href: string;
  iconKey: string;
  iconColor: string;
};

// Top-level shortcut definition
type ShortcutDef = {
  id: string;
  label: string;
  description: string;
  href: string;
  iconKey: string;
  iconColor: string;
  permArea?: string;   // checked via can(permArea) — only show when user has access
  adminOnly?: boolean;
  blindHide?: boolean;
  // If present, the user must drill into sub-options before the shortcut is added
  subOptions?: { id: string; label: string; description: string; href: string }[];
  // Populated dynamically at render time (e.g. one option per athlete)
  dynamicChildren?: "athletes";
};

const ALL_SHORTCUTS: ShortcutDef[] = [
  { id: "new-test",       label: "New Test",         description: "Create a new test",                  href: "/tests/new",       iconKey: "ListChecks",  iconColor: "text-emerald-600", permArea: "tests",     blindHide: true },
  { id: "tests",          label: "All Tests",         description: "Browse all tests",                   href: "/tests",           iconKey: "ListChecks",  iconColor: "text-emerald-600", permArea: "tests" },
  { id: "testskis",       label: "Test Skis",         description: "Manage test ski series",             href: "/testskis",        iconKey: "Snowflake",   iconColor: "text-sky-600",     permArea: "testskis",  blindHide: true },
  { id: "products",       label: "Products",          description: "Wax products catalogue",             href: "/products",        iconKey: "PackagePlus", iconColor: "text-amber-600",   permArea: "products",  blindHide: true },
  { id: "weather",        label: "Weather",           description: "Log weather & snow data",            href: "/weather",         iconKey: "CalendarPlus",iconColor: "text-violet-600",  permArea: "weather" },
  { id: "analytics",      label: "Analytics",         description: "Charts & performance data",          href: "/analytics",       iconKey: "BarChart2",   iconColor: "text-blue-600",    permArea: "analytics" },
  {
    id: "grinding", label: "Grinding", description: "Grind tests and profiles", href: "/grinding",
    iconKey: "Disc3", iconColor: "text-indigo-600", permArea: "grinding",
    subOptions: [
      { id: "grinding-tests",     label: "Grinding — Tests",     description: "Grind test sessions",    href: "/grinding" },
      { id: "grinding-grinds",    label: "Grinding — Profiles",  description: "Grind profiles library", href: "/grinding?tab=grinds" },
      { id: "grinding-analytics", label: "Grinding — Analytics", description: "Grind analytics",        href: "/grinding?tab=analytics" },
    ],
  },
  {
    id: "raceskis", label: "Race Skis", description: "Ski garage & race records", href: "/raceskis",
    iconKey: "Layers", iconColor: "text-rose-600", permArea: "raceskis",
    dynamicChildren: "athletes",
  },
  { id: "raceprep",       label: "Race Prep",         description: "Race day preparation",               href: "/raceprep",        iconKey: "Flag",        iconColor: "text-orange-600",  permArea: "raceskis" },
  { id: "suggestions",    label: "Suggestions",       description: "Wax suggestions",                    href: "/suggestions",     iconKey: "Trophy",      iconColor: "text-yellow-600",  permArea: "suggestions" },
  { id: "live-runsheets", label: "Live Runsheets",    description: "Live test runsheets",                href: "/live-runsheets",  iconKey: "Activity",    iconColor: "text-pink-600" },
  { id: "watch-queue",    label: "Watch Queue",       description: "Garmin watch queue",                 href: "/watch-queue",     iconKey: "Watch",       iconColor: "text-sky-600" },
  { id: "admin",          label: "Admin",             description: "Team admin settings",                href: "/admin",           iconKey: "Settings2",   iconColor: "text-gray-600",    adminOnly: true },
];

const SHORTCUTS_STORAGE_KEY = "glidr-dashboard-shortcuts-v2";
const MAX_SHORTCUTS = 4;

function loadShortcuts(userId: number | undefined): SavedShortcut[] {
  try {
    const raw = localStorage.getItem(`${SHORTCUTS_STORAGE_KEY}-${userId ?? "anon"}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveShortcuts(userId: number | undefined, shortcuts: SavedShortcut[]) {
  try { localStorage.setItem(`${SHORTCUTS_STORAGE_KEY}-${userId ?? "anon"}`, JSON.stringify(shortcuts)); } catch {}
}

type Test = { id: number; date: string; location: string; testName: string | null; testType: string; createdByName: string; groupScope: string; weatherId: number | null; seriesId: number; createdAt: string; testSkiSource?: string | null; athleteId?: number | null };
type Product = { id: number; brand: string; name: string; category: string; groupScope: string };
type Weather = { id: number; date: string; location: string; airTemperatureC: number; snowTemperatureC: number; time: string | null };
type RecentResult = {
  id: number;
  date: string;
  location: string;
  testName: string | null;
  testType: string;
  createdByName: string;
  createdAt: string;
  lastResultAt: string;
  entryCount: number;
  hasResults: boolean;
  winnerProduct: { id: number; brand: string; name: string } | null;
  winnerSkiNumber: number | null;
};

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  delta,
  barColor,
  barPct,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  delta?: string;
  barColor?: string;
  barPct?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-1 transition-all hover:border-border/80 hover:shadow-md">
      <div className={cn("flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.05em] text-muted-foreground", iconColor)}>
        <Icon className="h-[11px] w-[11px]" />
        {label}
      </div>
      <div className="text-[23px] font-bold text-foreground tracking-[-0.5px] leading-tight mt-0.5">{value}</div>
      {delta && <div className="text-[11px] font-medium text-muted-foreground">{delta}</div>}
      {barPct !== undefined && barColor && (
        <div className="mt-2 h-[2px] rounded-full bg-border overflow-hidden">
          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(100, barPct)}%` }} />
        </div>
      )}
    </div>
  );
}

function QuickCard({
  title,
  description,
  href,
  icon: Icon,
  iconColor,
  testId,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  testId: string;
}) {
  return (
    <AppLink
      href={href}
      testId={testId}
      className="group block rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-border"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight text-foreground">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
        <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/50", iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </AppLink>
  );
}

type WatchQueueItem = { id: number; test_name: string | null; series_name: string | null; added_by_name: string; session_code: string | null; status: string };

// ── Widget: Top Products ──────────────────────────────────────────────────────
function TopProductsWidget({ recentResults }: { recentResults: RecentResult[] }) {
  const winCounts: Record<number, { brand: string; name: string; count: number }> = {};
  for (const r of recentResults) {
    if (r.hasResults && r.winnerProduct) {
      const pid = r.winnerProduct.id;
      if (!winCounts[pid]) winCounts[pid] = { brand: r.winnerProduct.brand, name: r.winnerProduct.name, count: 0 };
      winCounts[pid].count++;
    }
  }
  const top = Object.values(winCounts).sort((a, b) => b.count - a.count).slice(0, 5);
  const maxCount = top[0]?.count ?? 1;

  return (
    <Card className="fs-card rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-50 dark:bg-yellow-900/20">
          <Award className="h-4 w-4 text-yellow-600" />
        </div>
        Top Products
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No results data yet.</p>
      ) : (
        <div className="space-y-2">
          {top.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{p.brand} {p.name}</div>
                <div className="mt-0.5 h-1.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-yellow-500" style={{ width: `${(p.count / maxCount) * 100}%` }} />
                </div>
              </div>
              <span className="text-xs font-bold text-yellow-700 shrink-0">{p.count}W</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Widget: Athlete Recent Tests ─────────────────────────────────────────────
type AthleteRecentTestsProps = {
  selectedAthleteIds: number[];
  athletes: { id: number; name: string }[];
  tests: Test[];
};

function AthleteRecentTestsWidget({ selectedAthleteIds, athletes, tests }: AthleteRecentTestsProps) {
  const raceSkiTests = tests.filter((t) => t.testSkiSource === "raceskis");

  // If no athletes selected → show all raceski tests; otherwise filter
  const filteredTests = selectedAthleteIds.length === 0
    ? raceSkiTests
    : raceSkiTests.filter((t) => t.athleteId != null && selectedAthleteIds.includes(t.athleteId!));

  const sorted = [...filteredTests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  const athleteMap: Record<number, string> = {};
  for (const a of athletes) athleteMap[a.id] = a.name;

  return (
    <Card className="fs-card rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-900/20">
          <User className="h-4 w-4 text-sky-600" />
        </div>
        Athlete Recent Tests
        {sorted.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{sorted.length}</span>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          {raceSkiTests.length === 0 ? "No race-ski tests found." : "No tests for the selected athlete(s)."}
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((t) => (
            <AppLink key={t.id} href={`/tests/${t.id}`}>
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs cursor-pointer hover:bg-card transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0",
                    t.testType === "Glide" ? "fs-badge-glide"
                      : t.testType === "Classic" ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                      : t.testType === "Skating" ? "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200"
                      : "fs-badge-structure"
                  )}>
                    {t.testType}
                  </span>
                  <span className="font-medium text-foreground truncate">{t.testName || t.location}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {t.athleteId && athleteMap[t.athleteId] && (
                    <span className="text-sky-600 font-medium">{athleteMap[t.athleteId]}</span>
                  )}
                  <span className="text-muted-foreground">{fmtDate(t.date)}</span>
                </div>
              </div>
            </AppLink>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Widget: Recent Activity (admin only) ──────────────────────────────────────
function RecentActivityWidget() {
  const { data: activityLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/activity"],
    queryFn: async () => {
      const res = await fetch("/api/activity?limit=10", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    retry: false,
  });

  function formatTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <Card className="fs-card rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/20">
          <Activity className="h-4 w-4 text-violet-600" />
        </div>
        Team Activity
      </div>
      {activityLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No recent activity.</p>
      ) : (
        <div className="space-y-1.5">
          {activityLogs.slice(0, 10).map((log: any, i: number) => (
            <div key={log.id ?? i} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-foreground shrink-0">{log.userName || log.user_name || "Unknown"}</span>
                <span className="text-muted-foreground truncate">{log.action} {log.entityType || log.entity_type || ""}</span>
              </div>
              <span className="text-muted-foreground shrink-0 ml-2">{formatTime(log.createdAt || log.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { user, isBlindTester, can, canManage } = useAuth();
  const { t } = useI18n();
  const hasGarminWatch = can("garmin_watch");
  const [resultLimit, setResultLimit] = useState("10");
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: watchQueue = [] } = useQuery<WatchQueueItem[]>({
    queryKey: ["/api/watch/queue"],
    enabled: hasGarminWatch,
  });
  const activeQueue = watchQueue.filter((q) => q.status === "active");
  const { data: recentResults = [] } = useQuery<RecentResult[]>({
    queryKey: ["/api/tests/recent-results", resultLimit],
    queryFn: async () => {
      const res = await fetch(`/api/tests/recent-results?limit=${resultLimit}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 10000,
  });
  const { data: allRecentResults = [] } = useQuery<RecentResult[]>({
    queryKey: ["/api/tests/recent-results", "100"],
    queryFn: async () => {
      const res = await fetch("/api/tests/recent-results?limit=100", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const { data: athletes = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/athletes"],
    retry: false,
    // Returns empty array if user has no raceskis permission
    queryFn: async () => {
      const res = await fetch("/api/athletes", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTests = tests.filter((test) => test.date === todayStr);

  const recentWeather = [...weather].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const [highlightId, setHighlightId] = useState<number | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (recentResults.length === 0) {
      lastSeenRef.current = null;
      setHighlightId(null);
      return;
    }
    const top = recentResults[0];
    const key = `${top.id}:${top.lastResultAt}`;
    if (lastSeenRef.current !== null && lastSeenRef.current !== key) {
      setHighlightId(top.id);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHighlightId(null), 20000);
    }
    lastSeenRef.current = key;
  }, [recentResults]);

  // Widget preferences
  const [widgetPrefs, setWidgetPrefs] = useState(() => loadWidgetPrefs());
  const [editingWidgets, setEditingWidgets] = useState(false);

  // Shortcuts
  const [savedShortcuts, setSavedShortcuts] = useState<SavedShortcut[]>(() => loadShortcuts(user?.id));
  const [expandedShortcutId, setExpandedShortcutId] = useState<string | null>(null);

  function addShortcut(s: SavedShortcut) {
    setSavedShortcuts((prev) => {
      if (prev.some((p) => p.uid === s.uid)) return prev; // already added
      const next = [...prev, s].slice(0, MAX_SHORTCUTS);
      saveShortcuts(user?.id, next);
      return next;
    });
  }
  function removeShortcut(uid: string) {
    setSavedShortcuts((prev) => {
      const next = prev.filter((s) => s.uid !== uid);
      saveShortcuts(user?.id, next);
      return next;
    });
  }
  function isShortcutSaved(uid: string) {
    return savedShortcuts.some((s) => s.uid === uid);
  }

  function toggleWidget(id: WidgetId) {
    const next = widgetPrefs.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p);
    setWidgetPrefs(next);
    saveWidgetPrefs(next);
  }

  function resetWidgets() {
    const defaults = WIDGET_REGISTRY.map(w => ({ id: w.id, enabled: w.defaultEnabled }));
    setWidgetPrefs(defaults as WidgetPref[]);
    saveWidgetPrefs(defaults as WidgetPref[]);
  }

  function toggleAthleteInWidget(widgetId: WidgetId, athleteId: number) {
    const next = widgetPrefs.map((p) => {
      if (p.id !== widgetId) return p;
      const ids = p.athleteIds ?? [];
      const newIds = ids.includes(athleteId) ? ids.filter((id) => id !== athleteId) : [...ids, athleteId];
      return { ...p, athleteIds: newIds };
    });
    setWidgetPrefs(next);
    saveWidgetPrefs(next);
  }

  // Visible widgets filtered by feature flags and admin status
  const availableWidgets = WIDGET_REGISTRY.filter((w) => {
    if (w.featureFlag === "garmin_watch" && !hasGarminWatch) return false;
    if (w.adminOnly && !canManage) return false;
    return true;
  });

  const enabledWidgetIds = new Set(widgetPrefs.filter((p) => p.enabled).map((p) => p.id));

  function isWidgetEnabled(id: WidgetId) {
    const pref = widgetPrefs.find((p) => p.id === id);
    return pref ? pref.enabled : WIDGET_REGISTRY.find((w) => w.id === id)?.defaultEnabled ?? false;
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("dashboard.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-dashboard-subtitle">
              {user ? t("dashboard.welcome", { name: user.name }) : t("dashboard.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingWidgets((v) => !v)}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              data-testid="button-customise-dashboard"
            >
              <Settings2 className="h-4 w-4" />
              Customise
            </Button>
            <AppLink href="/tests/new">
              <Button data-testid="button-new-test" className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                {t("dashboard.newTest")}
              </Button>
            </AppLink>
            <AppLink href="/weather">
              <Button variant="outline" data-testid="button-add-weather">
                <CalendarPlus className="mr-2 h-4 w-4 text-violet-600" />
                {t("nav.weather")}
              </Button>
            </AppLink>
            <AppLink href="/products">
              <Button variant="outline" data-testid="button-add-product">
                <PackagePlus className="mr-2 h-4 w-4 text-amber-600" />
                {t("nav.products")}
              </Button>
            </AppLink>
          </div>
        </div>

        {/* Widget customiser panel */}
        {editingWidgets && (
          <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Customise Dashboard</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetWidgets}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset to defaults
                </button>
                <button
                  type="button"
                  onClick={() => setEditingWidgets(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {availableWidgets.map((w) => {
                const pref = widgetPrefs.find((p) => p.id === w.id);
                const enabled = pref ? pref.enabled : w.defaultEnabled;
                const selectedAthleteIds = (pref as WidgetPref | undefined)?.athleteIds ?? [];

                if (w.hasAthleteConfig) {
                  // Athlete-configurable widget: render as a card with toggle + sub-checkboxes
                  return (
                    <div
                      key={w.id}
                      className={cn(
                        "col-span-full rounded-xl border px-3 py-2.5 transition-all sm:col-span-2 lg:col-span-full",
                        enabled
                          ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800"
                          : "border-border bg-muted/20"
                      )}
                    >
                      {/* Toggle row */}
                      <button
                        type="button"
                        onClick={() => toggleWidget(w.id)}
                        className="flex w-full items-start gap-3 text-left"
                      >
                        <div className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
                          enabled ? "border-green-600 bg-green-600" : "border-muted-foreground/40"
                        )}>
                          {enabled && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-foreground">{w.label}</div>
                          <div className="text-[11px] text-muted-foreground">{w.description}</div>
                        </div>
                      </button>

                      {/* Athlete sub-selector (only when enabled and athletes available) */}
                      {enabled && athletes.length > 0 && (
                        <div className="mt-2.5 border-t border-green-200/60 pt-2 dark:border-green-800/60">
                          <p className="text-[11px] text-muted-foreground mb-1.5">
                            Show tests for: <span className="italic">{selectedAthleteIds.length === 0 ? "all athletes" : `${selectedAthleteIds.length} selected`}</span>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {athletes.map((a) => {
                              const isSelected = selectedAthleteIds.includes(a.id);
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => toggleAthleteInWidget(w.id, a.id)}
                                  className={cn(
                                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
                                    isSelected
                                      ? "bg-sky-100 text-sky-700 ring-1 ring-sky-300 dark:bg-sky-900/40 dark:text-sky-300"
                                      : "bg-muted/50 text-muted-foreground ring-1 ring-border hover:bg-muted"
                                  )}
                                >
                                  <User className="h-3 w-3" />
                                  {a.name}
                                </button>
                              );
                            })}
                          </div>
                          {selectedAthleteIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = widgetPrefs.map((p) => p.id === w.id ? { ...p, athleteIds: [] } : p);
                                setWidgetPrefs(next);
                                saveWidgetPrefs(next);
                              }}
                              className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Clear selection (show all)
                            </button>
                          )}
                        </div>
                      )}
                      {enabled && athletes.length === 0 && (
                        <p className="mt-2 text-[11px] text-muted-foreground italic">No athletes accessible.</p>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWidget(w.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                      enabled
                        ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800"
                        : "border-border bg-muted/20 hover:bg-muted/40"
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
                      enabled ? "border-green-600 bg-green-600" : "border-muted-foreground/40"
                    )}>
                      {enabled && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground">{w.label}</div>
                      <div className="text-[11px] text-muted-foreground">{w.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Shortcuts config ── */}
            <div className="mt-4 border-t border-border pt-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-foreground">
                  Quick-access shortcuts ({savedShortcuts.length}/{MAX_SHORTCUTS})
                </p>
                {savedShortcuts.length > 0 && (
                  <button type="button" onClick={() => { setSavedShortcuts([]); saveShortcuts(user?.id, []); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    Clear all
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Choose up to {MAX_SHORTCUTS} shortcuts to pin at the top of your dashboard.
                Some pages let you drill down to a specific section or athlete.
              </p>

              <div className="flex flex-col gap-1.5">
                {ALL_SHORTCUTS.filter((s) => {
                  if (s.adminOnly && !canManage) return false;
                  if (s.blindHide && isBlindTester) return false;
                  if (s.permArea && !can(s.permArea)) return false;
                  return true;
                }).map((s) => {
                  const Icon = SHORTCUT_ICON_MAP[s.iconKey] ?? ListChecks;
                  const hasChildren = !!(s.subOptions?.length || s.dynamicChildren);
                  const isExpanded = expandedShortcutId === s.id;

                  // Build dynamic athlete sub-options for Race Skis
                  const dynamicOpts: { id: string; label: string; description: string; href: string }[] =
                    s.dynamicChildren === "athletes"
                      ? [
                          { id: `${s.id}-all`, label: "Race Skis — All athletes", description: "Ski garage overview", href: s.href },
                          ...athletes.map((a) => ({
                            id: `${s.id}-athlete-${a.id}`,
                            label: `Race Skis — ${a.name}`,
                            description: a.name,
                            href: `/raceskis/${a.id}`,
                          })),
                        ]
                      : [];

                  const allChildren = [...(s.subOptions ?? []), ...dynamicOpts];

                  // Whether ALL sub-options for this parent are already saved
                  const parentSaved = !hasChildren && isShortcutSaved(s.id);
                  const canAddMore = savedShortcuts.length < MAX_SHORTCUTS;

                  return (
                    <div key={s.id}>
                      {/* Top-level row */}
                      <button
                        type="button"
                        onClick={() => {
                          if (hasChildren) {
                            setExpandedShortcutId(isExpanded ? null : s.id);
                          } else {
                            // Direct shortcut — toggle
                            if (parentSaved) {
                              removeShortcut(s.id);
                            } else if (canAddMore) {
                              addShortcut({ uid: s.id, label: s.label, description: s.description, href: s.href, iconKey: s.iconKey, iconColor: s.iconColor });
                            }
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition-all",
                          parentSaved
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : hasChildren
                              ? isExpanded
                                ? "border-primary/30 bg-primary/5 text-foreground"
                                : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                              : canAddMore
                                ? "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                : "border-border bg-muted/10 text-muted-foreground/40 cursor-not-allowed"
                        )}
                      >
                        <Icon className={cn("h-3.5 w-3.5 shrink-0", parentSaved ? "text-primary" : s.iconColor)} />
                        <span className="font-medium flex-1 truncate">{s.label}</span>
                        {parentSaved && <span className="text-[10px] font-bold text-primary shrink-0">✓</span>}
                        {hasChildren && (
                          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                        )}
                      </button>

                      {/* Sub-options (drill-down) */}
                      {isExpanded && allChildren.length > 0 && (
                        <div className="ml-5 mt-1 flex flex-col gap-1">
                          {allChildren.map((child) => {
                            const saved = isShortcutSaved(child.id);
                            const canAdd = canAddMore || saved;
                            return (
                              <button
                                key={child.id}
                                type="button"
                                disabled={!canAdd}
                                onClick={() => {
                                  if (saved) {
                                    removeShortcut(child.id);
                                  } else if (canAddMore) {
                                    addShortcut({ uid: child.id, label: child.label, description: child.description, href: child.href, iconKey: s.iconKey, iconColor: s.iconColor });
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-xs transition-all",
                                  saved
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : canAdd
                                      ? "border-border bg-muted/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                      : "border-border bg-muted/5 text-muted-foreground/40 cursor-not-allowed"
                                )}
                              >
                                <span className="flex-1 truncate">{child.label}</span>
                                {saved && <span className="text-[10px] font-bold text-primary shrink-0">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Pinned shortcuts row */}
        {savedShortcuts.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="dashboard-shortcuts">
            {savedShortcuts.map((s) => {
              const Icon = SHORTCUT_ICON_MAP[s.iconKey] ?? ListChecks;
              return (
                <div key={s.uid} className="relative">
                  {editingWidgets && (
                    <button
                      type="button"
                      onClick={() => removeShortcut(s.uid)}
                      className="absolute -top-1.5 -right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/80 transition-colors"
                      title="Remove shortcut"
                    >
                      <span className="text-[11px] font-bold leading-none">−</span>
                    </button>
                  )}
                  <AppLink href={s.href} testId={`shortcut-${s.uid}`}
                    className="group block rounded-2xl border border-primary/20 bg-primary/5 p-3.5 transition-all duration-200 hover:shadow-md hover:border-primary/40 hover:bg-primary/10">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 dark:bg-black/20 shadow-sm shrink-0", s.iconColor)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{s.description}</p>
                      </div>
                    </div>
                  </AppLink>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats row — 4 summary cards */}
        {isWidgetEnabled("stats") && !isBlindTester && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label={t("dashboard.statsTests")}
              value={tests.length}
              icon={ListChecks}
              iconColor="text-emerald-600"
              delta={todayTests.length > 0 ? `${todayTests.length} today` : undefined}
              barColor="bg-green-500"
              barPct={Math.min(100, (tests.length / Math.max(tests.length, 50)) * 100)}
            />
            <StatCard
              label={t("dashboard.statsProducts")}
              value={products.length}
              icon={Package}
              iconColor="text-blue-600"
              delta={products.length > 0 ? `${[...new Set(products.map((p) => p.brand))].length} brands` : undefined}
              barColor="bg-blue-500"
              barPct={Math.min(100, (products.length / Math.max(products.length, 40)) * 100)}
            />
            <StatCard
              label={t("dashboard.statsWatchQueue")}
              value={activeQueue.length}
              icon={Watch}
              iconColor="text-sky-600"
              delta={activeQueue.length > 0 ? "Active" : "No items"}
              barColor="bg-sky-500"
              barPct={activeQueue.length > 0 ? 100 : 0}
            />
            <StatCard
              label={t("dashboard.statsVenues")}
              value={[...new Set(tests.map((t) => t.location))].length}
              icon={MapPin}
              iconColor="text-amber-600"
              delta={weather.length > 0 ? `${weather.length} weather logs` : undefined}
              barColor="bg-amber-500"
              barPct={Math.min(100, ([...new Set(tests.map((t) => t.location))].length / Math.max([...new Set(tests.map((t) => t.location))].length, 10)) * 100)}
            />
          </div>
        )}

        {/* Insight bar — last test + tests missing weather */}
        {!isBlindTester && (() => {
          const sortedTests = [...tests].sort((a, b) => b.date.localeCompare(a.date));
          const lastTest = sortedTests[0];
          const noWeather = sortedTests.filter((t) => !t.weatherId);
          if (!lastTest && noWeather.length === 0) return null;
          return (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {lastTest && (
                <AppLink href={`/tests/${lastTest.id}`}>
                  <Card className="fs-card rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                      <ListChecks className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("dashboard.lastTest")}</div>
                      <div className="truncate text-sm font-semibold text-foreground">{lastTest.testName || lastTest.location}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(lastTest.date)} · {lastTest.testType}</div>
                    </div>
                  </Card>
                </AppLink>
              )}
              {noWeather.length > 0 && (
                <AppLink href="/weather/new">
                  <Card className="fs-card rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow border-amber-200/80">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20">
                      <CloudSun className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("dashboard.missingWeather")}</div>
                      <div className="text-sm font-semibold text-foreground">{noWeather.length} {noWeather.length === 1 ? t("dashboard.missingWeatherSingular") : t("dashboard.missingWeatherPlural")}</div>
                      <div className="text-xs text-amber-600">{t("dashboard.missingWeatherCta")}</div>
                    </div>
                  </Card>
                </AppLink>
              )}
            </div>
          );
        })()}

        {isWidgetEnabled("today-tests") && todayTests.length > 0 && (
          <Card className="fs-card rounded-2xl border-emerald-200 p-4" data-testid="card-today-tests">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                <Zap className="h-4 w-4 text-emerald-600" />
              </div>
              {t("dashboard.todayTests")}
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200">{todayTests.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {todayTests.map((test) => (
                <AppLink key={test.id} href={`/tests/${test.id}`} testId={`link-today-test-${test.id}`}>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5 transition hover:bg-card hover:shadow-sm cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", test.testType === "Glide" ? "fs-badge-glide" : test.testType === "Grind" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "fs-badge-structure")}>
                        {test.testType}
                      </span>
                      <span className="text-sm font-medium text-foreground">{test.testName || test.location}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{test.createdByName}</span>
                  </div>
                </AppLink>
              ))}
            </div>
          </Card>
        )}

        {isWidgetEnabled("watch-queue") && hasGarminWatch && activeQueue.length > 0 && (
          <Card className="fs-card rounded-2xl border-sky-200 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-900/20">
                  <Watch className="h-4 w-4 text-sky-600" />
                </div>
                {t("dashboard.watchQueue")}
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700 ring-1 ring-sky-200">{activeQueue.length}</span>
              </div>
              <AppLink href="/watch-queue">
                <span className="text-xs font-medium text-sky-600 hover:text-sky-700">{t("dashboard.watchQueueManage")}</span>
              </AppLink>
            </div>
            <div className="space-y-1.5">
              {activeQueue.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs">
                  <span className="font-medium text-foreground truncate">{item.test_name || item.series_name || `Test #${item.id}`}</span>
                  <span className="ml-2 text-muted-foreground shrink-0">{item.added_by_name}</span>
                </div>
              ))}
              {activeQueue.length > 4 && (
                <p className="text-center text-xs text-muted-foreground pt-1">+{activeQueue.length - 4} {t("common.more")}</p>
              )}
            </div>
          </Card>
        )}

        {isWidgetEnabled("quick-actions") && (
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isBlindTester ? "" : "lg:grid-cols-4"}`}>
            {!isBlindTester && <QuickCard title={t("dashboard.newTest")} description={t("dashboard.newTestDesc")} href="/tests/new" icon={ListChecks} iconColor="text-emerald-600" testId="card-quick-new-test" />}
            {!isBlindTester && <QuickCard title={t("dashboard.newTestSeries")} description={t("dashboard.newTestSeriesDesc")} href="/testskis" icon={Snowflake} iconColor="text-sky-600" testId="card-quick-new-series" />}
            {!isBlindTester && <QuickCard title={t("dashboard.addProduct")} description={t("dashboard.addProductDesc")} href="/products" icon={PackagePlus} iconColor="text-amber-600" testId="card-quick-add-product" />}
            <QuickCard title={t("dashboard.addWeather")} description={t("dashboard.addWeatherDesc")} href="/weather" icon={CalendarPlus} iconColor="text-violet-600" testId="card-quick-add-weather" />
          </div>
        )}

        {isWidgetEnabled("recent-results") && (
          <Card className="fs-card rounded-2xl p-4" data-testid="card-recent-results">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-50 dark:bg-yellow-900/20">
                <Trophy className="h-4 w-4 text-yellow-600" />
              </div>
              {t("dashboard.recentResults")}
              <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600 ring-1 ring-green-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                LIVE
              </span>
              <span className="text-[10px] text-muted-foreground font-normal ml-1">{t("dashboard.recentResultsAuto")}</span>
              <div className="ml-auto">
                <Select value={resultLimit} onValueChange={setResultLimit}>
                  <SelectTrigger className="h-7 w-[72px] text-xs" data-testid="select-result-limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {recentResults.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground italic">{t("dashboard.noResults")}</div>
            ) : (
              <div className="space-y-2">
                {recentResults.map((item) => (
                  <AppLink key={item.id} href={`/tests/${item.id}`} testId={`link-recent-result-${item.id}`}>
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3 py-2.5 transition hover:shadow-sm cursor-pointer",
                        item.id === highlightId
                          ? "animate-highlight-pulse"
                          : "border-border bg-muted/30 hover:bg-card"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0",
                          item.testType === "Glide" ? "fs-badge-glide"
                            : item.testType === "Grind" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                            : item.testType === "Classic" ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                            : item.testType === "Skating" ? "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200"
                            : "fs-badge-structure"
                        )}>
                          {item.testType}
                        </span>
                        <span className="text-sm font-medium text-foreground truncate">{item.testName || item.location}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{fmtDate(item.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isBlindTester ? (
                          item.hasResults ? (
                            <span className="text-[10px] text-muted-foreground italic">{t("dashboard.resultsAvailable")}</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">{t("dashboard.noResultsYet")}</span>
                          )
                        ) : item.hasResults && item.winnerProduct ? (
                          <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-700">
                            <Trophy className="mr-1 h-2.5 w-2.5" />
                            {item.winnerProduct.brand} {item.winnerProduct.name}
                          </Badge>
                        ) : item.hasResults ? (
                          <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-700">
                            <Trophy className="mr-1 h-2.5 w-2.5" />
                            {t("dashboard.pair")} {item.winnerSkiNumber}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">{t("dashboard.noResultsYet")}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{item.createdByName}</span>
                      </div>
                    </div>
                  </AppLink>
                ))}
              </div>
            )}
            <div className="mt-3 text-center">
              <AppLink href="/tests" testId="link-all-tests">
                <span className="text-xs font-medium text-green-600 hover:text-green-700">{t("dashboard.viewAllTests")}</span>
              </AppLink>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {isWidgetEnabled("recent-weather") && recentWeather.length > 0 && (
            <Card className="fs-card rounded-2xl p-4" data-testid="card-recent-weather">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/20">
                  <CloudSun className="h-4 w-4 text-violet-600" />
                </div>
                {t("dashboard.recentWeather")}
              </div>
              <div className="space-y-2">
                {recentWeather.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs" data-testid={`weather-row-${w.id}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{w.location}</span>
                      <span className="text-muted-foreground">{fmtDate(w.date)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-green-600">{t("dashboard.air")} {w.airTemperatureC}°C</span>
                      <span className="text-cyan-600">{t("dashboard.snow")} {w.snowTemperatureC}°C</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-center">
                <AppLink href="/weather" testId="link-all-weather">
                  <span className="text-xs font-medium text-violet-600 hover:text-violet-700">{t("dashboard.viewAllWeather")}</span>
                </AppLink>
              </div>
            </Card>
          )}

          {isWidgetEnabled("products-overview") && products.length > 0 && !isBlindTester && (
            <Card className="fs-card rounded-2xl p-4" data-testid="card-products-overview">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20">
                  <Package className="h-4 w-4 text-amber-600" />
                </div>
                {t("nav.products")}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{products.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {products.slice(0, 8).map((p) => (
                  <span key={p.id} className="rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground/80 ring-1 ring-border" data-testid={`badge-product-${p.id}`}>
                    {p.brand} {p.name}
                  </span>
                ))}
                {products.length > 8 && (
                  <span className="rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">+{products.length - 8} {t("common.more")}</span>
                )}
              </div>
              <div className="mt-3 text-center">
                <AppLink href="/products" testId="link-all-products">
                  <span className="text-xs font-medium text-amber-600 hover:text-amber-700">{t("dashboard.viewAllProducts")}</span>
                </AppLink>
              </div>
            </Card>
          )}
        </div>

        {/* Optional widgets row */}
        {(isWidgetEnabled("top-products") || isWidgetEnabled("athlete-recent-tests") || isWidgetEnabled("recent-activity")) && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {isWidgetEnabled("top-products") && !isBlindTester && (
              <TopProductsWidget recentResults={allRecentResults} />
            )}
            {isWidgetEnabled("athlete-recent-tests") && (
              <AthleteRecentTestsWidget
                selectedAthleteIds={(widgetPrefs.find((p) => p.id === "athlete-recent-tests") as WidgetPref | undefined)?.athleteIds ?? []}
                athletes={athletes}
                tests={tests}
              />
            )}
            {isWidgetEnabled("recent-activity") && canManage && (
              <RecentActivityWidget />
            )}
          </div>
        )}

      </div>
    </AppShell>
  );
}
