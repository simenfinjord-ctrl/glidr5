export type WidgetId =
  | "stats" | "today-tests" | "watch-queue" | "quick-actions"
  | "recent-results" | "recent-weather" | "products-overview"
  | "top-products" | "athlete-recent-tests" | "recent-activity";

export interface WidgetDef {
  id: WidgetId;
  label: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
  adminOnly?: boolean;
  featureFlag?: string;
  hasAthleteConfig?: boolean; // shows athlete multi-select in customise panel
}

export interface WidgetPref {
  id: WidgetId;
  enabled: boolean;
  athleteIds?: number[]; // for athlete-recent-tests: [] = all accessible
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "stats",                label: "Stats Overview",       description: "Tests, products, venues and watch queue counts",    icon: "BarChart3",  defaultEnabled: true },
  { id: "today-tests",          label: "Today's Tests",        description: "Tests scheduled or run today",                      icon: "Zap",        defaultEnabled: true },
  { id: "watch-queue",          label: "Watch Queue",          description: "Active Garmin watch queue items",                   icon: "Watch",      defaultEnabled: true, featureFlag: "garmin_watch" },
  { id: "quick-actions",        label: "Quick Actions",        description: "Shortcuts to common tasks",                         icon: "Rocket",     defaultEnabled: true },
  { id: "recent-results",       label: "Recent Results",       description: "Latest test results with winners, live updated",    icon: "Trophy",     defaultEnabled: true },
  { id: "recent-weather",       label: "Recent Weather",       description: "Latest weather entries",                            icon: "CloudSun",   defaultEnabled: true },
  { id: "products-overview",    label: "Products",             description: "Products in your catalogue",                        icon: "Package",    defaultEnabled: true },
  { id: "top-products",         label: "Top Products",         description: "Best performing products by test win rate",         icon: "Award",      defaultEnabled: false },
  { id: "athlete-recent-tests", label: "Athlete Recent Tests", description: "Latest race-ski tests per selected athlete(s)",     icon: "User",       defaultEnabled: false, hasAthleteConfig: true },
  { id: "recent-activity",      label: "Team Activity",        description: "Recent actions by your team",                       icon: "Activity",   defaultEnabled: false, adminOnly: true },
];

const STORAGE_KEY = "glidr-dashboard-widgets";

export function loadWidgetPrefs(): WidgetPref[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: WidgetPref[] = JSON.parse(raw);
      // Migrate old "athlete-top-ski" → "athlete-recent-tests"
      return parsed.map(p => p.id === ("athlete-top-ski" as any)
        ? { ...p, id: "athlete-recent-tests" as WidgetId }
        : p
      );
    }
  } catch {}
  return WIDGET_REGISTRY.map(w => ({ id: w.id, enabled: w.defaultEnabled }));
}

export function saveWidgetPrefs(prefs: WidgetPref[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}
