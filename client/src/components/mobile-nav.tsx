import { useState } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard, ListChecks, Watch, MoreHorizontal, X,
  Snowflake, CloudSun, Package, BarChart3, Disc3, Trophy,
  Sparkles, Radio, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLink } from "@/components/app-link";
import { useAuth } from "@/lib/auth";

export function useMobileNav() {
  const key = "glidr_mobile_nav";
  const get = () => {
    try { return localStorage.getItem(key) === "1"; } catch { return false; }
  };
  const set = (val: boolean) => {
    try { localStorage.setItem(key, val ? "1" : "0"); } catch {}
  };
  return { get, set };
}

const ALL_NAV = [
  { href: "/dashboard",     label: "Dashboard",      icon: LayoutDashboard, featureArea: null, permArea: null,          adminOnly: false },
  { href: "/tests",         label: "Tests",           icon: ListChecks,      featureArea: null, permArea: "tests",       adminOnly: false },
  { href: "/testskis",      label: "Test Skis",       icon: Snowflake,       featureArea: null, permArea: "testskis",    adminOnly: false },
  { href: "/products",      label: "Products",        icon: Package,         featureArea: null, permArea: "products",    adminOnly: false },
  { href: "/weather",       label: "Weather",         icon: CloudSun,        featureArea: null, permArea: "weather",     adminOnly: false },
  { href: "/analytics",     label: "Analytics",       icon: BarChart3,       featureArea: null, permArea: "analytics",   adminOnly: false },
  { href: "/grinding",      label: "Grinding",        icon: Disc3,           featureArea: null, permArea: "grinding",    adminOnly: false },
  { href: "/raceskis",      label: "Race Skis",       icon: Trophy,          featureArea: null, permArea: "raceskis",    adminOnly: false },
  { href: "/suggestions",   label: "Suggestions",     icon: Sparkles,        featureArea: null, permArea: "suggestions", adminOnly: false },
  { href: "/live-runsheets",label: "Live Runsheets",  icon: Radio,           featureArea: null, permArea: "liverunsheets", adminOnly: false },
  { href: "/watch-queue",   label: "Watch Queue",     icon: Watch,           featureArea: "garmin_watch", permArea: null, adminOnly: false },
  { href: "/admin",         label: "Admin",           icon: Shield,          featureArea: null, permArea: null,          adminOnly: true  },
];

// Primary tabs always shown in bottom bar
const PRIMARY_HREFS = ["/dashboard", "/tests", "/watch-queue"];

export function MobileNav({ watchQueueCount }: { watchQueueCount?: number }) {
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { can, canManage } = useAuth();

  const visible = ALL_NAV.filter((item) => {
    if (item.adminOnly) return canManage;
    if (item.featureArea && !can(item.featureArea)) return false;
    if (item.permArea && !can(item.permArea)) return false;
    return true;
  });

  const primary = visible.filter((i) => PRIMARY_HREFS.includes(i.href));
  const secondary = visible.filter((i) => !PRIMARY_HREFS.includes(i.href));

  const isActive = (href: string) =>
    location === href || (href !== "/dashboard" && location.startsWith(href));

  return (
    <>
      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg pb-safe">
        <div className="flex items-stretch">
          {primary.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <AppLink
                key={item.href}
                href={item.href}
                testId={`mobile-nav-${item.href.replace("/", "")}`}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.href === "/watch-queue" && watchQueueCount && watchQueueCount > 0 ? (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500 text-[8px] font-bold text-white">
                      {watchQueueCount}
                    </span>
                  ) : null}
                </div>
                <span>{item.label}</span>
              </AppLink>
            );
          })}

          {/* More button */}
          {secondary.length > 0 && (
            <button
              onClick={() => setShowMore((v) => !v)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                showMore ? "text-primary" : "text-muted-foreground"
              )}
            >
              {showMore ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
              <span>{showMore ? "Close" : "More"}</span>
            </button>
          )}
        </div>
      </nav>

      {/* More panel */}
      {showMore && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-[57px] left-0 right-0 z-50 border-t border-border bg-card/98 backdrop-blur-lg shadow-lg">
            <div className="grid grid-cols-3 gap-px p-3">
              {secondary.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <AppLink
                    key={item.href}
                    href={item.href}
                    testId={`mobile-nav-more-${item.href.replace("/", "")}`}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-[10px] font-medium transition-colors",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-center leading-tight">{item.label}</span>
                  </AppLink>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Spacer so content isn't hidden behind the bar */}
      <div className="h-16" />
    </>
  );
}
