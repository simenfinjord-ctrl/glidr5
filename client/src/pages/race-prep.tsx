// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flag, Plus, X, ChevronRight, Pencil, Check, Trash2, Users, Search, Snowflake } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Product = { id: number; category: string; brand: string; name: string };

type Weather = {
  id: number;
  date: string;
  location: string;
  snowTemperatureC: number | null;
  airTemperatureC: number | null;
  snowHumidityPct: number | null;
  airHumidityPct: number | null;
  artificialSnow: string | null;
  naturalSnow: string | null;
  snowHumidityType: string | null;
  trackHardness: string | null;
  testQuality: number | null;
  snowType: string | null;
  wind: string | null;
  clouds: number | null;
  precipitation: string | null;
  grainSize: string | null;
  visibility: string | null;
};

type RacePrep = {
  id: number;
  teamId: number;
  date: string;
  startTime: string | null;
  location: string;
  raceType: string;
  discipline: string;
  products: string | null;
  method: string | null;
  structure: string | null;
  notes: string | null;
  productIds: string | null;
  structureIds: string | null;
  kickProductIds: string | null;
  tette: string | null;
  weatherId: number | null;
  createdById: number;
  createdByName: string;
  createdAt: string;
};

type RacePrepEntry = {
  id: number;
  racePrepId: number;
  athleteId: number;
  athleteName: string;
  skiId: string | null;
  skiIdClassic: string | null;
  skiIdSkating: string | null;
  waxerId: number | null;
  waxerName: string | null;
  notes: string | null;
  createdAt: string;
};

type Athlete = {
  id: number;
  name: string;
  team: string | null;
};

type RaceSkiRecord = {
  id: number;
  athleteId: number;
  skiId: string;
  serialNumber: string | null;
  brand: string | null;
  discipline: string;
  construction: string | null;
  mold: string | null;
  base: string | null;
  grind: string | null;
  heights: string | null;
  year: string | null;
  customParams: string | null;
};

const parseIds = (s: string | null) => s ? s.split(",").map(Number).filter(Boolean) : [];

function productNames(ids: string | null, products: Product[]): string {
  if (!ids) return "";
  return ids.split(",").map(id => {
    const p = products.find(p => p.id === parseInt(id));
    return p ? `${p.brand} ${p.name}` : "";
  }).filter(Boolean).join(" + ");
}

// Returns true if the string looks like free text (not a list of numeric IDs)
function isFreeText(s: string | null): boolean {
  if (!s) return false;
  return s.split(",").some(part => isNaN(Number(part.trim())));
}

const EMPTY_FORM = {
  date: "",
  startTime: "",
  location: "",
  raceType: "",
  discipline: "Classic",
  productIds: [] as number[],
  structureIds: [] as number[],
  kick: "",
  tette: "",
  method: "",
  notes: "",
  weatherId: null as number | null,
};

// Values stored in DB as English; labels shown per language
const DISCIPLINES = ["Classic", "Skating", "Skiathlon"];
const DISCIPLINE_LABEL: Record<string, { no: string; en: string }> = {
  Classic:   { no: "Klassisk",  en: "Classic" },
  Skating:   { no: "Skøyting",  en: "Skating" },
  Skiathlon: { no: "Skiathlon", en: "Skiathlon" },
};

const DISCIPLINE_COLORS: Record<string, string> = {
  Classic:   "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800",
  Skating:   "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800",
  Skiathlon: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-800",
};

function fmtDate(d: string, lang: string) {
  try {
    return new Date(d).toLocaleDateString(lang === "en" ? "en-GB" : "nb-NO", { dateStyle: "medium" });
  } catch {
    return d;
  }
}

const TRACK_HARDNESS_OPTIONS = ["Very soft", "Soft", "Medium hard", "Hard", "Very hard", "Ice"] as const;
const SNOW_HUMIDITY_TYPE_OPTIONS = ["Dry", "Moist", "Wet", "Very wet", "Slush"] as const;
const GRAIN_SIZE_OPTIONS = ["Extra fine", "Very fine", "Fine", "Average", "Coarse", "Very coarse"] as const;
const SNOW_STAGE_OPTIONS = ["Falling new", "New", "Irreg. dir. new", "Irreg. dir. transf.", "Transformed"] as const;

