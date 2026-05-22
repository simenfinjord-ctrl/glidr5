export type WidgetId =
  | "stats" | "today-tests" | "watch-queue" | "quick-actions"
  | "recent-results" | "recent-weather" | "products-overview"
  | "top-products" | "athlete-top-ski" | "recent-activity";

export interface WidgetDef {
  id: WidgetId;
  label: string;
  description: string;
  icon: string; // lucide icon name as string
  defaultEnabled: boolean;
  adminOnly?: boolean;    // only show for admins/TAs
  featureFlag?: string;   // e.g. "garmin_watch"
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "stats",             label: "Stats Overview",       description: "Tests, products, venues and watch queue counts", icon: "BarChart3",   defaultEnabled: true },
  { id: "today-tests",       label: "Today's Tests",        description: "Tests scheduled or run today",                   icon: "Zap",         defaultEnabled: true },
  { id: "watch-queue",       label: "Watch Queue",          description: "Active Garmin watch queue items",                icon: "Watch",       defaultEnabled: true, featureFlag: "garmin_watch" },
  { id: "quick-actions",     label: "Quick Actions",        description: "Shortcuts to common tasks",                      icon: "Rocket",      defaultEnabled: true },
  { id: "recent-results",    label: "Recent Results",       description: "Latest test results with winners, live updated", icon: "Trophy",      defaultEnabled: true },
  { id: "recent-weather",    label: "Recent Weather",       description: "Latest weather entries",                         icon: "CloudSun",    defaultEnabled: true },
  { id: "products-overview", label: "Products",             description: "Products in your catalogue",                     icon: "Package",     defaultEnabled: true },
  { id: "top-products",      label: "Top Products",         description: "Best performing products by test win rate",      icon: "Award",       defaultEnabled: false },
  { id: "athlete-top-ski",   label: "Athlete Top Ski",      description: "Best ski pair per athlete from race tests",      icon: "Snowflake",   defaultEnabled: false },
  { id: "recent-activity",   label: "Team Activity",        description: "Recent actions by your team",                    icon: "Activity",    defaultEnabled: false, adminOnly: true },
];

const STORAGE_KEY = "glidr-dashboard-widgets";

export function loadWidgetPrefs(): { id: WidgetId; enabled: boolean }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return WIDGET_REGISTRY.map(w => ({ id: w.id, enabled: w.defaultEnabled }));
}

export function saveWidgetPrefs(prefs: { id: WidgetId; enabled: boolean }[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
}
