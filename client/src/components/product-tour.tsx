// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_KEY = "glidr-product-tour-v1";

export function useTourCompleted() {
  try { return localStorage.getItem(TOUR_KEY) === "done"; } catch { return false; }
}
export function markTourDone() {
  try { localStorage.setItem(TOUR_KEY, "done"); } catch {}
}
export function resetTour() {
  try { localStorage.removeItem(TOUR_KEY); } catch {}
}

const STEPS = [
  {
    target: "[data-tour='nav-tests']",
    title: "Tests",
    body: "This is where your ski tests live. Create Glide, Structure, Classic, Skating, Double Poling or Grind tests — each with entries per ski, products, application methods and results.",
    placement: "right" as const,
  },
  {
    target: "[data-tour='nav-products']",
    title: "Products",
    body: "Your product catalogue. Add wax brands, compare products head-to-head, track stock quantities, and use Combination Search to find tests where multiple products were used together.",
    placement: "right" as const,
  },
  {
    target: "[data-tour='nav-weather']",
    title: "Weather & Conditions",
    body: "Log snow and air conditions for each session — 15 fields including snow type, humidity, grain size, cloud cover, wind, and more. Link conditions to tests for meaningful analysis.",
    placement: "right" as const,
  },
  {
    target: "[data-tour='nav-analytics']",
    title: "Analytics",
    body: "See which products perform best across all your tests. Filter by conditions, compare products side by side, and find patterns in your data.",
    placement: "right" as const,
  },
  {
    target: "[data-tour='nav-racepreps']",
    title: "Race Preparations",
    body: "Plan race day. Record glide products, structure choices, kick wax, and assign specific skis to each athlete — all linked to conditions data.",
    placement: "right" as const,
  },
  {
    target: "[data-tour='whats-new']",
    title: "What's New",
    body: "Click the sparkles icon to see the latest Glidr updates. A green dot appears whenever there's something new to read.",
    placement: "bottom" as const,
  },
];

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function getTooltipPosition(rect: Rect, placement: "right" | "bottom" | "left"): { left?: number; top?: number; right?: number } {
  const TOOLTIP_WIDTH = 280;
  const TOOLTIP_HEIGHT = 200; // estimated
  const MARGIN = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (placement === "right") {
    const left = clamp(rect.right + MARGIN, MARGIN, vw - TOOLTIP_WIDTH - MARGIN);
    const top = clamp(rect.top, MARGIN, vh - TOOLTIP_HEIGHT - MARGIN);
    return { left, top };
  }
  if (placement === "bottom") {
    const left = clamp(rect.left, MARGIN, vw - TOOLTIP_WIDTH - MARGIN);
    const top = clamp(rect.bottom + MARGIN, MARGIN, vh - TOOLTIP_HEIGHT - MARGIN);
    return { left, top };
  }
  // left
  const right = clamp(vw - rect.left + MARGIN, MARGIN, vw - TOOLTIP_WIDTH - MARGIN);
  const top = clamp(rect.top, MARGIN, vh - TOOLTIP_HEIGHT - MARGIN);
  return { right, top };
}

export function ProductTour({ onDone }: { onDone: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const findAndSetRect = useCallback((index: number) => {
    const step = STEPS[index];
    if (!step) return null;
    const el = document.querySelector(step.target);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }, []);

  // When step changes, find the element or skip
  useEffect(() => {
    const rect = findAndSetRect(stepIndex);
    if (rect) {
      setTargetRect(rect);
    } else {
      // Skip to next step if element not found
      if (stepIndex < STEPS.length - 1) {
        setStepIndex((i) => i + 1);
      } else {
        // No more steps, done
        markTourDone();
        onDone();
      }
    }
  }, [stepIndex, findAndSetRect, onDone]);

  // Recalculate on resize
  useEffect(() => {
    const handler = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        const rect = findAndSetRect(stepIndex);
        if (rect) setTargetRect(rect);
      }, 100);
    };
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, [stepIndex, findAndSetRect]);

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      markTourDone();
      onDone();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const handleSkip = () => {
    markTourDone();
    onDone();
  };

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  if (!targetRect) return null;

  const spotlightStyle: React.CSSProperties = {
    position: "fixed",
    left: targetRect.left - 4,
    top: targetRect.top - 4,
    width: targetRect.width + 8,
    height: targetRect.height + 8,
    borderRadius: 8,
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
    pointerEvents: "none",
    transition: "all 0.3s ease",
    zIndex: 10000,
  };

  const tooltipPos = getTooltipPosition(targetRect, step.placement);
  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    width: 280,
    zIndex: 10001,
    pointerEvents: "auto",
    ...tooltipPos,
  };

  return (
    <>
      {/* Semi-transparent overlay (non-interactive) */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />
      {/* Spotlight cutout */}
      <div style={spotlightStyle} aria-hidden="true" />
      {/* Tooltip card */}
      <div style={tooltipStyle} role="dialog" aria-modal="true" aria-label={`Tour step ${stepIndex + 1} of ${STEPS.length}: ${step.title}`}>
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-border p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground leading-snug">{step.title}</h3>
            <button
              onClick={handleSkip}
              className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Skip tour"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground font-medium">{stepIndex + 1} / {STEPS.length}</span>
            <div className="flex items-center gap-1.5">
              {stepIndex > 0 && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleBack}>
                  <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                  Back
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={handleSkip}>
                Skip
              </Button>
              <Button size="sm" className="h-7 px-3 text-xs" onClick={handleNext}>
                {isLast ? "Finish" : "Next"}
                {!isLast && <ChevronRight className="h-3.5 w-3.5 ml-0.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
