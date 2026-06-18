import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Users,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  X,
  MapPin,
  Calendar,
  Settings2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Archive,
  ArchiveRestore,
  Warehouse,
  Search,
  LayoutGrid,
  List,
  Filter,
  BarChart2,
  ChevronUp,
  Thermometer,
  FileDown,
  Loader2,
  FileText,
  WifiOff,
  MessageSquare,
  Link2,
  CalendarDays,
  Upload,
  Clock,
  Flag,
  Snowflake,
} from "lucide-react";
import { useOffline } from "@/lib/offline-context";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn, fmtDate, fmtDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";
import { pdfDocument, pdfSection, pdfCards, pdfTable, pdfWeather, openPdfWindow } from "@/lib/pdf-layout";
import { RacePrepComments } from "@/components/race-prep-comments";

type Athlete = {
  id: number;
  name: string;
  team: string | null;
  defaultSkiBrand: string | null;
  heightCm: string | null;
  weightKg: string | null;
  poleHeight: string | null;
  bindingPosition: string | null;
  skiServicePreferences: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
};

type RaceSki = {
  id: number;
  athleteId: number;
  serialNumber: string | null;
  skiId: string;
  brand: string | null;
  discipline: string;
  construction: string | null;
  mold: string | null;
  base: string | null;
  grind: string | null;
  heights: string | null;
  year: string | null;
  length: string | null;
  typeOfSki: string | null;
  whereReceived: string | null;
  notes: string | null;
  isTrainingSki: number;
  customParams: string | null;
  archivedAt: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
};

type RaceSkiRegrind = {
  id: number;
  raceSkiId: number;
  date: string;
  grindType: string;
  stone: string | null;
  pattern: string | null;
  notes: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
};

type RaceSkiTest = {
  id: number;
  date: string;
  location: string;
  testType: string;
  testSkiSource: string;
  seriesId: number | null;
  athleteId: number | null;
  weatherId: number | null;
  notes: string | null;
  distanceLabels: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
};

type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  results: string | null;
  feelingRank: number | null;
  kickRank: number | null;
  grindType: string | null;
  grindStone: string | null;
  grindPattern: string | null;
  raceSkiId: number | null;
  createdAt: string;
};

type RaceSkiTestRow = {
  id: string;
  raceSkiId: number;
  skiId: string;
  brand: string | null;
  base: string | null;
  construction: string | null;
  mold: string | null;
  grind: string | null;
  heights: string | null;
  serialNumber: string | null;
  year: string | null;
  roundResults: { result: number | null; rank: number | null }[];
  feelingRank: number | null;
  kickRank: number | null;
  [key: string]: any;
};

type WeatherItem = {
  id: number;
  date: string;
  time: string;
  location: string;
  snowTemperatureC: number | null;
  airTemperatureC: number | null;
  snowHumidityPct: number | null;
  airHumidityPct: number | null;
  clouds: number | null;
  visibility: string | null;
  wind: string | null;
  precipitation: string | null;
  artificialSnow: string | null;
  naturalSnow: string | null;
  grainSize: string | null;
  snowHumidityType: string | null;
  trackHardness: string | null;
  testQuality: number | null;
  snowType: string | null;
  groupScope: string;
};

type AthleteAccess = {
  id: number;
  athleteId: number;
  userId: number;
};

type UserItem = {
  id: number;
  name: string;
  email: string;
};

type AthleteRaceHistory = {
  entryId: number;
  skiId: string | null;
  skiIdClassic: string | null;
  skiIdSkating: string | null;
  waxerName: string | null;
  entryNotes: string | null;
  racePrepId: number;
  date: string;
  startTime: string | null;
  location: string;
  raceType: string;
  discipline: string;
  productIds: string | null;
  structureIds: string | null;
  kickProductIds: string | null;
  productApps: string | null;
  structureApps: string | null;
  tette: string | null;
  method: string | null;
  prepNotes: string | null;
  weatherId: number | null;
  athleteRating: string | null;
  athleteComment: string | null;
};