// ── Multi-product picker ──────────────────────────────────────────────────────
function MultiProductPicker({
  value,
  onChange,
  products,
  placeholder,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  products: Product[];
  placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const selected = products.filter(p => value.includes(p.id));
  const filtered = search.trim()
    ? products.filter(p =>
        !value.includes(p.id) &&
        `${p.brand} ${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase())
      )
    : products.filter(p => !value.includes(p.id)).slice(0, 20);

  return (
    <div className="space-y-1.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(p => (
            <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
              {p.brand} {p.name}
              <button type="button" onClick={() => onChange(value.filter(id => id !== p.id))} className="ml-0.5 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        placeholder={placeholder}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      {search.trim() && filtered.length > 0 && (
        <div className="rounded-lg border border-border bg-card shadow-sm max-h-40 overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors"
              onClick={() => { onChange([...value, p.id]); setSearch(""); }}
            >
              <span className="font-medium">{p.brand} {p.name}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">{p.category}</span>
            </button>
          ))}
        </div>
      )}
      {search.trim() && filtered.length === 0 && (
        <p className="text-xs text-muted-foreground px-1">No products found</p>
      )}
    </div>
  );
}

// ── Ski detail dialog ─────────────────────────────────────────────────────────
function parseCustomParams(s: string | null): Record<string, string> {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}

function SkiDetailDialog({
  ski,
  open,
  onClose,
  lang,
}: {
  ski: RaceSkiRecord;
  open: boolean;
  onClose: () => void;
  lang: string;
}) {
  const L = (no: string, en: string) => lang === "en" ? en : no;
  const cp = parseCustomParams(ski.customParams);
  const fields: { label: string; value: string | null | undefined }[] = [
    { label: "Ski ID", value: ski.skiId },
    { label: L("Serienummer", "Serial number"), value: ski.serialNumber },
    { label: L("Merke", "Brand"), value: ski.brand },
    { label: L("Stilart", "Discipline"), value: ski.discipline },
    { label: L("Konstruksjon", "Construction"), value: ski.construction },
    { label: L("Form", "Mold"), value: ski.mold },
    { label: L("Sål", "Base"), value: ski.base },
    { label: L("Slipemønster", "Grind"), value: ski.grind },
    { label: "RA-Value", value: cp.ra_value ?? null },
    { label: L("Høyder", "Heights"), value: ski.heights },
    { label: L("År", "Year"), value: ski.year },
  ];
  // Any extra custom params beyond ra_value
  const extraCustom = Object.entries(cp).filter(([k]) => k !== "ra_value");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            {L("Skiinfo", "Ski info")} — {ski.skiId}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {fields.filter(f => f.value).map(f => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground mb-0.5">{f.label}</p>
              <p className="font-medium">{f.value}</p>
            </div>
          ))}
          {extraCustom.map(([k, v]) => (
            <div key={k}>
              <p className="text-xs text-muted-foreground mb-0.5">{k}</p>
              <p className="font-medium">{v}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Equipment overview — one row per ski per athlete ─────────────────────────
function AthleteSkiOverviewRow({
  entry,
  skiId,
  disciplineLabel,
  lang,
}: {
  entry: RacePrepEntry;
  skiId: string | null | undefined;
  disciplineLabel?: string;
  lang: string;
}) {
  const { data: skis = [] } = useQuery<RaceSkiRecord[]>({
    queryKey: [`/api/athletes/${entry.athleteId}/skis`],
    enabled: !!skiId,
  });
  const ski = skis.find(s => s.skiId === skiId || s.serialNumber === skiId) ?? null;
  const cp = parseCustomParams(ski?.customParams ?? null);
  const cell = (v: string | null | undefined) => (
    <td className="px-3 py-2 text-xs text-muted-foreground">{v || "—"}</td>
  );
  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-muted/20">
      <td className="px-3 py-2 text-sm font-medium">
        {entry.athleteName}
        {disciplineLabel && (
          <span className="ml-1.5 text-[10px] text-muted-foreground">({disciplineLabel})</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs font-mono">{skiId || <span className="text-muted-foreground">—</span>}</td>
      {cell(ski?.serialNumber)}
      {cell(ski?.brand)}
      {cell(ski?.grind)}
      {cell(cp.ra_value)}
      {cell(ski?.construction)}
      {cell(ski?.base)}
      {cell(ski?.heights)}
    </tr>
  );
}

function EquipmentOverview({
  entries,
  discipline,
  lang,
}: {
  entries: RacePrepEntry[];
  discipline: string;
  lang: string;
}) {
  const L = (no: string, en: string) => lang === "en" ? en : no;
  const headers = [
    L("Løper", "Athlete"),
    "Ski-ID",
    L("Serienr.", "Serial No."),
    L("Merke", "Brand"),
    L("Slipemønster", "Grind"),
    "RA-Value",
    L("Konstruksjon", "Construction"),
    L("Sål", "Base"),
    L("Høyder", "Heights"),
  ];
  return (
    <div className="rounded-xl border border-border overflow-x-auto mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            {headers.map(h => <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => {
            if (discipline === "Skiathlon") {
              return [
                <AthleteSkiOverviewRow
                  key={`${entry.id}-c`}
                  entry={entry}
                  skiId={entry.skiIdClassic ?? entry.skiId}
                  disciplineLabel={L("Klassisk", "Classic")}
                  lang={lang}
                />,
                <AthleteSkiOverviewRow
                  key={`${entry.id}-s`}
                  entry={entry}
                  skiId={entry.skiIdSkating}
                  disciplineLabel={L("Skøyting", "Skating")}
                  lang={lang}
                />,
              ];
            }
            return (
              <AthleteSkiOverviewRow
                key={entry.id}
                entry={entry}
                skiId={entry.skiId ?? entry.skiIdClassic}
                lang={lang}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Inline ski-ID editor ──────────────────────────────────────────────────────
function SkiIdCell({
  entry,
  canEdit,
  prepId,
  onSaved,
  lang,
  disciplineHint,
}: {
  entry: RacePrepEntry;
  canEdit: boolean;
  prepId: number;
  onSaved: () => void;
  lang: string;
  disciplineHint?: "Classic" | "Skating";
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(
    disciplineHint === "Classic" ? (entry.skiIdClassic ?? entry.skiId ?? "")
    : disciplineHint === "Skating" ? (entry.skiIdSkating ?? "")
    : (entry.skiId ?? "")
  );
  const [saving, setSaving] = useState(false);
  // Optimistic local value so cell shows the saved ID immediately while refetch is in-flight
  const [optimisticVal, setOptimisticVal] = useState<string | null | undefined>(undefined);
  const [skiDetailOpen, setSkiDetailOpen] = useState(false);
  const [selectedSki, setSelectedSki] = useState<RaceSkiRecord | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Fetch athlete's skis for autocomplete
  const { data: athleteSkis = [] } = useQuery<RaceSkiRecord[]>({
    queryKey: [`/api/athletes/${entry.athleteId}/skis`],
    enabled: editing,
  });

  const suggestions = useMemo(() => {
    const base = disciplineHint
      ? athleteSkis.filter(s => s.discipline === disciplineHint)
      : athleteSkis;
    if (!val.trim()) return base.slice(0, 8);
    return base.filter(s =>
      s.skiId.toLowerCase().includes(val.toLowerCase()) ||
      (s.serialNumber ?? "").toLowerCase().includes(val.toLowerCase())
    ).slice(0, 8);
  }, [athleteSkis, val, disciplineHint]);

  const [showSuggestions, setShowSuggestions] = useState(false);

  // Current ski ID value for display (use optimistic value while refetch is in-flight)
  const currentSkiId = disciplineHint === "Classic" ? (entry.skiIdClassic ?? entry.skiId)
    : disciplineHint === "Skating" ? entry.skiIdSkating
    : entry.skiId;
  const displaySkiId = optimisticVal !== undefined ? optimisticVal : currentSkiId;

  async function save(skiIdVal?: string) {
    const finalVal = skiIdVal !== undefined ? skiIdVal : val;
    setSaving(true);
    try {
      // Always send all three ski ID fields to avoid nulling out sibling fields (e.g. Skiathlon)
      const body: any = {
        notes: entry.notes,
        skiId: disciplineHint == null ? (finalVal.trim() || null) : (entry.skiId ?? null),
        skiIdClassic: disciplineHint === "Classic" ? (finalVal.trim() || null) : (entry.skiIdClassic ?? null),
        skiIdSkating: disciplineHint === "Skating" ? (finalVal.trim() || null) : (entry.skiIdSkating ?? null),
      };
      await apiRequest("PUT", `/api/race-preps/${prepId}/entries/${entry.id}`, body);
      // Show value immediately while refetch is in-flight (prevents flash to "—")
      setOptimisticVal(finalVal.trim() || null);
      onSaved();
      setEditing(false);
      setShowSuggestions(false);
    } catch {
      toast({ title: "Feil", description: "Kunde ikke lagre Ski-ID", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const { data: allSkisForAthlete = [] } = useQuery<RaceSkiRecord[]>({
    queryKey: [`/api/athletes/${entry.athleteId}/skis`],
    enabled: !!currentSkiId,
  });

  const matchedSki = useMemo(() =>
    allSkisForAthlete.find(s => s.skiId === currentSkiId || s.serialNumber === currentSkiId) ?? null,
    [allSkisForAthlete, currentSkiId]
  );

  if (!canEdit) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-sm">{displaySkiId ?? <span className="text-muted-foreground">—</span>}</span>
        {displaySkiId && matchedSki && (
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setSelectedSki(matchedSki); setSkiDetailOpen(true); }}
            title="View ski details"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        )}
        {selectedSki && (
          <SkiDetailDialog ski={selectedSki} open={skiDetailOpen} onClose={() => setSkiDetailOpen(false)} lang={lang} />
        )}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="relative flex items-start gap-1">
        <div className="relative">
          <Input
            ref={inputRef}
            className="h-7 w-28 text-xs"
            value={val}
            onChange={(e) => { setVal(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              // Small delay so a mousedown on a suggestion can fire first
              setTimeout(() => setShowSuggestions(false), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { save(); setShowSuggestions(false); }
              if (e.key === "Escape") { setEditing(false); setVal(displaySkiId ?? ""); setShowSuggestions(false); }
            }}
            autoFocus
          />
          {showSuggestions && suggestions.length > 0 && (
            // Rendered inside the dialog DOM — no portal, no Radix "outside click" problems.
            // position:absolute relative to the enclosing `relative` div keeps it below the input.
            <div className="absolute top-full left-0 z-50 mt-0.5 min-w-[12rem] w-full rounded-lg border border-border bg-card shadow-lg max-h-40 overflow-y-auto">
              {suggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary/10 hover:text-primary transition-colors"
                  onMouseDown={(e) => {
                    // preventDefault keeps the input focused (no blur) so the dropdown
                    // stays mounted until we hide it ourselves.
                    e.preventDefault();
                    setVal(s.skiId);
                    setShowSuggestions(false);
                    save(s.skiId);
                  }}
                >
                  <span className="font-medium">{s.skiId}</span>
                  {s.brand && <span className="ml-1 text-muted-foreground">{s.brand}</span>}
                  {s.discipline && <span className="ml-1 text-muted-foreground text-[10px]">({s.discipline})</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => save()} disabled={saving}>
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditing(false); setVal(displaySkiId ?? ""); setShowSuggestions(false); }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        className="flex items-center gap-1.5 group text-sm"
        onClick={() => setEditing(true)}
      >
        <span>{displaySkiId ?? <span className="text-muted-foreground">—</span>}</span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {displaySkiId && matchedSki && (
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => { setSelectedSki(matchedSki); setSkiDetailOpen(true); }}
          title="View ski details"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      )}
      {selectedSki && (
        <SkiDetailDialog ski={selectedSki} open={skiDetailOpen} onClose={() => setSkiDetailOpen(false)} lang={lang} />
      )}
    </div>
  );
}

// ── Weather summary row ───────────────────────────────────────────────────────
function WeatherRow({ weather, lang }: { weather: Weather; lang: string }) {
  const L = (no: string, en: string) => lang === "en" ? en : no;
  const rows: { label: string; value: string | number | null | undefined }[] = [
    { label: L("Snøtemp", "Snow temp"), value: weather.snowTemperatureC != null ? `${weather.snowTemperatureC}°C` : null },
    { label: L("Lufttemp", "Air temp"), value: weather.airTemperatureC != null ? `${weather.airTemperatureC}°C` : null },
    { label: L("Snøfukt", "Snow humidity"), value: weather.snowHumidityPct != null ? `${weather.snowHumidityPct}%` : null },
    { label: L("Luftfukt", "Air humidity"), value: weather.airHumidityPct != null ? `${weather.airHumidityPct}%` : null },
    { label: L("Kunstig snø", "Artificial snow"), value: weather.artificialSnow },
    { label: L("Naturlig snø", "Natural snow"), value: weather.naturalSnow },
    { label: L("Snøtype", "Snow type"), value: weather.snowType },
    { label: L("Sporhardhet", "Track hardness"), value: weather.trackHardness },
    { label: L("Vind", "Wind"), value: weather.wind },
    { label: L("Skyer", "Clouds"), value: weather.clouds != null ? `${weather.clouds}/8` : null },
    { label: L("Nedbør", "Precipitation"), value: weather.precipitation },
    { label: L("Kornstørrelse", "Grain size"), value: weather.grainSize },
    { label: L("Testkvalitet", "Test quality"), value: weather.testQuality != null ? String(weather.testQuality) : null },
  ];
  const visible = rows.filter(r => r.value != null && r.value !== "");
  if (visible.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
        <Snowflake className="h-3.5 w-3.5" />
        {L("Værforhold", "Weather conditions")} — {fmtDate(weather.date, lang)}, {weather.location}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        {visible.map(r => (
          <div key={r.label}>
            <p className="text-[10px] text-muted-foreground">{r.label}</p>
            <p className="font-medium text-sm">{r.value as string}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ski param cell — fetches athlete skis (React Query caches) ────────────────
function SkiParamCell({ athleteId, skiIdValue, paramKey }: { athleteId: number; skiIdValue: string | null | undefined; paramKey: string }) {
  const { data: skis = [] } = useQuery<RaceSkiRecord[]>({
    queryKey: [`/api/athletes/${athleteId}/skis`],
    enabled: !!skiIdValue,
  });
  if (!skiIdValue) return <span className="text-muted-foreground text-xs">—</span>;
  const ski = skis.find(s => s.skiId === skiIdValue || s.serialNumber === skiIdValue);
  if (!ski) return <span className="text-muted-foreground text-xs">—</span>;

  if (paramKey === "serialNumber") return <span className="text-xs">{ski.serialNumber || "—"}</span>;
  if (paramKey === "brand") return <span className="text-xs">{ski.brand || "—"}</span>;
  if (paramKey === "grind") return <span className="text-xs">{ski.grind || "—"}</span>;
  if (paramKey === "construction") return <span className="text-xs">{ski.construction || "—"}</span>;
  if (paramKey === "base") return <span className="text-xs">{ski.base || "—"}</span>;
  if (paramKey === "heights") return <span className="text-xs">{ski.heights || "—"}</span>;
  if (paramKey === "raValue") {
    try {
      const cp = ski.customParams ? JSON.parse(ski.customParams) : {};
      return <span className="text-xs">{cp.ra_value || "—"}</span>;
    } catch { return <span className="text-xs">—</span>; }
  }
  return <span className="text-xs">—</span>;
}

// ── Detail dialog ─────────────────────────────────────────────────────────────
function PrepDetailDialog({
  prep,
  open,
  onClose,
  isAdmin,
  userId,
  lang,
  weatherList,
}: {
  prep: RacePrep;
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  userId: number;
  lang: string;
  weatherList: Weather[];
}) {
  const { toast } = useToast();
  const [addAthletesOpen, setAddAthletesOpen] = useState(false);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<number>>(new Set());
  const [addingSaving, setAddingSaving] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);

  const SKI_PARAM_COLS = [
    { key: "serialNumber", label: lang === "en" ? "Serial No." : "Serienr." },
    { key: "brand", label: lang === "en" ? "Brand" : "Merke" },
    { key: "grind", label: lang === "en" ? "Grind" : "Slipemønster" },
    { key: "raValue", label: "RA-Value" },
    { key: "construction", label: lang === "en" ? "Construction" : "Konstruksjon" },
    { key: "base", label: lang === "en" ? "Base" : "Sål" },
    { key: "heights", label: lang === "en" ? "Heights" : "Høyder" },
  ];
  const [visibleSkiCols, setVisibleSkiCols] = useState<string[]>([]);

  const { data: entries = [], refetch: refetchEntries } = useQuery<RacePrepEntry[]>({
    queryKey: [`/api/race-preps/${prep.id}/entries`],
    enabled: open,
  });

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ["/api/athletes"],
    enabled: addAthletesOpen,
  });

  const alreadyAddedIds = useMemo(() => new Set(entries.map((e) => e.athleteId)), [entries]);
  const L = (no: string, en: string) => lang === "en" ? en : no;

  function canEditEntry(entry: RacePrepEntry): boolean {
    // Admins can always edit. Otherwise: only the assigned waxer for this entry can set Ski-ID.
    // If waxerId is null (not yet claimed), any raceskis-level user may fill it in (they become the waxer on save).
    return isAdmin || entry.waxerId === null || entry.waxerId === userId;
  }

  async function removeEntry(entryId: number) {
    try {
      await apiRequest("DELETE", `/api/race-preps/${prep.id}/entries/${entryId}`);
      refetchEntries();
    } catch {
      toast({ title: "Feil", description: "Kunne ikke fjerne løper", variant: "destructive" });
    }
  }

  async function addAthletes() {
    if (selectedAthleteIds.size === 0) return;
    setAddingSaving(true);
    try {
      const toAdd = athletes.filter((a) => selectedAthleteIds.has(a.id) && !alreadyAddedIds.has(a.id));
      await Promise.all(
        toAdd.map((a) =>
          apiRequest("POST", `/api/race-preps/${prep.id}/entries`, { athleteId: a.id, athleteName: a.name })
        )
      );
      await refetchEntries();
      setSelectedAthleteIds(new Set());
      setAddAthletesOpen(false);
    } catch {
      toast({ title: "Feil", description: "Kunne ikke legge til løpere", variant: "destructive" });
    } finally {
      setAddingSaving(false);
    }
  }

  const glideNames = productNames(prep.productIds, products);
  const structureNamesStr = productNames(prep.structureIds, products);
  // kickProductIds may hold free text or legacy comma-sep IDs
  const kickDisplay = prep.kickProductIds
    ? (isFreeText(prep.kickProductIds) ? prep.kickProductIds : productNames(prep.kickProductIds, products))
    : null;
  const showKick = prep.discipline === "Classic" || prep.discipline === "Skiathlon";

  // Linked weather record
  const linkedWeather = prep.weatherId ? weatherList.find(w => w.id === prep.weatherId) ?? null : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-primary" />
            {prep.location} — {fmtDate(prep.date, lang)}{prep.startTime ? ` · ${prep.startTime}` : ""}
          </DialogTitle>
        </DialogHeader>

        {/* Race info */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{L("Renntype", "Race type")}</p>
            <p className="font-medium">{prep.raceType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{L("Stilart", "Discipline")}</p>
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", DISCIPLINE_COLORS[prep.discipline] ?? "")}>
              {DISCIPLINE_LABEL[prep.discipline]?.[lang] ?? prep.discipline}
            </span>
          </div>
          {glideNames && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{L("Produkter (glid)", "Products (glide)")}</p>
              <p className="font-medium">{glideNames}</p>
            </div>
          )}
          {structureNamesStr && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{L("Struktur", "Structure")}</p>
              <p className="font-medium">{structureNamesStr}</p>
            </div>
          )}
          {showKick && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Kick</p>
              <p className="font-medium">{kickDisplay || <span className="text-muted-foreground">—</span>}</p>
            </div>
          )}
          {showKick && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{lang === "en" ? "Binder" : "Tette"}</p>
              <p className="font-medium">{prep.tette || <span className="text-muted-foreground">—</span>}</p>
            </div>
          )}
          {prep.method && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{L("Metode", "Method")}</p>
              <p className="font-medium">{prep.method}</p>
            </div>
          )}
          {/* Legacy text fields fallback */}
          {!glideNames && prep.products && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{L("Produkter", "Products")}</p>
              <p className="font-medium">{prep.products}</p>
            </div>
          )}
          {!structureNamesStr && prep.structure && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{L("Struktur", "Structure")}</p>
              <p className="font-medium">{prep.structure}</p>
            </div>
          )}
          {prep.notes && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-muted-foreground mb-0.5">{L("Notater", "Notes")}</p>
              <p className="text-muted-foreground">{prep.notes}</p>
            </div>
          )}
        </div>

        {/* Linked weather */}
        {linkedWeather && (
          <WeatherRow weather={linkedWeather} lang={lang} />
        )}

        {/* Start list */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              {L("Startliste", "Start list")}
              <span className="text-xs font-normal text-muted-foreground">({entries.length})</span>
            </h3>
            {isAdmin && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAddAthletesOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />
                {L("Legg til løper", "Add athlete")}
              </Button>
            )}
          </div>

          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">
              {L("Ingen løpere lagt til ennå.", "No athletes added yet.")}
            </p>
          ) : (
            <>
              {/* Column selector */}
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mr-1">{L("Vis kolonner:", "Show columns:")}</span>
                {SKI_PARAM_COLS.map(col => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => setVisibleSkiCols(prev => prev.includes(col.key) ? prev.filter(k => k !== col.key) : [...prev, col.key])}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 transition-colors",
                      visibleSkiCols.includes(col.key)
                        ? "bg-primary/10 text-primary ring-primary/20"
                        : "text-muted-foreground ring-border hover:bg-muted/60"
                    )}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-border overflow-visible">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">{L("Løper", "Athlete")}</th>
                      {prep.discipline === "Skiathlon" ? (
                        <>
                          <th className="px-3 py-2">{L("Ski-ID Klassisk", "Ski-ID Classic")}</th>
                          <th className="px-3 py-2">{L("Ski-ID Skøyting", "Ski-ID Skating")}</th>
                        </>
                      ) : (
                        <th className="px-3 py-2">Ski-ID</th>
                      )}
                      {visibleSkiCols.map(colKey => {
                        const col = SKI_PARAM_COLS.find(c => c.key === colKey)!;
                        return <th key={colKey} className="px-3 py-2 text-[10px]">{col.label}</th>;
                      })}
                      <th className="px-3 py-2">{L("Smører", "Waxer")}</th>
                      {isAdmin && <th className="px-3 py-2 w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      // For param columns: use the primary ski ID for this discipline
                      const skiIdVal = prep.discipline === "Skating"
                        ? (entry.skiIdSkating ?? entry.skiId)
                        : (entry.skiId ?? entry.skiIdClassic);
                      return (
                        <tr key={entry.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2.5 font-medium">{entry.athleteName}</td>
                          {prep.discipline === "Skiathlon" ? (
                            <>
                              <td className="px-3 py-2.5">
                                <SkiIdCell entry={entry} canEdit={canEditEntry(entry)} prepId={prep.id} onSaved={refetchEntries} lang={lang} disciplineHint="Classic" />
                              </td>
                              <td className="px-3 py-2.5">
                                <SkiIdCell entry={entry} canEdit={canEditEntry(entry)} prepId={prep.id} onSaved={refetchEntries} lang={lang} disciplineHint="Skating" />
                              </td>
                            </>
                          ) : (
                            <td className="px-3 py-2.5">
                              <SkiIdCell
                                entry={entry}
                                canEdit={canEditEntry(entry)}
                                prepId={prep.id}
                                onSaved={refetchEntries}
                                lang={lang}
                                disciplineHint={prep.discipline === "Classic" ? "Classic" : prep.discipline === "Skating" ? "Skating" : undefined}
                              />
                            </td>
                          )}
                          {visibleSkiCols.map(colKey => (
                            <td key={colKey} className="px-3 py-2.5">
                              <SkiParamCell athleteId={entry.athleteId} skiIdValue={skiIdVal} paramKey={colKey} />
                            </td>
                          ))}
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">{entry.waxerName ?? "—"}</td>
                          {isAdmin && (
                            <td className="px-3 py-2.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                                onClick={() => removeEntry(entry.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Equipment overview — admin toggle */}
              {isAdmin && entries.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowEquipment(v => !v)}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 ring-1 transition-colors",
                      showEquipment
                        ? "bg-primary/10 text-primary ring-primary/20"
                        : "text-muted-foreground ring-border hover:bg-muted/60"
                    )}
                  >
                    <Search className="h-3.5 w-3.5" />
                    {showEquipment
                      ? L("Skjul utstyrsoversikt", "Hide equipment overview")
                      : L("Vis alle skipar og parametre", "Show all skis & parameters")}
                  </button>
                  {showEquipment && (
                    <EquipmentOverview entries={entries} discipline={prep.discipline} lang={lang} />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Add athletes sub-dialog */}
        <Dialog open={addAthletesOpen} onOpenChange={setAddAthletesOpen}>
          <DialogContent className="max-w-sm max-h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{L("Legg til løpere på startlisten", "Add athletes to start list")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {athletes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{L("Ingen løpere registrert.", "No athletes found.")}</p>
              ) : (
                athletes.map((a) => {
                  const alreadyAdded = alreadyAddedIds.has(a.id);
                  return (
                    <div key={a.id} className={cn("flex items-center gap-3 rounded-lg px-3 py-2", alreadyAdded ? "opacity-40" : "hover:bg-muted/30")}>
                      <Checkbox
                        id={`ath-${a.id}`}
                        checked={alreadyAdded || selectedAthleteIds.has(a.id)}
                        disabled={alreadyAdded}
                        onCheckedChange={(checked) => {
                          setSelectedAthleteIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(a.id); else next.delete(a.id);
                            return next;
                          });
                        }}
                      />
                      <label htmlFor={`ath-${a.id}`} className={cn("text-sm cursor-pointer", alreadyAdded && "cursor-default")}>
                        {a.name}
                        {alreadyAdded && <span className="ml-2 text-xs text-muted-foreground">({L("allerede lagt til", "already added")})</span>}
                      </label>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setAddAthletesOpen(false)}>{L("Avbryt", "Cancel")}</Button>
              <Button size="sm" onClick={addAthletes} disabled={selectedAthleteIds.size === 0 || addingSaving}>
                {L(`Legg til (${selectedAthleteIds.size})`, `Add (${selectedAthleteIds.size})`)}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

// ── Create / Edit form dialog ─────────────────────────────────────────────────
function PrepFormDialog({
  open,
  onClose,
  editPrep,
  lang,
  weatherList,
}: {
  open: boolean;
  onClose: (saved: boolean) => void;
  editPrep?: RacePrep;
  lang: string;
  weatherList: Weather[];
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const [form, setForm] = useState(() =>
    editPrep
      ? {
          date: editPrep.date,
          startTime: editPrep.startTime ?? "",
          location: editPrep.location,
          raceType: editPrep.raceType,
          discipline: editPrep.discipline,
          productIds: parseIds(editPrep.productIds),
          structureIds: parseIds(editPrep.structureIds),
          // kickProductIds may be free text or legacy IDs — display as text
          kick: editPrep.kickProductIds
            ? (isFreeText(editPrep.kickProductIds) ? editPrep.kickProductIds : productNames(editPrep.kickProductIds, []))
            : "",
          tette: editPrep.tette ?? "",
          method: editPrep.method ?? "",
          notes: editPrep.notes ?? "",
          weatherId: editPrep.weatherId ?? null,
        }
      : { ...EMPTY_FORM }
  );

  const L = (no: string, en: string) => lang === "en" ? en : no;

  function f<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  const showKick = form.discipline === "Classic" || form.discipline === "Skiathlon";

  // Sort weather list newest first, labeled with date+location
  const weatherOptions = useMemo(() =>
    [...weatherList].sort((a, b) => b.date.localeCompare(a.date)),
    [weatherList]
  );

  async function submit() {
    if (!form.date || !form.startTime || !form.location || !form.raceType || !form.discipline) return;
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        startTime: form.startTime,
        location: form.location,
        raceType: form.raceType,
        discipline: form.discipline,
        productIds: form.productIds.join(","),
        structureIds: form.structureIds.join(","),
        // Store kick free text in kickProductIds column
        kickProductIds: form.kick,
        tette: form.tette,
        method: form.method,
        notes: form.notes,
        weatherId: form.weatherId,
      };
      if (editPrep) {
        await apiRequest("PUT", `/api/race-preps/${editPrep.id}`, payload);
      } else {
        await apiRequest("POST", "/api/race-preps", payload);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/race-preps"] });
      onClose(true);
    } catch {
      toast({ title: L("Feil", "Error"), description: L("Kunne ikke lagre", "Could not save"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(false); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editPrep ? L("Rediger raceprep", "Edit race prep") : L("Ny raceprep", "New race prep")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium">{L("Dato", "Date")} *</label>
            <Input type="date" value={form.date} onChange={(e) => f("date", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{L("Starttid", "Start time")} *</label>
            <Input type="time" value={form.startTime} onChange={(e) => f("startTime", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{L("Lokasjon", "Location")} *</label>
            <Input value={form.location} onChange={(e) => f("location", e.target.value)} placeholder={L("f.eks. Davos", "e.g. Davos")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{L("Renntype", "Race type")} *</label>
            <Input value={form.raceType} onChange={(e) => f("raceType", e.target.value)} placeholder={L("f.eks. 10km", "e.g. 10km")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{L("Stilart", "Discipline")} *</label>
            <Select value={form.discipline} onValueChange={(v) => f("discipline", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{DISCIPLINE_LABEL[d]?.[lang] ?? d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{L("Produkt(er) — glid", "Product(s) — glide")}</label>
            <MultiProductPicker
              value={form.productIds}
              onChange={(ids) => f("productIds", ids)}
              products={products}
              placeholder={L("Søk etter produkt...", "Search for product...")}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{L("Struktur", "Structure")}</label>
            <MultiProductPicker
              value={form.structureIds}
              onChange={(ids) => f("structureIds", ids)}
              products={products.filter(p => p.category === "Structure tool")}
              placeholder={L("Søk etter struktur...", "Search for structure tool...")}
            />
          </div>
          {showKick && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Kick</label>
              <Textarea
                value={form.kick}
                onChange={(e) => f("kick", e.target.value)}
                placeholder={L("Beskriv kick-produkt(er) og behandling...", "Describe kick product(s) and application...")}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          )}
          {showKick && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">{L("Tette", "Binder")}</label>
              <Input value={form.tette} onChange={(e) => f("tette", e.target.value)} placeholder={L("f.eks. Rode Violet", "e.g. Rode Violet")} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{L("Metode", "Method")}</label>
            <Input value={form.method} onChange={(e) => f("method", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{L("Notater", "Notes")}</label>
            <Textarea value={form.notes} onChange={(e) => f("notes", e.target.value)} rows={2} className="resize-none" />
          </div>
          {weatherOptions.length > 0 && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">{L("Koble til værobservasjon (valgfritt)", "Link weather record (optional)")}</label>
              <Select
                value={form.weatherId != null ? String(form.weatherId) : "__none__"}
                onValueChange={(v) => f("weatherId", v === "__none__" ? null : parseInt(v))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder={L("Ingen", "None")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{L("Ingen", "None")}</SelectItem>
                  {weatherOptions.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {fmtDate(w.date, lang)} — {w.location}
                      {w.snowTemperatureC != null && ` (${w.snowTemperatureC}°C)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onClose(false)}>{L("Avbryt", "Cancel")}</Button>
          <Button onClick={submit} disabled={saving || !form.date || !form.startTime || !form.location || !form.raceType}>{L("Lagre", "Save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RacePrep() {
  const { user, can, isTeamAdmin, isSuperAdmin } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const isAdmin = !!(isTeamAdmin || isSuperAdmin);

  const { data: preps = [], isLoading } = useQuery<RacePrep[]>({
    queryKey: ["/api/race-preps"],
    enabled: can("raceprep", "view"),
  });

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const { data: weatherList = [] } = useQuery<Weather[]>({
    queryKey: ["/api/weather"],
    enabled: can("weather", "view"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editPrep, setEditPrep] = useState<RacePrep | null>(null);
  const [detailPrep, setDetailPrep] = useState<RacePrep | null>(null);

  // Search & filter state
  const [search, setSearch] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [weatherFilterOpen, setWeatherFilterOpen] = useState(false);
  const [wfSnowTempMin, setWfSnowTempMin] = useState("");
  const [wfSnowTempMax, setWfSnowTempMax] = useState("");
  const [wfAirTempMin, setWfAirTempMin] = useState("");
  const [wfAirTempMax, setWfAirTempMax] = useState("");
  const [wfTrackHardness, setWfTrackHardness] = useState("");
  const [wfAirHumMin, setWfAirHumMin] = useState("");
  const [wfAirHumMax, setWfAirHumMax] = useState("");
  const [wfSnowHumMin, setWfSnowHumMin] = useState("");
  const [wfSnowHumMax, setWfSnowHumMax] = useState("");
  const [wfArtSnow, setWfArtSnow] = useState("");
  const [wfNatSnow, setWfNatSnow] = useState("");
  const [wfSnowHumidityType, setWfSnowHumidityType] = useState("");
  const [wfGrainSize, setWfGrainSize] = useState("");
  const [wfPrecipitation, setWfPrecipitation] = useState("");
  const [wfWind, setWfWind] = useState("");
  const [wfVisibility, setWfVisibility] = useState("");
  const [wfCloudMin, setWfCloudMin] = useState("");
  const [wfCloudMax, setWfCloudMax] = useState("");

  const L = (no: string, en: string) => lang === "en" ? en : no;

  async function deletePrep(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(L("Slett denne racepreppen?", "Delete this race prep?"))) return;
    try {
      await apiRequest("DELETE", `/api/race-preps/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/race-preps"] });
      toast({ title: L("Slettet", "Deleted") });
    } catch {
      toast({ title: L("Feil", "Error"), variant: "destructive" });
    }
  }

  const weatherById = useMemo(() => {
    const m = new Map<number, Weather>();
    for (const w of weatherList) m.set(w.id, w);
    return m;
  }, [weatherList]);

  const hasWeatherFilter = !!(wfSnowTempMin || wfSnowTempMax || wfAirTempMin || wfAirTempMax || wfTrackHardness || wfAirHumMin || wfAirHumMax || wfSnowHumMin || wfSnowHumMax || wfArtSnow || wfNatSnow || wfSnowHumidityType || wfGrainSize || wfPrecipitation || wfWind || wfVisibility || wfCloudMin || wfCloudMax);

  const filteredPreps = useMemo(() => {
    return preps.filter(prep => {
      if (disciplineFilter !== "All" && prep.discipline !== disciplineFilter) return false;
      if (dateFrom && prep.date < dateFrom) return false;
      if (dateTo && prep.date > dateTo) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const glide = productNames(prep.productIds, products);
        const structure = productNames(prep.structureIds, products);
        const kick = prep.kickProductIds ?? "";
        const disc = (DISCIPLINE_LABEL[prep.discipline]?.en ?? prep.discipline).toLowerCase();
        if (
          !prep.location.toLowerCase().includes(q) &&
          !prep.raceType.toLowerCase().includes(q) &&
          !(prep.notes ?? "").toLowerCase().includes(q) &&
          !glide.toLowerCase().includes(q) &&
          !structure.toLowerCase().includes(q) &&
          !kick.toLowerCase().includes(q) &&
          !disc.includes(q)
        ) return false;
      }
      // Weather filters — only apply if prep has linked weather
      if (hasWeatherFilter) {
        const w = prep.weatherId ? weatherById.get(prep.weatherId) : null;
        if (!w) return false;
        if (wfSnowTempMin !== "" && (w.snowTemperatureC ?? 999) < parseFloat(wfSnowTempMin)) return false;
        if (wfSnowTempMax !== "" && (w.snowTemperatureC ?? -999) > parseFloat(wfSnowTempMax)) return false;
        if (wfAirTempMin !== "" && (w.airTemperatureC ?? 999) < parseFloat(wfAirTempMin)) return false;
        if (wfAirTempMax !== "" && (w.airTemperatureC ?? -999) > parseFloat(wfAirTempMax)) return false;
        if (wfTrackHardness && !(w.trackHardness ?? "").toLowerCase().includes(wfTrackHardness.toLowerCase())) return false;
        if (wfAirHumMin !== "" && (w.airHumidityPct ?? 999) < parseFloat(wfAirHumMin)) return false;
        if (wfAirHumMax !== "" && (w.airHumidityPct ?? -999) > parseFloat(wfAirHumMax)) return false;
        if (wfSnowHumMin !== "" && (w.snowHumidityPct ?? 999) < parseFloat(wfSnowHumMin)) return false;
        if (wfSnowHumMax !== "" && (w.snowHumidityPct ?? -999) > parseFloat(wfSnowHumMax)) return false;
        if (wfArtSnow && !(w.artificialSnow ?? "").toLowerCase().includes(wfArtSnow.toLowerCase())) return false;
        if (wfNatSnow && !(w.naturalSnow ?? "").toLowerCase().includes(wfNatSnow.toLowerCase())) return false;
        if (wfSnowHumidityType && !(w.snowHumidityType ?? "").toLowerCase().includes(wfSnowHumidityType.toLowerCase())) return false;
        if (wfGrainSize && !(w.grainSize ?? "").toLowerCase().includes(wfGrainSize.toLowerCase())) return false;
        if (wfPrecipitation && !(w.precipitation ?? "").toLowerCase().includes(wfPrecipitation.toLowerCase())) return false;
        if (wfWind && !(w.wind ?? "").toLowerCase().includes(wfWind.toLowerCase())) return false;
        if (wfVisibility && !(w.visibility ?? "").toLowerCase().includes(wfVisibility.toLowerCase())) return false;
        if (wfCloudMin !== "" && (w.clouds ?? 999) < parseFloat(wfCloudMin)) return false;
        if (wfCloudMax !== "" && (w.clouds ?? -999) > parseFloat(wfCloudMax)) return false;
      }
      return true;
    });
  }, [preps, disciplineFilter, dateFrom, dateTo, search, products, hasWeatherFilter, wfSnowTempMin, wfSnowTempMax, wfAirTempMin, wfAirTempMax, wfTrackHardness, wfAirHumMin, wfAirHumMax, wfSnowHumMin, wfSnowHumMax, wfArtSnow, wfNatSnow, wfSnowHumidityType, wfGrainSize, wfPrecipitation, wfWind, wfVisibility, wfCloudMin, wfCloudMax, weatherById]);

  if (!can("raceprep", "view")) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[40vh]">
          <p className="text-muted-foreground text-sm">{L("Ingen tilgang", "No access")}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Flag className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Race Prep</h1>
              <p className="text-sm text-muted-foreground">{L("Planlegg renn og smørevalg", "Plan races and waxing choices")}</p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {L("Ny raceprep", "New race prep")}
            </Button>
          )}
        </div>

        {/* Search & filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={L("Søk etter sted, renntype...", "Search by location, race type...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">{L("Alle stilarter", "All disciplines")}</SelectItem>
              {DISCIPLINES.map(d => (
                <SelectItem key={d} value={d}>{DISCIPLINE_LABEL[d]?.[lang] ?? d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground whitespace-nowrap">{L("Fra", "From")}</label>
            <Input type="date" className="w-36 h-9 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground whitespace-nowrap">{L("Til", "To")}</label>
            <Input type="date" className="w-36 h-9 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <Button
            variant={weatherFilterOpen || hasWeatherFilter ? "default" : "outline"}
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setWeatherFilterOpen(v => !v)}
          >
            <Snowflake className="h-3.5 w-3.5" />
            {L("Vær", "Weather")}
            {hasWeatherFilter && <span className="ml-1 rounded-full bg-white/20 text-[10px] px-1">✓</span>}
          </Button>
          {(search || disciplineFilter !== "All" || dateFrom || dateTo || hasWeatherFilter) && (
            <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => { setSearch(""); setDisciplineFilter("All"); setDateFrom(""); setDateTo(""); setWfSnowTempMin(""); setWfSnowTempMax(""); setWfAirTempMin(""); setWfAirTempMax(""); setWfTrackHardness(""); setWfAirHumMin(""); setWfAirHumMax(""); setWfSnowHumMin(""); setWfSnowHumMax(""); setWfArtSnow(""); setWfNatSnow(""); setWfSnowHumidityType(""); setWfGrainSize(""); setWfPrecipitation(""); setWfWind(""); setWfVisibility(""); setWfCloudMin(""); setWfCloudMax(""); }}>
              <X className="h-3.5 w-3.5 mr-1" />
              {L("Nullstill", "Clear")}
            </Button>
          )}
        </div>

        {/* Weather filter panel */}
        {weatherFilterOpen && (
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Snowflake className="h-3.5 w-3.5" />
              {L("Værforhold", "Weather Conditions")}
            </div>
            <div className="space-y-4">
              {/* Temperature & Humidity */}
              <div>
                <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{L("Temperatur & fuktighet", "Temperature & Humidity")}</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-xs text-muted-foreground">{L("Lufttemp (°C)", "Air temp (°C)")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 text-xs" placeholder="Min" value={wfAirTempMin} onChange={e => setWfAirTempMin(e.target.value)} />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="number" className="h-8 text-xs" placeholder="Max" value={wfAirTempMax} onChange={e => setWfAirTempMax(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-muted-foreground">{L("Snøtemp (°C)", "Snow temp (°C)")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 text-xs" placeholder="Min" value={wfSnowTempMin} onChange={e => setWfSnowTempMin(e.target.value)} />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="number" className="h-8 text-xs" placeholder="Max" value={wfSnowTempMax} onChange={e => setWfSnowTempMax(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
                      <span className="text-xs text-muted-foreground">{L("Luftfukt (%rH)", "Air humidity (%rH)")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 text-xs" placeholder="Min" value={wfAirHumMin} onChange={e => setWfAirHumMin(e.target.value)} />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="number" className="h-8 text-xs" placeholder="Max" value={wfAirHumMax} onChange={e => setWfAirHumMax(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-xs text-muted-foreground">{L("Snøfukt (%)", "Snow humidity (%)")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 text-xs" placeholder="Min" value={wfSnowHumMin} onChange={e => setWfSnowHumMin(e.target.value)} />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="number" className="h-8 text-xs" placeholder="Max" value={wfSnowHumMax} onChange={e => setWfSnowHumMax(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
                      <span className="text-xs text-muted-foreground">{L("Skydekke (%)", "Cloud cover (%)")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 text-xs" placeholder="Min" value={wfCloudMin} onChange={e => setWfCloudMin(e.target.value)} />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input type="number" className="h-8 text-xs" placeholder="Max" value={wfCloudMax} onChange={e => setWfCloudMax(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
              {/* Snow Type */}
              <div>
                <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{L("Snøtype", "Snow Type")}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
                      <span className="text-xs text-muted-foreground">{L("Kunstig snø", "Artificial snow")}</span>
                    </div>
                    <Select value={wfArtSnow || "__any__"} onValueChange={v => setWfArtSnow(v === "__any__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">— Any —</SelectItem>
                        {SNOW_STAGE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-teal-500" />
                      <span className="text-xs text-muted-foreground">{L("Naturlig snø", "Natural snow")}</span>
                    </div>
                    <Select value={wfNatSnow || "__any__"} onValueChange={v => setWfNatSnow(v === "__any__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">— Any —</SelectItem>
                        {SNOW_STAGE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-cyan-500" />
                      <span className="text-xs text-muted-foreground">{L("Snøfuktighetstype", "Snow humidity type")}</span>
                    </div>
                    <Select value={wfSnowHumidityType || "__any__"} onValueChange={v => setWfSnowHumidityType(v === "__any__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">— Any —</SelectItem>
                        {SNOW_HUMIDITY_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-lime-500" />
                      <span className="text-xs text-muted-foreground">{L("Kornstørrelse", "Grain size")}</span>
                    </div>
                    <Select value={wfGrainSize || "__any__"} onValueChange={v => setWfGrainSize(v === "__any__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">— Any —</SelectItem>
                        {GRAIN_SIZE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {/* Snow & Track */}
              <div>
                <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{L("Snø & spor", "Snow & Track")}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
                      <span className="text-xs text-muted-foreground">{L("Sporharhet", "Track hardness")}</span>
                    </div>
                    <Select value={wfTrackHardness || "__any__"} onValueChange={v => setWfTrackHardness(v === "__any__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">— Any —</SelectItem>
                        {TRACK_HARDNESS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                      <span className="text-xs text-muted-foreground">{L("Nedbør", "Precipitation")}</span>
                    </div>
                    <Input className="h-8 text-xs" placeholder="e.g. Snow" value={wfPrecipitation} onChange={e => setWfPrecipitation(e.target.value)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                      <span className="text-xs text-muted-foreground">{L("Vind", "Wind")}</span>
                    </div>
                    <Input className="h-8 text-xs" placeholder="e.g. NW 3m/s" value={wfWind} onChange={e => setWfWind(e.target.value)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
                      <span className="text-xs text-muted-foreground">{L("Sikt", "Visibility")}</span>
                    </div>
                    <Input className="h-8 text-xs" placeholder="e.g. Good" value={wfVisibility} onChange={e => setWfVisibility(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : filteredPreps.length === 0 ? (
          <Card className="rounded-2xl p-10 text-center">
            <Flag className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">
              {preps.length === 0
                ? L("Ingen raceprep registrert ennå.", "No race preps registered yet.")
                : L("Ingen treff på søket.", "No results match your search.")}
            </p>
            {isAdmin && preps.length === 0 && (
              <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                {L("Opprett den første", "Create the first one")}
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredPreps.map((prep) => {
              const glideDisplay = productNames(prep.productIds, products) || prep.products || null;
              const linkedWeather = prep.weatherId ? weatherList.find(w => w.id === prep.weatherId) : null;
              return (
                <Card
                  key={prep.id}
                  className="rounded-2xl px-5 py-4 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4"
                  onClick={() => setDetailPrep(prep)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{prep.location}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(prep.date, lang)}{prep.startTime ? ` · ${prep.startTime}` : ""}</span>
                      <Badge variant="outline" className="text-xs">{prep.raceType}</Badge>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1", DISCIPLINE_COLORS[prep.discipline] ?? "")}>
                        {DISCIPLINE_LABEL[prep.discipline]?.[lang] ?? prep.discipline}
                      </span>
                      {linkedWeather && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Snowflake className="h-3 w-3" />
                          {linkedWeather.snowTemperatureC != null ? `${linkedWeather.snowTemperatureC}°C` : ""}
                        </span>
                      )}
                    </div>
                    {glideDisplay && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{glideDisplay}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); setEditPrep(prep); }}
                        title={L("Rediger", "Edit")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                        onClick={(e) => deletePrep(prep.id, e)}
                        title={L("Slett", "Delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      {createOpen && (
        <PrepFormDialog
          open={createOpen}
          onClose={(saved) => { setCreateOpen(false); }}
          lang={lang}
          weatherList={weatherList}
        />
      )}

      {/* Edit dialog */}
      {editPrep && (
        <PrepFormDialog
          open={!!editPrep}
          onClose={() => setEditPrep(null)}
          editPrep={editPrep}
          lang={lang}
          weatherList={weatherList}
        />
      )}

      {/* Detail dialog */}
      {detailPrep && (
        <PrepDetailDialog
          prep={detailPrep}
          open={!!detailPrep}
          onClose={() => setDetailPrep(null)}
          isAdmin={isAdmin}
          userId={user?.id ?? 0}
          lang={lang}
          weatherList={weatherList}
        />
      )}
    </AppShell>
  );
}