// Inline-editable ski ID for one slot of a race-prep entry, used on the athlete
// page so ski-waxers can register the ski pair without entering the Race Prep zone.
function RacePrepSkiIdField({
  prepId, entryId, athleteId, slot, discipline, entry, canEdit, onSaved, lang,
}: {
  prepId: number;
  entryId: number;
  athleteId: number;
  slot: "single" | "classic" | "skating";
  discipline: string;
  entry: { skiId: string | null; skiIdClassic: string | null; skiIdSkating: string | null; entryNotes: string | null };
  canEdit: boolean;
  onSaved: () => void;
  lang: "no" | "en";
}) {
  const L = (no: string, en: string) => (lang === "en" ? en : no);
  const { toast } = useToast();
  const current = slot === "classic" ? (entry.skiIdClassic ?? entry.skiId) : slot === "skating" ? entry.skiIdSkating : entry.skiId;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const [optimistic, setOptimistic] = useState<string | null | undefined>(undefined);
  const [showSug, setShowSug] = useState(false);
  const { data: skis = [] } = useQuery<{ id: number; skiId: string; serialNumber: string | null; discipline: string }[]>({
    queryKey: [`/api/athletes/${athleteId}/skis`],
    enabled: editing,
  });
  // Team-wide skis + athlete names — for borrowing a pair from another athlete.
  const { data: allSkis = [] } = useQuery<{ id: number; skiId: string; serialNumber: string | null; discipline: string; athleteId: number }[]>({
    queryKey: ["/api/race-skis/all"],
    enabled: editing,
  });
  const { data: allAthletes = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/athletes"],
    enabled: editing,
  });
  const athleteNameById = useMemo(() => new Map(allAthletes.map((a) => [a.id, a.name])), [allAthletes]);
  // Only suggest skis matching this slot's discipline. For a single-discipline
  // race the slot is "single" → filter by the race's own discipline.
  const discFilter = slot === "classic" ? "Classic" : slot === "skating" ? "Skating" : discipline;
  const suggestions = useMemo(() => {
    let base = discFilter ? skis.filter(s => s.discipline === discFilter) : skis;
    if (val.trim()) base = base.filter(s => s.skiId.toLowerCase().includes(val.toLowerCase()) || (s.serialNumber ?? "").toLowerCase().includes(val.toLowerCase()));
    return base.slice(0, 8);
  }, [skis, val, discFilter]);
  const borrowed = useMemo(() => {
    let base = allSkis.filter((s) => s.athleteId !== athleteId && (!discFilter || s.discipline === discFilter));
    if (val.trim()) base = base.filter((s) => s.skiId.toLowerCase().includes(val.toLowerCase()) || (s.serialNumber ?? "").toLowerCase().includes(val.toLowerCase()));
    return base.slice(0, 6);
  }, [allSkis, athleteId, discFilter, val]);
  const display = optimistic !== undefined ? optimistic : current;

  async function save(v?: string) {
    const final = (v ?? val).trim();
    setSaving(true);
    try {
      const body = {
        notes: entry.entryNotes ?? null,
        skiId: slot === "single" ? (final || null) : (entry.skiId ?? null),
        skiIdClassic: slot === "classic" ? (final || null) : (entry.skiIdClassic ?? null),
        skiIdSkating: slot === "skating" ? (final || null) : (entry.skiIdSkating ?? null),
      };
      await apiRequest("PUT", `/api/race-preps/${prepId}/entries/${entryId}`, body);
      setOptimistic(final || null);
      setEditing(false);
      setShowSug(false);
      onSaved();
    } catch {
      toast({ title: L("Feil", "Error"), description: L("Kunne ikke lagre", "Could not save"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => { if (canEdit) { setVal(display ?? ""); setEditing(true); } }}
        className={cn(
          "text-left leading-tight",
          canEdit ? "cursor-text hover:opacity-80" : "cursor-default"
        )}
        title={canEdit ? L("Klikk for å legge inn skipar", "Click to enter ski pair") : undefined}
      >
        {display || <span className="text-muted-foreground text-sm font-normal">{canEdit ? L("+ Legg inn", "+ Enter") : "—"}</span>}
      </button>
    );
  }

  return (
    <div className="relative">
      <input
        autoFocus
        value={val}
        disabled={saving}
        onChange={(e) => { setVal(e.target.value); setShowSug(true); }}
        onFocus={() => setShowSug(true)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setShowSug(false); } }}
        onBlur={() => setTimeout(() => save(), 120)}
        placeholder={L("Ski-ID", "Ski ID")}
        className="w-full rounded border border-input bg-background px-2 py-1 text-base font-bold"
      />
      {showSug && (suggestions.length > 0 || borrowed.length > 0) && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setVal(s.skiId); save(s.skiId); }}
              className="block w-full text-left px-2 py-1 text-sm hover:bg-muted"
            >
              <span className="font-medium">{s.skiId}</span>
              {s.serialNumber && <span className="ml-1.5 text-xs text-muted-foreground">{s.serialNumber}</span>}
            </button>
          ))}
          {borrowed.length > 0 && (
            <>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 sticky top-0">
                {L("Lånt fra andre utøvere", "Borrowed from other athletes")}
              </div>
              {borrowed.map((s) => (
                <button
                  key={`borrow-${s.id}`}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setVal(s.skiId); save(s.skiId); }}
                  className="block w-full text-left px-2 py-1 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{s.skiId}</span>
                  {s.serialNumber && <span className="ml-1.5 text-xs text-muted-foreground">{s.serialNumber}</span>}
                  <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400">{athleteNameById.get(s.athleteId) ?? L("Annen utøver", "Other athlete")}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ski color tags ──────────────────────────────────────────────────────────
const SKI_COLORS = [
  { id: "none",    label: "None",    bg: "bg-muted/40",                              ring: "ring-border",         dot: "" },
  { id: "sky",     label: "Blue",    bg: "bg-sky-100 dark:bg-sky-900/30",            ring: "ring-sky-300",        dot: "bg-sky-400" },
  { id: "emerald", label: "Green",   bg: "bg-emerald-100 dark:bg-emerald-900/30",    ring: "ring-emerald-300",    dot: "bg-emerald-400" },
  { id: "rose",    label: "Pink",    bg: "bg-rose-100 dark:bg-rose-900/30",          ring: "ring-rose-300",       dot: "bg-rose-400" },
  { id: "orange",  label: "Orange",  bg: "bg-orange-100 dark:bg-orange-900/30",      ring: "ring-orange-300",     dot: "bg-orange-400" },
  { id: "yellow",  label: "Yellow",  bg: "bg-yellow-100 dark:bg-yellow-900/30",      ring: "ring-yellow-300",     dot: "bg-yellow-400" },
  { id: "violet",  label: "Purple",  bg: "bg-violet-100 dark:bg-violet-900/30",      ring: "ring-violet-300",     dot: "bg-violet-400" },
  { id: "red",     label: "Red",     bg: "bg-red-100 dark:bg-red-900/30",            ring: "ring-red-300",        dot: "bg-red-400" },
  { id: "teal",    label: "Teal",    bg: "bg-teal-100 dark:bg-teal-900/30",          ring: "ring-teal-300",       dot: "bg-teal-400" },
] as const;

function getSkiColor(ski: RaceSki): string {
  try {
    const cp = ski.customParams ? JSON.parse(ski.customParams) : {};
    return cp._color || "none";
  } catch { return "none"; }
}

// Discipline color badges - same as race-prep.tsx
const DISCIPLINE_COLORS_DETAIL: Record<string, string> = {
  Classic:   "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800",
  Skating:   "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800",
  Skiathlon: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-800",
};

const DISCIPLINE_LABEL_DETAIL: Record<string, { no: string; en: string }> = {
  Classic:   { no: "Klassisk", en: "Classic" },
  Skating:   { no: "Skøyting", en: "Skating" },
  Skiathlon: { no: "Skiathlon", en: "Skiathlon" },
};

const TRACK_HARDNESS_OPTIONS = ["Very soft", "Soft", "Medium hard", "Hard", "Very hard", "Ice"] as const;
const SNOW_HUMIDITY_TYPE_OPTIONS = ["Dry", "Moist", "Wet", "Very wet", "Slush"] as const;
const GRAIN_SIZE_OPTIONS = ["Extra fine", "Very fine", "Fine", "Average", "Coarse", "Very coarse"] as const;
const SNOW_STAGE_OPTIONS = ["Falling new", "New", "Irreg. dir. new", "Irreg. dir. transf.", "Transformed"] as const;

// Colour for an athlete feedback rating (Competitive+ / Competitive / Competitive-).
function athleteRatingClass(r: string): string {
  return r === "Competitive+" ? "bg-emerald-100 text-emerald-700 ring-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800"
    : r === "Competitive-" ? "bg-rose-100 text-rose-700 ring-rose-300 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800"
    : "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800";
}

// ── Ski Garage list-view columns ────────────────────────────────────────────
// Every standard ski parameter plus RA-value. Custom params are appended
// dynamically (key "cp:<name>"). Numeric columns sort numerically.
const GARAGE_NUMERIC_KEYS = new Set(["year", "length", "ra"]);
function garageParseCustom(s: any): Record<string, any> {
  try { return s.customParams ? JSON.parse(s.customParams) : {}; } catch { return {}; }
}
// Raw value used for sorting (number for numeric columns, string otherwise).
function garageSortValue(s: any, key: string): number | string {
  const num = (v: any) => parseFloat(String(v ?? "").replace(",", ".")) || 0;
  if (key === "skiId") return s.skiId ?? "";
  if (key === "year") return num(s.year);
  if (key === "length") return num(s.length);
  if (key === "ra") return num(garageParseCustom(s).ra_value);
  if (key === "color") { const idx = SKI_COLORS.findIndex((c) => c.id === getSkiColor(s)); return idx < 0 ? 0 : idx; }
  if (key.startsWith("cp:")) {
    const v = garageParseCustom(s)[key.slice(3)];
    const n = parseFloat(String(v ?? "").replace(",", "."));
    return isNaN(n) ? String(v ?? "") : n;
  }
  return (s as any)[key] ?? "";
}
// Display string for a cell ("—" when empty).
function garageCellValue(s: any, key: string): string {
  if (key === "color") { const c = SKI_COLORS.find((x) => x.id === getSkiColor(s)); return c && c.id !== "none" ? c.label : "—"; }
  if (key === "ra") { const v = garageParseCustom(s).ra_value; return v != null && v !== "" ? String(v) : "—"; }
  if (key.startsWith("cp:")) { const v = garageParseCustom(s)[key.slice(3)]; return v != null && v !== "" ? String(v) : "—"; }
  const v = (s as any)[key];
  return v != null && v !== "" ? String(v) : "—";
}

export default function AthleteDetail() {
  const [, params] = useRoute("/raceskis/:id");
  const [, navigate] = useLocation();
  const search = useSearch();
  const athleteId = params?.id ? parseInt(params.id) : null;
  const { user, can, canManage } = useAuth();
  const isAnalyticsView = new URLSearchParams(search).get("view") === "analytics";
  const isAthletePortal = new URLSearchParams(search).get("view") === "athlete-portal";
  const { toast } = useToast();
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { isOnline, pendingCount, queueMutation } = useOffline();

  const [skiDialogOpen, setSkiDialogOpen] = useState(false);
  const [editingSki, setEditingSki] = useState<RaceSki | null>(null);
  const [regrindDialogOpen, setRegrindDialogOpen] = useState(false);
  const [regrindSkiId, setRegrindSkiId] = useState<number | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [editAthleteOpen, setEditAthleteOpen] = useState(false);
  const [expandedSkiId, setExpandedSkiId] = useState<number | null>(null);
  const [showArchivedSkis, setShowArchivedSkis] = useState(false);
  const [skiGarageOpen, setSkiGarageOpen] = useState(true);

  // Ski Garage view & filters
  const [garageViewMode, setGarageViewMode] = useState<"grid" | "list">(() => {
    try {
      const v = localStorage.getItem("glidr-garage-view-mode");
      if (v === "list" || v === "grid") return v;
    } catch {}
    return "grid";
  });
  const [garageDisciplineFilter, setGarageDisciplineFilter] = useState<string>("all");
  const [garageBrandFilter, setGarageBrandFilter] = useState<string>("all");
  const [garageYearFilter, setGarageYearFilter] = useState<string>("all");
  const [garageGrindFilter, setGarageGrindFilter] = useState<string>("");
  const [garageRaValueFilter, setGarageRaValueFilter] = useState<string>("");
  // Which ski-tag colours to show (empty = show all colours).
  const [garageColorFilter, setGarageColorFilter] = useState<string[]>([]);
  const [garageRaSort, setGarageRaSort] = useState<string>("none");
  const [showGarageFilters, setShowGarageFilters] = useState(false);
  // List-view column visibility. null = auto (show every column that has data).
  // Once the user toggles a column it becomes an explicit list, persisted locally.
  const [garageColPref, setGarageColPref] = useState<string[] | null>(() => {
    try { const s = localStorage.getItem("glidr-garage-cols-v1"); if (s) { const p = JSON.parse(s); if (Array.isArray(p)) return p; } } catch {}
    return null;
  });

  // Analytics section (used by dedicated analytics view)
  const [compareSkiIds, setCompareSkiIds] = useState<Set<number>>(new Set());

  // Test result column chooser
  const defaultTestColumns = ["skiId", "brand", "grind", "result", "rank", "feeling", "methodology"];
  const [activeTestColumns, setActiveTestColumns] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("glidr-raceski-test-columns");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultTestColumns;
  });
  const [testColumnsDialogOpen, setTestColumnsDialogOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("glidr-raceski-test-columns", JSON.stringify(activeTestColumns)); } catch {}
  }, [activeTestColumns]);

  const [pageTab, setPageTab] = useState<"garage" | "tests" | "races">("garage");
  const [testsExpanded, setTestsExpanded] = useState(true);
  const [testViewMode, setTestViewMode] = useState<"card" | "list">("card");
  const [expandedTestIds, setExpandedTestIds] = useState<Set<number>>(new Set());
  function toggleTestExpanded(id: number) {
    setExpandedTestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const [showTestForm, setShowTestForm] = useState(false);
  const [testForm, setTestForm] = useState({
    date: new Date().toISOString().split("T")[0],
    location: "",
    testType: "Classic" as "Classic" | "Skating" | "Double Poling",
    notes: "",
    weatherId: undefined as number | undefined,
  });
  const [selectedSkiIds, setSelectedSkiIds] = useState<Set<number>>(new Set());
  const [skiSearchQuery, setSkiSearchQuery] = useState("");
  const [testRows, setTestRows] = useState<RaceSkiTestRow[]>([]);
  const [distanceLabels, setDistanceLabels] = useState<string[]>([""]);

  const [customFieldDefs, setCustomFieldDefs] = useState<{ key: string; label: string }[]>(() => {
    try {
      const stored = localStorage.getItem("glidr-raceski-custom-fields");
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  useEffect(() => {
    localStorage.setItem("glidr-raceski-custom-fields", JSON.stringify(customFieldDefs));
  }, [customFieldDefs]);

  const builtInTestParams: { key: string; label: string }[] = [
    { key: "brand", label: L("Merke", "Brand") },
    { key: "base", label: t("raceskis.base") },
    { key: "grind", label: t("raceskis.grind") },
    { key: "heights", label: t("raceskis.heights") },
    { key: "construction", label: t("raceskis.construction") },
    { key: "mold", label: t("raceskis.mold") },
    { key: "serialNumber", label: t("raceskis.serialNumber") },
    { key: "year", label: "Year" },
  ];
  const allSkiParams = [...builtInTestParams, ...customFieldDefs];

  const defaultParams: string[] = ["brand", "base", "grind", "heights"];
  const [activeParams, setActiveParams] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("glidr-raceski-params");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultParams;
  });
  const [editParamsOpen, setEditParamsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("glidr-raceski-params", JSON.stringify(activeParams));
  }, [activeParams]);

  const inactiveParams = allSkiParams.filter((p) => !activeParams.includes(p.key));

  const moveParamUp = (idx: number) => {
    if (idx <= 0) return;
    const next = [...activeParams];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setActiveParams(next);
  };
  const moveParamDown = (idx: number) => {
    if (idx >= activeParams.length - 1) return;
    const next = [...activeParams];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setActiveParams(next);
  };
  const removeParam = (key: string) => {
    setActiveParams(activeParams.filter((k) => k !== key));
  };
  const addParam = (key: string) => {
    setActiveParams([...activeParams, key]);
  };

  const getParamLabel = (key: string) =>
    allSkiParams.find((p) => p.key === key)?.label ?? key;

  const [skiForm, setSkiForm] = useState({
    skiId: "",
    serialNumber: "",
    brand: "",
    discipline: "Classic",
    construction: "",
    mold: "",
    base: "",
    grind: "",
    heights: "",
    year: "",
    length: "",
    typeOfSki: "",
    whereReceived: "",
    notes: "",
    isTrainingSki: false,
    color: "",
  });
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const builtInSkiFields: { key: string; label: string }[] = [
    { key: "serialNumber", label: t("raceskis.serialNumber") },
    { key: "brand", label: L("Merke", "Brand") },
    { key: "discipline", label: t("raceskis.discipline") },
    { key: "construction", label: t("raceskis.construction") },
    { key: "mold", label: t("raceskis.mold") },
    { key: "base", label: t("raceskis.base") },
    { key: "grind", label: t("raceskis.grind") },
    { key: "heights", label: t("raceskis.heights") },
    { key: "year", label: L("Årgang", "Year") },
    { key: "length", label: L("Lengde", "Length") },
    { key: "typeOfSki", label: L("Skitype", "Ski type") },
    { key: "whereReceived", label: L("Mottatt fra", "Where received") },
  ];
  const builtInKeys = builtInSkiFields.map((f) => f.key);

  const allSkiFormFields = [...builtInSkiFields, ...customFieldDefs];

  const defaultFormFields = ["serialNumber", "grind", "brand", "discipline", "construction", "mold", "base", "heights", "year", "length", "typeOfSki", "whereReceived"];
  const [activeFormFields, setActiveFormFields] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("glidr-raceski-form-fields");
      if (stored) {
        let parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // One-time migration: move Grind to right under Serial number for faster entry.
          if (!localStorage.getItem("glidr-raceski-grind-moved-v1") && parsed.includes("grind")) {
            parsed = parsed.filter((k: string) => k !== "grind");
            const si = parsed.indexOf("serialNumber");
            parsed.splice(si >= 0 ? si + 1 : 0, 0, "grind");
            try {
              localStorage.setItem("glidr-raceski-form-fields", JSON.stringify(parsed));
              localStorage.setItem("glidr-raceski-grind-moved-v1", "1");
            } catch {}
          }
          // One-time migration: append newer fields (length, type of ski, where received)
          // for users whose saved config predates them, so they actually appear in the form.
          if (!localStorage.getItem("glidr-raceski-newfields-v1")) {
            for (const k of ["length", "typeOfSki", "whereReceived"]) {
              if (!parsed.includes(k)) parsed.push(k);
            }
            try {
              localStorage.setItem("glidr-raceski-form-fields", JSON.stringify(parsed));
              localStorage.setItem("glidr-raceski-newfields-v1", "1");
            } catch {}
          }
          return parsed;
        }
      }
    } catch {}
    return defaultFormFields;
  });
  const [editFormFieldsOpen, setEditFormFieldsOpen] = useState(false);
  const [newCustomFieldName, setNewCustomFieldName] = useState("");

  useEffect(() => {
    localStorage.setItem("glidr-raceski-form-fields", JSON.stringify(activeFormFields));
  }, [activeFormFields]);

  const inactiveFormFields = allSkiFormFields.filter((f) => !activeFormFields.includes(f.key));
  const getFormFieldLabel = (key: string) =>
    allSkiFormFields.find((f) => f.key === key)?.label ?? key;
  const isCustomField = (key: string) => !builtInKeys.includes(key);
  const moveFormFieldUp = (idx: number) => {
    if (idx <= 0) return;
    const next = [...activeFormFields];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setActiveFormFields(next);
  };
  const moveFormFieldDown = (idx: number) => {
    if (idx >= activeFormFields.length - 1) return;
    const next = [...activeFormFields];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setActiveFormFields(next);
  };
  const removeFormField = (key: string) => {
    setActiveFormFields(activeFormFields.filter((k) => k !== key));
  };
  const addFormField = (key: string) => {
    setActiveFormFields([...activeFormFields, key]);
  };
  const addCustomField = () => {
    const label = newCustomFieldName.trim();
    if (!label) return;
    const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    if (allSkiFormFields.some((f) => f.key === key)) return;
    setCustomFieldDefs([...customFieldDefs, { key, label }]);
    setActiveFormFields([...activeFormFields, key]);
    setNewCustomFieldName("");
  };
  const deleteCustomField = (key: string) => {
    setCustomFieldDefs(customFieldDefs.filter((f) => f.key !== key));
    setActiveFormFields(activeFormFields.filter((k) => k !== key));
  };

  const [regrindForm, setRegrindForm] = useState({
    date: new Date().toISOString().split("T")[0],
    grindType: "",
    stone: "",
    pattern: "",
    notes: "",
  });

  const [athleteForm, setAthleteForm] = useState({ name: "", team: "", brand: "", heightCm: "", weightKg: "", poleHeight: "", bindingPosition: "", skiServicePreferences: "" });
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ["/api/athletes"],
  });
  const athlete = athletes.find((a) => a.id === athleteId);

  const { data: skis = [] } = useQuery<RaceSki[]>({
    queryKey: [`/api/athletes/${athleteId}/skis`],
    enabled: !!athleteId,
  });

  const { data: raceHistory = [] } = useQuery<AthleteRaceHistory[]>({
    queryKey: [`/api/athletes/${athleteId}/race-history`],
    enabled: !!athleteId,
  });

  const { data: weatherList = [] } = useQuery<{ id: number; date: string; location: string; snowTemperatureC: number | null; airTemperatureC: number | null; snowHumidityPct: number | null; airHumidityPct: number | null; snowHumidityType: string | null; trackHardness: string | null }[]>({
    queryKey: ["/api/weather/for-filtering"],
  });

  const { data: allProducts = [] } = useQuery<{ id: number; brand: string; name: string; category: string }[]>({
    queryKey: ["/api/products"],
  });

  const { data: archivedSkis = [] } = useQuery<RaceSki[]>({
    queryKey: [`/api/athletes/${athleteId}/skis/archived`],
    enabled: !!athleteId && showArchivedSkis,
  });

  const { data: access = [] } = useQuery<AthleteAccess[]>({
    queryKey: [`/api/athletes/${athleteId}/access`],
    enabled: !!athleteId,
  });

  const { data: users = [] } = useQuery<UserItem[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  const { data: weather = [] } = useQuery<WeatherItem[]>({
    queryKey: ["/api/weather/for-filtering"],
  });

  const { data: allTests = [] } = useQuery<RaceSkiTest[]>({
    queryKey: ["/api/tests"],
    enabled: !!athleteId,
  });

  const skiIds = useMemo(() => new Set(skis.map((s) => s.id)), [skis]);

  // Fixed set of test columns mirroring ski properties + result columns
  const allTestColumns: { key: string; label: string }[] = [
    { key: "skiId", label: t("raceskis.skiId") },
    { key: "serialNumber", label: t("raceskis.serialNumber") },
    { key: "brand", label: L("Merke", "Brand") },
    { key: "discipline", label: t("raceskis.discipline") },
    { key: "construction", label: t("raceskis.construction") },
    { key: "mold", label: t("raceskis.mold") },
    { key: "base", label: t("raceskis.base") },
    { key: "grind", label: t("raceskis.grind") },
    { key: "heights", label: t("raceskis.heights") },
    { key: "year", label: "Year" },
    { key: "result", label: "Result (cm)" },
    { key: "rank", label: "Rank" },
    { key: "feeling", label: "Feeling" },
    { key: "methodology", label: "Methodology" },
  ];

  const raceSkiTests = useMemo(() => {
    return allTests.filter((t) => t.testSkiSource === "raceskis" && t.athleteId === Number(athleteId));
  }, [allTests, athleteId]);

  // Derived filter options for Ski Garage
  const garageDisciplineOptions = useMemo(() => {
    const vals = [...new Set(skis.map((s) => s.discipline).filter(Boolean))].sort();
    return vals;
  }, [skis]);
  const garageBrandOptions = useMemo(() => {
    const vals = [...new Set(skis.map((s) => s.brand).filter(Boolean) as string[])].sort();
    return vals;
  }, [skis]);
  const garageYearOptions = useMemo(() => {
    const vals = [...new Set(skis.map((s) => s.year).filter(Boolean) as string[])].sort((a, b) => b.localeCompare(a));
    return vals;
  }, [skis]);

  const filteredGarageSkis = useMemo(() => {
    let list = skis;
    if (garageDisciplineFilter !== "all") list = list.filter((s) => s.discipline === garageDisciplineFilter);
    if (garageBrandFilter !== "all") list = list.filter((s) => s.brand === garageBrandFilter);
    if (garageYearFilter !== "all") list = list.filter((s) => s.year === garageYearFilter);
    if (garageGrindFilter.trim()) {
      const q = garageGrindFilter.trim().toLowerCase();
      list = list.filter((s) => s.grind?.toLowerCase().includes(q));
    }
    if (garageRaValueFilter.trim()) {
      const q = garageRaValueFilter.trim().toLowerCase();
      list = list.filter((s) => {
        try {
          const cp = s.customParams ? JSON.parse(s.customParams) : {};
          return String(cp.ra_value ?? "").toLowerCase().includes(q);
        } catch { return false; }
      });
    }
    if (garageColorFilter.length > 0) {
      list = list.filter((s) => garageColorFilter.includes(getSkiColor(s)));
    }
    if (garageRaSort !== "none") {
      const [key, dir] = garageRaSort.split("|");
      list = [...list].sort((a, b) => {
        const av = garageSortValue(a, key), bv = garageSortValue(b, key);
        const cmp = (typeof av === "number" && typeof bv === "number") ? av - bv : String(av).localeCompare(String(bv));
        return dir === "desc" ? -cmp : cmp;
      });
    }
    return list;
  }, [skis, garageDisciplineFilter, garageBrandFilter, garageYearFilter, garageGrindFilter, garageRaValueFilter, garageColorFilter, garageRaSort]);

  function setGarageView(mode: "grid" | "list") {
    setGarageViewMode(mode);
    try { localStorage.setItem("glidr-garage-view-mode", mode); } catch {}
  }
  // Click a list-view column header to sort by it (toggles asc/desc).
  function toggleColSort(col: string) {
    setGarageRaSort((prev) => {
      const [k, d] = prev.split("|");
      return k === col ? `${col}|${d === "asc" ? "desc" : "asc"}` : `${col}|asc`;
    });
  }
  function sortArrow(col: string) {
    const [k, d] = garageRaSort.split("|");
    if (k !== col) return "";
    return d === "desc" ? " ↓" : " ↑";
  }

  const isOwnerOrAdmin =
    user?.isAdmin || user?.isTeamAdmin || (athlete && user?.id === athlete.createdById);
  const hasAthleteAccess = isOwnerOrAdmin || access.some((a) => a.userId === user?.id);

  // Import CSV state
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvPreviewRows, setCsvPreviewRows] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvImportProgress, setCsvImportProgress] = useState<{ done: number; total: number } | null>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

  function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return obj;
    });
    return { headers, rows };
  }

  async function handleCsvImport() {
    if (csvPreviewRows.length === 0 || !athleteId) return;
    setCsvImportProgress({ done: 0, total: csvPreviewRows.length });
    let done = 0;
    for (const row of csvPreviewRows) {
      try {
        await apiRequest("POST", `/api/athletes/${athleteId}/skis`, {
          skiId: row.skiId || row["ski_id"] || row["Ski ID"] || "",
          brand: row.brand || row.Brand || null,
          discipline: row.discipline || row.Discipline || "Classic",
          base: row.base || row.Base || null,
          grind: row.grind || row.Grind || null,
          construction: row.construction || row.Construction || null,
          mold: row.mold || row.Mold || null,
          heights: row.heights || row.Heights || null,
          year: row.year || row.Year || null,
          serialNumber: row.serialNumber || row.serial_number || row.SerialNumber || null,
          customParams: null,
        });
      } catch {}
      done++;
      setCsvImportProgress({ done, total: csvPreviewRows.length });
    }
    queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
    toast({ title: `Imported ${done} skis` });
    setCsvImportOpen(false);
    setCsvPreviewRows([]);
    setCsvHeaders([]);
    setCsvImportProgress(null);
  }

  // Audit log: fire-and-forget helper
  function logAction(action: string, details: string) {
    fetch("/api/action-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, details }),
    }).catch(() => {});
  }

  const [testDateFilter, setTestDateFilter] = useState<string>("all");
  const [testTypeFilter, setTestTypeFilter] = useState<string>("all");
  const [testSortBy, setTestSortBy] = useState<string>("date-desc");

  const [testLocationFilter, setTestLocationFilter] = useState("");
  const [testSeasonFilter, setTestSeasonFilter] = useState("all");
  const [testDateFrom, setTestDateFrom] = useState("");
  const [testDateTo, setTestDateTo] = useState("");
  const [quickTestDayDate, setQuickTestDayDate] = useState("");
  const [testAirTempMin, setTestAirTempMin] = useState("");
  const [testAirTempMax, setTestAirTempMax] = useState("");
  const [testSnowTempMin, setTestSnowTempMin] = useState("");
  const [testSnowTempMax, setTestSnowTempMax] = useState("");
  const [testAirHumMin, setTestAirHumMin] = useState("");
  const [testAirHumMax, setTestAirHumMax] = useState("");
  const [testSnowHumMin, setTestSnowHumMin] = useState("");
  const [testSnowHumMax, setTestSnowHumMax] = useState("");
  const [testTrackHardness, setTestTrackHardness] = useState("");
  const [testSnowHumidityType, setTestSnowHumidityType] = useState("");
  const [testGrainSize, setTestGrainSize] = useState("");
  const [testArtSnow, setTestArtSnow] = useState("");
  const [testNatSnow, setTestNatSnow] = useState("");
  const [testPrecipitation, setTestPrecipitation] = useState("");
  const [testWind, setTestWind] = useState("");
  const [testVisibility, setTestVisibility] = useState("");
  const [testCloudMin, setTestCloudMin] = useState("");
  const [testCloudMax, setTestCloudMax] = useState("");
  const [showTestWeatherFilters, setShowTestWeatherFilters] = useState(false);

  // ── Race history filters ──────────────────────────────────────────────────
  const [raceLocationFilter, setRaceLocationFilter] = useState("");
  const [raceSeasonFilter, setRaceSeasonFilter] = useState("all");
  const [raceDateFrom, setRaceDateFrom] = useState("");
  const [raceDateTo, setRaceDateTo] = useState("");
  const [raceAirTempMin, setRaceAirTempMin] = useState("");
  const [raceAirTempMax, setRaceAirTempMax] = useState("");
  const [raceSnowTempMin, setRaceSnowTempMin] = useState("");
  const [raceSnowTempMax, setRaceSnowTempMax] = useState("");
  const [raceAirHumMin, setRaceAirHumMin] = useState("");
  const [raceAirHumMax, setRaceAirHumMax] = useState("");
  const [raceSnowHumMin, setRaceSnowHumMin] = useState("");
  const [raceSnowHumMax, setRaceSnowHumMax] = useState("");
  const [raceSnowType, setRaceSnowType] = useState("");
  const [raceTrackHardness, setRaceTrackHardness] = useState("");
  const [raceSnowHumidityType, setRaceSnowHumidityType] = useState("");
  const [raceGrainSize, setRaceGrainSize] = useState("");
  const [raceArtSnow, setRaceArtSnow] = useState("");
  const [raceNatSnow, setRaceNatSnow] = useState("");
  const [racePrecipitation, setRacePrecipitation] = useState("");
  const [raceWind, setRaceWind] = useState("");
  const [raceVisibility, setRaceVisibility] = useState("");
  const [raceCloudMin, setRaceCloudMin] = useState("");
  const [raceCloudMax, setRaceCloudMax] = useState("");
  const [showRaceWeatherFilters, setShowRaceWeatherFilters] = useState(false);
  const [raceViewMode, setRaceViewMode] = useState<"card" | "compact">(() => {
    try {
      const v = localStorage.getItem("glidr-race-view-mode");
      if (v === "compact" || v === "card") return v;
    } catch {}
    return "card";
  });
  function setRaceView(mode: "card" | "compact") {
    setRaceViewMode(mode);
    try { localStorage.setItem("glidr-race-view-mode", mode); } catch {}
  }

  const testDates = useMemo(() => {
    const dates = [...new Set(raceSkiTests.map((t) => t.date))].sort((a, b) => b.localeCompare(a));
    return dates;
  }, [raceSkiTests]);

  const dateLabelMap = useMemo(() => {
    const locale = language === "no" ? "nb-NO" : "en-US";
    const map = new Map<string, string>();
    for (const d of testDates) {
      const weekday = new Date(d + "T12:00:00").toLocaleDateString(locale, { weekday: "long" });
      const locs = [...new Set(raceSkiTests.filter((test) => test.date === d).map((test) => test.location))];
      const loc = locs.length > 0 ? locs[0] : "";
      map.set(d, [fmtDate(d), weekday, loc].filter(Boolean).join("  "));
    }
    return map;
  }, [testDates, language, raceSkiTests]);

  const testWeatherById = useMemo(() => new Map(weather.map(w => [w.id, w])), [weather]);

  const testAvailableSeasons = useMemo(() => {
    const s = new Set(raceSkiTests.map(t => {
      const d = new Date(t.date); const m = d.getMonth(); const y = d.getFullYear();
      return m >= 4 ? `${y}/${y+1}` : `${y-1}/${y}`;
    }));
    return Array.from(s).sort().reverse();
  }, [raceSkiTests]);

  const filteredTests = useMemo(() => {
    let list = raceSkiTests;
    if (testDateFilter !== "all") list = list.filter((t) => t.date === testDateFilter);
    if (testTypeFilter !== "all") list = list.filter((t) => t.testType === testTypeFilter);
    if (testLocationFilter) list = list.filter(t => t.location.toLowerCase().includes(testLocationFilter.toLowerCase()));
    if (testSeasonFilter !== "all") {
      list = list.filter(t => {
        const d = new Date(t.date); const m = d.getMonth(); const y = d.getFullYear();
        const season = m >= 4 ? `${y}/${y+1}` : `${y-1}/${y}`;
        return season === testSeasonFilter;
      });
    }
    if (quickTestDayDate) { list = list.filter(t => t.date === quickTestDayDate); }
    else {
      if (testDateFrom) list = list.filter(t => t.date >= testDateFrom);
      if (testDateTo) list = list.filter(t => t.date <= testDateTo);
    }
    const hasWeatherFilter = testAirTempMin || testAirTempMax || testSnowTempMin || testSnowTempMax || testAirHumMin || testAirHumMax || testSnowHumMin || testSnowHumMax || testTrackHardness || testSnowHumidityType || testGrainSize || testArtSnow || testNatSnow || testPrecipitation || testWind || testVisibility || testCloudMin || testCloudMax;
    if (hasWeatherFilter) {
      list = list.filter(t => {
        const w = t.weatherId ? testWeatherById.get(t.weatherId) : null;
        if (!w) return false;
        // Auto-swap if user enters min > max (handles negative temperature confusion)
        const airMinRaw = testAirTempMin !== "" ? parseFloat(testAirTempMin) : null;
        const airMaxRaw = testAirTempMax !== "" ? parseFloat(testAirTempMax) : null;
        const snowMinRaw = testSnowTempMin !== "" ? parseFloat(testSnowTempMin) : null;
        const snowMaxRaw = testSnowTempMax !== "" ? parseFloat(testSnowTempMax) : null;
        const [airMin, airMax] = airMinRaw != null && airMaxRaw != null && airMinRaw > airMaxRaw ? [airMaxRaw, airMinRaw] : [airMinRaw, airMaxRaw];
        const [snowMin, snowMax] = snowMinRaw != null && snowMaxRaw != null && snowMinRaw > snowMaxRaw ? [snowMaxRaw, snowMinRaw] : [snowMinRaw, snowMaxRaw];
        if (airMin != null && (w.airTemperatureC == null || w.airTemperatureC < airMin)) return false;
        if (airMax != null && (w.airTemperatureC == null || w.airTemperatureC > airMax)) return false;
        if (snowMin != null && (w.snowTemperatureC == null || w.snowTemperatureC < snowMin)) return false;
        if (snowMax != null && (w.snowTemperatureC == null || w.snowTemperatureC > snowMax)) return false;
        const [tAhMin, tAhMax] = (() => { const a = testAirHumMin ? parseFloat(testAirHumMin) : null, b = testAirHumMax ? parseFloat(testAirHumMax) : null; return a != null && b != null && a > b ? [b, a] : [a, b]; })();
        const [tShMin, tShMax] = (() => { const a = testSnowHumMin ? parseFloat(testSnowHumMin) : null, b = testSnowHumMax ? parseFloat(testSnowHumMax) : null; return a != null && b != null && a > b ? [b, a] : [a, b]; })();
        const [tClMin, tClMax] = (() => { const a = testCloudMin !== "" ? parseFloat(testCloudMin) : null, b = testCloudMax !== "" ? parseFloat(testCloudMax) : null; return a != null && b != null && a > b ? [b, a] : [a, b]; })();
        if (tAhMin != null && (w.airHumidityPct == null || w.airHumidityPct < tAhMin)) return false;
        if (tAhMax != null && (w.airHumidityPct == null || w.airHumidityPct > tAhMax)) return false;
        if (tShMin != null && (w.snowHumidityPct == null || w.snowHumidityPct < tShMin)) return false;
        if (tShMax != null && (w.snowHumidityPct == null || w.snowHumidityPct > tShMax)) return false;
        if (testArtSnow && !(w?.artificialSnow ?? "").toLowerCase().includes(testArtSnow.toLowerCase())) return false;
        if (testNatSnow && !(w?.naturalSnow ?? "").toLowerCase().includes(testNatSnow.toLowerCase())) return false;
        if (testTrackHardness && !(w?.trackHardness ?? "").toLowerCase().includes(testTrackHardness.toLowerCase())) return false;
        if (testSnowHumidityType && !(w?.snowHumidityType ?? "").toLowerCase().includes(testSnowHumidityType.toLowerCase())) return false;
        if (testGrainSize && !(w?.grainSize ?? "").toLowerCase().includes(testGrainSize.toLowerCase())) return false;
        if (testPrecipitation && !(w?.precipitation ?? "").toLowerCase().includes(testPrecipitation.toLowerCase())) return false;
        if (testWind && !(w?.wind ?? "").toLowerCase().includes(testWind.toLowerCase())) return false;
        if (testVisibility && !(w?.visibility ?? "").toLowerCase().includes(testVisibility.toLowerCase())) return false;
        if (tClMin != null && (w?.clouds == null || w.clouds < tClMin)) return false;
        if (tClMax != null && (w?.clouds == null || w.clouds > tClMax)) return false;
        return true;
      });
    }
    list = [...list].sort((a, b) => {
      switch (testSortBy) {
        case "date-asc": return a.date.localeCompare(b.date);
        case "date-desc": return b.date.localeCompare(a.date);
        case "location-asc": return a.location.localeCompare(b.location);
        case "location-desc": return b.location.localeCompare(a.location);
        default: return b.date.localeCompare(a.date);
      }
    });
    return list;
  }, [raceSkiTests, testDateFilter, testTypeFilter, testSortBy, testLocationFilter, testSeasonFilter, quickTestDayDate, testDateFrom, testDateTo, testAirTempMin, testAirTempMax, testSnowTempMin, testSnowTempMax, testAirHumMin, testAirHumMax, testSnowHumMin, testSnowHumMax, testTrackHardness, testSnowHumidityType, testGrainSize, testArtSnow, testNatSnow, testPrecipitation, testWind, testVisibility, testCloudMin, testCloudMax, testWeatherById]);

  // Full weather map (WeatherItem with all fields) for race history
  const raceWeatherById = useMemo(() => new Map(weather.map(w => [w.id, w])), [weather]);

  const raceAvailableSeasons = useMemo(() => {
    const s = new Set(raceHistory.map(r => {
      const d = new Date(r.date); const m = d.getMonth(); const y = d.getFullYear();
      return m >= 4 ? `${y}/${y+1}` : `${y-1}/${y}`;
    }));
    return Array.from(s).sort().reverse();
  }, [raceHistory]);

  const filteredRaceHistory = useMemo(() => {
    let list = raceHistory;
    if (raceLocationFilter) list = list.filter(r => r.location.toLowerCase().includes(raceLocationFilter.toLowerCase()));
    if (raceSeasonFilter !== "all") {
      list = list.filter(r => {
        const d = new Date(r.date); const m = d.getMonth(); const y = d.getFullYear();
        const season = m >= 4 ? `${y}/${y+1}` : `${y-1}/${y}`;
        return season === raceSeasonFilter;
      });
    }
    if (raceDateFrom) list = list.filter(r => r.date >= raceDateFrom);
    if (raceDateTo) list = list.filter(r => r.date <= raceDateTo);
    const hasWFilter = raceAirTempMin || raceAirTempMax || raceSnowTempMin || raceSnowTempMax ||
      raceAirHumMin || raceAirHumMax || raceSnowHumMin || raceSnowHumMax || raceSnowType || raceTrackHardness ||
      raceSnowHumidityType || raceGrainSize || raceArtSnow || raceNatSnow || racePrecipitation || raceWind || raceVisibility || raceCloudMin || raceCloudMax;
    if (hasWFilter) {
      list = list.filter(r => {
        const w = r.weatherId ? raceWeatherById.get(r.weatherId) : null;
        if (!w) return false;
        const airMinRaw = raceAirTempMin !== "" ? parseFloat(raceAirTempMin) : null;
        const airMaxRaw = raceAirTempMax !== "" ? parseFloat(raceAirTempMax) : null;
        const snowMinRaw = raceSnowTempMin !== "" ? parseFloat(raceSnowTempMin) : null;
        const snowMaxRaw = raceSnowTempMax !== "" ? parseFloat(raceSnowTempMax) : null;
        const [airMin, airMax] = airMinRaw != null && airMaxRaw != null && airMinRaw > airMaxRaw ? [airMaxRaw, airMinRaw] : [airMinRaw, airMaxRaw];
        const [snowMin, snowMax] = snowMinRaw != null && snowMaxRaw != null && snowMinRaw > snowMaxRaw ? [snowMaxRaw, snowMinRaw] : [snowMinRaw, snowMaxRaw];
        if (airMin != null && (w.airTemperatureC == null || w.airTemperatureC < airMin)) return false;
        if (airMax != null && (w.airTemperatureC == null || w.airTemperatureC > airMax)) return false;
        if (snowMin != null && (w.snowTemperatureC == null || w.snowTemperatureC < snowMin)) return false;
        if (snowMax != null && (w.snowTemperatureC == null || w.snowTemperatureC > snowMax)) return false;
        const [rAhMin, rAhMax] = (() => { const a = raceAirHumMin ? parseFloat(raceAirHumMin) : null, b = raceAirHumMax ? parseFloat(raceAirHumMax) : null; return a != null && b != null && a > b ? [b, a] : [a, b]; })();
        const [rShMin, rShMax] = (() => { const a = raceSnowHumMin ? parseFloat(raceSnowHumMin) : null, b = raceSnowHumMax ? parseFloat(raceSnowHumMax) : null; return a != null && b != null && a > b ? [b, a] : [a, b]; })();
        const [rClMin, rClMax] = (() => { const a = raceCloudMin !== "" ? parseFloat(raceCloudMin) : null, b = raceCloudMax !== "" ? parseFloat(raceCloudMax) : null; return a != null && b != null && a > b ? [b, a] : [a, b]; })();
        if (rAhMin != null && (w.airHumidityPct == null || w.airHumidityPct < rAhMin)) return false;
        if (rAhMax != null && (w.airHumidityPct == null || w.airHumidityPct > rAhMax)) return false;
        if (rShMin != null && (w.snowHumidityPct == null || w.snowHumidityPct < rShMin)) return false;
        if (rShMax != null && (w.snowHumidityPct == null || w.snowHumidityPct > rShMax)) return false;
        if (raceSnowType && !(w.snowType ?? "").toLowerCase().includes(raceSnowType.toLowerCase())) return false;
        if (raceTrackHardness && !(w.trackHardness ?? "").toLowerCase().includes(raceTrackHardness.toLowerCase())) return false;
        if (raceArtSnow && !(w?.artificialSnow ?? "").toLowerCase().includes(raceArtSnow.toLowerCase())) return false;
        if (raceNatSnow && !(w?.naturalSnow ?? "").toLowerCase().includes(raceNatSnow.toLowerCase())) return false;
        if (raceSnowHumidityType && !(w?.snowHumidityType ?? "").toLowerCase().includes(raceSnowHumidityType.toLowerCase())) return false;
        if (raceGrainSize && !(w?.grainSize ?? "").toLowerCase().includes(raceGrainSize.toLowerCase())) return false;
        if (racePrecipitation && !(w?.precipitation ?? "").toLowerCase().includes(racePrecipitation.toLowerCase())) return false;
        if (raceWind && !(w?.wind ?? "").toLowerCase().includes(raceWind.toLowerCase())) return false;
        if (raceVisibility && !(w?.visibility ?? "").toLowerCase().includes(raceVisibility.toLowerCase())) return false;
        if (rClMin != null && (w?.clouds == null || w.clouds < rClMin)) return false;
        if (rClMax != null && (w?.clouds == null || w.clouds > rClMax)) return false;
        return true;
      });
    }
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [raceHistory, raceLocationFilter, raceSeasonFilter, raceDateFrom, raceDateTo,
      raceAirTempMin, raceAirTempMax, raceSnowTempMin, raceSnowTempMax,
      raceAirHumMin, raceAirHumMax, raceSnowHumMin, raceSnowHumMax,
      raceSnowType, raceTrackHardness, raceSnowHumidityType, raceGrainSize, raceArtSnow, raceNatSnow,
      racePrecipitation, raceWind, raceVisibility, raceCloudMin, raceCloudMax, raceWeatherById]);

  function buildSkiBody(data: typeof skiForm) {
    const cp: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(customFieldValues)) {
      if (v.trim()) cp[k] = v.trim();
    }
    if (data.color && data.color !== "none") {
      cp._color = data.color;
    }
    return {
      skiId: data.skiId,
      serialNumber: data.serialNumber.trim() || null,
      brand: data.brand.trim() || null,
      discipline: data.discipline,
      construction: data.construction.trim() || null,
      mold: data.mold.trim() || null,
      base: data.base.trim() || null,
      grind: data.grind.trim() || null,
      heights: data.discipline === "Classic" ? data.heights.trim() || null : null,
      year: data.year.trim() || null,
      length: data.length.trim() || null,
      typeOfSki: data.typeOfSki.trim() || null,
      whereReceived: data.whereReceived.trim() || null,
      notes: data.notes.trim() || null,
      isTrainingSki: data.isTrainingSki ? 1 : 0,
      customParams: Object.keys(cp).length > 0 ? JSON.stringify(cp) : null,
    };
  }

  const createSkiMutation = useMutation({
    mutationFn: async (data: typeof skiForm) => {
      const res = await apiRequest("POST", `/api/athletes/${athleteId}/skis`, buildSkiBody(data));
      return res.json();
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: L("Ski lagt til", "Ski added") });
      setSkiDialogOpen(false);
      resetSkiForm();
      setCustomFieldValues({});
      logAction("create_ski", `Added ski ${data.skiId} to athlete ${athleteId}`);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateSkiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof skiForm }) => {
      const res = await apiRequest("PUT", `/api/race-skis/${id}`, buildSkiBody(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: L("Ski oppdatert", "Ski updated") });
      setSkiDialogOpen(false);
      setEditingSki(null);
      resetSkiForm();
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteSkiMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/race-skis/${id}`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis/archived`] });
      toast({ title: "Ski permanently deleted" });
      logAction("delete_ski", `Deleted ski ${id} from athlete ${athleteId}`);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const archiveSkiMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/race-skis/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis/archived`] });
      toast({ title: "Ski archived" });
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const restoreSkiMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/race-skis/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis/archived`] });
      toast({ title: "Ski restored" });
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const createRegrindMutation = useMutation({
    mutationFn: async ({ skiId, data }: { skiId: number; data: typeof regrindForm }) => {
      const body = {
        date: data.date,
        grindType: data.grindType,
        stone: data.stone.trim() || null,
        pattern: data.pattern.trim() || null,
        notes: data.notes.trim() || null,
      };
      const res = await apiRequest("POST", `/api/race-skis/${skiId}/regrinds`, body);
      return res.json();
    },
    onSuccess: () => {
      if (regrindSkiId) {
        queryClient.invalidateQueries({ queryKey: [`/api/race-skis/${regrindSkiId}/regrinds`] });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: "Regrind added" });
      setRegrindDialogOpen(false);
      resetRegrindForm();
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteRegrindMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/race-ski-regrinds/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/race-skis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      if (expandedSkiId) {
        queryClient.invalidateQueries({ queryKey: [`/api/race-skis/${expandedSkiId}/regrinds`] });
      }
      toast({ title: "Regrind deleted" });
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateAccessMutation = useMutation({
    mutationFn: async (userIds: number[]) => {
      const res = await apiRequest("PUT", `/api/athletes/${athleteId}/access`, { userIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/access`] });
      toast({ title: "Access updated" });
      setAccessDialogOpen(false);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateAthleteMutation = useMutation({
    mutationFn: async (data: { name: string; team: string; brand: string; heightCm: string; weightKg: string; poleHeight: string; bindingPosition: string; skiServicePreferences: string }) => {
      const res = await apiRequest("PUT", `/api/athletes/${athleteId}`, {
        name: data.name,
        team: data.team.trim() || null,
        defaultSkiBrand: data.brand.trim() || null,
        heightCm: data.heightCm.trim() || null,
        weightKg: data.weightKg.trim() || null,
        poleHeight: data.poleHeight.trim() || null,
        bindingPosition: data.bindingPosition.trim() || null,
        skiServicePreferences: data.skiServicePreferences.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/athletes"] });
      toast({ title: L("Utøver oppdatert", "Athlete updated") });
      setEditAthleteOpen(false);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteAthleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/athletes/${athleteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/athletes"] });
      toast({ title: "Athlete deleted" });
      navigate("/raceskis");
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const createTestMutation = useMutation({
    mutationFn: async () => {
      const entries = testRows.map((row, idx) => ({
        skiNumber: idx + 1,
        raceSkiId: row.raceSkiId,
        productId: null,
        methodology: "",
        result0kmCmBehind: row.roundResults[0]?.result ?? null,
        rank0km: row.roundResults[0]?.rank ?? null,
        results: JSON.stringify(row.roundResults),
        feelingRank: row.feelingRank ?? null,
        kickRank: row.kickRank ?? null,
      }));
      const groupScope = user?.groupScope?.split(",")[0]?.trim() || "";
      const payload = {
        date: testForm.date,
        location: testForm.location.trim(),
        testType: testForm.testType,
        testSkiSource: "raceskis",
        seriesId: null,
        athleteId: Number(athleteId),
        weatherId: resolvedWeatherId || null,
        notes: testForm.notes.trim() || null,
        distanceLabels: JSON.stringify(distanceLabels),
        groupScope,
        entries,
      };
      if (!isOnline) {
        await queueMutation("POST", "/api/tests", payload, "Create race ski test");
        return { queued: true };
      }
      const res = await apiRequest("POST", "/api/tests", payload);
      return res.json();
    },
    onSuccess: (data) => {
      if (!(data as any)?.queued) {
        queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
        logAction("create_test", `Created test at ${testForm.location} on ${testForm.date} for athlete ${athleteId}`);
      }
      toast({ title: (data as any)?.queued ? "Test queued (offline)" : "Test saved" });
      setShowTestForm(false);
      setTestForm({ date: new Date().toISOString().split("T")[0], location: "", testType: "Classic" as any, notes: "", weatherId: undefined });
      setSelectedSkiIds(new Set());
      setDistanceLabels([""]);
      setTestRows([]);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  function resetSkiForm() {
    setSkiForm({ skiId: "", serialNumber: "", brand: "", discipline: "Classic", construction: "", mold: "", base: "", grind: "", heights: "", year: "", length: "", typeOfSki: "", whereReceived: "", notes: "", isTrainingSki: false, color: "" });
  }

  function resetRegrindForm() {
    setRegrindForm({ date: new Date().toISOString().split("T")[0], grindType: "", stone: "", pattern: "", notes: "" });
  }

  function openEditSki(ski: RaceSki) {
    setEditingSki(ski);
    let parsedColor = "";
    try {
      const cp = ski.customParams ? JSON.parse(ski.customParams) : {};
      parsedColor = cp._color || "";
      // strip _color from custom fields shown in UI
      const { _color: _c, ...rest } = cp;
      setCustomFieldValues(rest);
    } catch {
      setCustomFieldValues({});
    }
    setSkiForm({
      skiId: ski.skiId,
      serialNumber: ski.serialNumber || "",
      brand: ski.brand || "",
      discipline: ski.discipline,
      construction: ski.construction || "",
      mold: ski.mold || "",
      base: ski.base || "",
      grind: ski.grind || "",
      heights: ski.heights || "",
      year: ski.year || "",
      length: ski.length || "",
      typeOfSki: ski.typeOfSki || "",
      whereReceived: ski.whereReceived || "",
      notes: ski.notes || "",
      isTrainingSki: ski.isTrainingSki === 1,
      color: parsedColor,
    });
    setSkiDialogOpen(true);
  }

  function openAddSki() {
    setEditingSki(null);
    resetSkiForm();
    // Pre-fill the athlete's default ski brand so it carries into every new pair.
    if (athlete?.defaultSkiBrand) {
      setSkiForm((f) => ({ ...f, brand: athlete.defaultSkiBrand || "" }));
    }
    setCustomFieldValues({});
    setSkiDialogOpen(true);
  }

  function openRegrind(skiId: number) {
    setRegrindSkiId(skiId);
    resetRegrindForm();
    setRegrindDialogOpen(true);
  }

  function openAccessDialog() {
    setSelectedUserIds(access.map((a) => a.userId));
    setAccessDialogOpen(true);
  }

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCopied, setFeedbackCopied] = useState(false);
  const { data: feedbackLink } = useQuery<{ token: string | null }>({
    queryKey: [`/api/athletes/${athleteId}/feedback-link`],
    enabled: !!athleteId && hasAthleteAccess && !isAthletePortal,
  });
  const createFeedbackLink = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", `/api/athletes/${athleteId}/feedback-link`); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/feedback-link`] }); setFeedbackOpen(true); },
  });
  const revokeFeedbackLink = useMutation({
    mutationFn: async () => { await apiRequest("POST", `/api/athletes/${athleteId}/feedback-link/revoke`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/feedback-link`] }); setFeedbackOpen(false); },
  });
  const feedbackUrl = feedbackLink?.token ? `${typeof window !== "undefined" ? window.location.origin : ""}/feedback/${feedbackLink.token}` : "";

  function openEditAthlete() {
    if (athlete) {
      setAthleteForm({
        name: athlete.name, team: athlete.team || "", brand: athlete.defaultSkiBrand || "",
        heightCm: athlete.heightCm || "", weightKg: athlete.weightKg || "",
        poleHeight: athlete.poleHeight || "", bindingPosition: athlete.bindingPosition || "",
        skiServicePreferences: athlete.skiServicePreferences || "",
      });
      setEditAthleteOpen(true);
    }
  }

  // ── PDF Export ───────────────────────────────────────────────────────────────
  const [exportPdfOpen, setExportPdfOpen] = useState(false);
  const [exportSections, setExportSections] = useState({
    inventory: true,
    tests: true,
    grindHistory: true,
    summary: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  // Which ski parameters (columns) to include in the inventory table. Default = on.
  const [exportSkiParams, setExportSkiParams] = useState<Record<string, boolean>>({});
  const includeParam = (key: string) => exportSkiParams[key] !== false;
  const customSkiParamKeys = useMemo(() => {
    const set = new Set<string>();
    skis.forEach((s) => { try { const cp = s.customParams ? JSON.parse(s.customParams) : {}; Object.keys(cp).filter((k) => !k.startsWith("_")).forEach((k) => set.add(k)); } catch {} });
    return Array.from(set);
  }, [skis]);

  // ── Ski Garage list columns (all parameters, sortable + toggleable) ──────────
  const garageColumns = useMemo(() => {
    const std: { key: string; label: string }[] = [
      { key: "color", label: L("Farge", "Colour") },
      { key: "serialNumber", label: L("Serienr.", "Serial") },
      { key: "brand", label: L("Merke", "Brand") },
      { key: "discipline", label: L("Stilart", "Discipline") },
      { key: "construction", label: L("Konstruksjon", "Construction") },
      { key: "mold", label: L("Form", "Mold") },
      { key: "base", label: L("Såle", "Base") },
      { key: "grind", label: L("Slip", "Grind") },
      { key: "heights", label: L("Høyder", "Heights") },
      { key: "year", label: L("År", "Year") },
      { key: "length", label: L("Lengde", "Length") },
      { key: "typeOfSki", label: L("Skitype", "Ski type") },
      { key: "whereReceived", label: L("Mottatt fra", "Where received") },
    ];
    const cols = [...std];
    // RA-value and any other custom params, derived from the data.
    if (customSkiParamKeys.includes("ra_value")) cols.push({ key: "ra", label: "RA-Value" });
    for (const k of customSkiParamKeys) {
      if (k === "ra_value") continue;
      cols.push({ key: `cp:${k}`, label: k.replace(/^custom_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
    }
    return cols;
  }, [customSkiParamKeys, language]);

  // Columns that actually have data entered — used as the default visible set.
  const garageEnteredKeys = useMemo(
    () => garageColumns.filter((c) => skis.some((s) => garageCellValue(s, c.key) !== "—")).map((c) => c.key),
    [garageColumns, skis]
  );
  const garageVisibleKeys = garageColPref ?? garageEnteredKeys;
  const visibleGarageColumns = garageColumns.filter((c) => garageVisibleKeys.includes(c.key));
  function toggleGarageCol(key: string) {
    setGarageColPref((prev) => {
      const base = prev ?? garageEnteredKeys;
      const next = base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
      try { localStorage.setItem("glidr-garage-cols-v1", JSON.stringify(next)); } catch {}
      return next;
    });
  }
  const pdfParamDefs: { key: string; label: string }[] = [
    { key: "brand", label: L("Merke", "Brand") },
    { key: "discipline", label: L("Stilart", "Discipline") },
    { key: "base", label: L("Såle", "Base") },
    { key: "grind", label: L("Slip", "Grind") },
    { key: "construction", label: L("Konstruksjon", "Construction") },
    { key: "mold", label: L("Form", "Mold") },
    { key: "heights", label: L("Høyder", "Heights") },
    { key: "year", label: L("Årgang", "Year") },
    { key: "length", label: L("Lengde", "Length") },
    { key: "typeOfSki", label: L("Skitype", "Ski type") },
    { key: "whereReceived", label: L("Mottatt fra", "Where received") },
    { key: "serialNumber", label: L("Serienr.", "Serial #") },
    { key: "notes", label: L("Notat", "Note") },
    ...customSkiParamKeys.map((k) => ({ key: k, label: k.replace(/^custom_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) })),
  ];

  function toggleExportSection(key: keyof typeof exportSections) {
    setExportSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleExportPDF() {
    if (!athlete) return;
    setIsExporting(true);
    // Open the window BEFORE any async work so popup blockers don't intervene
    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: L("Sprettvindu blokkert", "Popup blocked"), description: L("Tillat sprettvinduer for glidr.no for å eksportere PDF.", "Allow popups for glidr.no to export PDF."), variant: "destructive" });
      setIsExporting(false);
      setExportPdfOpen(false);
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Generating…</title></head><body style="font-family:system-ui,sans-serif;padding:32px;color:#374151"><p>⏳ Generating report, please wait…</p></body></html>`);
    try {
      // Fetch regrinds for every ski in parallel
      const regrindsBySkiId: Record<number, RaceSkiRegrind[]> = {};
      await Promise.all(
        skis.map(async (ski) => {
          try {
            const res = await fetch(`/api/race-skis/${ski.id}/regrinds`, { credentials: "include" });
            if (res.ok) regrindsBySkiId[ski.id] = await res.json();
          } catch {}
        })
      );

      // Fetch entries for every test in parallel
      const entriesByTestId: Record<number, TestEntry[]> = {};
      await Promise.all(
        raceSkiTests.map(async (test) => {
          try {
            const res = await fetch(`/api/tests/${test.id}/entries`, { credentials: "include" });
            if (res.ok) entriesByTestId[test.id] = await res.json();
          } catch {}
        })
      );

      const skiMap = new Map(skis.map((s) => [s.id, s]));

      // ── Build body using shared pdf-layout helpers ────────────────────────
      const sections: string[] = [];

      // ── Performance Summary ──────────────────────────────────────────────
      if (exportSections.summary) {
        const totalTests = raceSkiTests.length;
        const totalSkis = skis.length;
        const allEntries = Object.values(entriesByTestId).flat();
        const rankedEntries = allEntries.filter((e) => e.rank0km != null);
        const topRanks = rankedEntries.filter((e) => (e.rank0km ?? 99) <= 3).length;
        const avgRank = rankedEntries.length > 0
          ? (rankedEntries.reduce((s, e) => s + (e.rank0km ?? 0), 0) / rankedEntries.length).toFixed(1)
          : "—";

        sections.push(
          pdfSection("Performance Summary") +
          pdfCards([
            { value: totalSkis, label: "Total Skis" },
            { value: totalTests, label: "Total Tests" },
            { value: avgRank, label: "Avg Rank" },
            { value: topRanks, label: "Top-3 Results" },
          ])
        );
      }

      // ── Ski Inventory ────────────────────────────────────────────────────
      if (exportSections.inventory && skis.length > 0) {
        const selDefs = pdfParamDefs.filter((d) => includeParam(d.key));
        const getVal = (s: RaceSki, key: string): string => {
          if (key === "notes") return s.notes || "";
          if (key in s && (s as any)[key] != null) return String((s as any)[key]);
          try { const cp = s.customParams ? JSON.parse(s.customParams) : {}; return cp[key] != null ? String(cp[key]) : ""; } catch { return ""; }
        };
        const headers = [L("Ski-ID", "Ski ID"), ...selDefs.map((d) => d.label)];
        const rows = skis.map((s) => [s.skiId, ...selDefs.map((d) => getVal(s, d.key) || "—")]);
        sections.push(
          pdfSection(L("Skioversikt", "Ski Inventory")) +
          pdfTable(headers, rows)
        );
      }

      // ── Test Results ─────────────────────────────────────────────────────
      if (exportSections.tests && raceSkiTests.length > 0) {
        const testBlocks = [...raceSkiTests]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((t) => {
            const entries = entriesByTestId[t.id] ?? [];
            const weath = weather.find((w) => w.id === t.weatherId);

            const entryRows = entries.map((e) => {
              const ski = skiMap.get(e.raceSkiId ?? -1);
              return [
                ski?.skiId ?? `#${e.skiNumber}`,
                ski?.brand ?? null,
                ski?.grind ?? null,
                e.result0kmCmBehind != null ? `${e.result0kmCmBehind} cm` : null,
                e.rank0km ?? null,
                e.feelingRank ?? null,
                e.methodology ?? null,
              ];
            });

            return `
              <div class="pdf-test-block">
                <div class="pdf-test-header">${t.date} · ${t.location} · ${t.testType}</div>
                ${t.notes ? `<div class="pdf-test-meta">Notes: ${t.notes}</div>` : ""}
                ${weath ? pdfWeather(weath) : ""}
                ${pdfTable(
                  ["Ski ID", "Brand", "Grind", "Result", "Rank", "Feeling", "Methodology"],
                  entryRows,
                )}
              </div>`;
          }).join("");

        sections.push(pdfSection("Test Results") + testBlocks);
      }

      // ── Grind History ────────────────────────────────────────────────────
      if (exportSections.grindHistory) {
        const allRegrinds: { ski: RaceSki; regrind: RaceSkiRegrind }[] = [];
        for (const ski of skis) {
          for (const rg of regrindsBySkiId[ski.id] ?? []) {
            allRegrinds.push({ ski, regrind: rg });
          }
        }
        allRegrinds.sort((a, b) => b.regrind.date.localeCompare(a.regrind.date));

        if (allRegrinds.length > 0) {
          const rows = allRegrinds.map(({ ski, regrind: rg }) => [
            ski.skiId, rg.date, rg.grindType, rg.stone, rg.pattern, rg.notes,
          ]);
          sections.push(
            pdfSection("Grind History") +
            pdfTable(["Ski ID", "Date", "Grind Type", "Stone", "Pattern", "Notes"], rows)
          );
        }
      }

      const subtitle = [athlete.team, `${raceSkiTests.length} tests`, `${skis.length} skis`].filter(Boolean).join(" · ");
      const body = `
        <div class="pdf-title">${athlete.name}</div>
        <div class="pdf-subtitle">${subtitle}</div>
        ${sections.join("")}
      `;

      openPdfWindow(pdfDocument(`${athlete.name} — Glidr Report`, body), win);
    } catch (e) {
      win.close();
    } finally {
      setIsExporting(false);
      setExportPdfOpen(false);
    }
  }

  const roundRanks = useMemo(() => {
    return distanceLabels.map((_, roundIdx) => {
      const vals = testRows
        .filter((r) => r.roundResults[roundIdx]?.result != null)
        .map((r) => ({ rowId: r.id, v: r.roundResults[roundIdx]!.result as number }));
      const sorted = [...vals].sort((a, b) => a.v - b.v);
      const ranks = new Map<string, number>();
      let prev: number | null = null;
      let currentRank = 1;
      for (let i = 0; i < sorted.length; i++) {
        if (prev !== null && sorted[i].v !== prev) currentRank = i + 1;
        ranks.set(sorted[i].rowId, currentRank);
        prev = sorted[i].v;
      }
      return ranks;
    });
  }, [testRows, distanceLabels.length]);

  useEffect(() => {
    let changed = false;
    const next = testRows.map((r) => {
      const newRoundResults = r.roundResults.map((rr, roundIdx) => {
        const newRank = rr.result === null ? null : (roundRanks[roundIdx]?.get(r.id) ?? null);
        if (newRank !== rr.rank) changed = true;
        return { ...rr, rank: newRank };
      });
      return { ...r, roundResults: newRoundResults };
    });
    if (changed) setTestRows(next);
  }, [roundRanks]);

  const autoWeather = useMemo(() => {
    if (!testForm.date || !testForm.location) return undefined;
    return weather.find(
      (w) =>
        w.date === testForm.date &&
        w.location.toLowerCase() === testForm.location.trim().toLowerCase(),
    );
  }, [weather, testForm.date, testForm.location]);

  const resolvedWeatherId = testForm.weatherId ?? autoWeather?.id ?? undefined;

  function toggleSkiSelection(skiId: number) {
    setSelectedSkiIds((prev) => {
      const next = new Set(prev);
      if (next.has(skiId)) {
        next.delete(skiId);
        setTestRows((rows) => rows.filter((r) => r.raceSkiId !== skiId));
      } else {
        next.add(skiId);
        const ski = skis.find((s) => s.id === skiId);
        if (ski) {
          setTestRows((rows) => [
            ...rows,
            {
              id: `rsk_${ski.id}_${Math.random().toString(16).slice(2)}`,
              raceSkiId: ski.id,
              skiId: ski.skiId,
              brand: ski.brand,
              base: ski.base,
              construction: ski.construction,
              mold: ski.mold,
              grind: ski.grind,
              heights: ski.heights,
              serialNumber: ski.serialNumber,
              year: ski.year,
              ...(ski.customParams ? (() => { try { return JSON.parse(ski.customParams); } catch { return {}; } })() : {}),
              roundResults: distanceLabels.map(() => ({ result: null, rank: null })),
              feelingRank: null,
              kickRank: null,
            },
          ]);
        }
      }
      return next;
    });
  }

  function openNewTest() {
    setTestForm({ date: new Date().toISOString().split("T")[0], location: "", testType: "Classic", notes: "", weatherId: undefined });
    setDistanceLabels([""]);
    setSelectedSkiIds(new Set());
    setSkiSearchQuery("");
    setTestRows([]);
    setShowTestForm(true);
  }

  function handleSkiSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!skiForm.skiId.trim()) return;
    if (editingSki) {
      updateSkiMutation.mutate({ id: editingSki.id, data: skiForm });
    } else {
      createSkiMutation.mutate(skiForm);
    }
  }

  function handleRegrindSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!regrindForm.grindType.trim() || !regrindSkiId) return;
    createRegrindMutation.mutate({ skiId: regrindSkiId, data: regrindForm });
  }

  function handleAthleteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!athleteForm.name.trim()) return;
    updateAthleteMutation.mutate(athleteForm);
  }

  if (!athlete) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-20" data-testid="not-found-athlete">
          <p className="text-muted-foreground">{L("Fant ikke utøveren.", "Athlete not found.")}</p>
          <AppLink href="/raceskis">
            <Button variant="secondary" data-testid="button-back-raceskis">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("athleteDetail.back")}
            </Button>
          </AppLink>
        </div>
      </AppShell>
    );
  }

  if (isAnalyticsView) {
    return (
      <AppShell>
        <div className="flex flex-col gap-5">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/raceskis/${athleteId}`)}
              data-testid="button-back-from-analytics"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("athleteDetail.back")}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-analytics-heading">
              {athlete.name} — Analytics
            </h1>
          </div>
          <AthleteAnalyticsView
            skis={skis}
            raceSkiTests={raceSkiTests}
            compareSkiIds={compareSkiIds}
            setCompareSkiIds={setCompareSkiIds}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        {/* Athlete Portal read-only banner */}
        {isAthletePortal && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">{L("Skrivebeskyttet", "Read-only view")}</span>
            <span className="text-amber-600 dark:text-amber-400">— contact your coach for access</span>
          </div>
        )}

        {/* Back button */}
        {!isAthletePortal && (
          <div>
            <AppLink href="/raceskis" testId="link-back-raceskis">
              <Button variant="ghost" size="sm" data-testid="button-back-raceskis">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("athleteDetail.back")}
              </Button>
            </AppLink>
          </div>
        )}

        {/* Athlete header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-athlete-name">
              {athlete.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {athlete.team && (
                <span
                  className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800"
                  data-testid="text-athlete-team"
                >
                  <Users className="mr-1 h-3 w-3" />
                  {athlete.team}
                </span>
              )}
              <span className="text-xs text-muted-foreground" data-testid="text-athlete-created-by">
                {athlete.createdByName}
              </span>
            </div>
            {/* Athlete profile metrics — shown in the same box as name & team */}
            {(athlete.defaultSkiBrand || athlete.heightCm || athlete.weightKg || athlete.poleHeight || athlete.bindingPosition) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="athlete-metrics">
                {([
                  [L("Merke", "Brand"), athlete.defaultSkiBrand],
                  [L("Høyde", "Height"), athlete.heightCm ? `${athlete.heightCm} cm` : null],
                  [L("Vekt", "Weight"), athlete.weightKg ? `${athlete.weightKg} kg` : null],
                  [L("Stavhøyde", "Pole height"), athlete.poleHeight],
                  [L("Binding", "Binding"), athlete.bindingPosition],
                ] as [string, string | null][]).filter(([, v]) => !!v).map(([label, v]) => (
                  <span key={label} className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{label}:</span> {v}
                  </span>
                ))}
              </div>
            )}
            {athlete.skiServicePreferences && (
              <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-200/60 dark:ring-amber-900/40 px-3 py-2 max-w-2xl" data-testid="athlete-service-prefs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">{L("Ski-service-preferanser", "Ski-service preferences")}</div>
                <div className="text-xs text-foreground/90 whitespace-pre-wrap mt-0.5">{athlete.skiServicePreferences}</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isOwnerOrAdmin && (
              <Button
                variant="outline"
                size="sm"
                data-testid="button-share-view"
                onClick={() => {
                  const url = `${window.location.origin}/raceskis/${athleteId}?view=athlete-portal`;
                  navigator.clipboard.writeText(url).then(() => {
                    toast({ title: "Link copied", description: "Athlete portal link copied to clipboard." });
                  }).catch(() => {
                    toast({ title: "Copy failed", description: url, variant: "destructive" });
                  });
                }}
              >
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                Share View
              </Button>
            )}
            {!isAthletePortal && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExportPdfOpen(true)}
                >
                  <FileDown className="mr-1.5 h-3.5 w-3.5" />
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-athlete-analytics"
                  onClick={() => navigate(`/raceskis/${athleteId}?view=analytics`)}
                >
                  <BarChart2 className="mr-1.5 h-3.5 w-3.5" />
                  Analytics
                </Button>
                {hasAthleteAccess && !isAthletePortal && (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-edit-athlete"
                    onClick={openEditAthlete}
                  >
                    <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                    {L("Rediger", "Edit")}
                  </Button>
                )}
                {hasAthleteAccess && !isAthletePortal && (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-feedback-link"
                    onClick={() => { if (feedbackLink?.token) setFeedbackOpen(true); else createFeedbackLink.mutate(); }}
                    disabled={createFeedbackLink.isPending}
                  >
                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                    {feedbackLink?.token ? L("Tilbakemeldingslenke", "Feedback link") : L("Lag tilbakemeldingslenke", "Create feedback link")}
                  </Button>
                )}
                {isOwnerOrAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-delete-athlete"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={() => {
                      if (confirm("Delete this athlete and all their skis?")) {
                        deleteAthleteMutation.mutate();
                      }
                    }}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {L("Slett", "Delete")}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Access management */}
        {isOwnerOrAdmin && !isAthletePortal && (
          <Card className="fs-card rounded-2xl p-4" data-testid="card-access-management">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">{L("Tilgang", "Access")}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground" data-testid="text-shared-with">
                  {t("raceskis.sharedWith")}: {access.length > 0
                    ? access.map((a) => {
                        const u = users.find((u) => u.id === a.userId);
                        return u?.name || `User #${a.userId}`;
                      }).join(", ")
                    : "—"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-manage-access"
                onClick={openAccessDialog}
              >
                <Users className="mr-1.5 h-3.5 w-3.5" />
                {t("raceskis.manageAccess")}
              </Button>
            </div>
          </Card>
        )}

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div
          className="flex gap-1 border-b border-border overflow-x-auto"
          style={{ backgroundColor: "hsl(var(--primary) / 0.06)" }}
        >
          <button
            onClick={() => setPageTab("garage")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              pageTab === "garage" ? "border-transparent" : "border-transparent text-muted-foreground hover:text-foreground/80"
            }`}
            style={pageTab === "garage" ? { borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))" } : undefined}
          >
            <Warehouse className="h-4 w-4" />
            {language === "no" ? "Garasje" : "Garage"}
            {skis.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                {skis.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setPageTab("tests")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              pageTab === "tests" ? "border-transparent" : "border-transparent text-muted-foreground hover:text-foreground/80"
            }`}
            style={pageTab === "tests" ? { borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))" } : undefined}
          >
            <BarChart2 className="h-4 w-4" />
            {language === "no" ? "Tester" : "Tests"}
            {raceSkiTests.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                {raceSkiTests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setPageTab("races")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              pageTab === "races" ? "border-transparent" : "border-transparent text-muted-foreground hover:text-foreground/80"
            }`}
            style={pageTab === "races" ? { borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))" } : undefined}
          >
            <Flag className="h-4 w-4" />
            {language === "no" ? "Renn" : "Race Prep"}
            {raceHistory.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                {raceHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Race History tab ─────────────────────────────────────────────── */}
        {pageTab === "races" && raceHistory.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Flag className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>{language === "no" ? "Ingen rennhistorikk ennå." : "No race history yet."}</p>
          </div>
        )}
        {pageTab === "races" && raceHistory.length > 0 && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Flag className="h-5 w-5 text-primary" />
                {t("nav.raceprep") || "Race History"}
                <span className="text-sm font-normal text-muted-foreground">
                  ({filteredRaceHistory.length}{filteredRaceHistory.length !== raceHistory.length ? ` / ${raceHistory.length}` : ""})
                </span>
              </h2>
              <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5">
                <button
                  onClick={() => setRaceView("card")}
                  className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors", raceViewMode === "card" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  title={L("Kortvisning", "Card view")}
                >
                  <LayoutGrid className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setRaceView("compact")}
                  className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors", raceViewMode === "compact" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  title={L("Kompakt visning", "Compact view")}
                >
                  <List className="h-3 w-3" />
                </button>
              </div>
            </div>
            {/* Race history filter bar */}
            <div className="mb-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={raceLocationFilter}
                  onChange={e => setRaceLocationFilter(e.target.value)}
                  placeholder={L("Sted…", "Location…")}
                  className="h-8 w-[140px] text-xs"
                />
                <Select value={raceSeasonFilter} onValueChange={setRaceSeasonFilter}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue placeholder={L("Sesong", "Season")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("Alle sesonger", "All seasons")}</SelectItem>
                    {raceAvailableSeasons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="date" value={raceDateFrom} onChange={e => setRaceDateFrom(e.target.value)} className="h-8 w-[130px] text-xs" />
                <span className="text-xs text-muted-foreground">–</span>
                <Input type="date" value={raceDateTo} onChange={e => setRaceDateTo(e.target.value)} className="h-8 w-[130px] text-xs" />
                <Button
                  variant={(showRaceWeatherFilters || !!(raceAirTempMin || raceAirTempMax || raceSnowTempMin || raceSnowTempMax || raceAirHumMin || raceAirHumMax || raceSnowHumMin || raceSnowHumMax || raceSnowType || raceTrackHardness || raceSnowHumidityType || raceGrainSize || raceArtSnow || raceNatSnow || racePrecipitation || raceWind || raceVisibility || raceCloudMin || raceCloudMax)) ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setShowRaceWeatherFilters(v => !v)}
                >
                  <Snowflake className="h-3 w-3" />
                  Weather
                </Button>
                {(raceLocationFilter || raceSeasonFilter !== "all" || raceDateFrom || raceDateTo || raceAirTempMin || raceAirTempMax || raceSnowTempMin || raceSnowTempMax || raceAirHumMin || raceAirHumMax || raceSnowHumMin || raceSnowHumMax || raceSnowType || raceTrackHardness || raceSnowHumidityType || raceGrainSize || raceArtSnow || raceNatSnow || racePrecipitation || raceWind || raceVisibility || raceCloudMin || raceCloudMax) && (
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => {
                    setRaceLocationFilter(""); setRaceSeasonFilter("all"); setRaceDateFrom(""); setRaceDateTo("");
                    setRaceAirTempMin(""); setRaceAirTempMax(""); setRaceSnowTempMin(""); setRaceSnowTempMax("");
                    setRaceAirHumMin(""); setRaceAirHumMax(""); setRaceSnowHumMin(""); setRaceSnowHumMax("");
                    setRaceSnowType(""); setRaceTrackHardness("");
                    setRaceSnowHumidityType(""); setRaceGrainSize(""); setRaceArtSnow(""); setRaceNatSnow("");
                    setRacePrecipitation(""); setRaceWind(""); setRaceVisibility(""); setRaceCloudMin(""); setRaceCloudMax("");
                  }}>
                    <X className="h-3 w-3 mr-1" />Clear
                  </Button>
                )}
              </div>
              {showRaceWeatherFilters && (
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{L("Temperatur og fuktighet", "Temperature & Humidity")}</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />Air temp (°C)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-7 text-xs" placeholder="Min" value={raceAirTempMin} onChange={e => setRaceAirTempMin(e.target.value)} />
                            <span className="text-xs">–</span>
                            <Input type="number" className="h-7 text-xs" placeholder={L("Maks", "Max")} value={raceAirTempMax} onChange={e => setRaceAirTempMax(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />Snow temp (°C)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-7 text-xs" placeholder="Min" value={raceSnowTempMin} onChange={e => setRaceSnowTempMin(e.target.value)} />
                            <span className="text-xs">–</span>
                            <Input type="number" className="h-7 text-xs" placeholder={L("Maks", "Max")} value={raceSnowTempMax} onChange={e => setRaceSnowTempMax(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400" />Air humidity (%)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-7 text-xs" placeholder="Min" value={raceAirHumMin} onChange={e => setRaceAirHumMin(e.target.value)} />
                            <span className="text-xs">–</span>
                            <Input type="number" className="h-7 text-xs" placeholder={L("Maks", "Max")} value={raceAirHumMax} onChange={e => setRaceAirHumMax(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />Snow humidity (%)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-7 text-xs" placeholder="Min" value={raceSnowHumMin} onChange={e => setRaceSnowHumMin(e.target.value)} />
                            <span className="text-xs">–</span>
                            <Input type="number" className="h-7 text-xs" placeholder={L("Maks", "Max")} value={raceSnowHumMax} onChange={e => setRaceSnowHumMax(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-300" />Cloud cover (%)
                          </label>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-7 text-xs" placeholder="Min" value={raceCloudMin} onChange={e => setRaceCloudMin(e.target.value)} />
                            <span className="text-xs">–</span>
                            <Input type="number" className="h-7 text-xs" placeholder={L("Maks", "Max")} value={raceCloudMax} onChange={e => setRaceCloudMax(e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{L("Snøtype", "Snow Type")}</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />Artificial snow
                          </label>
                          <Select value={raceArtSnow || "__any__"} onValueChange={v => setRaceArtSnow(v === "__any__" ? "" : v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__any__">— Any —</SelectItem>
                              {SNOW_STAGE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-400" />Natural snow
                          </label>
                          <Select value={raceNatSnow || "__any__"} onValueChange={v => setRaceNatSnow(v === "__any__" ? "" : v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__any__">— Any —</SelectItem>
                              {SNOW_STAGE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />Snow humidity type
                          </label>
                          <Select value={raceSnowHumidityType || "__any__"} onValueChange={v => setRaceSnowHumidityType(v === "__any__" ? "" : v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__any__">— Any —</SelectItem>
                              {SNOW_HUMIDITY_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-lime-400" />Grain size
                          </label>
                          <Select value={raceGrainSize || "__any__"} onValueChange={v => setRaceGrainSize(v === "__any__" ? "" : v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__any__">— Any —</SelectItem>
                              {GRAIN_SIZE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{L("Snø og spor", "Snow & Track")}</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />Track hardness
                          </label>
                          <Select value={raceTrackHardness || "__any__"} onValueChange={v => setRaceTrackHardness(v === "__any__" ? "" : v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__any__">— Any —</SelectItem>
                              {TRACK_HARDNESS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />Precipitation
                          </label>
                          <Input className="h-7 text-xs" placeholder="e.g. Snow" value={racePrecipitation} onChange={e => setRacePrecipitation(e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />Wind
                          </label>
                          <Input className="h-7 text-xs" placeholder="e.g. NW 3m/s" value={raceWind} onChange={e => setRaceWind(e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />Visibility
                          </label>
                          <Input className="h-7 text-xs" placeholder="e.g. Good" value={raceVisibility} onChange={e => setRaceVisibility(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* ── Compact table view ── */}
            {raceViewMode === "compact" && filteredRaceHistory.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden mb-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{L("Dato", "Date")}</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{L("Sted", "Location")}</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{L("Stilart", "Discipline")}</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ski</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{L("Glid", "Glide")}</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{L("Struktur", "Structure")}</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{L("Kick / Grunning", "Kick / Binder")}</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">{L("Smører", "Waxer")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRaceHistory.map((entry, i) => {
                      const parseIds = (ids: string | null) =>
                        ids ? ids.split(",").map(Number).filter(Boolean)
                            .map(id => allProducts.find(p => p.id === id))
                            .filter((p): p is typeof allProducts[0] => !!p)
                        : [];
                      // "Brand Name (app) + ..." from productApps, falling back to IDs
                      const fmtApps = (appsJson: string | null, idsFallback: string | null): string => {
                        let pairs: { productId: number; application: string }[] = [];
                        if (appsJson) {
                          try { const a = JSON.parse(appsJson); if (Array.isArray(a)) pairs = a.filter((x: any) => x && typeof x.productId === "number"); } catch {}
                        }
                        if (pairs.length === 0) return parseIds(idsFallback).map(p => `${p.brand} ${p.name}`).join(" + ");
                        return pairs.map(({ productId, application }) => {
                          const p = allProducts.find(pp => pp.id === productId);
                          if (!p) return "";
                          return application ? `${p.brand} ${p.name} (${application})` : `${p.brand} ${p.name}`;
                        }).filter(Boolean).join(" + ");
                      };
                      const glide = fmtApps(entry.productApps, entry.productIds);
                      const struct = fmtApps(entry.structureApps, entry.structureIds);
                      const kickIsText = entry.kickProductIds ? entry.kickProductIds.split(",").some(s => isNaN(Number(s.trim()))) : false;
                      const kick = kickIsText ? (entry.kickProductIds ?? "") : parseIds(entry.kickProductIds).map(p => `${p.brand} ${p.name}`).join(" + ");
                      const tette = entry.tette ?? "";
                      const kickTette = [kick, tette].filter(Boolean).join(" / ");
                      const skiDisplay = entry.discipline === "Skiathlon"
                        ? [entry.skiIdClassic && `CL: ${entry.skiIdClassic}`, entry.skiIdSkating && `SK: ${entry.skiIdSkating}`].filter(Boolean).join(" · ")
                        : (entry.skiId ?? "—");
                      return (
                        <tr key={entry.entryId} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(entry.date)}</td>
                          <td className="px-3 py-2 font-medium">{entry.location}</td>
                          <td className="px-3 py-2">
                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", DISCIPLINE_COLORS_DETAIL[entry.discipline] ?? "")}>
                              {DISCIPLINE_LABEL_DETAIL[entry.discipline]?.en ?? entry.discipline}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold">{skiDisplay}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">{glide || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{struct || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{kickTette || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{entry.waxerName ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className={cn(raceViewMode === "card" ? "space-y-2" : "hidden")}>
              {filteredRaceHistory.map((entry) => {
                const rw = entry.weatherId ? raceWeatherById.get(entry.weatherId) : null;

                // Resolve products with their per-product application.
                // Prefer the productApps JSON; fall back to comma-sep IDs.
                const resolveWithApps = (appsJson: string | null, idsFallback: string | null) => {
                  let pairs: { productId: number; application: string }[] = [];
                  if (appsJson) {
                    try {
                      const arr = JSON.parse(appsJson);
                      if (Array.isArray(arr)) pairs = arr.filter((x: any) => x && typeof x.productId === "number");
                    } catch {}
                  }
                  if (pairs.length === 0 && idsFallback) {
                    pairs = idsFallback.split(",").map(Number).filter(Boolean).map(productId => ({ productId, application: "" }));
                  }
                  return pairs
                    .map(({ productId, application }) => {
                      const p = allProducts.find(pp => pp.id === productId);
                      return p ? { product: p, application } : null;
                    })
                    .filter((x): x is { product: typeof allProducts[0]; application: string } => !!x);
                };
                const glideProducts = resolveWithApps(entry.productApps, entry.productIds);
                const structureProducts = resolveWithApps(entry.structureApps, entry.structureIds);
                const parseProductIds = (ids: string | null) =>
                  ids ? ids.split(",").map(Number).filter(Boolean)
                      .map(id => allProducts.find(p => p.id === id))
                      .filter((p): p is typeof allProducts[0] => !!p)
                  : [];
                const kickIsText = entry.kickProductIds
                  ? entry.kickProductIds.split(",").some(s => isNaN(Number(s.trim())))
                  : false;
                const kickProducts = kickIsText ? [] : parseProductIds(entry.kickProductIds);
                const kickText = kickIsText ? entry.kickProductIds : null;
                const hasProducts = glideProducts.length > 0 || structureProducts.length > 0 || kickProducts.length > 0 || !!kickText || !!entry.tette;

                // Ski-pair editing: anyone with access to this athlete may register the ski pair.
                // (Viewing this page already requires athlete access; the server re-checks.)
                const canEditSki = !!athleteId && !isAthletePortal;
                const skiLang: "no" | "en" = language === "no" ? "no" : "en";
                const onSkiSaved = () => queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/race-history`] });

                return (
                  <Card key={entry.entryId} className="rounded-xl overflow-hidden">
                    {/* ── Header bar ── */}
                    <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
                      <span className="font-semibold text-sm">{entry.location}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(entry.date)}</span>
                      {entry.startTime && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />{entry.startTime}
                        </span>
                      )}
                      {entry.raceType && <span className="text-xs text-muted-foreground">{entry.raceType}</span>}
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", DISCIPLINE_COLORS_DETAIL[entry.discipline] ?? "")}>
                        {DISCIPLINE_LABEL_DETAIL[entry.discipline]?.en ?? entry.discipline}
                      </span>
                      {entry.waxerName && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          Waxer: <span className="font-medium text-foreground">{entry.waxerName}</span>
                        </span>
                      )}
                    </div>

                    {/* ── SKI PAIR — hero section (editable for the assigned waxer) ── */}
                    <div className="px-4 pb-3">
                      {entry.discipline === "Skiathlon" ? (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-xl bg-sky-50 dark:bg-sky-900/25 ring-1 ring-sky-200 dark:ring-sky-800 px-4 py-3">
                            <div className="text-[9px] font-bold uppercase tracking-widest text-sky-500 dark:text-sky-400 mb-0.5">Classic</div>
                            <div className="text-xl font-bold text-sky-700 dark:text-sky-200 leading-tight">
                              <RacePrepSkiIdField prepId={entry.racePrepId} entryId={entry.entryId} athleteId={athleteId!} slot="classic" discipline={entry.discipline} entry={entry} canEdit={canEditSki} onSaved={onSkiSaved} lang={skiLang} />
                            </div>
                          </div>
                          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/25 ring-1 ring-emerald-200 dark:ring-emerald-800 px-4 py-3">
                            <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 dark:text-emerald-400 mb-0.5">Skating</div>
                            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-200 leading-tight">
                              <RacePrepSkiIdField prepId={entry.racePrepId} entryId={entry.entryId} athleteId={athleteId!} slot="skating" discipline={entry.discipline} entry={entry} canEdit={canEditSki} onSaved={onSkiSaved} lang={skiLang} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col rounded-xl bg-violet-50 dark:bg-violet-900/25 ring-1 ring-violet-200 dark:ring-violet-800 px-5 py-2.5 mb-3 min-w-[160px]">
                          <div className="text-[9px] font-bold uppercase tracking-widest text-violet-400 mb-0.5">
                            {DISCIPLINE_LABEL_DETAIL[entry.discipline]?.en ?? entry.discipline}
                          </div>
                          <div className="text-2xl font-bold text-violet-700 dark:text-violet-200 leading-tight">
                            <RacePrepSkiIdField prepId={entry.racePrepId} entryId={entry.entryId} athleteId={athleteId!} slot="single" discipline={entry.discipline} entry={entry} canEdit={canEditSki} onSaved={onSkiSaved} lang={skiLang} />
                          </div>
                        </div>
                      )}

                      {/* ── Products + Application ── */}
                      {hasProducts && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-3">
                          {glideProducts.map(({ product: p, application }, i) => (
                            <span key={i} className="inline-flex items-center rounded-lg bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300 ring-1 ring-violet-200 dark:ring-violet-800">
                              {p.brand} {p.name}{application ? <span className="ml-1 font-normal opacity-80">({application})</span> : null}
                            </span>
                          ))}
                          {structureProducts.map(({ product: p, application }, i) => (
                            <span key={`s${i}`} className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700">
                              {p.brand} {p.name}{application ? <span className="ml-1 font-normal opacity-80">({application})</span> : null}
                            </span>
                          ))}
                          {kickProducts.map((p, i) => (
                            <span key={`k${i}`} className="inline-flex items-center rounded-lg bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300 ring-1 ring-orange-200 dark:ring-orange-800">
                              {p.brand} {p.name}
                            </span>
                          ))}
                          {kickText && (
                            <span className="inline-flex items-center rounded-lg bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300 ring-1 ring-orange-200 dark:ring-orange-800">
                              {kickText}
                            </span>
                          )}
                          {entry.tette && (
                            <span className="inline-flex items-center rounded-lg bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800">
                              {language === "no" ? "Grunning" : "Binder"}: {entry.tette}
                            </span>
                          )}
                          {entry.method && (
                            <span className="text-xs text-muted-foreground">
                              · {entry.method}
                            </span>
                          )}
                        </div>
                      )}

                      {/* ── Athlete feedback (from the feedback link) ── */}
                      {(entry.athleteRating || entry.athleteComment) && (
                        <div className="flex flex-wrap items-center gap-2 mb-3 rounded-lg bg-muted/40 px-3 py-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {L("Tilbakemelding fra utøver", "Athlete feedback")}
                          </span>
                          {entry.athleteRating && (
                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1", athleteRatingClass(entry.athleteRating))}>
                              {entry.athleteRating}
                            </span>
                          )}
                          {entry.athleteComment && (
                            <span className="text-xs text-muted-foreground italic">“{entry.athleteComment}”</span>
                          )}
                        </div>
                      )}

                      {/* ── Weather conditions grid ── */}
                      {rw && (() => {
                        const cells: { val: string; lbl: string }[] = [];
                        if (rw.snowTemperatureC != null) cells.push({ val: `${rw.snowTemperatureC}°C`, lbl: "Snow Temp" });
                        if (rw.airTemperatureC != null)  cells.push({ val: `${rw.airTemperatureC}°C`,  lbl: "Air Temp" });
                        if (rw.snowHumidityPct != null)  cells.push({ val: `${rw.snowHumidityPct}%`,   lbl: "Snow RH" });
                        if (rw.airHumidityPct != null)   cells.push({ val: `${rw.airHumidityPct}%`,    lbl: "Air RH" });
                        if (rw.snowType)                 cells.push({ val: rw.snowType,                lbl: "Snow Type" });
                        if (rw.snowHumidityType)         cells.push({ val: rw.snowHumidityType,        lbl: "Hum. Type" });
                        if (rw.trackHardness)            cells.push({ val: rw.trackHardness,           lbl: "Track" });
                        if (rw.grainSize)                cells.push({ val: rw.grainSize,               lbl: "Grain Size" });
                        if (rw.clouds != null)           cells.push({ val: `${rw.clouds}/8`,           lbl: "Clouds" });
                        if (rw.wind)                     cells.push({ val: rw.wind,                    lbl: "Wind" });
                        if (rw.precipitation)            cells.push({ val: rw.precipitation,           lbl: "Precip." });
                        if (rw.visibility)               cells.push({ val: rw.visibility,              lbl: "Visibility" });
                        if (rw.artificialSnow)           cells.push({ val: rw.artificialSnow,          lbl: "Artificial" });
                        if (rw.naturalSnow)              cells.push({ val: rw.naturalSnow,             lbl: "Natural" });
                        if (rw.testQuality != null)      cells.push({ val: `${rw.testQuality}/10`,     lbl: "Quality" });
                        if (cells.length === 0) return null;
                        return (
                          <div className="border-t border-border/40 pt-2.5 mt-1">
                            <div className="grid grid-cols-4 gap-1.5">
                              {cells.map(({ val, lbl }) => (
                                <div key={lbl} className="rounded-lg bg-muted/50 dark:bg-muted/20 px-2 py-1.5 text-center">
                                  <div className="text-xs font-semibold text-foreground leading-tight truncate">{val}</div>
                                  <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{lbl}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── Waxer comments (private to author + admins) ── */}
                      {!isAthletePortal && can("raceskis", "view") && (
                        <div className="border-t border-border/40 pt-1 mt-1">
                          <RacePrepComments prepId={entry.racePrepId} lang={language === "no" ? "no" : "en"} />
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
            {filteredRaceHistory.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">{L("Ingen renn matcher filtrene.", "No races match the current filters.")}</p>
            )}
          </div>
        )}

        {/* ── Garage tab ───────────────────────────────────────────────────── */}
        {pageTab === "garage" && (
        <>
        <Collapsible open={skiGarageOpen} onOpenChange={setSkiGarageOpen} data-testid="section-ski-garage">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 cursor-pointer select-none group" data-testid="toggle-ski-garage">
                <Warehouse className="h-4.5 w-4.5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">
                  Ski Garage ({skis.length})
                </h2>
                {skiGarageOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
                )}
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2 flex-wrap">
              {!isOnline && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-300 ring-1 ring-yellow-200 dark:ring-yellow-800">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </span>
              )}
              {/* Garage view toggle */}
              <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5" data-testid="garage-view-toggle">
                <button
                  onClick={() => setGarageView("grid")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                    garageViewMode === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid="button-garage-grid"
                >
                  <LayoutGrid className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setGarageView("list")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                    garageViewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid="button-garage-list"
                >
                  <List className="h-3 w-3" />
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-7 px-2 text-xs", showGarageFilters && "bg-muted")}
                onClick={() => setShowGarageFilters(!showGarageFilters)}
                data-testid="button-garage-filters"
              >
                <Filter className="h-3 w-3 mr-1" />
                Filter
              </Button>
              {!isAthletePortal && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setCsvImportOpen(true)}
                    data-testid="button-import-csv"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    data-testid="button-add-ski"
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
                    size="sm"
                    onClick={openAddSki}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {t("raceskis.addSki")}
                  </Button>
                </>
              )}
            </div>
          </div>

          <CollapsibleContent>
            {/* Filter bar */}
            {showGarageFilters && (
              <div className="flex flex-wrap items-center gap-2 mt-3" data-testid="garage-filter-bar">
                <Select value={garageDisciplineFilter} onValueChange={setGarageDisciplineFilter}>
                  <SelectTrigger className="h-7 w-[130px] text-xs" data-testid="select-garage-discipline">
                    <SelectValue placeholder={L("Alle stilarter", "All disciplines")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("Alle stilarter", "All disciplines")}</SelectItem>
                    {garageDisciplineOptions.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={garageBrandFilter} onValueChange={setGarageBrandFilter}>
                  <SelectTrigger className="h-7 w-[120px] text-xs" data-testid="select-garage-brand">
                    <SelectValue placeholder={L("Alle merker", "All brands")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("Alle merker", "All brands")}</SelectItem>
                    {garageBrandOptions.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={garageYearFilter} onValueChange={setGarageYearFilter}>
                  <SelectTrigger className="h-7 w-[100px] text-xs" data-testid="select-garage-year">
                    <SelectValue placeholder={L("Alle år", "All years")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("Alle år", "All years")}</SelectItem>
                    {garageYearOptions.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={garageGrindFilter}
                  onChange={(e) => setGarageGrindFilter(e.target.value)}
                  placeholder={L("Slip…", "Grind…")}
                  className="h-7 w-[110px] text-xs"
                  data-testid="input-garage-grind-filter"
                />
                <Input
                  value={garageRaValueFilter}
                  onChange={(e) => setGarageRaValueFilter(e.target.value)}
                  placeholder={L("RA-verdi…", "RA-value…")}
                  className="h-7 w-[110px] text-xs"
                  data-testid="input-garage-ra-value-filter"
                />
                <Select value={garageRaSort} onValueChange={setGarageRaSort}>
                  <SelectTrigger className="h-7 w-[170px] text-xs" data-testid="select-garage-ra-sort">
                    <SelectValue placeholder={L("Sorter", "Sort")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{L("Ingen sortering", "No sorting")}</SelectItem>
                    <SelectItem value="skiId|asc">{L("Ski-ID A→Å", "Ski ID A→Z")}</SelectItem>
                    <SelectItem value="skiId|desc">{L("Ski-ID Å→A", "Ski ID Z→A")}</SelectItem>
                    <SelectItem value="brand|asc">{L("Merke A→Å", "Brand A→Z")}</SelectItem>
                    <SelectItem value="brand|desc">{L("Merke Å→A", "Brand Z→A")}</SelectItem>
                    <SelectItem value="grind|asc">{L("Slip A→Å", "Grind A→Z")}</SelectItem>
                    <SelectItem value="grind|desc">{L("Slip Å→A", "Grind Z→A")}</SelectItem>
                    <SelectItem value="year|desc">{L("Årgang nyest", "Year newest")}</SelectItem>
                    <SelectItem value="year|asc">{L("Årgang eldst", "Year oldest")}</SelectItem>
                    <SelectItem value="length|desc">{L("Lengde høy→lav", "Length high→low")}</SelectItem>
                    <SelectItem value="length|asc">{L("Lengde lav→høy", "Length low→high")}</SelectItem>
                    <SelectItem value="ra|desc">{L("RA høy→lav", "RA high→low")}</SelectItem>
                    <SelectItem value="ra|asc">{L("RA lav→høy", "RA low→high")}</SelectItem>
                    <SelectItem value="color|asc">{L("Farge", "Colour")}</SelectItem>
                  </SelectContent>
                </Select>
                {(garageDisciplineFilter !== "all" || garageBrandFilter !== "all" || garageYearFilter !== "all" || garageGrindFilter !== "" || garageRaValueFilter !== "" || garageColorFilter.length > 0 || garageRaSort !== "none") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => { setGarageDisciplineFilter("all"); setGarageBrandFilter("all"); setGarageYearFilter("all"); setGarageGrindFilter(""); setGarageRaValueFilter(""); setGarageColorFilter([]); setGarageRaSort("none"); }}
                    data-testid="button-garage-clear-filters"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
                {/* Colour filter — choose which colour tag(s) to show. Empty = all. */}
                <div className="flex w-full flex-wrap items-center gap-1.5 pt-1" data-testid="garage-color-filter">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mr-0.5">{L("Farge", "Colour")}:</span>
                  {SKI_COLORS.map((c) => {
                    const active = garageColorFilter.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setGarageColorFilter((prev) => prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 transition-colors",
                          active ? "ring-foreground/40 bg-muted text-foreground" : "ring-border text-muted-foreground hover:bg-muted/60",
                        )}
                        title={c.label}
                        data-testid={`color-filter-${c.id}`}
                      >
                        {c.id !== "none"
                          ? <span className={cn("inline-block h-2.5 w-2.5 rounded-full", c.dot)} />
                          : <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-border" />}
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {skis.length === 0 ? (
              <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground mt-3" data-testid="empty-skis">
                No skis yet. Add the first ski for this athlete.
              </Card>
            ) : garageViewMode === "grid" ? (
              <div className="space-y-3 mt-3">
                {[...filteredGarageSkis].sort((a, b) => (a.isTrainingSki || 0) - (b.isTrainingSki || 0)).map((ski, _i, _arr) => (
                  <React.Fragment key={ski.id}>
                    {ski.isTrainingSki === 1 && (_i === 0 || _arr[_i - 1].isTrainingSki !== 1) && (
                      <div className="pt-3 mt-1 border-t border-amber-200/60 dark:border-amber-900/40 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400" data-testid="garage-training-section">
                        {L("Treningsski", "Training skis")}
                      </div>
                    )}
                  <SkiCard
                    ski={ski}
                    expanded={expandedSkiId === ski.id}
                    onToggle={() => setExpandedSkiId(expandedSkiId === ski.id ? null : ski.id)}
                    onEdit={() => openEditSki(ski)}
                    onArchive={() => {
                      if (confirm("Archive this ski? It can be restored later.")) archiveSkiMutation.mutate(ski.id);
                    }}
                    onRegrind={() => openRegrind(ski.id)}
                    onDeleteRegrind={(id) => {
                      if (confirm("Delete this regrind record?")) deleteRegrindMutation.mutate(id);
                    }}
                    raceHistory={raceHistory}
                    weatherList={weather}
                  />
                  </React.Fragment>
                ))}
                {filteredGarageSkis.length === 0 && skis.length > 0 && (
                  <p className="text-sm text-muted-foreground">{L("Ingen ski matcher filtrene.", "No skis match the current filters.")}</p>
                )}
              </div>
            ) : (
              /* List view for Ski Garage */
              <div className="mt-3">
                {/* Column picker — show/hide any parameter. Click a header to sort by it. */}
                <div className="mb-2 flex items-center justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" data-testid="button-garage-columns">
                        <Settings2 className="h-3.5 w-3.5" />
                        {L("Kolonner", "Columns")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-[60vh] overflow-y-auto">
                      <DropdownMenuLabel>{L("Vis kolonner", "Show columns")}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {garageColumns.map((col) => (
                        <DropdownMenuCheckboxItem
                          key={col.key}
                          checked={garageVisibleKeys.includes(col.key)}
                          onCheckedChange={() => toggleGarageCol(col.key)}
                          onSelect={(e) => e.preventDefault()}
                          data-testid={`toggle-col-${col.key}`}
                        >
                          {col.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Card className="fs-card rounded-2xl overflow-hidden" data-testid="ski-list-view">
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b select-none">
                          <th className="px-4 py-2.5 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleColSort("skiId")}>{L("Ski-ID", "Ski ID")}{sortArrow("skiId")}</th>
                          {visibleGarageColumns.map((col) => (
                            <th key={col.key} className="px-3 py-2.5 font-medium cursor-pointer hover:text-foreground whitespace-nowrap" onClick={() => toggleColSort(col.key)}>
                              {col.label}{sortArrow(col.key)}
                            </th>
                          ))}
                          <th className="px-3 py-2.5 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGarageSkis.map((ski, idx) => (
                          <React.Fragment key={ski.id}>
                            <tr
                              className={cn(
                                "border-t border-border/30 cursor-pointer transition-colors",
                                idx % 2 === 0 ? "bg-background/30" : "bg-background/10",
                                expandedSkiId === ski.id && "bg-indigo-50/30 dark:bg-indigo-950/10",
                              )}
                              onClick={() => setExpandedSkiId(expandedSkiId === ski.id ? null : ski.id)}
                              data-testid={`row-ski-${ski.id}`}
                            >
                              <td className="px-4 py-2.5 font-semibold">
                                <span className="flex items-center gap-1.5">
                                  {(() => {
                                    const cid = getSkiColor(ski);
                                    const ce = SKI_COLORS.find(c => c.id === cid);
                                    return cid !== "none" && ce?.dot ? <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", ce.dot)} /> : null;
                                  })()}
                                  {ski.skiId}
                                  {ski.isTrainingSki === 1 && (
                                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300" title={L("Treningsski", "Training ski")}>{L("TRENING", "TRAINING")}</span>
                                  )}
                                  {ski.notes && <MessageSquare className="h-3 w-3 text-muted-foreground/60 shrink-0" />}
                                </span>
                              </td>
                              {visibleGarageColumns.map((col) => (
                                <td key={col.key} className={cn("px-3 py-2.5", col.key === "discipline" || col.key === "color" ? "" : "text-muted-foreground")}>
                                  {col.key === "discipline" ? (
                                    <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800 whitespace-nowrap">
                                      {ski.discipline}
                                    </span>
                                  ) : col.key === "color" ? (
                                    (() => {
                                      const ce = SKI_COLORS.find((c) => c.id === getSkiColor(ski));
                                      return ce && ce.id !== "none"
                                        ? <span className="inline-flex items-center gap-1.5 text-xs"><span className={cn("inline-block h-2.5 w-2.5 rounded-full", ce.dot)} />{ce.label}</span>
                                        : <span className="text-muted-foreground">—</span>;
                                    })()
                                  ) : (
                                    garageCellValue(ski, col.key)
                                  )}
                                </td>
                              ))}
                              <td className="px-3 py-2.5">
                                {expandedSkiId === ski.id
                                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                              </td>
                            </tr>
                            {expandedSkiId === ski.id && (
                              <tr className="border-t border-indigo-200/30 dark:border-indigo-800/30">
                                <td colSpan={visibleGarageColumns.length + 2} className="px-4 py-3 bg-indigo-50/20 dark:bg-indigo-950/10">
                                  <SkiDetailPanel
                                    ski={ski}
                                    onEdit={() => openEditSki(ski)}
                                    onArchive={() => { if (confirm("Archive this ski? It can be restored later.")) archiveSkiMutation.mutate(ski.id); }}
                                    onRegrind={() => openRegrind(ski.id)}
                                    onDeleteRegrind={(id) => { if (confirm("Delete this regrind record?")) deleteRegrindMutation.mutate(id); }}
                                    raceHistory={raceHistory}
                                    weatherList={weather}
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                        {filteredGarageSkis.length === 0 && (
                          <tr>
                            <td colSpan={visibleGarageColumns.length + 2} className="px-4 py-6 text-sm text-muted-foreground text-center">
                              No skis match the current filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchivedSkis(!showArchivedSkis)}
                className="text-xs text-muted-foreground hover:text-foreground"
                data-testid="toggle-archived-skis"
              >
                <Archive className="mr-1 h-3.5 w-3.5" />
                {showArchivedSkis ? "Hide archived" : "Show archived"}
                {showArchivedSkis && archivedSkis.length > 0 && ` (${archivedSkis.length})`}
              </Button>
            </div>

            {showArchivedSkis && archivedSkis.length > 0 && (
              <div className="space-y-3 opacity-70">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{L("Arkiverte ski", "Archived Skis")}</p>
                {archivedSkis.map((ski) => (
                  <SkiCard
                    key={ski.id}
                    ski={ski}
                    expanded={expandedSkiId === ski.id}
                    onToggle={() => setExpandedSkiId(expandedSkiId === ski.id ? null : ski.id)}
                    isArchived
                    onRestore={() => restoreSkiMutation.mutate(ski.id)}
                    onDelete={() => {
                      if (confirm("Permanently delete this ski and all its regrind history? This cannot be undone.")) deleteSkiMutation.mutate(ski.id);
                    }}
                    raceHistory={raceHistory}
                    weatherList={weather}
                  />
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Smart Ski Suggestions */}
        <SkiSuggestionsSection
          athleteId={athleteId!}
          skis={skis}
          raceSkiTests={raceSkiTests}
          raceHistory={raceHistory}
        />
        </>
        )} {/* end garage tab */}

        {/* ── Tests tab ────────────────────────────────────────────────────── */}
        {pageTab === "tests" && (
        <div className="pt-1" data-testid="section-race-ski-tests">
          {/* Offline banner */}
          {!isOnline && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-4 py-2.5 text-sm text-yellow-800 dark:text-yellow-200">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>You are offline — new tests will be queued and synced when you reconnect.</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => setTestsExpanded(!testsExpanded)}
              data-testid="toggle-tests-section"
            >
              {testsExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <h2 className="text-lg font-semibold" data-testid="text-tests-heading">
                Tests
              </h2>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800">
                  <RefreshCw className="h-2.5 w-2.5" />
                  {pendingCount} pending
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Tests view toggle */}
              <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5" data-testid="tests-view-toggle">
                <button
                  onClick={() => setTestViewMode("card")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                    testViewMode === "card" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid="button-tests-card-view"
                >
                  <LayoutGrid className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setTestViewMode("list")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                    testViewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid="button-tests-list-view"
                >
                  <List className="h-3 w-3" />
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setTestColumnsDialogOpen(true)}
                data-testid="button-test-columns"
              >
                <Settings2 className="h-3 w-3 mr-1" />
                Columns
              </Button>
              {!isAthletePortal && (can("tests", "edit") || hasAthleteAccess) && (
                <Button
                  data-testid="button-new-test"
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
                  size="sm"
                  onClick={openNewTest}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Test
                </Button>
              )}
            </div>
          </div>

          {testsExpanded && (
            <div className="mt-3 space-y-3">
              {raceSkiTests.length > 0 && !showTestForm && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2" data-testid="test-filters">
                    {/* 1. Season */}
                    <Select value={testSeasonFilter} onValueChange={setTestSeasonFilter}>
                      <SelectTrigger className="h-8 min-w-[140px] text-xs">
                        <SelectValue placeholder={L("Alle sesonger", "All seasons")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{L("Alle sesonger", "All seasons")}</SelectItem>
                        {testAvailableSeasons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* 2. All dates */}
                    <Select value={testDateFilter} onValueChange={setTestDateFilter}>
                      <SelectTrigger className="h-8 min-w-[180px] text-xs" data-testid="select-test-date-filter">
                        <SelectValue placeholder={L("Alle datoer", "All dates")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{L("Alle datoer", "All dates")}</SelectItem>
                        {testDates.map((d) => (
                          <SelectItem key={d} value={d}>{dateLabelMap.get(d) ?? fmtDate(d)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* 3. Date range */}
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground px-1">Date from:</span>
                        <div className="relative h-8 w-[130px]">
                          <input type="date" value={testDateFrom} onChange={e => setTestDateFrom(e.target.value)}
                            className="h-full w-full cursor-pointer rounded-md border border-input bg-background px-3 text-xs [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-inner-spin-button]:hidden" />
                          <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-xs">
                            {testDateFrom ? fmtDate(testDateFrom) : <span className="text-muted-foreground">—</span>}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 mt-4">–</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground px-1">Date to:</span>
                        <div className="relative h-8 w-[130px]">
                          <input type="date" value={testDateTo} onChange={e => setTestDateTo(e.target.value)}
                            className="h-full w-full cursor-pointer rounded-md border border-input bg-background px-3 text-xs [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-inner-spin-button]:hidden" />
                          <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-xs">
                            {testDateTo ? fmtDate(testDateTo) : <span className="text-muted-foreground">—</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* 4. Test type */}
                    <Select value={testTypeFilter} onValueChange={setTestTypeFilter}>
                      <SelectTrigger className="h-8 min-w-[140px] text-xs" data-testid="select-test-type-filter">
                        <SelectValue placeholder={L("Alle typer", "All types")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{L("Alle typer", "All types")}</SelectItem>
                        <SelectItem value="Classic">Classic</SelectItem>
                        <SelectItem value="Skating">Skating</SelectItem>
                        <SelectItem value="Double Poling">Double Poling</SelectItem>
                      </SelectContent>
                    </Select>
                    {/* 5. Location */}
                    <Input
                      value={testLocationFilter}
                      onChange={e => setTestLocationFilter(e.target.value)}
                      placeholder={L("Sted…", "Location…")}
                      className="h-8 min-w-[140px] text-xs"
                    />
                    {/* Extra: Sort */}
                    <Select value={testSortBy} onValueChange={setTestSortBy}>
                      <SelectTrigger className="h-8 min-w-[130px] text-xs" data-testid="select-test-sort">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-desc">Date ↓</SelectItem>
                        <SelectItem value="date-asc">Date ↑</SelectItem>
                        <SelectItem value="location-asc">{L("Sted A–Å", "Location A-Z")}</SelectItem>
                        <SelectItem value="location-desc">{L("Sted Å–A", "Location Z-A")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant={(showTestWeatherFilters || !!(testAirTempMin || testAirTempMax || testSnowTempMin || testSnowTempMax || testAirHumMin || testAirHumMax || testSnowHumMin || testSnowHumMax || testTrackHardness || testSnowHumidityType || testGrainSize || testArtSnow || testNatSnow || testPrecipitation || testWind || testVisibility || testCloudMin || testCloudMax)) ? "default" : "outline"}
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => setShowTestWeatherFilters(v => !v)}
                    >
                      <Snowflake className="h-3 w-3" />
                      Weather
                    </Button>
                    {(testLocationFilter || testSeasonFilter !== "all" || testDateFrom || testDateTo || testAirTempMin || testAirTempMax || testSnowTempMin || testSnowTempMax || testAirHumMin || testAirHumMax || testSnowHumMin || testSnowHumMax || testTrackHardness || testSnowHumidityType || testGrainSize || testArtSnow || testNatSnow || testPrecipitation || testWind || testVisibility || testCloudMin || testCloudMax) && (
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setTestLocationFilter(""); setTestSeasonFilter("all"); setTestDateFrom(""); setTestDateTo(""); setTestAirTempMin(""); setTestAirTempMax(""); setTestSnowTempMin(""); setTestSnowTempMax(""); setTestAirHumMin(""); setTestAirHumMax(""); setTestSnowHumMin(""); setTestSnowHumMax(""); setTestTrackHardness(""); setTestSnowHumidityType(""); setTestGrainSize(""); setTestArtSnow(""); setTestNatSnow(""); setTestPrecipitation(""); setTestWind(""); setTestVisibility(""); setTestCloudMin(""); setTestCloudMax(""); }}>
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                  {showTestWeatherFilters && (
                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                      <div className="space-y-4">
                        <div>
                          <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{L("Temperatur og fuktighet", "Temperature & Humidity")}</div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />Air temp (°C)
                              </label>
                              <div className="flex items-center gap-1">
                                <Input type="number" className="h-7 text-xs" placeholder="Min" value={testAirTempMin} onChange={e => setTestAirTempMin(e.target.value)} />
                                <span className="text-xs">–</span>
                                <Input type="number" className="h-7 text-xs" placeholder={L("Maks", "Max")} value={testAirTempMax} onChange={e => setTestAirTempMax(e.target.value)} />
                              </div>
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />Snow temp (°C)
                              </label>
                              <div className="flex items-center gap-1">
                                <Input type="number" className="h-7 text-xs" placeholder="Min" value={testSnowTempMin} onChange={e => setTestSnowTempMin(e.target.value)} />
                                <span className="text-xs">–</span>
                                <Input type="number" className="h-7 text-xs" placeholder={L("Maks", "Max")} value={testSnowTempMax} onChange={e => setTestSnowTempMax(e.target.value)} />
                              </div>
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400" />Air humidity (%)
                              </label>
                              <div className="flex items-center gap-1">
                                <Input type="number" className="h-7 text-xs" placeholder="Min" value={testAirHumMin} onChange={e => setTestAirHumMin(e.target.value)} />
                                <span className="text-xs">–</span>
                                <Input type="number" className="h-7 text-xs" placeholder={L("Maks", "Max")} value={testAirHumMax} onChange={e => setTestAirHumMax(e.target.value)} />
                              </div>
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />Snow humidity (%)
                              </label>
                              <div className="flex items-center gap-1">
                                <Input type="number" className="h-7 text-xs" placeholder="Min" value={testSnowHumMin} onChange={e => setTestSnowHumMin(e.target.value)} />
                                <span className="text-xs">–</span>
                                <Input type="number" className="h-7 text-xs" placeholder={L("Maks", "Max")} value={testSnowHumMax} onChange={e => setTestSnowHumMax(e.target.value)} />
                              </div>
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-300" />Cloud cover (%)
                              </label>
                              <div className="flex items-center gap-1">
                                <Input type="number" className="h-7 text-xs" placeholder="Min" value={testCloudMin} onChange={e => setTestCloudMin(e.target.value)} />
                                <span className="text-xs">–</span>
                                <Input type="number" className="h-7 text-xs" placeholder={L("Maks", "Max")} value={testCloudMax} onChange={e => setTestCloudMax(e.target.value)} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{L("Snøtype", "Snow Type")}</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />Artificial snow
                              </label>
                              <Select value={testArtSnow || "__any__"} onValueChange={v => setTestArtSnow(v === "__any__" ? "" : v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__any__">— Any —</SelectItem>
                                  {SNOW_STAGE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-400" />Natural snow
                              </label>
                              <Select value={testNatSnow || "__any__"} onValueChange={v => setTestNatSnow(v === "__any__" ? "" : v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__any__">— Any —</SelectItem>
                                  {SNOW_STAGE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />Snow humidity type
                              </label>
                              <Select value={testSnowHumidityType || "__any__"} onValueChange={v => setTestSnowHumidityType(v === "__any__" ? "" : v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__any__">— Any —</SelectItem>
                                  {SNOW_HUMIDITY_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-lime-400" />Grain size
                              </label>
                              <Select value={testGrainSize || "__any__"} onValueChange={v => setTestGrainSize(v === "__any__" ? "" : v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__any__">— Any —</SelectItem>
                                  {GRAIN_SIZE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{L("Snø og spor", "Snow & Track")}</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />Track hardness
                              </label>
                              <Select value={testTrackHardness || "__any__"} onValueChange={v => setTestTrackHardness(v === "__any__" ? "" : v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__any__">— Any —</SelectItem>
                                  {TRACK_HARDNESS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />Precipitation
                              </label>
                              <Input className="h-7 text-xs" placeholder="e.g. Snow" value={testPrecipitation} onChange={e => setTestPrecipitation(e.target.value)} />
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />Wind
                              </label>
                              <Input className="h-7 text-xs" placeholder="e.g. NW 3m/s" value={testWind} onChange={e => setTestWind(e.target.value)} />
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />Visibility
                              </label>
                              <Input className="h-7 text-xs" placeholder="e.g. Good" value={testVisibility} onChange={e => setTestVisibility(e.target.value)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick day select */}
                  {testDates.length > 0 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <CalendarDays className="h-3 w-3" />
                        Quick day select
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {testDates.slice(0, 10).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              const isSelecting = quickTestDayDate !== d;
                              setQuickTestDayDate(isSelecting ? d : "");
                              if (isSelecting) {
                                setExpandedTestIds(new Set(
                                  raceSkiTests
                                    .filter(t => t.date === d)
                                    .map(t => t.id)
                                ));
                              }
                            }}
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                              quickTestDayDate === d
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                            )}
                          >
                            {fmtDate(d)}
                          </button>
                        ))}
                        {testDates.length > 10 && (
                          <Select
                            value={quickTestDayDate && !testDates.slice(0, 10).includes(quickTestDayDate) ? quickTestDayDate : "__none__"}
                            onValueChange={(v) => {
                              const date = v === "__none__" ? "" : v;
                              setQuickTestDayDate(date);
                              if (date) {
                                setExpandedTestIds(new Set(
                                  raceSkiTests.filter(t => t.date === date).map(t => t.id)
                                ));
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 min-w-[160px] text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {testDates.slice(10).map((d) => (
                                <SelectItem key={d} value={d}>{dateLabelMap.get(d) ?? fmtDate(d)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Column chooser bar */}
              {!showTestForm && raceSkiTests.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-2.5" data-testid="test-column-chooser">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">Columns:</span>
                    {allTestColumns.map((col) => (
                      <div
                        key={col.key}
                        className="flex items-center gap-1.5 cursor-pointer select-none"
                        data-testid={`col-toggle-${col.key}`}
                        onClick={() =>
                          setActiveTestColumns((prev) =>
                            prev.includes(col.key)
                              ? prev.filter((k) => k !== col.key)
                              : [...prev, col.key]
                          )
                        }
                      >
                        <Checkbox
                          checked={activeTestColumns.includes(col.key)}
                          className="h-3.5 w-3.5 pointer-events-none"
                        />
                        <span className="text-xs">{col.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Inline Test Form */}
              {showTestForm && (
                <Card className="fs-card rounded-2xl p-4" data-testid="card-new-test-form">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">{L("Ny konkurranseski-test", "New Raceski Test")}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTestForm(false)}
                      data-testid="button-cancel-test"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Date *</label>
                      <Input
                        type="date"
                        value={testForm.date}
                        onChange={(e) => setTestForm((f) => ({ ...f, date: e.target.value }))}
                        required
                        data-testid="input-test-date"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Location *</label>
                      <Input
                        value={testForm.location}
                        onChange={(e) => setTestForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="e.g., Davos"
                        data-testid="input-test-location"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">{L("Testtype", "Test Type")}</label>
                      <Select
                        value={testForm.testType}
                        onValueChange={(v) => setTestForm((f) => ({ ...f, testType: v as "Classic" | "Skating" | "Double Poling" }))}
                      >
                        <SelectTrigger data-testid="select-test-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Classic">Classic</SelectItem>
                          <SelectItem value="Skating">Skating</SelectItem>
                          <SelectItem value="Double Poling">Double Poling</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">{L("Vær", "Weather")}</label>
                      <Select
                        value={testForm.weatherId != null ? String(testForm.weatherId) : "__auto__"}
                        onValueChange={(v) => setTestForm((f) => ({ ...f, weatherId: v === "__auto__" ? undefined : Number(v) }))}
                      >
                        <SelectTrigger data-testid="select-test-weather">
                          <SelectValue
                            placeholder={
                              autoWeather
                                ? `Auto: ${autoWeather.location} ${autoWeather.time}`
                                : "Select weather"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__auto__" data-testid="option-weather-auto">
                            {autoWeather ? `Auto: ${autoWeather.location} ${autoWeather.time}` : "Auto (match by date + location)"}
                          </SelectItem>
                          {weather.map((w) => (
                            <SelectItem key={w.id} value={String(w.id)} data-testid={`option-weather-${w.id}`}>
                              {fmtDate(w.date)} · {w.location} · {w.time} · Air {w.airTemperatureC}°C
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
                    <div className="lg:col-span-3">
                      <label className="mb-1 block text-sm font-medium">{L("Notater", "Notes")}</label>
                      <Textarea
                        value={testForm.notes}
                        onChange={(e) => setTestForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder={L("Valgfrie notater…", "Optional notes…")}
                        className="h-9 min-h-[36px] resize-none"
                        data-testid="input-test-notes"
                      />
                    </div>
                  </div>

                  {/* Ski Selection */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium">{L("Velg ski for denne testen", "Select skis for this test")}</label>
                    {(() => {
                      const raceTestTypes = ["Classic", "Skating", "Double Poling"];
                      const disciplineFiltered = raceTestTypes.includes(testForm.testType)
                        ? skis.filter((s) => s.discipline === testForm.testType)
                        : skis;
                      const q = skiSearchQuery.toLowerCase().trim();
                      const filteredSkis = q
                        ? disciplineFiltered.filter((s) =>
                            [s.skiId, s.serialNumber, s.brand, s.grind, s.discipline]
                              .filter(Boolean)
                              .some((field) => field!.toLowerCase().includes(q))
                          )
                        : disciplineFiltered;
                      return disciplineFiltered.length === 0 ? (
                      <p className="text-sm text-muted-foreground" data-testid="text-no-skis-for-test">
                        No {raceTestTypes.includes(testForm.testType) ? `${testForm.testType} ` : ""}skis available. {skis.length > 0 ? "Try a different test type or add skis with the right discipline." : "Add skis to this athlete first."}
                      </p>
                    ) : (
                      <>
                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            value={skiSearchQuery}
                            onChange={(e) => setSkiSearchQuery(e.target.value)}
                            placeholder={L("Søk serienummer, ski-ID, merke, slip…", "Search serial number, ski ID, brand, grind…")}
                            className="h-8 pl-8 text-sm"
                            data-testid="input-ski-search"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {filteredSkis.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No skis matching "{skiSearchQuery}"</p>
                          ) : (
                            filteredSkis.map((ski) => (
                              <button
                                key={ski.id}
                                type="button"
                                onClick={() => toggleSkiSelection(ski.id)}
                                className={cn(
                                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all",
                                  selectedSkiIds.has(ski.id)
                                    ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800"
                                    : "border-border bg-background/50 text-muted-foreground hover:border-indigo-300 hover:bg-indigo-50/50",
                                )}
                                data-testid={`button-select-ski-${ski.id}`}
                              >
                                <div className={cn(
                                  "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                                  selectedSkiIds.has(ski.id) ? "bg-indigo-500 border-indigo-500" : "border-border",
                                )}>
                                  {selectedSkiIds.has(ski.id) && (
                                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <span className="font-semibold">{ski.skiId}</span>
                                {ski.serialNumber && <span className="text-xs text-muted-foreground">#{ski.serialNumber}</span>}
                                {ski.brand && <span className="text-xs text-muted-foreground">{ski.brand}</span>}
                                {ski.grind && <span className="text-xs text-muted-foreground">· {ski.grind}</span>}
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    );
                    })()}
                  </div>

                  {/* Test Entry Table */}
                  {testRows.length > 0 && (
                    <div className="overflow-x-auto rounded-2xl border bg-card/50">
                      <div className="flex items-center justify-end px-3 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setEditParamsOpen(true)}
                          data-testid="button-edit-parameters"
                        >
                          <Settings2 className="h-3.5 w-3.5 mr-1" />
                          Edit parameters
                        </Button>
                      </div>

                      <Dialog open={editParamsOpen} onOpenChange={setEditParamsOpen}>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle>{L("Rediger parametre", "Edit Parameters")}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{L("Aktive kolonner", "Active columns")}</div>
                            {activeParams.length === 0 && (
                              <p className="text-sm text-muted-foreground">{L("Ingen parametre valgt", "No parameters selected")}</p>
                            )}
                            <div className="space-y-1">
                              {activeParams.map((key, idx) => (
                                <div
                                  key={key}
                                  className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5"
                                  data-testid={`param-active-${key}`}
                                >
                                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                                  <span className="text-sm flex-1">{getParamLabel(key)}{!builtInTestParams.some(p => p.key === key) && <span className="ml-1 text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 px-1 rounded">custom</span>}</span>
                                  <button
                                    type="button"
                                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                    onClick={() => moveParamUp(idx)}
                                    disabled={idx === 0}
                                    data-testid={`button-param-up-${key}`}
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                    onClick={() => moveParamDown(idx)}
                                    disabled={idx === activeParams.length - 1}
                                    data-testid={`button-param-down-${key}`}
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="p-0.5 text-red-400 hover:text-red-300"
                                    onClick={() => removeParam(key)}
                                    data-testid={`button-param-remove-${key}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {inactiveParams.length > 0 && (
                              <>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">{L("Tilgjengelige", "Available")}</div>
                                <div className="space-y-1">
                                  {inactiveParams.map((p) => (
                                    <div
                                      key={p.key}
                                      className="flex items-center gap-1.5 rounded-lg border border-dashed bg-background/50 px-2 py-1.5"
                                      data-testid={`param-inactive-${p.key}`}
                                    >
                                      <span className="text-sm text-muted-foreground flex-1">{p.label}{!builtInTestParams.some(bp => bp.key === p.key) && <span className="ml-1 text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 px-1 rounded">custom</span>}</span>
                                      <button
                                        type="button"
                                        className="p-0.5 text-emerald-400 hover:text-emerald-300"
                                        onClick={() => addParam(p.key)}
                                        data-testid={`button-param-add-${p.key}`}
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      <table className="w-full border-separate border-spacing-0" style={{ minWidth: `${400 + distanceLabels.length * 200}px` }}>
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="sticky left-0 z-10 bg-card/80 px-3 py-3">{L("Ski-ID", "Ski ID")}</th>
                            {activeParams.map((key) => (
                              <th key={key} className="px-2 py-3">{getParamLabel(key)}</th>
                            ))}
                            {distanceLabels.map((label, roundIdx) => (
                              <th key={roundIdx} className="px-3 py-3" colSpan={2}>
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={label}
                                    onChange={(e) => {
                                      const next = [...distanceLabels];
                                      next[roundIdx] = e.target.value;
                                      setDistanceLabels(next);
                                    }}
                                    className="h-7 w-24 text-xs bg-background/70"
                                    placeholder={`Round ${roundIdx + 1}`}
                                    data-testid={`input-test-distance-label-${roundIdx}`}
                                  />
                                  {distanceLabels.length > 1 && (
                                    <button
                                      type="button"
                                      className="text-red-400 hover:text-red-300 transition-colors"
                                      onClick={() => {
                                        setDistanceLabels(distanceLabels.filter((_, i) => i !== roundIdx));
                                        setTestRows(testRows.map((r) => ({
                                          ...r,
                                          roundResults: r.roundResults.filter((_, i) => i !== roundIdx),
                                        })));
                                      }}
                                      data-testid={`button-remove-test-round-${roundIdx}`}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </th>
                            ))}
                            <th className="px-3 py-3">{L("Følelse", "Feeling")}</th>
                            <th className="px-1 py-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                onClick={() => {
                                  setDistanceLabels([...distanceLabels, ""]);
                                  setTestRows(testRows.map((r) => ({
                                    ...r,
                                    roundResults: [...r.roundResults, { result: null, rank: null }],
                                  })));
                                }}
                                data-testid="button-add-test-round"
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Round
                              </Button>
                            </th>
                          </tr>
                          <tr className="text-left text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                            <th className="sticky left-0 z-10 bg-card/80"></th>
                            {activeParams.map((key) => (
                              <th key={key}></th>
                            ))}
                            {distanceLabels.map((_, roundIdx) => (
                              <React.Fragment key={roundIdx}>
                                <th className="px-3 pb-1">{L("Resultat (cm)", "Result (cm)")}</th>
                                <th className="px-3 pb-1">{L("Rang", "Rank")}</th>
                              </React.Fragment>
                            ))}
                            <th></th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {testRows.map((row, idx) => {
                            const rankBadge = (rank: number | null) => (
                              <div
                                className={cn(
                                  "inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold",
                                  rank === 1
                                    ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                                    : rank === 2
                                      ? "bg-slate-300/15 text-slate-500 dark:text-slate-300"
                                      : rank === 3
                                        ? "bg-amber-700/15 text-amber-700 dark:text-amber-600"
                                        : "bg-muted/70 text-foreground",
                                )}
                              >
                                {rank ?? "—"}
                              </div>
                            );

                            return (
                              <tr
                                key={row.id}
                                className={cn(
                                  "border-t",
                                  idx % 2 === 0 ? "bg-background/30" : "bg-background/10",
                                )}
                                data-testid={`row-test-entry-${row.raceSkiId}`}
                              >
                                <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                                  <div
                                    className="inline-flex h-9 items-center justify-center rounded-xl border bg-background/70 px-2 text-sm font-semibold"
                                    data-testid={`text-test-ski-id-${row.raceSkiId}`}
                                  >
                                    {row.skiId}
                                  </div>
                                </td>
                                {activeParams.map((key) => (
                                  <td key={key} className="px-2 py-2 text-xs text-muted-foreground" data-testid={`text-test-${key}-${row.raceSkiId}`}>
                                    {(row as any)[key] || "—"}
                                  </td>
                                ))}
                                {row.roundResults.map((rr, roundIdx) => (
                                  <React.Fragment key={roundIdx}>
                                    <td className="px-3 py-2">
                                      <Input
                                        inputMode="decimal"
                                        type="number"
                                        value={rr.result ?? ""}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          const num = v === "" ? null : Number(v);
                                          setTestRows(testRows.map((r) => {
                                            if (r.id !== row.id) return r;
                                            const newRounds = [...r.roundResults];
                                            newRounds[roundIdx] = { ...newRounds[roundIdx], result: Number.isNaN(num) ? null : num };
                                            return { ...r, roundResults: newRounds };
                                          }));
                                        }}
                                        className="h-9 w-20 bg-background/70"
                                        placeholder="0"
                                        data-testid={`input-test-result-${roundIdx}-${row.raceSkiId}`}
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      {rankBadge(rr.rank)}
                                    </td>
                                  </React.Fragment>
                                ))}
                                <td className="px-3 py-2">
                                  <Input
                                    inputMode="numeric"
                                    type="number"
                                    min={1}
                                    value={row.feelingRank ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      const num = v === "" ? null : Number(v);
                                      setTestRows(testRows.map((r) => r.id === row.id ? { ...r, feelingRank: Number.isNaN(num) ? null : num } : r));
                                    }}
                                    className="h-9 w-16 bg-background/70"
                                    placeholder="—"
                                    data-testid={`input-test-feeling-${row.raceSkiId}`}
                                  />
                                </td>
                                <td></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTestForm(false)}
                      data-testid="button-cancel-test-form"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => createTestMutation.mutate()}
                      disabled={createTestMutation.isPending || !testForm.date || !testForm.location.trim()}
                      data-testid="button-save-test"
                    >
                      {createTestMutation.isPending ? "Saving…" : "Save Test"}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Existing Race Ski Tests */}
              {raceSkiTests.length === 0 && !showTestForm ? (
                <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-tests">
                  No race ski tests yet.
                </Card>
              ) : testViewMode === "list" ? (
                <TestListView tests={filteredTests} skiIds={skiIds} allSkis={skis} activeTestColumns={activeTestColumns} weather={weather} />
              ) : (
                filteredTests.map((test) => (
                  <RaceSkiTestCard
                    key={test.id}
                    test={test}
                    skiIds={skiIds}
                    allSkis={skis}
                    activeTestColumns={activeTestColumns}
                    weather={weather}
                    expanded={expandedTestIds.has(test.id)}
                    onToggle={() => toggleTestExpanded(test.id)}
                    athleteName={athlete?.name}
                    currentUserId={user?.id}
                    isReadOnly={isAthletePortal}
                  />
                ))
              )}
            </div>
          )}
        </div>
        )} {/* end tests tab */}
      </div>

      {/* CSV Import Dialog */}
      <Dialog open={csvImportOpen} onOpenChange={(v) => { setCsvImportOpen(v); if (!v) { setCsvPreviewRows([]); setCsvHeaders([]); setCsvImportProgress(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import Skis from CSV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Expected columns (first row = headers):</p>
              <p className="font-mono text-xs">skiId, brand, discipline, base, grind, construction, mold, heights, year, serialNumber</p>
              <p className="mt-1 text-xs">Comma or tab-separated. Only <code>skiId</code> is required.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{L("Velg CSV-fil", "Select CSV file")}</label>
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const text = ev.target?.result as string;
                    const { headers, rows } = parseCsv(text);
                    setCsvHeaders(headers);
                    setCsvPreviewRows(rows);
                  };
                  reader.readAsText(file);
                }}
              />
            </div>
            {csvPreviewRows.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Preview (first 5 rows of {csvPreviewRows.length}):</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-muted/40">
                        {csvHeaders.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreviewRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-background/30" : "bg-background/10"}>
                          {csvHeaders.map((h) => (
                            <td key={h} className="px-3 py-1.5 border-t border-border/30">{row[h] || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {csvImportProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Importing…</span>
                  <span>{csvImportProgress.done} / {csvImportProgress.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-200"
                    style={{ width: `${Math.round((csvImportProgress.done / csvImportProgress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setCsvImportOpen(false)}>{L("Avbryt", "Cancel")}</Button>
              <Button
                size="sm"
                disabled={csvPreviewRows.length === 0 || !!csvImportProgress}
                onClick={handleCsvImport}
                data-testid="button-confirm-csv-import"
              >
                {csvImportProgress ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Importing…</>
                ) : (
                  <><Upload className="mr-1.5 h-3.5 w-3.5" />Import {csvPreviewRows.length} ski{csvPreviewRows.length !== 1 ? "s" : ""}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Ski Dialog */}
      <Dialog
        open={skiDialogOpen}
        onOpenChange={(v) => {
          setSkiDialogOpen(v);
          if (!v) { setEditingSki(null); resetSkiForm(); }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSki ? t("common.edit") : t("raceskis.addSki")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSkiSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">{t("raceskis.skiId")} *</label>
              <Input
                value={skiForm.skiId}
                onChange={(e) => setSkiForm((f) => ({ ...f, skiId: e.target.value }))}
                required
                data-testid="input-ski-id"
              />
            </div>

            {activeFormFields.map((fieldKey) => {
              if (fieldKey === "heights" && skiForm.discipline !== "Classic") return null;
              const custom = isCustomField(fieldKey);
              if (fieldKey === "discipline") {
                return (
                  <div key={fieldKey}>
                    <label className="mb-1 block text-sm font-medium">{getFormFieldLabel(fieldKey)}</label>
                    <Select
                      value={skiForm.discipline}
                      onValueChange={(v) => setSkiForm((f) => ({ ...f, discipline: v }))}
                    >
                      <SelectTrigger data-testid="select-ski-discipline">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Classic">Classic</SelectItem>
                        <SelectItem value="Skating">Skating</SelectItem>
                        <SelectItem value="Double Poling">Double Poling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              if (fieldKey === "typeOfSki") {
                return (
                  <div key={fieldKey}>
                    <label className="mb-1 block text-sm font-medium">{getFormFieldLabel(fieldKey)}</label>
                    <Select value={skiForm.typeOfSki || "__none__"} onValueChange={(v) => setSkiForm((f) => ({ ...f, typeOfSki: v === "__none__" ? "" : v }))}>
                      <SelectTrigger data-testid="select-ski-type"><SelectValue placeholder={L("Ingen", "None")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{L("Ingen", "None")}</SelectItem>
                        <SelectItem value="Hard Wax">Hard Wax</SelectItem>
                        <SelectItem value="Klister/Cover">Klister/Cover</SelectItem>
                        <SelectItem value="Klister">Klister</SelectItem>
                        <SelectItem value="Zero">Zero</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return (
                <div key={fieldKey}>
                  <label className="mb-1 block text-sm font-medium">{getFormFieldLabel(fieldKey)}</label>
                  <Input
                    value={custom ? (customFieldValues[fieldKey] ?? "") : ((skiForm as any)[fieldKey] ?? "")}
                    onChange={(e) => {
                      if (custom) {
                        setCustomFieldValues((prev) => ({ ...prev, [fieldKey]: e.target.value }));
                      } else {
                        setSkiForm((f) => ({ ...f, [fieldKey]: e.target.value }));
                      }
                    }}
                    data-testid={`input-ski-${fieldKey}`}
                  />
                </div>
              );
            })}

            {/* Colour tag field */}
            <div>
              <label className="mb-2 block text-sm font-medium">{L("Fargemerke", "Colour tag")}</label>
              <div className="flex flex-wrap gap-2">
                {SKI_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    onClick={() => setSkiForm((f) => ({ ...f, color: c.id === "none" ? "" : c.id }))}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all",
                      c.id === "none"
                        ? "bg-muted/60 border-border"
                        : `${c.dot} border-transparent`,
                      (c.id === "none" ? (!skiForm.color || skiForm.color === "none") : skiForm.color === c.id)
                        ? "ring-2 ring-offset-1 ring-foreground/40 scale-110"
                        : "hover:scale-105"
                    )}
                    aria-pressed={c.id === "none" ? (!skiForm.color || skiForm.color === "none") : skiForm.color === c.id}
                  />
                ))}
              </div>
            </div>

            {/* Notes (always visible in the garage) */}
            <div>
              <label className="mb-1 block text-sm font-medium">{L("Notat", "Note")}</label>
              <textarea
                value={skiForm.notes}
                onChange={(e) => setSkiForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder={L("Synlig på skiparet i garasjen…", "Shown on the ski pair in the garage…")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="textarea-ski-notes"
              />
            </div>

            {/* Training-ski toggle */}
            <button
              type="button"
              onClick={() => setSkiForm((f) => ({ ...f, isTrainingSki: !f.isTrainingSki }))}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors",
                skiForm.isTrainingSki ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20" : "border-border bg-muted/30"
              )}
              data-testid="toggle-training-ski"
            >
              <span className="font-medium">{L("Treningsski", "Training ski")}</span>
              <span className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", skiForm.isTrainingSki ? "bg-amber-500" : "bg-muted-foreground/30")}>
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", skiForm.isTrainingSki ? "translate-x-4" : "translate-x-0.5")} />
              </span>
            </button>

            <div className="flex items-center justify-between pt-2 pb-16 sm:pb-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setEditFormFieldsOpen(true)}
                data-testid="button-edit-ski-form-fields"
              >
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                {L("Rediger parametre", "Edit parameters")}
              </Button>
              <Button
                type="submit"
                data-testid="button-save-ski"
                disabled={createSkiMutation.isPending || updateSkiMutation.isPending || !skiForm.skiId.trim()}
              >
                {(createSkiMutation.isPending || updateSkiMutation.isPending) ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}
              </Button>
            </div>
          </form>

          <Dialog open={editFormFieldsOpen} onOpenChange={setEditFormFieldsOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{L("Rediger parametre", "Edit Parameters")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{L("Aktive felt", "Active fields")}</div>
                {activeFormFields.length === 0 && (
                  <p className="text-sm text-muted-foreground">{L("Ingen felt valgt", "No fields selected")}</p>
                )}
                <div className="space-y-1">
                  {activeFormFields.map((key, idx) => (
                    <div
                      key={key}
                      className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5"
                      data-testid={`form-field-active-${key}`}
                    >
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      <span className="text-sm flex-1">{getFormFieldLabel(key)}</span>
                      {isCustomField(key) && (
                        <span className="text-[10px] text-muted-foreground/60 bg-muted/50 rounded px-1">custom</span>
                      )}
                      <button
                        type="button"
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => moveFormFieldUp(idx)}
                        disabled={idx === 0}
                        data-testid={`button-form-field-up-${key}`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => moveFormFieldDown(idx)}
                        disabled={idx === activeFormFields.length - 1}
                        data-testid={`button-form-field-down-${key}`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className={cn("p-0.5", isCustomField(key) ? "text-red-400 hover:text-red-300" : "text-red-400 hover:text-red-300")}
                        onClick={() => isCustomField(key) ? deleteCustomField(key) : removeFormField(key)}
                        data-testid={`button-form-field-remove-${key}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {inactiveFormFields.length > 0 && (
                  <>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">{L("Tilgjengelige", "Available")}</div>
                    <div className="space-y-1">
                      {inactiveFormFields.map((f) => (
                        <div
                          key={f.key}
                          className="flex items-center gap-1.5 rounded-lg border border-dashed bg-background/50 px-2 py-1.5"
                          data-testid={`form-field-inactive-${f.key}`}
                        >
                          <span className="text-sm text-muted-foreground flex-1">{f.label}</span>
                          <button
                            type="button"
                            className="p-0.5 text-emerald-400 hover:text-emerald-300"
                            onClick={() => addFormField(f.key)}
                            data-testid={`button-form-field-add-${f.key}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="border-t pt-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{L("Legg til egendefinert parameter", "Add custom parameter")}</div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newCustomFieldName}
                      onChange={(e) => setNewCustomFieldName(e.target.value)}
                      placeholder={L("Parameternavn…", "Parameter name…")}
                      className="h-8 text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomField(); } }}
                      data-testid="input-new-custom-field"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 shrink-0"
                      onClick={addCustomField}
                      disabled={!newCustomFieldName.trim()}
                      data-testid="button-add-custom-field"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      {/* Regrind Dialog */}
      <Dialog
        open={regrindDialogOpen}
        onOpenChange={(v) => {
          setRegrindDialogOpen(v);
          if (!v) { setRegrindSkiId(null); resetRegrindForm(); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("raceskis.addRegrind")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegrindSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Date *</label>
              <Input
                type="date"
                value={regrindForm.date}
                onChange={(e) => setRegrindForm((f) => ({ ...f, date: e.target.value }))}
                required
                data-testid="input-regrind-date"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("raceskis.grindType")} *</label>
              <Input
                value={regrindForm.grindType}
                onChange={(e) => setRegrindForm((f) => ({ ...f, grindType: e.target.value }))}
                required
                data-testid="input-regrind-type"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("raceskis.stone")}</label>
              <Input
                value={regrindForm.stone}
                onChange={(e) => setRegrindForm((f) => ({ ...f, stone: e.target.value }))}
                data-testid="input-regrind-stone"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t("raceskis.pattern")}</label>
              <Input
                value={regrindForm.pattern}
                onChange={(e) => setRegrindForm((f) => ({ ...f, pattern: e.target.value }))}
                data-testid="input-regrind-pattern"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{L("Notater", "Notes")}</label>
              <Input
                value={regrindForm.notes}
                onChange={(e) => setRegrindForm((f) => ({ ...f, notes: e.target.value }))}
                data-testid="input-regrind-notes"
              />
            </div>
            <div className="flex items-center justify-end pt-2">
              <Button
                type="submit"
                data-testid="button-save-regrind"
                disabled={createRegrindMutation.isPending || !regrindForm.grindType.trim()}
              >
                {createRegrindMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Access Dialog */}
      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("raceskis.manageAccess")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">{L("Ingen brukere tilgjengelig.", "No users available.")}</p>
            ) : (
              users
                .filter((u) => u.id !== athlete?.createdById)
                .map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer"
                    data-testid={`checkbox-access-user-${u.id}`}
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(u.id)}
                      onCheckedChange={(checked) => {
                        setSelectedUserIds((prev) =>
                          checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                        );
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </label>
                ))
            )}
          </div>
          <div className="flex items-center justify-end pt-2">
            <Button
              data-testid="button-save-access"
              onClick={() => updateAccessMutation.mutate(selectedUserIds)}
              disabled={updateAccessMutation.isPending}
            >
              {updateAccessMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Athlete Dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{L("Tilbakemeldingslenke", "Feedback link")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {L("Send denne lenken til utøveren. De rangerer skiene (Competitive±) og legger inn kommentar etter renn — svarene vises på skiparenes løpsbruk.",
               "Send this link to the athlete. They rate the skis (Competitive±) and comment after races — responses appear on the ski pairs' race usage.")}
          </p>
          <div className="flex items-center gap-2">
            <Input value={feedbackUrl} readOnly className="text-xs" data-testid="input-feedback-url" onFocus={(e) => e.currentTarget.select()} />
            <Button size="sm" onClick={() => { try { navigator.clipboard?.writeText(feedbackUrl); } catch {} setFeedbackCopied(true); setTimeout(() => setFeedbackCopied(false), 1500); }} data-testid="button-copy-feedback-url">
              {feedbackCopied ? L("Kopiert", "Copied") : L("Kopier", "Copy")}
            </Button>
          </div>
          <div className="flex justify-end pt-1">
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20" disabled={revokeFeedbackLink.isPending}
              onClick={() => { if (confirm(L("Trekke tilbake lenken? Den slutter å virke.", "Revoke this link? It will stop working."))) revokeFeedbackLink.mutate(); }}
              data-testid="button-revoke-feedback-link">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {L("Trekk tilbake lenke", "Revoke link")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editAthleteOpen} onOpenChange={setEditAthleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{L("Rediger", "Edit")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAthleteSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Name *</label>
              <Input
                value={athleteForm.name}
                onChange={(e) => setAthleteForm((f) => ({ ...f, name: e.target.value }))}
                required
                data-testid="input-edit-athlete-name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{L("Lag", "Team")}</label>
              <Input
                value={athleteForm.team}
                onChange={(e) => setAthleteForm((f) => ({ ...f, team: e.target.value }))}
                data-testid="input-edit-athlete-team"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{L("Standard skimerke", "Default ski brand")}</label>
              <Input
                value={athleteForm.brand}
                onChange={(e) => setAthleteForm((f) => ({ ...f, brand: e.target.value }))}
                placeholder={L("f.eks. Madshus", "e.g., Madshus")}
                data-testid="input-edit-athlete-brand"
              />
              <p className="mt-1 text-xs text-muted-foreground">{L("Fylles automatisk inn på nye skipar.", "Auto-fills on every new ski pair.")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{L("Høyde (cm)", "Height (cm)")}</label>
                <Input
                  value={athleteForm.heightCm}
                  onChange={(e) => setAthleteForm((f) => ({ ...f, heightCm: e.target.value }))}
                  placeholder="180"
                  data-testid="input-edit-athlete-height"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{L("Vekt (kg)", "Weight (kg)")}</label>
                <Input
                  value={athleteForm.weightKg}
                  onChange={(e) => setAthleteForm((f) => ({ ...f, weightKg: e.target.value }))}
                  placeholder="72"
                  data-testid="input-edit-athlete-weight"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{L("Stavhøyde", "Pole height")}</label>
                <Input
                  value={athleteForm.poleHeight}
                  onChange={(e) => setAthleteForm((f) => ({ ...f, poleHeight: e.target.value }))}
                  placeholder="152 cm"
                  data-testid="input-edit-athlete-pole-height"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{L("Bindingsposisjon", "Binding position")}</label>
                <Input
                  value={athleteForm.bindingPosition}
                  onChange={(e) => setAthleteForm((f) => ({ ...f, bindingPosition: e.target.value }))}
                  placeholder="0 / -1 cm"
                  data-testid="input-edit-athlete-binding"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{L("Ski-service-preferanser", "Ski-service preferences")}</label>
              <Textarea
                value={athleteForm.skiServicePreferences}
                onChange={(e) => setAthleteForm((f) => ({ ...f, skiServicePreferences: e.target.value }))}
                placeholder={L("f.eks. liker varm grunning, unngå fluor, foretrukket slip…", "e.g., prefers warm base prep, avoid fluor, preferred grind…")}
                rows={3}
                data-testid="input-edit-athlete-service-prefs"
              />
            </div>
            <div className="flex items-center justify-end pt-2">
              <Button
                type="submit"
                data-testid="button-save-edit-athlete"
                disabled={updateAthleteMutation.isPending || !athleteForm.name.trim()}
              >
                {updateAthleteMutation.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Test Columns Chooser Dialog */}
      <Dialog open={testColumnsDialogOpen} onOpenChange={setTestColumnsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{L("Kolonner for testresultat", "Test Result Columns")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">{L("Velg hvilke kolonner som vises i testresultater.", "Choose which columns to show in test results.")}</div>
            <div className="space-y-2">
              {allTestColumns.map((col) => {
                const isActive = activeTestColumns.includes(col.key);
                return (
                  <div
                    key={col.key}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer"
                    data-testid={`checkbox-test-col-${col.key}`}
                    onClick={() =>
                      setActiveTestColumns((prev) =>
                        prev.includes(col.key)
                          ? prev.filter((k) => k !== col.key)
                          : [...prev, col.key]
                      )
                    }
                  >
                    <Checkbox
                      checked={isActive}
                      className="pointer-events-none"
                    />
                    <span className="text-sm">{col.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Export PDF Dialog ────────────────────────────────────────────────── */}
      <Dialog open={exportPdfOpen} onOpenChange={setExportPdfOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-4 w-4" />
              {L("Eksporter til PDF", "Export to PDF")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              {L("Velg hva som skal med i rapporten. Alt er valgt som standard.", "Select which data to include in the report. All sections are selected by default.")}
            </p>
            <div className="space-y-2">
              {(
                [
                  { key: "summary", label: L("Ytelsessammendrag", "Performance Summary"), desc: L("Totaler og snittrang", "Totals & average rank") },
                  { key: "inventory", label: L("Skioversikt", "Ski Inventory"), desc: `${skis.length} ${L("ski", "skis")}` },
                  { key: "tests", label: L("Testresultater", "Test Results"), desc: `${raceSkiTests.length} ${L("tester", "tests")}` },
                  { key: "grindHistory", label: L("Sliphistorikk", "Grind History"), desc: L("Alle reslip-oppføringer", "All regrind records") },
                ] as { key: keyof typeof exportSections; label: string; desc: string }[]
              ).map(({ key, label, desc }) => (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => toggleExportSection(key)}
                >
                  <Checkbox checked={exportSections[key]} className="pointer-events-none shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            {exportSections.inventory && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium mb-2">{L("Parametre i skioversikten", "Ski inventory parameters")}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {pdfParamDefs.map((d) => (
                    <label key={d.key} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox checked={includeParam(d.key)} onCheckedChange={() => setExportSkiParams((p) => ({ ...p, [d.key]: p[d.key] === false }))} className="shrink-0" />
                      <span className="truncate">{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setExportPdfOpen(false)}>
                {L("Avbryt", "Cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleExportPDF}
                disabled={isExporting || !Object.values(exportSections).some(Boolean)}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    {L("Genererer…", "Generating…")}
                  </>
                ) : (
                  <>
                    <FileDown className="mr-1.5 h-3.5 w-3.5" />
                    {L("Generer PDF", "Generate PDF")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ─── Ski Suggestions Section ─────────────────────────────────────────────────

const SNOW_STAGE_OPTS = ["Falling new", "New", "Irreg. dir. new", "Irreg. dir. transf.", "Transformed"] as const;
const TRACK_HARDNESS_OPTS = ["Very soft", "Soft", "Medium hard", "Hard", "Very hard", "Ice"] as const;
const SNOW_HUM_TYPE_OPTS = ["Dry", "Moist", "Wet", "Very wet", "Slush"] as const;
const GRAIN_SIZE_OPTS = ["Extra fine", "Very fine", "Fine", "Average", "Coarse", "Very coarse"] as const;

function SkiSuggestionsSection({
  athleteId,
  skis,
  raceSkiTests,
  raceHistory,
}: {
  athleteId: number;
  skis: RaceSki[];
  raceSkiTests: RaceSkiTest[];
  raceHistory: AthleteRaceHistory[];
}) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [open, setOpen] = useState(false);
  const [discipline, setDiscipline] = useState<"Classic" | "Skating">("Classic");

  // Weather filter state
  const [sfSnowMin, setSfSnowMin] = useState("");
  const [sfSnowMax, setSfSnowMax] = useState("");
  const [sfAirMin, setSfAirMin] = useState("");
  const [sfAirMax, setSfAirMax] = useState("");
  const [sfAirHumMin, setSfAirHumMin] = useState("");
  const [sfAirHumMax, setSfAirHumMax] = useState("");
  const [sfSnowHumMin, setSfSnowHumMin] = useState("");
  const [sfSnowHumMax, setSfSnowHumMax] = useState("");
  const [sfSnowType, setSfSnowType] = useState("");
  const [sfTrackHardness, setSfTrackHardness] = useState("");
  const [sfArtSnow, setSfArtSnow] = useState("");
  const [sfNatSnow, setSfNatSnow] = useState("");
  const [sfSnowHumType, setSfSnowHumType] = useState("");
  const [sfGrainSize, setSfGrainSize] = useState("");
  const [sfPrecip, setSfPrecip] = useState("");
  const [sfWind, setSfWind] = useState("");
  const [sfVisibility, setSfVisibility] = useState("");
  const [sfCloudMin, setSfCloudMin] = useState("");
  const [sfCloudMax, setSfCloudMax] = useState("");

  const hasFilters = !!(sfSnowMin || sfSnowMax || sfAirMin || sfAirMax ||
    sfAirHumMin || sfAirHumMax || sfSnowHumMin || sfSnowHumMax ||
    sfSnowType || sfTrackHardness || sfArtSnow || sfNatSnow ||
    sfSnowHumType || sfGrainSize || sfPrecip || sfWind || sfVisibility ||
    sfCloudMin || sfCloudMax);

  // Fetch entries for all race ski tests (lazy — only when section is open)
  const testIds = useMemo(() => raceSkiTests.map((t) => t.id), [raceSkiTests]);
  const { data: allEntries = [] } = useQuery<TestEntry[]>({
    queryKey: [`/api/raceski-suggestions-entries/${athleteId}`, testIds],
    queryFn: async () => {
      if (testIds.length === 0) return [];
      const results = await Promise.all(
        testIds.map((id) => fetch(`/api/tests/${id}/entries`, { credentials: "include" }).then((r) => r.json()))
      );
      return results.flat();
    },
    enabled: open && testIds.length > 0,
    staleTime: 60_000,
  });

  // Build a weather map from the tests that have weatherId
  const weatherIds = useMemo(() => {
    const ids = new Set(raceSkiTests.map((t) => t.weatherId).filter((id): id is number => id != null));
    return Array.from(ids);
  }, [raceSkiTests]);

  const { data: weatherDetails = [] } = useQuery<WeatherItem[]>({
    queryKey: ["/api/weather/for-filtering"],
  });

  const weatherById = useMemo(() => {
    const map = new Map<number, WeatherItem>();
    for (const w of weatherDetails) map.set(w.id, w);
    return map;
  }, [weatherDetails]);

  // How many race history entries used each ski (by skiId string)
  const raceUsesBySkiId = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of raceHistory) {
      const ids = discipline === "Classic"
        ? [r.skiIdClassic, r.skiId].filter(Boolean) as string[]
        : [r.skiIdSkating, r.skiId].filter(Boolean) as string[];
      for (const id of ids) {
        map.set(id, (map.get(id) ?? 0) + 1);
      }
    }
    return map;
  }, [raceHistory, discipline]);

  // Compute suggestions
  const suggestions = useMemo(() => {
    if (!hasFilters) return null;

    // Filter skis by discipline
    const disciplineSkis = skis.filter(
      (s) => !s.archivedAt && (s.discipline === discipline || s.discipline === "Skiathlon")
    );
    if (disciplineSkis.length === 0) return { skis: [], matchingTestCount: 0 };

    const skiIdSet = new Set(disciplineSkis.map((s) => s.id));

    // Filter tests by discipline type
    const disciplineTests = raceSkiTests.filter((t) =>
      discipline === "Classic"
        ? t.testType === "Classic" || t.testType === "Skiathlon"
        : t.testType === "Skating" || t.testType === "Skiathlon"
    );

    // Parse filter values
    const toF = (v: string) => v !== "" ? parseFloat(v) : null;
    const snowMin = toF(sfSnowMin); const snowMax = toF(sfSnowMax);
    const airMin = toF(sfAirMin);   const airMax = toF(sfAirMax);
    const ahMin = toF(sfAirHumMin); const ahMax = toF(sfAirHumMax);
    const shMin = toF(sfSnowHumMin); const shMax = toF(sfSnowHumMax);
    const clMin = toF(sfCloudMin);  const clMax = toF(sfCloudMax);

    const autoSwap = (a: number | null, b: number | null): [number | null, number | null] =>
      a != null && b != null && a > b ? [b, a] : [a, b];
    const [effSnowMin, effSnowMax] = autoSwap(snowMin, snowMax);
    const [effAirMin, effAirMax] = autoSwap(airMin, airMax);
    const [effAhMin, effAhMax] = autoSwap(ahMin, ahMax);
    const [effShMin, effShMax] = autoSwap(shMin, shMax);
    const [effClMin, effClMax] = autoSwap(clMin, clMax);

    // Find tests whose weather matches ALL set filters
    const matchingTests = disciplineTests.filter((test) => {
      if (!test.weatherId) return false;
      const w = weatherById.get(test.weatherId);
      if (!w) return false;
      if (effSnowMin != null && (w.snowTemperatureC == null || w.snowTemperatureC < effSnowMin)) return false;
      if (effSnowMax != null && (w.snowTemperatureC == null || w.snowTemperatureC > effSnowMax)) return false;
      if (effAirMin != null && (w.airTemperatureC == null || w.airTemperatureC < effAirMin)) return false;
      if (effAirMax != null && (w.airTemperatureC == null || w.airTemperatureC > effAirMax)) return false;
      if (effAhMin != null && (w.airHumidityPct == null || w.airHumidityPct < effAhMin)) return false;
      if (effAhMax != null && (w.airHumidityPct == null || w.airHumidityPct > effAhMax)) return false;
      if (effShMin != null && (w.snowHumidityPct == null || w.snowHumidityPct < effShMin)) return false;
      if (effShMax != null && (w.snowHumidityPct == null || w.snowHumidityPct > effShMax)) return false;
      if (sfSnowType && !(w.snowType ?? "").toLowerCase().includes(sfSnowType.toLowerCase())) return false;
      if (sfTrackHardness && !(w.trackHardness ?? "").toLowerCase().includes(sfTrackHardness.toLowerCase())) return false;
      if (sfArtSnow && !(w.artificialSnow ?? "").toLowerCase().includes(sfArtSnow.toLowerCase())) return false;
      if (sfNatSnow && !(w.naturalSnow ?? "").toLowerCase().includes(sfNatSnow.toLowerCase())) return false;
      if (sfSnowHumType && !(w.snowHumidityType ?? "").toLowerCase().includes(sfSnowHumType.toLowerCase())) return false;
      if (sfGrainSize && !(w.grainSize ?? "").toLowerCase().includes(sfGrainSize.toLowerCase())) return false;
      if (sfPrecip && !(w.precipitation ?? "").toLowerCase().includes(sfPrecip.toLowerCase())) return false;
      if (sfWind && !(w.wind ?? "").toLowerCase().includes(sfWind.toLowerCase())) return false;
      if (sfVisibility && !(w.visibility ?? "").toLowerCase().includes(sfVisibility.toLowerCase())) return false;
      if (effClMin != null && (w.clouds == null || w.clouds < effClMin)) return false;
      if (effClMax != null && (w.clouds == null || w.clouds > effClMax)) return false;
      return true;
    });

    const matchingTestIds = new Set(matchingTests.map((t) => t.id));

    // Aggregate per ski
    const statsMap = new Map<number, { ranks: number[]; results: number[]; feelings: number[]; tests: Set<number> }>();
    for (const entry of allEntries) {
      if (!matchingTestIds.has(entry.testId)) continue;
      if (!entry.raceSkiId || !skiIdSet.has(entry.raceSkiId)) continue;
      let s = statsMap.get(entry.raceSkiId);
      if (!s) { s = { ranks: [], results: [], feelings: [], tests: new Set() }; statsMap.set(entry.raceSkiId, s); }
      s.tests.add(entry.testId);
      if (entry.rank0km != null) s.ranks.push(entry.rank0km);
      if (entry.result0kmCmBehind != null) s.results.push(entry.result0kmCmBehind);
      if (entry.feelingRank != null) s.feelings.push(entry.feelingRank);
    }

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const scored = disciplineSkis.map((ski) => {
      const s = statsMap.get(ski.id);
      const ranks = s?.ranks ?? [];
      const results = s?.results ?? [];
      const feelings = s?.feelings ?? [];
      const testCount = s?.tests.size ?? 0;
      return {
        ski,
        testCount,
        entryCount: ranks.length,
        avgRank: avg(ranks),
        avgResult: avg(results),
        avgFeeling: avg(feelings),
        wins: ranks.filter((r) => r === 1).length,
        top3: ranks.filter((r) => r <= 3).length,
        raceUses: raceUsesBySkiId.get(ski.skiId) ?? 0,
      };
    });

    // Sort: skis with test data first (by avgRank asc), then no data
    const withData = scored.filter((s) => s.avgRank != null).sort((a, b) => (a.avgRank ?? 99) - (b.avgRank ?? 99));
    const noData = scored.filter((s) => s.avgRank == null).sort((a, b) => b.raceUses - a.raceUses);

    return { skis: [...withData, ...noData], matchingTestCount: matchingTests.length };
  }, [hasFilters, skis, discipline, raceSkiTests, allEntries, weatherById, raceUsesBySkiId,
    sfSnowMin, sfSnowMax, sfAirMin, sfAirMax, sfAirHumMin, sfAirHumMax, sfSnowHumMin, sfSnowHumMax,
    sfSnowType, sfTrackHardness, sfArtSnow, sfNatSnow, sfSnowHumType, sfGrainSize, sfPrecip,
    sfWind, sfVisibility, sfCloudMin, sfCloudMax]);

  function clearFilters() {
    setSfSnowMin(""); setSfSnowMax(""); setSfAirMin(""); setSfAirMax("");
    setSfAirHumMin(""); setSfAirHumMax(""); setSfSnowHumMin(""); setSfSnowHumMax("");
    setSfSnowType(""); setSfTrackHardness(""); setSfArtSnow(""); setSfNatSnow("");
    setSfSnowHumType(""); setSfGrainSize(""); setSfPrecip(""); setSfWind("");
    setSfVisibility(""); setSfCloudMin(""); setSfCloudMax("");
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="section-ski-suggestions">
      <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-4">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 cursor-pointer select-none group" data-testid="toggle-ski-suggestions">
            <Snowflake className="h-4 w-4 text-sky-500" />
            <h2 className="text-lg font-semibold">{t("suggestions.skiTitle")}</h2>
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
            )}
          </button>
        </CollapsibleTrigger>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            {t("common.clearFilters") || "Clear filters"}
          </button>
        )}
      </div>

      <CollapsibleContent>
        <div className="mt-4 flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">{t("suggestions.skiSubtitle")}</p>

          {/* Discipline toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">{t("suggestions.discipline")}:</span>
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button
                type="button"
                onClick={() => setDiscipline("Classic")}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium transition-colors",
                  discipline === "Classic" ? "bg-sky-500 text-white" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t("suggestions.classic")}
              </button>
              <button
                type="button"
                onClick={() => setDiscipline("Skating")}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium transition-colors",
                  discipline === "Skating" ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t("suggestions.skating")}
              </button>
            </div>
          </div>

          {/* Full weather filter panel */}
          <Card className="fs-card rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Snowflake className="h-3.5 w-3.5 text-sky-500" />
              {t("suggestions.weatherParams")}
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="ml-auto text-xs text-muted-foreground hover:text-foreground normal-case tracking-normal font-normal flex items-center gap-1">
                  <X className="h-3 w-3" />{t("common.clearFilters") || "Clear"}
                </button>
              )}
            </div>

            {/* Temperature & Humidity */}
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Temperature &amp; Humidity
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.snowTemp")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 text-xs" placeholder="Min" value={sfSnowMin} onChange={e => setSfSnowMin(e.target.value)} />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="number" className="h-8 text-xs" placeholder={L("Maks", "Max")} value={sfSnowMax} onChange={e => setSfSnowMax(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.airTemp")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 text-xs" placeholder="Min" value={sfAirMin} onChange={e => setSfAirMin(e.target.value)} />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="number" className="h-8 text-xs" placeholder={L("Maks", "Max")} value={sfAirMax} onChange={e => setSfAirMax(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-violet-500 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.airHumidity")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 text-xs" placeholder="Min" value={sfAirHumMin} onChange={e => setSfAirHumMin(e.target.value)} />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="number" className="h-8 text-xs" placeholder={L("Maks", "Max")} value={sfAirHumMax} onChange={e => setSfAirHumMax(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.snowHumidity")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 text-xs" placeholder="Min" value={sfSnowHumMin} onChange={e => setSfSnowHumMin(e.target.value)} />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="number" className="h-8 text-xs" placeholder={L("Maks", "Max")} value={sfSnowHumMax} onChange={e => setSfSnowHumMax(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-sky-400 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.cloudCover")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 text-xs" placeholder="Min" value={sfCloudMin} onChange={e => setSfCloudMin(e.target.value)} />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="number" className="h-8 text-xs" placeholder={L("Maks", "Max")} value={sfCloudMax} onChange={e => setSfCloudMax(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Snow type */}
              <div>
                <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("suggestions.snowType")}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.artificialSnow")}</span>
                    </div>
                    <Select value={sfArtSnow || "__any__"} onValueChange={v => setSfArtSnow(v === "__any__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">— Any —</SelectItem>
                        {SNOW_STAGE_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-teal-500 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.naturalSnow")}</span>
                    </div>
                    <Select value={sfNatSnow || "__any__"} onValueChange={v => setSfNatSnow(v === "__any__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">— Any —</SelectItem>
                        {SNOW_STAGE_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-cyan-500 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.snowHumidityType")}</span>
                    </div>
                    <Select value={sfSnowHumType || "__any__"} onValueChange={v => setSfSnowHumType(v === "__any__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">— Any —</SelectItem>
                        {SNOW_HUM_TYPE_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-lime-500 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.grainSize")}</span>
                    </div>
                    <Select value={sfGrainSize || "__any__"} onValueChange={v => setSfGrainSize(v === "__any__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">— Any —</SelectItem>
                        {GRAIN_SIZE_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Snow & Track */}
              <div>
                <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("weather.snowType")} &amp; {t("weather.trackHardness") || "Track"}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.trackHardness")}</span>
                    </div>
                    <Select value={sfTrackHardness || "__any__"} onValueChange={v => setSfTrackHardness(v === "__any__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={L("Alle", "Any")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">— Any —</SelectItem>
                        {TRACK_HARDNESS_OPTS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.precipitation")}</span>
                    </div>
                    <Input className="h-8 text-xs" placeholder="e.g. Snow" value={sfPrecip} onChange={e => setSfPrecip(e.target.value)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.wind")}</span>
                    </div>
                    <Input className="h-8 text-xs" placeholder="e.g. NW 3m/s" value={sfWind} onChange={e => setSfWind(e.target.value)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-2 w-2 rounded-full bg-gray-400 inline-block" />
                      <span className="text-xs text-muted-foreground">{t("suggestions.visibility")}</span>
                    </div>
                    <Input className="h-8 text-xs" placeholder="e.g. Good" value={sfVisibility} onChange={e => setSfVisibility(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Results */}
          {!hasFilters ? (
            <p className="text-sm text-muted-foreground italic">{t("suggestions.setFilters")}</p>
          ) : suggestions && suggestions.matchingTestCount === 0 ? (
            <Card className="fs-card rounded-2xl p-6 text-center">
              <Snowflake className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{t("suggestions.noMatchingTests")}</p>
            </Card>
          ) : suggestions ? (
            <div className="flex flex-col gap-3">
              {/* Matching tests count */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                <span>
                  <span className="font-semibold text-foreground">{suggestions.matchingTestCount}</span>{" "}
                  {t("suggestions.matchingTests").toLowerCase()}
                </span>
              </div>

              {suggestions.skis.filter(s => s.avgRank != null).length === 0 ? (
                <Card className="fs-card rounded-2xl p-6 text-center">
                  <p className="text-sm text-muted-foreground">{t("suggestions.noMatchingTests")}</p>
                </Card>
              ) : (
                <Card className="fs-card rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/30">
                          <th className="px-3 py-2.5">#</th>
                          <th className="px-3 py-2.5">{t("raceskis.skiId")}</th>
                          <th className="px-3 py-2.5">{L("Merke", "Brand")}</th>
                          <th className="px-3 py-2.5">{t("raceskis.grind")}</th>
                          <th className="px-3 py-2.5">{t("suggestions.avgRank")}</th>
                          <th className="px-3 py-2.5">{t("suggestions.wins")}</th>
                          <th className="px-3 py-2.5">{t("suggestions.top3")}</th>
                          <th className="px-3 py-2.5">{t("suggestions.nTests")}</th>
                          <th className="px-3 py-2.5">{t("suggestions.avgResult")}</th>
                          <th className="px-3 py-2.5">{t("suggestions.raceUses")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suggestions.skis.map((s, idx) => {
                          const isTop = idx === 0 && s.avgRank != null;
                          return (
                            <tr
                              key={s.ski.id}
                              className={cn(
                                "border-b border-border/40 transition-colors",
                                isTop ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "hover:bg-muted/20",
                                s.avgRank == null && "opacity-50"
                              )}
                            >
                              <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                                {s.avgRank != null ? (
                                  <span className={cn("font-bold", isTop ? "text-emerald-600" : "text-foreground")}>
                                    {idx + 1}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-2 font-semibold">
                                <AppLink href={`/raceskis/${s.ski.athleteId}`}>
                                  <span className="hover:text-primary transition-colors">{s.ski.skiId}</span>
                                </AppLink>
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{s.ski.brand ?? "—"}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{s.ski.grind ?? "—"}</td>
                              <td className="px-3 py-2">
                                {s.avgRank != null ? (
                                  <span className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                                    s.avgRank <= 1.5 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                      : s.avgRank <= 3 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                        : "bg-muted text-muted-foreground"
                                  )}>
                                    {s.avgRank.toFixed(1)}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-2 text-xs">{s.wins > 0 ? <span className="font-bold text-emerald-600">{s.wins}</span> : "—"}</td>
                              <td className="px-3 py-2 text-xs">{s.top3 > 0 ? s.top3 : "—"}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{s.testCount > 0 ? s.testCount : "—"}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {s.avgResult != null ? `${s.avgResult.toFixed(1)} cm` : "—"}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{s.raceUses > 0 ? s.raceUses : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Shared "race usage" log for a ski pair — used in both grid (SkiCard) and list (SkiDetailPanel).
function SkiRaceUsageSection({ ski, weatherList, raceWeatherById, canEdit = true }: {
  ski: RaceSki;
  weatherList: WeatherItem[];
  raceWeatherById: Map<number, WeatherItem>;
  canEdit?: boolean;
}) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageForm, setUsageForm] = useState({
    date: new Date().toISOString().slice(0, 10), location: "", discipline: ski.discipline,
    weatherMode: "link" as "link" | "manual", weatherId: "", snowTemp: "", airTemp: "", snowType: "", result: "", notes: "",
  });
  const { data: usages = [] } = useQuery<any[]>({ queryKey: [`/api/race-skis/${ski.id}/usages`] });
  const { data: prepFeedback = [] } = useQuery<any[]>({ queryKey: [`/api/race-skis/${ski.id}/prep-feedback`] });
  const usageWeatherOptions = useMemo(() => weatherList.filter((w) => w.date === usageForm.date), [weatherList, usageForm.date]);
  const ratingClass = (r: string) =>
    r === "Competitive+" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : r === "Competitive-" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  const saveUsage = useMutation({
    mutationFn: async () => {
      const manualWeather = usageForm.weatherMode === "manual"
        ? JSON.stringify({
            snowTemperatureC: usageForm.snowTemp ? parseFloat(usageForm.snowTemp.replace(",", ".")) : null,
            airTemperatureC: usageForm.airTemp ? parseFloat(usageForm.airTemp.replace(",", ".")) : null,
            snowType: usageForm.snowType || null,
          })
        : null;
      await apiRequest("POST", `/api/race-skis/${ski.id}/usages`, {
        date: usageForm.date, location: usageForm.location || null, discipline: usageForm.discipline,
        weatherId: usageForm.weatherMode === "link" && usageForm.weatherId ? parseInt(usageForm.weatherId) : null,
        manualWeather, result: usageForm.result || null, notes: usageForm.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/race-skis/${ski.id}/usages`] });
      setUsageOpen(false);
      setUsageForm((f) => ({ ...f, location: "", weatherId: "", snowTemp: "", airTemp: "", snowType: "", result: "", notes: "" }));
    },
  });
  const deleteUsage = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/race-skis/${ski.id}/usages/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/race-skis/${ski.id}/usages`] }),
  });
  return (
    <div className="pt-2 border-t border-border/40">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{L("Løpsbruk", "Race usage")}</h3>
        {canEdit && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setUsageOpen(true)} data-testid={`button-add-usage-${ski.id}`}>
            <Plus className="h-3 w-3 mr-1" />{L("Logg løpsbruk", "Log race use")}
          </Button>
        )}
      </div>
      {usages.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{L("Ingen løpsbruk logget.", "No race use logged.")}</p>
      ) : (
        <div className="space-y-1.5">
          {usages.map((usage) => {
            let mw: any = null; try { mw = usage.manualWeather ? JSON.parse(usage.manualWeather) : null; } catch {}
            const lw = usage.weatherId ? raceWeatherById.get(usage.weatherId) : null;
            const w: any = lw || mw;
            return (
              <div key={usage.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/30 px-3 py-1.5" data-testid={`row-usage-${usage.id}`}>
                <div className="text-[11px]">
                  <span className="font-medium text-foreground">{usage.location || "—"} · {fmtDate(usage.date)}</span>
                  {usage.discipline && <span className="text-muted-foreground"> · {usage.discipline}</span>}
                  {w && (
                    <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground mt-0.5">
                      {w.snowTemperatureC != null && <span>{L("Snø", "Snow")} {w.snowTemperatureC}°C</span>}
                      {w.airTemperatureC != null && <span>{L("Luft", "Air")} {w.airTemperatureC}°C</span>}
                      {w.snowType && <span>{w.snowType}</span>}
                    </div>
                  )}
                  {usage.athleteRating && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className={cn("rounded-full px-1.5 py-0.5 font-semibold",
                        usage.athleteRating === "Competitive+" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                        usage.athleteRating === "Competitive-" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" :
                        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300")}>
                        {L("Utøver", "Athlete")}: {usage.athleteRating}
                      </span>
                      {usage.athleteComment && <span className="text-muted-foreground italic">«{usage.athleteComment}»</span>}
                    </div>
                  )}
                </div>
                {usage.notes && (
                  <div className="flex-1 min-w-0 text-[11px] text-muted-foreground italic border-l border-border/50 pl-2 self-stretch" data-testid={`usage-note-${usage.id}`}>
                    {usage.notes}
                  </div>
                )}
                {canEdit && (
                  <button onClick={() => deleteUsage.mutate(usage.id)} className="text-muted-foreground/50 hover:text-red-500 shrink-0" data-testid={`button-delete-usage-${usage.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {prepFeedback.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/40">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{L("Raceprep-tilbakemelding", "Race-prep feedback")}</h3>
          <div className="space-y-1.5">
            {prepFeedback.map((pf) => (
              <div key={pf.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-muted/30 px-3 py-1.5 text-[11px]" data-testid={`prep-feedback-${pf.id}`}>
                <span className="font-medium text-foreground">{pf.location || "—"} · {fmtDate(pf.date)}</span>
                {pf.discipline && <span className="text-muted-foreground">{pf.discipline}</span>}
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", ratingClass(pf.athleteRating))}>{pf.athleteRating}</span>
                {pf.athleteComment && <span className="text-muted-foreground italic">«{pf.athleteComment}»</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <Dialog open={usageOpen} onOpenChange={setUsageOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{L("Logg løpsbruk", "Log race use")} — {ski.skiId}</DialogTitle></DialogHeader>
          <div className="space-y-3 pb-12 sm:pb-0">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">{L("Dato", "Date")}</label>
                <Input type="date" value={usageForm.date} onChange={(e) => setUsageForm((f) => ({ ...f, date: e.target.value, weatherId: "" }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{L("Stilart", "Discipline")}</label>
                <Select value={usageForm.discipline} onValueChange={(v) => setUsageForm((f) => ({ ...f, discipline: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Classic">Classic</SelectItem>
                    <SelectItem value="Skating">Skating</SelectItem>
                    <SelectItem value="Double Poling">Double Poling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{L("Sted", "Location")}</label>
              <Input value={usageForm.location} onChange={(e) => setUsageForm((f) => ({ ...f, location: e.target.value }))} placeholder={L("f.eks. Ruka", "e.g. Ruka")} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{L("Vær", "Weather")}</label>
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => setUsageForm((f) => ({ ...f, weatherMode: "link" }))} className={cn("flex-1 rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition-colors", usageForm.weatherMode === "link" ? "border-primary bg-primary/5" : "border-border text-muted-foreground")}>{L("Koble til observasjon", "Link record")}</button>
                <button type="button" onClick={() => setUsageForm((f) => ({ ...f, weatherMode: "manual" }))} className={cn("flex-1 rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition-colors", usageForm.weatherMode === "manual" ? "border-primary bg-primary/5" : "border-border text-muted-foreground")}>{L("Manuelt", "Manual")}</button>
              </div>
              {usageForm.weatherMode === "link" ? (
                usageWeatherOptions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">{L("Ingen værobservasjon på denne datoen.", "No weather record on this date.")}</p>
                ) : (
                  <Select value={usageForm.weatherId || "__none__"} onValueChange={(v) => setUsageForm((f) => ({ ...f, weatherId: v === "__none__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder={L("Velg", "Choose")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{L("Ingen", "None")}</SelectItem>
                      {usageWeatherOptions.map((w) => (<SelectItem key={w.id} value={String(w.id)}>{w.location}{w.snowTemperatureC != null ? ` (${w.snowTemperatureC}°C)` : ""}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <Input value={usageForm.snowTemp} onChange={(e) => setUsageForm((f) => ({ ...f, snowTemp: e.target.value }))} placeholder={L("Snø °C", "Snow °C")} />
                  <Input value={usageForm.airTemp} onChange={(e) => setUsageForm((f) => ({ ...f, airTemp: e.target.value }))} placeholder={L("Luft °C", "Air °C")} />
                  <Input value={usageForm.snowType} onChange={(e) => setUsageForm((f) => ({ ...f, snowType: e.target.value }))} placeholder={L("Snøtype", "Snow type")} />
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{L("Kommentar", "Comment")}</label>
              <Input value={usageForm.notes} onChange={(e) => setUsageForm((f) => ({ ...f, notes: e.target.value }))} placeholder={L("Valgfri kommentar…", "Optional comment…")} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => saveUsage.mutate()} disabled={saveUsage.isPending || !usageForm.date} data-testid="button-save-usage">
                {saveUsage.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkiDetailPanel({
  ski,
  onEdit,
  onArchive,
  onRegrind,
  onDeleteRegrind,
  raceHistory = [],
  weatherList = [],
}: {
  ski: RaceSki;
  onEdit?: () => void;
  onArchive?: () => void;
  onRegrind?: () => void;
  onDeleteRegrind?: (id: number) => void;
  raceHistory?: AthleteRaceHistory[];
  weatherList?: WeatherItem[];
}) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const raceWeatherById = useMemo(() => new Map(weatherList.map(w => [w.id, w])), [weatherList]);
  const { data: regrinds = [] } = useQuery<RaceSkiRegrind[]>({
    queryKey: [`/api/race-skis/${ski.id}/regrinds`],
  });

  let customParams: Record<string, string> = {};
  try { customParams = ski.customParams ? JSON.parse(ski.customParams) : {}; } catch {}

  const paramRows: { label: string; value: string | null }[] = [
    { label: t("raceskis.serialNumber"), value: ski.serialNumber },
    { label: "Brand", value: ski.brand },
    { label: t("raceskis.discipline"), value: ski.discipline },
    { label: t("raceskis.construction"), value: ski.construction },
    { label: t("raceskis.mold"), value: ski.mold },
    { label: t("raceskis.base"), value: ski.base },
    { label: t("raceskis.grind"), value: ski.grind },
    ...(ski.discipline === "Classic" ? [{ label: t("raceskis.heights"), value: ski.heights }] : []),
    { label: L("Årgang", "Year"), value: ski.year },
    { label: L("Lengde", "Length"), value: ski.length },
    { label: L("Skitype", "Ski type"), value: ski.typeOfSki },
    { label: L("Mottatt fra", "Where received"), value: ski.whereReceived },
    ...Object.entries(customParams).map(([k, v]) => ({
      label: k.replace(/^custom_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: v || null,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Training badge + notes */}
      {(ski.isTrainingSki === 1 || ski.typeOfSki) && (
        <div className="flex flex-wrap items-center gap-2">
          {ski.typeOfSki && (
            <span className="rounded-full bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300 ring-1 ring-violet-200 dark:ring-violet-800">{ski.typeOfSki}</span>
          )}
          {ski.isTrainingSki === 1 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800">{L("Treningsski", "Training ski")}</span>
          )}
        </div>
      )}
      {ski.notes && (
        <div className="rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap" data-testid={`detail-ski-notes-${ski.id}`}>
          {ski.notes}
        </div>
      )}
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {onRegrind && (
          <Button variant="outline" size="sm" onClick={onRegrind} className="h-7 text-xs">
            <RefreshCw className="mr-1 h-3 w-3" />
            Regrind
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit} className="h-7 text-xs">
            <Edit2 className="mr-1 h-3 w-3" />
            Edit
          </Button>
        )}
        {onArchive && (
          <Button variant="outline" size="sm" onClick={onArchive} className="h-7 text-xs text-amber-600 hover:text-amber-700">
            <Archive className="mr-1 h-3 w-3" />
            Archive
          </Button>
        )}
      </div>

      {/* All parameters */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{L("Parametre", "Parameters")}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
          {paramRows.map((row) => (
            <div key={row.label} className="text-xs">
              <span className="text-muted-foreground">{row.label}: </span>
              <span className="font-medium">{row.value || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Regrind history */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("raceskis.regrindHistory")}</div>
        {regrinds.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("raceskis.noRegrinds")}</p>
        ) : (
          <div className="space-y-1.5">
            {regrinds.map((rg) => (
              <div
                key={rg.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-1.5"
                data-testid={`row-regrind-panel-${rg.id}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  <span className="font-medium">{fmtDate(rg.date)}</span>
                  <span className="font-semibold text-foreground">{rg.grindType}</span>
                  {rg.stone && <span className="text-muted-foreground">Stone: {rg.stone}</span>}
                  {rg.pattern && <span className="text-muted-foreground">Pattern: {rg.pattern}</span>}
                  {rg.notes && <span className="text-muted-foreground italic">{rg.notes}</span>}
                </div>
                {onDeleteRegrind && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteRegrind(rg.id)}
                    className="h-6 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Race history for this ski */}
      {(() => {
        const skiRaces = raceHistory.filter(r =>
          r.skiId === ski.skiId || r.skiIdClassic === ski.skiId || r.skiIdSkating === ski.skiId
        ).sort((a, b) => b.date.localeCompare(a.date));
        if (skiRaces.length === 0) return null;
        return (
          <div className="mt-2 pt-2 border-t border-border/40">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Raced {skiRaces.length}×
            </p>
            <div className="space-y-2">
              {skiRaces.map(r => {
                const w = r.weatherId ? raceWeatherById.get(r.weatherId) : null;
                return (
                  <div key={r.entryId} className="text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">
                      {r.location} · {new Date(r.date).toLocaleDateString()}{r.startTime ? ` · ${r.startTime}` : ""} · {r.raceType}
                    </div>
                    {w && (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[10px]">
                        {w.snowTemperatureC != null && <span>Snow {w.snowTemperatureC}°C</span>}
                        {w.airTemperatureC != null && <span>Air {w.airTemperatureC}°C</span>}
                        {w.snowHumidityPct != null && <span>Snow RH {w.snowHumidityPct}%</span>}
                        {w.airHumidityPct != null && <span>Air RH {w.airHumidityPct}%</span>}
                        {w.snowType && <span>{w.snowType}</span>}
                        {w.trackHardness && <span>{w.trackHardness}</span>}
                        {w.grainSize && <span>Grain {w.grainSize}</span>}
                        {w.precipitation && <span>{w.precipitation}</span>}
                        {w.artificialSnow && <span>Art. {w.artificialSnow}</span>}
                        {w.wind && <span>Wind {w.wind}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <SkiRaceUsageSection ski={ski} weatherList={weatherList} raceWeatherById={raceWeatherById} canEdit={!!onEdit} />
    </div>
  );
}

function SkiAnalyticsSection({
  skis,
  raceSkiTests,
  compareSkiIds,
  setCompareSkiIds,
}: {
  skis: RaceSki[];
  raceSkiTests: RaceSkiTest[];
  compareSkiIds: Set<number>;
  setCompareSkiIds: React.Dispatch<React.SetStateAction<Set<number>>>;
}) {
  const testIds = useMemo(() => raceSkiTests.map((t) => t.id), [raceSkiTests]);
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);

  // Fetch entries for all race ski tests
  const { data: allEntries = [] } = useQuery<(TestEntry & { testId: number })[]>({
    queryKey: [`/api/athletes/analytics/entries`, testIds.join(",")],
    enabled: testIds.length > 0,
    queryFn: async () => {
      // Fetch entries for each test in parallel
      const results = await Promise.all(
        testIds.map(async (tid) => {
          const res = await fetch(`/api/tests/${tid}/entries`, { credentials: "include" });
          if (!res.ok) return [];
          const data = await res.json();
          return (data as TestEntry[]).map((e) => ({ ...e, testId: tid }));
        })
      );
      return results.flat();
    },
  });

  const [analyticsMode, setAnalyticsMode] = useState<"glide" | "feeling" | "total">("glide");

  // Classify every test by what was measured in it. A test that has BOTH a
  // speed/glide rank and a feeling rank counts as glide AND feeling AND both.
  const testTypeCounts = useMemo(() => {
    const byTest = new Map<number, { glide: boolean; feeling: boolean }>();
    for (const e of allEntries) {
      const c = byTest.get(e.testId) ?? { glide: false, feeling: false };
      if (e.rank0km != null) c.glide = true;
      if (e.feelingRank != null) c.feeling = true;
      byTest.set(e.testId, c);
    }
    let glide = 0, feeling = 0, both = 0;
    for (const c of byTest.values()) {
      if (c.glide) glide++;
      if (c.feeling) feeling++;
      if (c.glide && c.feeling) both++;
    }
    return { glide, feeling, both };
  }, [allEntries]);

  const skiStats = useMemo(() => {
    const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    return skis.map((ski) => {
      const entries = allEntries.filter((e) => e.raceSkiId === ski.id);
      const testCount = new Set(entries.map((e) => e.testId)).size;
      const ranks = entries.map((e) => e.rank0km).filter((r): r is number => r !== null);
      const feelings = entries.map((e) => e.feelingRank).filter((r): r is number => r !== null);
      // Per-ski test-type counts.
      const glideTestCount = new Set(entries.filter((e) => e.rank0km != null).map((e) => e.testId)).size;
      const feelingTestCount = new Set(entries.filter((e) => e.feelingRank != null).map((e) => e.testId)).size;
      const bothTestCount = new Set(entries.filter((e) => e.rank0km != null && e.feelingRank != null).map((e) => e.testId)).size;
      const avgRank = avg(ranks);
      const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;
      const wins = ranks.filter((r) => r === 1).length;
      const winRate = ranks.length > 0 ? (wins / ranks.length) * 100 : null;
      const avgFeeling = avg(feelings);
      const bestFeeling = feelings.length > 0 ? Math.min(...feelings) : null;
      // Combined score: average of speed rank and feeling rank (lower = better).
      const combined = avgRank != null && avgFeeling != null ? (avgRank + avgFeeling) / 2 : null;
      return {
        ski, testCount, entryCount: entries.length,
        avgRank, bestRank, winRate, avgFeeling, bestFeeling, combined,
        glideTestCount, feelingTestCount, bothTestCount,
      };
    }).filter((s) => s.entryCount > 0);
  }, [skis, allEntries]);

  // Rows relevant to the current overview.
  const modeStats = useMemo(() => {
    if (analyticsMode === "glide") return skiStats.filter((s) => s.avgRank != null);
    if (analyticsMode === "feeling") return skiStats.filter((s) => s.avgFeeling != null);
    return skiStats.filter((s) => s.bothTestCount > 0);
  }, [skiStats, analyticsMode]);

  const compareList = useMemo(() => skiStats.filter((s) => compareSkiIds.has(s.ski.id)), [skiStats, compareSkiIds]);

  function toggleCompare(skiId: number) {
    setCompareSkiIds((prev) => {
      const next = new Set(prev);
      if (next.has(skiId)) next.delete(skiId);
      else next.add(skiId);
      return next;
    });
  }

  if (skiStats.length === 0) {
    return (
      <div className="mt-3">
        <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-analytics">
          No test data yet for this athlete's skis.
        </Card>
      </div>
    );
  }

  const rankBadge = (rank: number | null) =>
    rank === null ? "—" : (
      <span className={cn(
        "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        rank === 1 ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" :
        rank === 2 ? "bg-slate-300/15 text-slate-500 dark:text-slate-300" :
        rank === 3 ? "bg-amber-700/15 text-amber-700 dark:text-amber-600" :
        "bg-muted/70 text-foreground"
      )}>
        #{rank}
      </span>
    );

  const MODES: { key: "glide" | "feeling" | "total"; label: string; desc: string }[] = [
    { key: "glide", label: L("Glid-ytelse", "Glide Performance"), desc: L("Basert på fart/rangering", "Based on speed/ranking") },
    { key: "feeling", label: L("Følelse-ytelse", "Feeling Performance"), desc: L("Basert på feelingtester", "Based on feeling tests") },
    { key: "total", label: L("Total ytelse", "Total Performance"), desc: L("Forholdet mellom fart og følelse", "Speed vs. feeling relationship") },
  ];

  return (
    <div className="mt-3 space-y-4" data-testid="analytics-section">
      {/* Test-type counts — a test with both speed & feeling counts in all three. */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: L("Glidtester", "Glide tests"), value: testTypeCounts.glide, cls: "text-sky-600 dark:text-sky-400" },
          { label: L("Feelingtester", "Feeling tests"), value: testTypeCounts.feeling, cls: "text-violet-600 dark:text-violet-400" },
          { label: L("Begge deler", "Both"), value: testTypeCounts.both, cls: "text-emerald-600 dark:text-emerald-400" },
        ].map((c) => (
          <Card key={c.label} className="fs-card rounded-2xl p-3 text-center" data-testid={`count-${c.label}`}>
            <div className={cn("text-2xl font-bold", c.cls)}>{c.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{c.label}</div>
          </Card>
        ))}
      </div>

      {/* Overview switch: Glide / Feeling / Total */}
      <div className="flex flex-wrap gap-1.5" data-testid="analytics-mode-toggle">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setAnalyticsMode(m.key)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium ring-1 transition-colors text-left",
              analyticsMode === m.key ? "bg-primary text-primary-foreground ring-primary" : "ring-border text-muted-foreground hover:bg-muted/60",
            )}
            data-testid={`mode-${m.key}`}
          >
            <div>{m.label}</div>
            <div className={cn("text-[10px]", analyticsMode === m.key ? "text-primary-foreground/80" : "text-muted-foreground/70")}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Mode-aware summary table */}
      <Card className="fs-card rounded-2xl overflow-hidden" data-testid="analytics-summary-table">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="px-4 py-2.5 font-medium">Ski</th>
                {analyticsMode === "glide" && <>
                  <th className="px-3 py-2.5 font-medium">{L("Glidtester", "Glide tests")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Snittrang", "Avg Rank")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Beste rang", "Best Rank")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Seiersrate", "Win Rate")}</th>
                </>}
                {analyticsMode === "feeling" && <>
                  <th className="px-3 py-2.5 font-medium">{L("Feelingtester", "Feeling tests")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Snittfølelse", "Avg Feeling")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Beste følelse", "Best Feeling")}</th>
                </>}
                {analyticsMode === "total" && <>
                  <th className="px-3 py-2.5 font-medium">{L("Tester (begge)", "Tests (both)")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Snitt fart", "Avg Speed")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Snitt følelse", "Avg Feeling")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Kombinert", "Combined")}</th>
                </>}
                <th className="px-3 py-2.5 font-medium">{L("Sammenlign", "Compare")}</th>
              </tr>
            </thead>
            <tbody>
              {modeStats.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {analyticsMode === "glide" ? L("Ingen glidtester ennå.", "No glide tests yet.")
                    : analyticsMode === "feeling" ? L("Ingen feelingtester ennå.", "No feeling tests yet.")
                    : L("Ingen tester med både fart og følelse ennå.", "No tests with both speed and feeling yet.")}
                </td></tr>
              )}
              {modeStats.map((s, idx) => (
                <tr
                  key={s.ski.id}
                  className={cn("border-t border-border/30", idx % 2 === 0 ? "bg-background/30" : "bg-background/10")}
                  data-testid={`analytics-row-${s.ski.id}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-sm">{s.ski.skiId}</div>
                    {s.ski.brand && <div className="text-xs text-muted-foreground">{s.ski.brand}</div>}
                  </td>
                  {analyticsMode === "glide" && <>
                    <td className="px-3 py-2.5 text-muted-foreground">{s.glideTestCount}</td>
                    <td className="px-3 py-2.5">{s.avgRank !== null ? s.avgRank.toFixed(1) : "—"}</td>
                    <td className="px-3 py-2.5">{rankBadge(s.bestRank)}</td>
                    <td className="px-3 py-2.5">{s.winRate !== null ? `${s.winRate.toFixed(0)}%` : "—"}</td>
                  </>}
                  {analyticsMode === "feeling" && <>
                    <td className="px-3 py-2.5 text-muted-foreground">{s.feelingTestCount}</td>
                    <td className="px-3 py-2.5">{s.avgFeeling !== null ? s.avgFeeling.toFixed(1) : "—"}</td>
                    <td className="px-3 py-2.5">{rankBadge(s.bestFeeling)}</td>
                  </>}
                  {analyticsMode === "total" && <>
                    <td className="px-3 py-2.5 text-muted-foreground">{s.bothTestCount}</td>
                    <td className="px-3 py-2.5">{s.avgRank !== null ? s.avgRank.toFixed(1) : "—"}</td>
                    <td className="px-3 py-2.5">{s.avgFeeling !== null ? s.avgFeeling.toFixed(1) : "—"}</td>
                    <td className="px-3 py-2.5 font-semibold">{s.combined !== null ? s.combined.toFixed(1) : "—"}</td>
                  </>}
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={compareSkiIds.has(s.ski.id)}
                      onCheckedChange={() => toggleCompare(s.ski.id)}
                      data-testid={`checkbox-compare-${s.ski.id}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Comparison panel */}
      {compareList.length >= 2 && (
        <Card className="fs-card rounded-2xl p-4" data-testid="analytics-comparison">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{L("Sammenligning av skipar", "Ski Pair Comparison")}</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setCompareSkiIds(new Set())}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">{L("Måltall", "Metric")}</th>
                  {compareList.map(({ ski }) => (
                    <th key={ski.id} className="px-3 py-2 font-medium">{ski.skiId}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-xs">
                {[
                  { label: "Tests", key: "testCount" as const, fmt: (v: number | null) => v ?? "—" },
                  { label: "Entries", key: "entryCount" as const, fmt: (v: number | null) => v ?? "—" },
                  { label: "Avg Rank", key: "avgRank" as const, fmt: (v: number | null) => v !== null ? v.toFixed(1) : "—" },
                  { label: "Best Rank", key: "bestRank" as const, fmt: (v: number | null) => v !== null ? `#${v}` : "—" },
                  { label: "Win Rate", key: "winRate" as const, fmt: (v: number | null) => v !== null ? `${v.toFixed(0)}%` : "—" },
                  { label: "Avg Feeling", key: "avgFeeling" as const, fmt: (v: number | null) => v !== null ? v.toFixed(1) : "—" },
                ].map((metric, mIdx) => {
                  const values = compareList.map((s) => (s as any)[metric.key] as number | null);
                  // Highlight best (lowest for rank, highest for win rate)
                  const isRankMetric = ["avgRank", "bestRank"].includes(metric.key);
                  const validVals = values.filter((v): v is number => v !== null);
                  const bestVal = validVals.length > 0
                    ? isRankMetric ? Math.min(...validVals) : Math.max(...validVals)
                    : null;
                  return (
                    <tr key={metric.key} className={cn("border-t border-border/20", mIdx % 2 === 0 ? "bg-background/20" : "")}>
                      <td className="px-2 py-2 text-muted-foreground font-medium">{metric.label}</td>
                      {values.map((val, ci) => (
                        <td
                          key={ci}
                          className={cn(
                            "px-3 py-2",
                            val !== null && val === bestVal && validVals.length > 1 && "text-emerald-600 dark:text-emerald-400 font-semibold",
                          )}
                        >
                          {metric.fmt(val)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {compareList.length === 1 && (
        <p className="text-xs text-muted-foreground mt-1">Select at least 2 ski pairs to compare.</p>
      )}
    </div>
  );
}

function SkiCard({
  ski,
  expanded,
  onToggle,
  onEdit,
  onArchive,
  onRegrind,
  onDeleteRegrind,
  isArchived,
  onRestore,
  onDelete,
  raceHistory = [],
  weatherList = [],
}: {
  ski: RaceSki;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onRegrind?: () => void;
  onDeleteRegrind?: (id: number) => void;
  isArchived?: boolean;
  onRestore?: () => void;
  onDelete?: () => void;
  raceHistory?: AthleteRaceHistory[];
  weatherList?: WeatherItem[];
}) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const raceWeatherById = useMemo(() => new Map(weatherList.map(w => [w.id, w])), [weatherList]);
  const { data: regrinds = [] } = useQuery<RaceSkiRegrind[]>({
    queryKey: [`/api/race-skis/${ski.id}/regrinds`],
    enabled: expanded,
  });

  // Waxer-logged race usages for this ski pair (no admin race prep needed)
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageForm, setUsageForm] = useState({
    date: new Date().toISOString().slice(0, 10), location: "", discipline: ski.discipline,
    weatherMode: "link" as "link" | "manual", weatherId: "", snowTemp: "", airTemp: "", snowType: "", result: "", notes: "",
  });
  const { data: usages = [] } = useQuery<any[]>({ queryKey: [`/api/race-skis/${ski.id}/usages`], enabled: expanded });
  const usageWeatherOptions = useMemo(() => weatherList.filter((w) => w.date === usageForm.date), [weatherList, usageForm.date]);
  const saveUsage = useMutation({
    mutationFn: async () => {
      const manualWeather = usageForm.weatherMode === "manual"
        ? JSON.stringify({
            snowTemperatureC: usageForm.snowTemp ? parseFloat(usageForm.snowTemp.replace(",", ".")) : null,
            airTemperatureC: usageForm.airTemp ? parseFloat(usageForm.airTemp.replace(",", ".")) : null,
            snowType: usageForm.snowType || null,
          })
        : null;
      await apiRequest("POST", `/api/race-skis/${ski.id}/usages`, {
        date: usageForm.date, location: usageForm.location || null, discipline: usageForm.discipline,
        weatherId: usageForm.weatherMode === "link" && usageForm.weatherId ? parseInt(usageForm.weatherId) : null,
        manualWeather, result: usageForm.result || null, notes: usageForm.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/race-skis/${ski.id}/usages`] });
      setUsageOpen(false);
      setUsageForm((f) => ({ ...f, location: "", weatherId: "", snowTemp: "", airTemp: "", snowType: "", result: "", notes: "" }));
    },
  });
  const deleteUsage = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/race-skis/${ski.id}/usages/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/race-skis/${ski.id}/usages`] }),
  });

  const skiColorId = getSkiColor(ski);
  const skiColorEntry = SKI_COLORS.find((c) => c.id === skiColorId);

  return (
    <Card className={cn("fs-card rounded-2xl p-4", skiColorId !== "none" && skiColorEntry ? skiColorEntry.bg : "")} data-testid={`card-ski-${ski.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div
          className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1"
          onClick={onToggle}
          data-testid={`toggle-ski-${ski.id}`}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {skiColorId !== "none" && skiColorEntry?.dot && (
                <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", skiColorEntry.dot)} />
              )}
              <span className="font-semibold text-sm" data-testid={`text-ski-id-${ski.id}`}>
                {ski.skiId}
              </span>
              {ski.brand && (
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800">
                  {ski.brand}
                </span>
              )}
              <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800">
                {ski.discipline}
              </span>
              {ski.typeOfSki && (
                <span className="rounded-full bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300 ring-1 ring-violet-200 dark:ring-violet-800">
                  {ski.typeOfSki}
                </span>
              )}
              {ski.isTrainingSki === 1 && (
                <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800">
                  {L("Trening", "Training")}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {ski.grind && (
                <span data-testid={`text-ski-grind-${ski.id}`}>
                  <strong className="text-foreground">{t("raceskis.currentGrind")}:</strong> {ski.grind}
                </span>
              )}
              {ski.construction && <span>Construction: {ski.construction}</span>}
              {ski.mold && <span>Mold: {ski.mold}</span>}
              {ski.base && <span>Base: {ski.base}</span>}
              {ski.discipline === "Classic" && ski.heights && (
                <span>Heights: {ski.heights}</span>
              )}
              {ski.year && <span>Year: {ski.year}</span>}
              {ski.length && <span>{L("Lengde", "Length")}: {ski.length}</span>}
              {ski.whereReceived && <span>{L("Mottatt", "Received")}: {ski.whereReceived}</span>}
              {(() => {
                try {
                  const cp = ski.customParams ? JSON.parse(ski.customParams) : {};
                  return Object.entries(cp).filter(([k]) => !k.startsWith("_")).map(([k, v]) => (
                    v ? <span key={k}>{k.replace(/^custom_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}: {String(v)}</span> : null
                  ));
                } catch { return null; }
              })()}
            </div>
            {ski.notes && (
              <div className="mt-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 px-2.5 py-1.5 text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap" data-testid={`text-ski-notes-${ski.id}`}>
                {ski.notes}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isArchived && onRegrind && (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`button-regrind-ski-${ski.id}`}
              onClick={onRegrind}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Regrind
            </Button>
          )}
          {!isArchived && onEdit && (
            <Button variant="ghost" size="sm" data-testid={`button-edit-ski-${ski.id}`} onClick={onEdit}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {!isArchived && onArchive && (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`button-archive-ski-${ski.id}`}
              onClick={onArchive}
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
              title={L("Arkiver ski", "Archive ski")}
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
          {isArchived && onRestore && (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`button-restore-ski-${ski.id}`}
              onClick={onRestore}
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            >
              <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
              Restore
            </Button>
          )}
          {isArchived && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`button-delete-ski-${ski.id}`}
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-border/40 pt-3 space-y-4" data-testid={`section-regrinds-${ski.id}`}>
          {/* All parameters */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{L("Parametre", "Parameters")}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
              {[
                { label: t("raceskis.serialNumber"), value: ski.serialNumber },
                { label: "Brand", value: ski.brand },
                { label: t("raceskis.discipline"), value: ski.discipline },
                { label: t("raceskis.construction"), value: ski.construction },
                { label: t("raceskis.mold"), value: ski.mold },
                { label: t("raceskis.base"), value: ski.base },
                { label: t("raceskis.grind"), value: ski.grind },
                ...(ski.discipline === "Classic" ? [{ label: t("raceskis.heights"), value: ski.heights }] : []),
                { label: "Year", value: ski.year },
                ...(() => {
                  try {
                    const cp = ski.customParams ? JSON.parse(ski.customParams) : {};
                    return Object.entries(cp).map(([k, v]) => ({
                      label: k.replace(/^custom_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                      value: v ? String(v) : null,
                    }));
                  } catch { return []; }
                })(),
              ].map((row) => (
                <div key={row.label} className="text-xs">
                  <span className="text-muted-foreground">{row.label}: </span>
                  <span className="font-medium">{row.value || "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Regrind history */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("raceskis.regrindHistory")}
            </h3>
            {regrinds.length === 0 ? (
              <p className="text-xs text-muted-foreground" data-testid={`text-no-regrinds-${ski.id}`}>
                {t("raceskis.noRegrinds")}
              </p>
            ) : (
              <div className="space-y-2">
                {regrinds.map((rg) => (
                  <div
                    key={rg.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2"
                    data-testid={`row-regrind-${rg.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                      <span className="font-medium">{fmtDate(rg.date)}</span>
                      <span className="font-semibold text-foreground">{rg.grindType}</span>
                      {rg.stone && <span className="text-muted-foreground">Stone: {rg.stone}</span>}
                      {rg.pattern && <span className="text-muted-foreground">Pattern: {rg.pattern}</span>}
                      {rg.notes && <span className="text-muted-foreground italic">{rg.notes}</span>}
                    </div>
                    {onDeleteRegrind && (
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-delete-regrind-${rg.id}`}
                        onClick={() => onDeleteRegrind(rg.id)}
                        className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Race history for this ski */}
          {(() => {
            const skiRaces = raceHistory.filter(r =>
              r.skiId === ski.skiId || r.skiIdClassic === ski.skiId || r.skiIdSkating === ski.skiId
            ).sort((a, b) => b.date.localeCompare(a.date));
            if (skiRaces.length === 0) return null;
            return (
              <div className="mt-2 pt-2 border-t border-border/40">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Raced {skiRaces.length}×
                </p>
                <div className="space-y-1.5">
                  {skiRaces.map(r => {
                    const w = r.weatherId ? raceWeatherById.get(r.weatherId) : null;
                    return (
                      <div key={r.entryId} className="text-[10px] text-muted-foreground">
                        <div className="font-medium text-foreground">
                          {r.location} · {new Date(r.date).toLocaleDateString()}
                        </div>
                        {w && (
                          <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5">
                            {w.snowTemperatureC != null && <span>Snow {w.snowTemperatureC}°C</span>}
                            {w.airTemperatureC != null && <span>Air {w.airTemperatureC}°C</span>}
                            {w.snowHumidityPct != null && <span>SRH {w.snowHumidityPct}%</span>}
                            {w.airHumidityPct != null && <span>ARH {w.airHumidityPct}%</span>}
                            {w.snowType && <span>{w.snowType}</span>}
                            {w.trackHardness && <span>{w.trackHardness}</span>}
                            {w.grainSize && <span>Grain {w.grainSize}</span>}
                            {w.precipitation && <span>{w.precipitation}</span>}
                            {w.artificialSnow && <span>Art. {w.artificialSnow}</span>}
                            {w.wind && <span>Wind {w.wind}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Waxer-logged race usage */}
          <div className="pt-2 border-t border-border/40">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{L("Løpsbruk", "Race usage")}</h3>
              {!isArchived && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setUsageOpen(true)} data-testid={`button-add-usage-${ski.id}`}>
                  <Plus className="h-3 w-3 mr-1" />{L("Logg løpsbruk", "Log race use")}
                </Button>
              )}
            </div>
            {usages.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{L("Ingen løpsbruk logget.", "No race use logged.")}</p>
            ) : (
              <div className="space-y-1.5">
                {usages.map((usage) => {
                  let mw: any = null; try { mw = usage.manualWeather ? JSON.parse(usage.manualWeather) : null; } catch {}
                  const lw = usage.weatherId ? raceWeatherById.get(usage.weatherId) : null;
                  const w: any = lw || mw;
                  return (
                    <div key={usage.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/30 px-3 py-1.5" data-testid={`row-usage-${usage.id}`}>
                      <div className="text-[11px]">
                        <span className="font-medium text-foreground">{usage.location || "—"} · {fmtDate(usage.date)}</span>
                        {usage.discipline && <span className="text-muted-foreground"> · {usage.discipline}</span>}
                        {w && (
                          <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground mt-0.5">
                            {w.snowTemperatureC != null && <span>{L("Snø", "Snow")} {w.snowTemperatureC}°C</span>}
                            {w.airTemperatureC != null && <span>{L("Luft", "Air")} {w.airTemperatureC}°C</span>}
                            {w.snowType && <span>{w.snowType}</span>}
                          </div>
                        )}
                      </div>
                      {!isArchived && (
                        <button onClick={() => deleteUsage.mutate(usage.id)} className="text-muted-foreground/50 hover:text-red-500 shrink-0" data-testid={`button-delete-usage-${usage.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={usageOpen} onOpenChange={setUsageOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{L("Logg løpsbruk", "Log race use")} — {ski.skiId}</DialogTitle></DialogHeader>
          <div className="space-y-3 pb-12 sm:pb-0">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">{L("Dato", "Date")}</label>
                <Input type="date" value={usageForm.date} onChange={(e) => setUsageForm((f) => ({ ...f, date: e.target.value, weatherId: "" }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{L("Stilart", "Discipline")}</label>
                <Select value={usageForm.discipline} onValueChange={(v) => setUsageForm((f) => ({ ...f, discipline: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Classic">Classic</SelectItem>
                    <SelectItem value="Skating">Skating</SelectItem>
                    <SelectItem value="Double Poling">Double Poling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{L("Sted", "Location")}</label>
              <Input value={usageForm.location} onChange={(e) => setUsageForm((f) => ({ ...f, location: e.target.value }))} placeholder={L("f.eks. Ruka", "e.g. Ruka")} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{L("Vær", "Weather")}</label>
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => setUsageForm((f) => ({ ...f, weatherMode: "link" }))} className={cn("flex-1 rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition-colors", usageForm.weatherMode === "link" ? "border-primary bg-primary/5" : "border-border text-muted-foreground")}>{L("Koble til observasjon", "Link record")}</button>
                <button type="button" onClick={() => setUsageForm((f) => ({ ...f, weatherMode: "manual" }))} className={cn("flex-1 rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition-colors", usageForm.weatherMode === "manual" ? "border-primary bg-primary/5" : "border-border text-muted-foreground")}>{L("Manuelt", "Manual")}</button>
              </div>
              {usageForm.weatherMode === "link" ? (
                usageWeatherOptions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">{L("Ingen værobservasjon på denne datoen.", "No weather record on this date.")}</p>
                ) : (
                  <Select value={usageForm.weatherId || "__none__"} onValueChange={(v) => setUsageForm((f) => ({ ...f, weatherId: v === "__none__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder={L("Velg", "Choose")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{L("Ingen", "None")}</SelectItem>
                      {usageWeatherOptions.map((w) => (<SelectItem key={w.id} value={String(w.id)}>{w.location}{w.snowTemperatureC != null ? ` (${w.snowTemperatureC}°C)` : ""}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <Input value={usageForm.snowTemp} onChange={(e) => setUsageForm((f) => ({ ...f, snowTemp: e.target.value }))} placeholder={L("Snø °C", "Snow °C")} />
                  <Input value={usageForm.airTemp} onChange={(e) => setUsageForm((f) => ({ ...f, airTemp: e.target.value }))} placeholder={L("Luft °C", "Air °C")} />
                  <Input value={usageForm.snowType} onChange={(e) => setUsageForm((f) => ({ ...f, snowType: e.target.value }))} placeholder={L("Snøtype", "Snow type")} />
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{L("Kommentar", "Comment")}</label>
              <Input value={usageForm.notes} onChange={(e) => setUsageForm((f) => ({ ...f, notes: e.target.value }))} placeholder={L("Valgfri kommentar…", "Optional comment…")} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => saveUsage.mutate()} disabled={saveUsage.isPending || !usageForm.date} data-testid="button-save-usage">
                {saveUsage.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TestListView({ tests, skiIds, allSkis, activeTestColumns, weather = [] }: { tests: RaceSkiTest[]; skiIds: Set<number>; allSkis: RaceSki[]; activeTestColumns: string[]; weather?: WeatherItem[] }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const testIds = useMemo(() => tests.map((t) => t.id), [tests]);
  const [, navigate] = useLocation();

  const { data: allEntries = [], isLoading } = useQuery<(TestEntry & { testId: number })[]>({
    queryKey: [`/api/test-list-view/entries`, testIds.join(",")],
    enabled: testIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        testIds.map(async (tid) => {
          const res = await fetch(`/api/tests/${tid}/entries`, { credentials: "include" });
          if (!res.ok) return [];
          const data = await res.json();
          return (data as TestEntry[]).map((e) => ({ ...e, testId: tid }));
        })
      );
      return results.flat();
    },
  });

  const raceSkiById = useMemo(() => new Map(allSkis.map((s) => [s.id, s])), [allSkis]);
  const weatherById = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);

  // One row per test: count of skis tested + top ski (rank 1)
  const testRows = useMemo(() => {
    return tests.map((test) => {
      const entries = allEntries.filter((e) => e.testId === test.id && e.raceSkiId && skiIds.has(e.raceSkiId));
      const skiCount = entries.length;
      const topEntry = entries.find((e) => e.rank0km === 1) ?? entries.reduce<(typeof entries)[0] | null>((best, e) => {
        if (!best) return e;
        const bRank = best.rank0km ?? Infinity;
        const eRank = e.rank0km ?? Infinity;
        return eRank < bRank ? e : best;
      }, null);
      const topSki = topEntry?.raceSkiId ? raceSkiById.get(topEntry.raceSkiId) : undefined;
      return { test, skiCount, topSki, topEntry };
    });
  }, [tests, allEntries, skiIds, raceSkiById]);

  if (tests.length === 0) return null;

  return (
    <Card className="fs-card rounded-2xl overflow-hidden" data-testid="tests-list-view">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="px-3 py-2.5 font-medium">{L("Dato", "Date")}</th>
              <th className="px-3 py-2.5 font-medium">{L("Sted", "Location")}</th>
              <th className="px-3 py-2.5 font-medium">{L("Type", "Type")}</th>
              <th className="px-3 py-2.5 font-medium">{L("Vær", "Weather")}</th>
              <th className="px-3 py-2.5 font-medium"># Skis</th>
              <th className="px-3 py-2.5 font-medium">{L("Beste ski", "Top Ski")}</th>
              <th className="px-3 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && testIds.length > 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td>
              </tr>
            ) : (
              testRows.map(({ test, skiCount, topSki, topEntry }, idx) => (
                <tr
                  key={test.id}
                  className={cn("border-t border-border/30", idx % 2 === 0 ? "bg-background/30" : "bg-background/10")}
                  data-testid={`list-row-test-${test.id}`}
                >
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{fmtDate(test.date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{test.location}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800">
                      {test.testType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[10px]">
                    {test.weatherId != null && weatherById.get(test.weatherId) ? (
                      (() => {
                        const w = weatherById.get(test.weatherId!)!;
                        const parts: string[] = [];
                        if (w.snowTemperatureC != null) parts.push(`Snow ${w.snowTemperatureC}°`);
                        if (w.airTemperatureC != null) parts.push(`Air ${w.airTemperatureC}°`);
                        if (w.snowHumidityPct != null) parts.push(`SRH ${w.snowHumidityPct}%`);
                        if (w.airHumidityPct != null) parts.push(`ARH ${w.airHumidityPct}%`);
                        if (w.wind) parts.push(w.wind);
                        if (w.snowType) parts.push(w.snowType);
                        if (w.trackHardness) parts.push(w.trackHardness);
                        if (w.grainSize) parts.push(w.grainSize);
                        if (w.precipitation) parts.push(w.precipitation);
                        if (w.testQuality != null) parts.push(`Q${w.testQuality}/5`);
                        return parts.length > 0
                          ? <span className="text-muted-foreground">{parts.join(" · ")}</span>
                          : <span className="opacity-50">—</span>;
                      })()
                    ) : <span className="opacity-50 text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {skiCount > 0 ? skiCount : <span className="opacity-50">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {topSki ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400">#1</span>
                        <span className="font-medium">{topSki.skiId}</span>
                      </span>
                    ) : <span className="text-muted-foreground opacity-50">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                      onClick={() => navigate(`/tests/${test.id}`)}
                      data-testid={`list-open-test-${test.id}`}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type TestComment = {
  id: number;
  test_id: number;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
};

function relativeTime(dateStr: string, lang: string = "no"): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (lang === "no") {
    if (mins < 1) return "nettopp";
    if (mins < 60) return `${mins}m siden`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}t siden`;
    const days = Math.floor(hours / 24);
    return `${days}d siden`;
  }
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function RaceSkiTestCard({
  test, skiIds, allSkis, activeTestColumns, weather = [], expanded, onToggle,
  athleteName, currentUserId, isReadOnly,
}: {
  test: RaceSkiTest;
  skiIds: Set<number>;
  allSkis: RaceSki[];
  activeTestColumns: string[];
  weather?: WeatherItem[];
  expanded: boolean;
  onToggle: () => void;
  athleteName?: string;
  currentUserId?: number;
  isReadOnly?: boolean;
}) {
  const weatherMap = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [, navigate] = useLocation();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { toast } = useToast();

  const { data: entries = [] } = useQuery<TestEntry[]>({
    queryKey: [`/api/tests/${test.id}/entries`],
    enabled: expanded,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery<TestComment[]>({
    queryKey: ["/api/tests", test.id, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/tests/${test.id}/comments`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: expanded && commentsOpen,
  });

  const postCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/tests/${test.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      refetchComments();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to post comment", variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete comment");
    },
    onSuccess: () => {
      refetchComments();
    },
  });

  const relevantEntries = useMemo(() => {
    if (entries.length === 0) return [];
    return entries.filter((e) => e.raceSkiId && skiIds.has(e.raceSkiId));
  }, [entries, skiIds]);

  const raceSkiById = useMemo(() => new Map(allSkis.map((s) => [s.id, s])), [allSkis]);

  // Reorder state
  const hasNoResults = relevantEntries.length > 0 &&
    relevantEntries.every((e) => e.result0kmCmBehind === null && e.feelingRank === null);
  const [reorderMode, setReorderMode] = useState(false);
  const [orderedEntries, setOrderedEntries] = useState<TestEntry[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  // Sync orderedEntries from relevantEntries when not in reorder mode
  useEffect(() => {
    if (!reorderMode) {
      setOrderedEntries([...relevantEntries].sort((a, b) => a.skiNumber - b.skiNumber));
    }
  }, [relevantEntries, reorderMode]);

  function moveEntryUp(idx: number) {
    if (idx <= 0) return;
    setOrderedEntries((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveEntryDown(idx: number) {
    if (idx >= orderedEntries.length - 1) return;
    setOrderedEntries((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  async function saveOrder() {
    setSavingOrder(true);
    try {
      const updatedEntries = orderedEntries.map((e, i) => ({ ...e, skiNumber: i + 1 }));
      await apiRequest("PUT", `/api/tests/${test.id}`, {
        date: test.date,
        location: test.location,
        testType: test.testType,
        notes: test.notes,
        distanceLabels: test.distanceLabels,
        entries: updatedEntries.map((e) => ({ ...e, skiNumber: e.skiNumber, raceSkiId: e.raceSkiId })),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${test.id}/entries`] });
      toast({ title: "Order saved", description: "Watch will use this order." });
      setReorderMode(false);
    } catch (err) {
      toast({ title: "Error", description: "Failed to save order.", variant: "destructive" });
    } finally {
      setSavingOrder(false);
    }
  }

  function handleOpenReport() {
    // Open window synchronously before any work (popup-blocker safe)
    const win = window.open("", "_blank");
    if (!win) return;

    const weath = test.weatherId != null ? weatherMap.get(test.weatherId) : undefined;

    const entryRows = relevantEntries.map((e) => {
      const ski = e.raceSkiId ? raceSkiById.get(e.raceSkiId) : undefined;
      return [
        ski?.skiId ?? `#${e.skiNumber}`,
        ski?.brand ?? null,
        ski?.grind ?? null,
        e.result0kmCmBehind != null ? `${e.result0kmCmBehind} cm` : null,
        e.rank0km != null ? (e.rank0km === 1 ? `🥇 #${e.rank0km}` : `#${e.rank0km}`) : null,
        e.feelingRank ?? null,
      ];
    });

    const subtitle = [athleteName, test.location, test.testType].filter(Boolean).join(" · ");

    const body = `
      <div class="pdf-title">{L("Testrapport", "Test Report")}</div>
      <div class="pdf-subtitle">${subtitle}</div>
      ${pdfTable(["Date", "Location", "Type", "Notes"], [[test.date, test.location, test.testType, test.notes ?? null]])}
      ${weath ? pdfWeather(weath) : ""}
      ${pdfSection("Results")}
      ${pdfTable(
        ["Ski ID", "Brand", "Grind", "Result", "Rank", "Feeling"],
        entryRows,
        (row) => row[4] != null && String(row[4]).startsWith("🥇"),
      )}
    `;

    openPdfWindow(pdfDocument(`Test Report — ${test.date}`, body), win);
  }

  const getSkiLabel = (entry: TestEntry) => {
    if (entry.raceSkiId) {
      const rs = raceSkiById.get(entry.raceSkiId);
      if (rs) return rs.serialNumber || rs.skiId;
    }
    return String(entry.skiNumber);
  };

  if (expanded && entries.length > 0 && relevantEntries.length === 0) {
    return null;
  }

  return (
    <Card className="fs-card rounded-2xl p-4" data-testid={`card-test-${test.id}`}>
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1"
          onClick={onToggle}
          data-testid={`toggle-test-${test.id}`}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            <span className="flex items-center gap-1 text-sm font-medium" data-testid={`text-test-date-${test.id}`}>
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {fmtDate(test.date)}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-test-location-${test.id}`}>
              <MapPin className="h-3 w-3" />
              {test.location}
            </span>
            <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800" data-testid={`text-test-type-${test.id}`}>
              {test.testType}
            </span>
            {test.weatherId != null && weatherMap.get(test.weatherId) && (() => {
              const w = weatherMap.get(test.weatherId!)!;
              const badges: { label: string; value: string; color: string }[] = [];
              if (w.snowTemperatureC != null) badges.push({ label: "Snow", value: `${w.snowTemperatureC}°C`, color: "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800" });
              if (w.airTemperatureC != null) badges.push({ label: "Air", value: `${w.airTemperatureC}°C`, color: "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 ring-orange-200 dark:ring-orange-800" });
              if (w.snowHumidityPct != null) badges.push({ label: "Snow RH", value: `${w.snowHumidityPct}%`, color: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 ring-cyan-200 dark:ring-cyan-800" });
              if (w.airHumidityPct != null) badges.push({ label: "Air RH", value: `${w.airHumidityPct}%`, color: "bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700" });
              if (w.wind) badges.push({ label: "Wind", value: w.wind, color: "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 ring-teal-200 dark:ring-teal-800" });
              if (w.snowType) badges.push({ label: "Snow", value: w.snowType, color: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-800" });
              if (w.trackHardness) badges.push({ label: "Track", value: w.trackHardness, color: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800" });
              if (w.grainSize) badges.push({ label: "Grain", value: w.grainSize, color: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-800" });
              if (w.precipitation) badges.push({ label: "Precip", value: w.precipitation, color: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-800" });
              if (w.clouds != null) badges.push({ label: "Clouds", value: `${w.clouds}/8`, color: "bg-muted text-muted-foreground ring-border" });
              if (w.visibility) badges.push({ label: "Visibility", value: w.visibility, color: "bg-muted text-muted-foreground ring-border" });
              if (w.naturalSnow) badges.push({ label: "Natural", value: w.naturalSnow, color: "bg-muted text-muted-foreground ring-border" });
              if (w.artificialSnow) badges.push({ label: "Artificial", value: w.artificialSnow, color: "bg-muted text-muted-foreground ring-border" });
              if (w.testQuality != null) badges.push({ label: "Quality", value: `${w.testQuality}/5`, color: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800" });
              return badges.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {badges.map((b, i) => (
                    <span key={i} className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${b.color}`}>
                      <span className="opacity-60">{b.label}</span>
                      <span className="font-semibold">{b.value}</span>
                    </span>
                  ))}
                </div>
              ) : null;
            })()}
            <span className="text-xs text-muted-foreground">{test.createdByName}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleOpenReport}
            data-testid={`button-report-test-${test.id}`}
            title={L("Skriv ut / eksporter denne testrapporten", "Print/export this test report")}
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate(`/tests/${test.id}`)}
            data-testid={`button-view-test-${test.id}`}
          >
            Open
          </Button>
        </div>
      </div>

      {expanded && relevantEntries.length > 0 && (
        <div className="mt-3 border-t border-border/40 pt-3" data-testid={`section-test-entries-${test.id}`}>
          {/* Reorder toolbar */}
          {hasNoResults && !isReadOnly && (
            <div className="flex items-center justify-between mb-2">
              {!reorderMode ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setReorderMode(true)}
                  data-testid={`button-reorder-${test.id}`}
                >
                  <GripVertical className="h-3 w-3 mr-1" />
                  Edit Order
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setReorderMode(false); setOrderedEntries([...relevantEntries].sort((a, b) => a.skiNumber - b.skiNumber)); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-3 text-xs"
                    onClick={saveOrder}
                    disabled={savingOrder}
                    data-testid={`button-save-order-${test.id}`}
                  >
                    {savingOrder ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Save Order
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border bg-card/50">
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  {reorderMode && <th className="px-2 py-2 w-16"></th>}
                  {activeTestColumns.includes("skiId") && <th className="px-3 py-2">{L("Ski-ID", "Ski ID")}</th>}
                  {!activeTestColumns.includes("skiId") && <th className="px-3 py-2">Ski</th>}
                  {activeTestColumns.includes("serialNumber") && <th className="px-3 py-2">{L("Serienr.", "Serial")}</th>}
                  {activeTestColumns.includes("brand") && <th className="px-3 py-2">{L("Merke", "Brand")}</th>}
                  {activeTestColumns.includes("discipline") && <th className="px-3 py-2">{L("Stilart", "Discipline")}</th>}
                  {activeTestColumns.includes("construction") && <th className="px-3 py-2">{L("Konstruksjon", "Construction")}</th>}
                  {activeTestColumns.includes("mold") && <th className="px-3 py-2">Mold</th>}
                  {activeTestColumns.includes("base") && <th className="px-3 py-2">Base</th>}
                  {activeTestColumns.includes("grind") && <th className="px-3 py-2">{L("Slip", "Grind")}</th>}
                  {activeTestColumns.includes("heights") && <th className="px-3 py-2">{L("Høyder", "Heights")}</th>}
                  {activeTestColumns.includes("year") && <th className="px-3 py-2">Year</th>}
                  {activeTestColumns.includes("result") && <th className="px-3 py-2">{L("Resultat", "Result")}</th>}
                  {activeTestColumns.includes("rank") && <th className="px-3 py-2">Rank</th>}
                  {activeTestColumns.includes("feeling") && <th className="px-3 py-2">{L("Følelse", "Feeling")}</th>}
                  {activeTestColumns.includes("methodology") && <th className="px-3 py-2">{L("Metodikk", "Methodology")}</th>}
                </tr>
              </thead>
              <tbody>
                {(reorderMode ? orderedEntries : relevantEntries).map((entry, idx) => {
                  const linkedSki = entry.raceSkiId ? raceSkiById.get(entry.raceSkiId) : undefined;
                  return (
                  <tr key={entry.id} className="border-t" data-testid={`row-test-result-${entry.id}`}>
                    {reorderMode && (
                      <td className="px-2 py-1.5">
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            onClick={() => moveEntryUp(idx)}
                            disabled={idx === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            onClick={() => moveEntryDown(idx)}
                            disabled={idx === orderedEntries.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    )}
                    {activeTestColumns.includes("skiId") ? (
                      <td className="px-3 py-1.5 font-medium">{linkedSki?.skiId ?? getSkiLabel(entry)}</td>
                    ) : (
                      <td className="px-3 py-1.5 font-medium">{getSkiLabel(entry)}</td>
                    )}
                    {activeTestColumns.includes("serialNumber") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.serialNumber ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("brand") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.brand ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("discipline") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.discipline ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("construction") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.construction ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("mold") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.mold ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("base") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.base ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("grind") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.grind ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("heights") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.heights ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("year") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.year ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("result") && (
                      <td className="px-3 py-1.5">{entry.result0kmCmBehind ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("rank") && (
                      <td className="px-3 py-1.5">
                        <span className={cn(
                          "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          entry.rank0km === 1 ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" :
                          entry.rank0km === 2 ? "bg-slate-300/15 text-slate-500 dark:text-slate-300" :
                          entry.rank0km === 3 ? "bg-amber-700/15 text-amber-700 dark:text-amber-600" :
                          "bg-muted/70 text-foreground"
                        )}>
                          {entry.rank0km ?? "—"}
                        </span>
                      </td>
                    )}
                    {activeTestColumns.includes("feeling") && (
                      <td className="px-3 py-1.5">{entry.feelingRank ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("methodology") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{entry.methodology || "—"}</td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {test.notes && (
            <p className="mt-2 text-xs text-muted-foreground italic" data-testid={`text-test-notes-${test.id}`}>
              {test.notes}
            </p>
          )}

          {/* Comments sub-section */}
          <div className="mt-3 border-t border-border/30 pt-3">
            <button
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setCommentsOpen((v) => !v)}
              data-testid={`toggle-comments-${test.id}`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Comments ({comments.length})
              {commentsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {commentsOpen && (
              <div className="mt-3 space-y-3" data-testid={`comments-section-${test.id}`}>
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{L("Ingen kommentarer ennå.", "No comments yet.")}</p>
                ) : (
                  <div className="space-y-2">
                    {comments.map((c) => {
                      const initial = (c.user_name || "?")[0].toUpperCase();
                      const colorIndex = c.user_id % 6;
                      const avatarColors = [
                        "bg-indigo-500", "bg-emerald-500", "bg-amber-500",
                        "bg-rose-500", "bg-sky-500", "bg-violet-500",
                      ];
                      return (
                        <div key={c.id} className="flex items-start gap-2" data-testid={`comment-${c.id}`}>
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColors[colorIndex]}`}>
                            {initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium">{c.user_name}</span>
                              <span className="text-[10px] text-muted-foreground">{relativeTime(c.created_at)}</span>
                            </div>
                            <p className="text-xs text-foreground/90 break-words">{c.content}</p>
                          </div>
                          {currentUserId === c.user_id && !isReadOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500 shrink-0"
                              onClick={() => deleteCommentMutation.mutate(c.id)}
                              data-testid={`button-delete-comment-${c.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!isReadOnly && (
                  <div className="flex items-end gap-2 pt-1">
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={L("Skriv en kommentar…", "Add a comment…")}
                      className="min-h-[40px] h-10 resize-none text-xs flex-1"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (commentText.trim()) postCommentMutation.mutate(commentText.trim());
                        }
                      }}
                      data-testid={`input-comment-${test.id}`}
                    />
                    <Button
                      size="sm"
                      className="h-9 shrink-0"
                      disabled={!commentText.trim() || postCommentMutation.isPending}
                      onClick={() => { if (commentText.trim()) postCommentMutation.mutate(commentText.trim()); }}
                      data-testid={`button-post-comment-${test.id}`}
                    >
                      {postCommentMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Post"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </Card>
  );
}

// ─── Race Calendar Section ───────────────────────────────────────────────────

type PlannedRace = {
  id: number;
  date: string;
  raceName: string;
  location: string | null;
  discipline: string | null;
  notes: string | null;
};

function RaceCalendarSection({
  athleteId,
  raceSkiTests,
  isReadOnly,
}: {
  athleteId: number;
  raceSkiTests: RaceSkiTest[];
  isReadOnly?: boolean;
}) {
  const { toast } = useToast();
  const { lang } = useLanguage();
  const L = (no: string, en: string) => lang === "en" ? en : no;
  const { data: races = [], refetch: refetchRaces } = useQuery<PlannedRace[]>({
    queryKey: [`/api/athletes/${athleteId}/races`],
    enabled: !!athleteId,
  });
  const [open, setOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: "", raceName: "", location: "", discipline: "Klassisk", notes: "" });

  const today = new Date().toISOString().split("T")[0];
  const upcoming = [...races].filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = [...races].filter((r) => r.date < today).sort((a, b) => b.date.localeCompare(a.date));

  async function addRace() {
    if (!form.date || !form.raceName.trim()) return;
    setSaving(true);
    try {
      await apiRequest("POST", `/api/athletes/${athleteId}/races`, {
        date: form.date,
        raceName: form.raceName.trim(),
        location: form.location.trim() || null,
        discipline: form.discipline,
        notes: form.notes.trim() || null,
      });
      await refetchRaces();
      setForm({ date: "", raceName: "", location: "", discipline: "Klassisk", notes: "" });
      setShowAddForm(false);
    } catch {
      toast({ title: L("Feil", "Error"), description: L("Kunne ikke lagre løp", "Could not save race"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRace(id: number) {
    try {
      await apiRequest("DELETE", `/api/athletes/${athleteId}/races/${id}`);
      await refetchRaces();
    } catch {
      toast({ title: L("Feil", "Error"), description: L("Kunne ikke slette løp", "Could not delete race"), variant: "destructive" });
    }
  }

  function matchingTestCount(location: string | null | undefined): number {
    if (!location) return 0;
    return raceSkiTests.filter((t) => t.location.toLowerCase() === location.toLowerCase()).length;
  }

  const disciplineColors: Record<string, string> = {
    Klassisk: "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800",
    Skøyting: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800",
    Skiathlon: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-800",
    Sprint: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800",
    Classic: "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800",
    Skating: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800",
  };

  function RaceRow({ race }: { race: PlannedRace }) {
    const matches = matchingTestCount(race.location);
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-2.5" data-testid={`race-row-${race.id}`}>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800">
          <CalendarDays className="h-3 w-3" />
          {race.date}
        </span>
        <span className="font-medium text-sm">{race.raceName}</span>
        {race.location && <span className="text-xs text-muted-foreground">{race.location}</span>}
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${disciplineColors[race.discipline] ?? disciplineColors["Klassisk"]}`}>
          {race.discipline}
        </span>
        {race.notes && (
          <span className="text-xs text-muted-foreground italic">{race.notes}</span>
        )}
        {matches > 0 && (
          <span className="text-[10px] text-muted-foreground rounded-full bg-muted px-2 py-0.5">
            {matches} {lang === "no" ? `test${matches !== 1 ? "er" : ""}` : `test${matches !== 1 ? "s" : ""}`}
          </span>
        )}
        {!isReadOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
            onClick={() => deleteRace(race.id)}
            data-testid={`button-delete-race-${race.id}`}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="section-race-calendar">
      <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-4">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 cursor-pointer select-none" data-testid="toggle-race-calendar">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{L("Løpskalender", "Race Calendar")}</h2>
            <span className="text-xs text-muted-foreground">({races.length})</span>
          </button>
        </CollapsibleTrigger>
        {!isReadOnly && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => { setOpen(true); setShowAddForm(true); }}
            data-testid="button-add-race"
          >
            <Plus className="h-3 w-3 mr-1" />
            {L("Legg til løp", "Add race")}
          </Button>
        )}
      </div>

      <CollapsibleContent>
        <div className="mt-3 space-y-3">
          {upcoming.length === 0 && !showAddForm ? (
            <p className="text-sm text-muted-foreground">{L("Ingen kommende løp registrert.", "No upcoming races registered.")}</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((r) => <RaceRow key={r.id} race={r} />)}
            </div>
          )}

          {past.length > 0 && (
            <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  {pastOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {L("Tidligere løp", "Past races")} ({past.length})
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-2 opacity-70">
                  {past.map((r) => <RaceRow key={r.id} race={r} />)}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {showAddForm && !isReadOnly && (
            <Card className="fs-card rounded-2xl p-4" data-testid="form-add-race">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{L("Nytt løp", "New race")}</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">{L("Dato *", "Date *")}</label>
                  <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} data-testid="input-race-date" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{L("Rennnavn *", "Race name *")}</label>
                  <Input value={form.raceName} onChange={(e) => setForm((f) => ({ ...f, raceName: e.target.value }))} placeholder={L("f.eks. Birkebeineren", "e.g. Birkebeineren")} data-testid="input-race-name" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{L("Lokasjon", "Location")}</label>
                  <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder={L("f.eks. Lillehammer", "e.g. Lillehammer")} data-testid="input-race-location" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">{L("Stilart", "Discipline")}</label>
                  <Select value={form.discipline} onValueChange={(v) => setForm((f) => ({ ...f, discipline: v }))}>
                    <SelectTrigger data-testid="select-race-discipline"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Klassisk">{L("Klassisk", "Classic")}</SelectItem>
                      <SelectItem value="Skøyting">{L("Skøyting", "Skating")}</SelectItem>
                      <SelectItem value="Skiathlon">Skiathlon</SelectItem>
                      <SelectItem value="Sprint klassisk">{L("Sprint klassisk", "Sprint classic")}</SelectItem>
                      <SelectItem value="Sprint skøyting">{L("Sprint skøyting", "Sprint skating")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium">{L("Notater", "Notes")}</label>
                  <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={L("Valgfrie notater…", "Optional notes…")} data-testid="input-race-notes" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>{L("Avbryt", "Cancel")}</Button>
                <Button size="sm" onClick={addRace} disabled={!form.date || !form.raceName.trim() || saving} data-testid="button-save-race">
                  {L("Lagre løp", "Save race")}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Audit Log Section ────────────────────────────────────────────────────────

type ActivityEntry = {
  id: number;
  userId: number;
  userName: string;
  action: string;
  entityType: string | null;
  entityId: number | null;
  details: string | null;
  createdAt: string;
};

function AuditLogSection({ athleteId, skis }: { athleteId: number; skis: RaceSki[] }) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);

  const ACTION_LABELS: Record<string, { no: string; en: string }> = {
    created:          { no: "opprettet",       en: "created" },
    updated:          { no: "oppdaterte",      en: "updated" },
    deleted:          { no: "slettet",         en: "deleted" },
    duplicated:       { no: "dupliserte",      en: "duplicated" },
    runsheet_applied: { no: "kjørte runsheet", en: "applied runsheet" },
  };

  function translateAction(action: string): string {
    return ACTION_LABELS[action]?.[lang] ?? action.replace(/_/g, " ");
  }

  const skiIds = useMemo(() => new Set(skis.map((s) => s.id)), [skis]);

  const { data: allActivity = [] } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/activity", { limit: 100 }],
    queryFn: async () => {
      const res = await fetch("/api/activity?limit=100", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const filteredActivity = useMemo(() => {
    return allActivity.filter((e) => {
      if (e.details?.includes(`athlete ${athleteId}`)) return true;
      if (e.entityType === "athlete" && e.entityId === athleteId) return true;
      if (e.entityType === "ski" && e.entityId != null && skiIds.has(e.entityId)) return true;
      if (e.details?.includes(`athleteId=${athleteId}`)) return true;
      return false;
    });
  }, [allActivity, athleteId, skiIds]);

  function actionIcon(action: string) {
    if (action.includes("create") || action.includes("add")) return <Plus className="h-3.5 w-3.5 text-emerald-500" />;
    if (action.includes("delete")) return <Trash2 className="h-3.5 w-3.5 text-red-500" />;
    if (action.includes("edit") || action.includes("update")) return <Edit2 className="h-3.5 w-3.5 text-blue-500" />;
    if (action.includes("test")) return <FileText className="h-3.5 w-3.5 text-indigo-500" />;
    return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="section-audit-log">
      <div className="flex items-center gap-2 border-t border-border/40 pt-4">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 cursor-pointer select-none" data-testid="toggle-audit-log">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{lang === "no" ? "Aktivitetslogg" : "Activity Log"}</h2>
            {filteredActivity.length > 0 && (
              <span className="text-xs text-muted-foreground">({filteredActivity.length} {lang === "no" ? "hendelser" : "events"})</span>
            )}
          </button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="mt-3" data-testid="audit-log-content">
          {filteredActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{lang === "no" ? "Ingen aktivitet registrert ennå." : "No activity recorded yet."}</p>
          ) : (
            <div className="space-y-1.5">
              {filteredActivity.map((e) => (
                <div key={e.id} className="flex items-start gap-2.5 rounded-lg bg-muted/20 px-3 py-2" data-testid={`audit-entry-${e.id}`}>
                  <div className="mt-0.5 shrink-0">{actionIcon(e.action)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-xs font-medium">{e.userName}</span>
                      <span className="text-xs text-muted-foreground">{translateAction(e.action)}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{relativeTime(e.createdAt, lang)}</span>
                    </div>
                    {e.details && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{e.details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Full-page analytics view (shown when ?view=analytics) ───────────────────

function AthleteAnalyticsView({
  skis,
  raceSkiTests,
  compareSkiIds,
  setCompareSkiIds,
}: {
  skis: RaceSki[];
  raceSkiTests: RaceSkiTest[];
  compareSkiIds: Set<number>;
  setCompareSkiIds: React.Dispatch<React.SetStateAction<Set<number>>>;
}) {
  const testIds = useMemo(() => raceSkiTests.map((t) => t.id), [raceSkiTests]);
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);

  const { data: allEntries = [] } = useQuery<(TestEntry & { testId: number })[]>({
    queryKey: [`/api/athletes/analytics/entries`, testIds.join(",")],
    enabled: testIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        testIds.map(async (tid) => {
          const res = await fetch(`/api/tests/${tid}/entries`, { credentials: "include" });
          if (!res.ok) return [];
          const data = await res.json();
          return (data as TestEntry[]).map((e) => ({ ...e, testId: tid }));
        })
      );
      return results.flat();
    },
  });

  // Weather data for conditions analysis
  const { data: weather = [] } = useQuery<WeatherItem[]>({
    queryKey: ["/api/weather/for-filtering"],
  });

  const weatherById = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);

  const skiStats = useMemo(() => {
    return skis.map((ski) => {
      const entries = allEntries.filter((e) => e.raceSkiId === ski.id);
      const testCount = new Set(entries.map((e) => e.testId)).size;
      const ranks = entries.map((e) => e.rank0km).filter((r): r is number => r !== null);
      const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
      const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;
      const wins = ranks.filter((r) => r === 1).length;
      const winRate = ranks.length > 0 ? (wins / ranks.length) * 100 : null;
      return { ski, testCount, avgRank, bestRank, winRate, entryCount: entries.length };
    }).filter((s) => s.entryCount > 0).sort((a, b) => (a.avgRank ?? 999) - (b.avgRank ?? 999));
  }, [skis, allEntries]);

  // Snow temp brackets
  const tempBrackets = [
    { label: "< -10°C", test: (t: number) => t < -10 },
    { label: "-10 to -5°C", test: (t: number) => t >= -10 && t < -5 },
    { label: "-5 to 0°C", test: (t: number) => t >= -5 && t < 0 },
    { label: "0°C+", test: (t: number) => t >= 0 },
  ];

  // Avg rank by snow temp bracket for top 5 skis
  const top5Skis = skiStats.slice(0, 5);
  const conditionsChartData = useMemo(() => {
    return tempBrackets.map(({ label, test: inBracket }) => {
      const row: Record<string, string | number> = { bracket: label };
      for (const { ski } of top5Skis) {
        const entries = allEntries.filter((e) => e.raceSkiId === ski.id);
        const bracketEntries = entries.filter((e) => {
          const testObj = raceSkiTests.find((t) => t.id === e.testId);
          if (!testObj?.weatherId) return false;
          const w = weatherById.get(testObj.weatherId);
          if (!w || w.snowTemperatureC === null) return false;
          return inBracket(w.snowTemperatureC);
        });
        const ranks = bracketEntries.map((e) => e.rank0km).filter((r): r is number => r !== null);
        row[ski.skiId] = ranks.length > 0 ? parseFloat((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1)) : 0;
      }
      return row;
    });
  }, [allEntries, raceSkiTests, weatherById, top5Skis]);

  // Best conditions per ski: show snow temp range where ski ranked #1 or top 3
  const bestConditionsPerSki = useMemo(() => {
    return skiStats.map(({ ski }) => {
      const entries = allEntries.filter((e) => e.raceSkiId === ski.id);
      const top1Conditions: string[] = [];
      const top3Conditions: string[] = [];
      for (const { label, test: inBracket } of tempBrackets) {
        const bracketEntries = entries.filter((e) => {
          const testObj = raceSkiTests.find((t) => t.id === e.testId);
          if (!testObj?.weatherId) return false;
          const w = weatherById.get(testObj.weatherId);
          if (!w || w.snowTemperatureC === null) return false;
          return inBracket(w.snowTemperatureC);
        });
        const hasWin = bracketEntries.some((e) => e.rank0km === 1);
        const hasTop3 = bracketEntries.some((e) => e.rank0km !== null && e.rank0km <= 3);
        if (hasWin) top1Conditions.push(label);
        else if (hasTop3) top3Conditions.push(label);
      }
      return { ski, top1Conditions, top3Conditions };
    });
  }, [skiStats, allEntries, raceSkiTests, weatherById]);

  const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

  // Feature 4: Ski Performance Over Time — top 6 most-tested skis
  const top6Skis = useMemo(() =>
    [...skiStats].sort((a, b) => b.entryCount - a.entryCount).slice(0, 6),
  [skiStats]);

  const sortedTests = useMemo(() =>
    [...raceSkiTests].sort((a, b) => a.date.localeCompare(b.date)),
  [raceSkiTests]);

  const performanceOverTimeData = useMemo(() => {
    return sortedTests.map((test) => {
      const row: Record<string, string | number | null> = { date: test.date };
      for (const { ski } of top6Skis) {
        const entry = allEntries.find((e) => e.testId === test.id && e.raceSkiId === ski.id);
        row[ski.skiId] = entry?.rank0km ?? null;
      }
      return row;
    }).filter((row) => top6Skis.some(({ ski }) => row[ski.skiId] !== null));
  }, [sortedTests, allEntries, top6Skis]);

  // Feature 5: Weather vs Result Correlation — 2°C snow temp buckets per ski
  const tempCorrelationData = useMemo(() => {
    type BucketKey = string;
    const map = new Map<number, Map<BucketKey, number[]>>();
    for (const { ski } of skiStats) {
      const skiEntries = allEntries.filter((e) => e.raceSkiId === ski.id && e.rank0km !== null);
      const buckets = new Map<BucketKey, number[]>();
      for (const e of skiEntries) {
        const testObj = raceSkiTests.find((t) => t.id === e.testId);
        if (!testObj?.weatherId) continue;
        const w = weatherById.get(testObj.weatherId);
        if (!w || w.snowTemperatureC === null) continue;
        const bucketStart = Math.floor(w.snowTemperatureC / 2) * 2;
        const key = `${bucketStart}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(e.rank0km!);
      }
      map.set(ski.id, buckets);
    }
    return skiStats.map(({ ski }) => {
      const buckets = map.get(ski.id) ?? new Map();
      let bestBucket: string | null = null;
      let bestAvg = Infinity;
      let bestTests = 0;
      for (const [key, ranks] of buckets.entries()) {
        const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
        if (avg < bestAvg) {
          bestAvg = avg;
          bestBucket = key;
          bestTests = ranks.length;
        }
      }
      const totalEntries = [...buckets.values()].flat().length;
      return {
        ski,
        bestTempRange: bestBucket !== null ? `${bestBucket}°C to ${Number(bestBucket) + 2}°C` : null,
        avgRank: bestBucket !== null ? bestAvg : null,
        tests: bestTests,
        totalEntries,
      };
    }).filter((r) => r.totalEntries > 0);
  }, [skiStats, allEntries, raceSkiTests, weatherById]);

  if (skiStats.length === 0) {
    return (
      <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-analytics-view">
        No test data yet. Add race ski tests to see analytics.
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="full-analytics-view">
      {/* Per-ski performance summary */}
      <Card className="fs-card rounded-2xl overflow-hidden" data-testid="analytics-perf-table">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold">{L("Ytelsessammendrag per ski", "Per-Ski Performance Summary")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="px-4 py-2.5 font-medium">{L("Ski-ID", "Ski ID")}</th>
                <th className="px-3 py-2.5 font-medium"># Tests</th>
                <th className="px-3 py-2.5 font-medium">{L("Snittrang", "Avg Rank")}</th>
                <th className="px-3 py-2.5 font-medium">{L("Beste rang", "Best Rank")}</th>
                <th className="px-3 py-2.5 font-medium">{L("Seiersrate", "Win Rate")}</th>
              </tr>
            </thead>
            <tbody>
              {skiStats.map(({ ski, testCount, avgRank, bestRank, winRate }, idx) => (
                <tr
                  key={ski.id}
                  className={cn("border-t border-border/30", idx % 2 === 0 ? "bg-background/30" : "bg-background/10")}
                  data-testid={`analytics-perf-row-${ski.id}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{ski.skiId}</div>
                    {ski.brand && <div className="text-xs text-muted-foreground">{ski.brand}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{testCount}</td>
                  <td className="px-3 py-2.5">{avgRank !== null ? avgRank.toFixed(1) : "—"}</td>
                  <td className="px-3 py-2.5">
                    {bestRank !== null ? (
                      <span className={cn(
                        "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        bestRank === 1 ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" :
                        bestRank === 2 ? "bg-slate-300/15 text-slate-500 dark:text-slate-300" :
                        bestRank === 3 ? "bg-amber-700/15 text-amber-700 dark:text-amber-600" :
                        "bg-muted/70 text-foreground"
                      )}>#{bestRank}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5">{winRate !== null ? `${winRate.toFixed(0)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top skis per condition bracket — bar chart */}
      {top5Skis.length > 0 && conditionsChartData.some((d) => top5Skis.some(({ ski }) => (d[ski.skiId] as number) > 0)) && (
        <Card className="fs-card rounded-2xl p-4" data-testid="analytics-conditions-chart">
          <h2 className="text-base font-semibold mb-4">Avg Rank by Snow Temperature (Top 5 Skis)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={conditionsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="bracket" tick={{ fontSize: 11 }} />
              <YAxis reversed tick={{ fontSize: 11 }} label={{ value: "Avg Rank", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number) => [value === 0 ? "No data" : value.toFixed(1), ""]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {top5Skis.map(({ ski }, i) => (
                <Bar key={ski.id} dataKey={ski.skiId} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-muted-foreground">Lower rank = better. 0 = no data in that bracket.</p>
        </Card>
      )}

      {/* Best conditions per ski */}
      <Card className="fs-card rounded-2xl overflow-hidden" data-testid="analytics-best-conditions">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold">{L("Beste forhold per ski", "Best Conditions Per Ski")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Snow temperature ranges where each ski ranked #1 or top 3</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="px-4 py-2.5 font-medium">{L("Ski-ID", "Ski ID")}</th>
                <th className="px-3 py-2.5 font-medium">{L("Vant i forhold", "Won in conditions")}</th>
                <th className="px-3 py-2.5 font-medium">Top 3 in conditions</th>
              </tr>
            </thead>
            <tbody>
              {bestConditionsPerSki.map(({ ski, top1Conditions, top3Conditions }, idx) => (
                <tr
                  key={ski.id}
                  className={cn("border-t border-border/30", idx % 2 === 0 ? "bg-background/30" : "bg-background/10")}
                  data-testid={`analytics-conditions-row-${ski.id}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{ski.skiId}</div>
                    {ski.brand && <div className="text-xs text-muted-foreground">{ski.brand}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    {top1Conditions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {top1Conditions.map((c) => (
                          <span key={c} className="inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {top3Conditions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {top3Conditions.map((c) => (
                          <span key={c} className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Feature 4: Ski Performance Over Time */}
      {performanceOverTimeData.length > 1 && top6Skis.length > 0 && (
        <Card className="fs-card rounded-2xl p-4" data-testid="analytics-performance-over-time">
          <h2 className="text-base font-semibold mb-1">{L("Skiytelse over tid", "Ski Performance Over Time")}</h2>
          <p className="text-xs text-muted-foreground mb-4">Average rank per test date (lower = better) — top 6 most-tested skis</p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={performanceOverTimeData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
              <YAxis reversed tick={{ fontSize: 11 }} label={{ value: "Rank", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number | null) => [v ?? "—", ""]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {top6Skis.map(({ ski }, i) => (
                <Line
                  key={ski.id}
                  type="monotone"
                  dataKey={ski.skiId}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Feature 5: Weather vs Result Correlation */}
      {tempCorrelationData.length > 0 && (
        <Card className="fs-card rounded-2xl overflow-hidden" data-testid="analytics-temp-correlation">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-base font-semibold">{L("Ytelse etter snøtemperatur", "Performance by Snow Temperature")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Best 2°C snow temperature bucket per ski</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="px-4 py-2.5 font-medium">{L("Ski-ID", "Ski ID")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Merke", "Brand")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Beste temp.område", "Best Temp Range")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Snittrang", "Avg Rank")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Tester", "Tests")}</th>
                </tr>
              </thead>
              <tbody>
                {tempCorrelationData.map(({ ski, bestTempRange, avgRank, tests }, idx) => (
                  <tr
                    key={ski.id}
                    className={cn("border-t border-border/30", idx % 2 === 0 ? "bg-background/30" : "bg-background/10")}
                    data-testid={`analytics-temp-row-${ski.id}`}
                  >
                    <td className="px-4 py-2.5 font-semibold">{ski.skiId}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{ski.brand ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {bestTempRange ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800">
                          <Thermometer className="h-3 w-3" />
                          {bestTempRange}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5">{avgRank !== null ? avgRank.toFixed(1) : "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{tests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Existing ski comparison section */}
      <SkiAnalyticsSection
        skis={skis}
        raceSkiTests={raceSkiTests}
        compareSkiIds={compareSkiIds}
        setCompareSkiIds={setCompareSkiIds}
      />
    </div>
  );
}
