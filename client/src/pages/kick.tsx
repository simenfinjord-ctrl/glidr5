// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// #9: Kick — a dedicated page (under Athlete skis) for classic kick testing.
// An overview of kick test skis (brand / grind / heights / type), kick tests
// (date, weather, location, test persons, per-ski binder + kick solution +
// feeling rank + notes), and an interpreted report tied to weather/conditions.
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Footprints, Pencil, Trash2, Cloud, MapPin, Users, FileText, Copy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import { ManualWeatherDialog } from "@/components/manual-weather-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────────
type KickSki = {
  id: number;
  name: string | null;
  brand: string | null;
  grind: string | null;
  heights: string | null;
  typeOfSki: string | null;
  color: string | null;
  notes: string | null;
};

// Same ski-type options as Athlete skis → new ski → ski type.
const SKI_TYPE_OPTIONS = ["Hard Wax", "Klister/Cover", "Klister", "Zero"] as const;

// Same colour palette as Athlete skis (race ski garage).
const SKI_COLORS = [
  { id: "none",    label: "White",  dot: "bg-white border border-border" },
  { id: "emerald", label: "Green",  dot: "bg-emerald-400" },
  { id: "sky",     label: "Blue",   dot: "bg-sky-400" },
  { id: "violet",  label: "Purple", dot: "bg-violet-400" },
  { id: "red",     label: "Red",    dot: "bg-red-400" },
  { id: "yellow",  label: "Yellow", dot: "bg-yellow-400" },
  { id: "grey",    label: "Grey",   dot: "bg-gray-400" },
] as const;
const colorDot = (id: string | null) => SKI_COLORS.find((c) => c.id === (id || "none"))?.dot ?? SKI_COLORS[0].dot;

type KickEntry = {
  id?: number;
  kickSkiId: number;
  binder: string | null;
  kickSolution: string | null;
  feelingRank: number | null;
  feelingNotes: string | null;
};

type KickTest = {
  id: number;
  date: string;
  location: string | null;
  weatherId: number | null;
  noWeather: number;
  testPersons: string | null;
  notes: string | null;
  report: string | null;
  createdByName: string | null;
  entries: KickEntry[];
};

type WeatherItem = {
  id: number;
  date: string;
  location: string;
  airTemperatureC: number | null;
  snowTemperatureC: number | null;
  snowType: string | null;
  snowHumidityType: string | null;
};

const skiLabel = (s: KickSki | undefined): string =>
  s ? [s.name, s.brand].filter(Boolean).join(" — ") || `Ski #${s.id}` : "—";

type MixProduct = { name: string; parts: number };
type KickMix = {
  id: number;
  name: string;
  mixType: "hardwax" | "klister";
  rollerTemperature: string | null;
  products: string | null; // JSON: MixProduct[]
  notes: string | null;
};

function parseMixProducts(json: string | null): MixProduct[] {
  if (!json) return [];
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : []; } catch { return []; }
}

// Greatest common divisor — used to reduce the mixing ratio (4:2 → 2:1).
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

// "2 : 1 : 1" (reduced) plus per-product percentages.
function mixRatio(products: MixProduct[]): { ratio: string; pct: number[] } {
  const parts = products.map((p) => (Number.isFinite(p.parts) && p.parts > 0 ? p.parts : 0));
  const total = parts.reduce((a, b) => a + b, 0);
  if (total <= 0) return { ratio: "", pct: products.map(() => 0) };
  const divisor = parts.filter((p) => p > 0).reduce((a, b) => gcd(a, b), 0) || 1;
  const ratio = parts.map((p) => p / divisor).join(" : ");
  const pct = parts.map((p) => Math.round((p / total) * 100));
  return { ratio, pct };
}

// ── Report generation (#9) ──────────────────────────────────────────────────
// Interpret the kick-test text and tie it to weather/conditions into a short
// report — the foundation for understanding "what works when" and recreating
// past recipes. Heuristic, but bilingual and grounded in the entered data.
const KICK_POS = ["bra", "godt", "god", "perfekt", "stabil", "stabilt", "good", "great", "grip", "feste", "klistrer", "solid"];
const KICK_NEG = ["dårlig", "darlig", "lite", "glipper", "glir", "slips", "slipping", "icing", "ising", "bom", "for hardt", "for mykt", "poor", "bad", "no grip"];

function buildKickReport(
  entries: KickEntry[],
  skis: Map<number, KickSki>,
  weather: WeatherItem | null,
  lang: string,
): string {
  const L = (no: string, en: string) => (lang === "no" ? no : en);
  const withData = entries.filter((e) => (e.feelingNotes && e.feelingNotes.trim()) || e.kickSolution || e.feelingRank != null);
  if (withData.length === 0) return "";

  const parts: string[] = [];

  // Conditions sentence from weather.
  if (weather && weather.airTemperatureC != null) {
    const t = weather.airTemperatureC;
    const band = t <= -8 ? L("kaldt føre", "cold conditions") : t >= -2 ? L("mildt føre", "mild conditions") : L("variert føre", "varied conditions");
    const snow = weather.snowType || weather.snowHumidityType;
    parts.push(L(
      `Testet i ${band} (lufttemp ${t.toFixed(0)}°C${snow ? `, ${snow.toLowerCase()}` : ""}).`,
      `Tested in ${band} (air temp ${t.toFixed(0)}°C${snow ? `, ${snow.toLowerCase()}` : ""}).`,
    ));
  }

  // Best-rated ski (lowest feeling rank = best).
  const ranked = withData.filter((e) => e.feelingRank != null).sort((a, b) => (a.feelingRank! - b.feelingRank!));
  if (ranked.length) {
    const best = ranked[0];
    const name = skiLabel(skis.get(best.kickSkiId));
    const recipe = [best.binder, best.kickSolution].filter(Boolean).join(" + ");
    parts.push(L(
      `Best feeling: ${name}${recipe ? ` (${recipe})` : ""}.`,
      `Best feeling: ${name}${recipe ? ` (${recipe})` : ""}.`,
    ));
  }

  // Sentiment + recurring observations across all feeling notes.
  const allText = withData.map((e) => (e.feelingNotes || "").toLowerCase()).join(" ");
  let pos = 0, neg = 0;
  for (const w of KICK_POS) if (allText.includes(w)) pos++;
  for (const w of KICK_NEG) if (allText.includes(w)) neg++;
  if (neg > pos && neg > 0) parts.push(L("Flere notater peker på svakt feste eller dårlig å stake — vurder hardere/lengre festesone.", "Several notes point to weak grip or poor kick — consider a harder/longer kick zone."));
  else if (pos > neg && pos > 0) parts.push(L("Overveiende godt feste i notatene.", "Mostly good grip in the notes."));
  else if (pos > 0 && neg > 0) parts.push(L("Blandede tilbakemeldinger på feste.", "Mixed grip feedback."));

  return parts.join(" ");
}

// ── Kick ski add/edit dialog ────────────────────────────────────────────────
// `duplicating` pre-fills every field from an existing ski but creates a NEW
// ski (so the waxer only changes the ski number / small details).
function KickSkiDialog({ open, onClose, editing, duplicating }: { open: boolean; onClose: () => void; editing: KickSki | null; duplicating?: KickSki | null }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const src = editing ?? duplicating ?? null;
  const [name, setName] = useState(editing?.name ?? "");  // blank when duplicating → enter new ski number
  const [brand, setBrand] = useState(src?.brand ?? "");
  const [grind, setGrind] = useState(src?.grind ?? "");
  const [heights, setHeights] = useState(src?.heights ?? "");
  const [typeOfSki, setTypeOfSki] = useState(src?.typeOfSki ?? "");
  const [color, setColor] = useState(src?.color ?? "none");
  const [notes, setNotes] = useState(src?.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const body = { name, brand, grind, heights, typeOfSki, color, notes };
      if (editing) return apiRequest("PUT", `/api/kick-skis/${editing.id}`, body);
      return apiRequest("POST", "/api/kick-skis", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kick-skis"] });
      toast({ title: L("Lagret", "Saved") });
      onClose();
    },
    onError: (e: any) => toast({ title: L("Feil", "Error"), description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? L("Rediger testski", "Edit test ski") : duplicating ? L("Dupliser testski", "Duplicate test ski") : L("Ny testski", "New test ski")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{L("Navn / Ski-ID", "Name / Ski ID")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={duplicating ? L("nytt skinummer", "new ski number") : L("valgfritt", "optional")} autoFocus={!!duplicating} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">{L("Merke", "Brand")}</label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">{L("Slip", "Grind")}</label>
              <Input value={grind} onChange={(e) => setGrind(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">{L("Høyder", "Heights")}</label>
              <Input value={heights} onChange={(e) => setHeights(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">{L("Ski-type", "Ski type")}</label>
              <Select value={typeOfSki || "__none__"} onValueChange={(v) => setTypeOfSki(v === "__none__" ? "" : v)}>
                <SelectTrigger data-testid="select-kick-ski-type"><SelectValue placeholder={L("Ingen", "None")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{L("Ingen", "None")}</SelectItem>
                  {SKI_TYPE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{L("Farge", "Color")}</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SKI_COLORS.map((c) => (
                <button key={c.id} type="button" onClick={() => setColor(c.id)} title={c.label}
                  className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 transition-colors",
                    color === c.id ? "ring-primary bg-primary/10" : "ring-border hover:bg-muted")}>
                  <span className={cn("h-3 w-3 rounded-full", c.dot)} />{c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{L("Notater", "Notes")}</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{L("Avbryt", "Cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Kick test add/edit dialog ───────────────────────────────────────────────
function KickTestDialog({ open, onClose, editing, skis, weather }: {
  open: boolean; onClose: () => void; editing: KickTest | null; skis: KickSki[]; weather: WeatherItem[];
}) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const skiById = useMemo(() => new Map(skis.map((s) => [s.id, s])), [skis]);

  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().split("T")[0]);
  const [location, setLocation] = useState(editing?.location ?? "");
  const [weatherId, setWeatherId] = useState<number | null>(editing?.weatherId ?? null);
  const [noWeather, setNoWeather] = useState(editing ? editing.noWeather === 1 : false);
  const [testPersons, setTestPersons] = useState(editing?.testPersons ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [manualOpen, setManualOpen] = useState(false);
  const [entries, setEntries] = useState<KickEntry[]>(editing?.entries ?? []);

  const selectedIds = new Set(entries.map((e) => e.kickSkiId));
  const toggleSki = (skiId: number) => {
    setEntries((prev) =>
      prev.some((e) => e.kickSkiId === skiId)
        ? prev.filter((e) => e.kickSkiId !== skiId)
        : [...prev, { kickSkiId: skiId, binder: "", kickSolution: "", feelingRank: null, feelingNotes: "" }]);
  };
  const updateEntry = (skiId: number, patch: Partial<KickEntry>) => {
    setEntries((prev) => prev.map((e) => (e.kickSkiId === skiId ? { ...e, ...patch } : e)));
  };

  const save = useMutation({
    mutationFn: async () => {
      const w = weatherId ? weather.find((x) => x.id === weatherId) ?? null : null;
      const report = buildKickReport(entries, skiById, noWeather ? null : w, language);
      const body = { date, location, weatherId: noWeather ? null : weatherId, noWeather, testPersons, notes, report, entries };
      if (editing) return apiRequest("PUT", `/api/kick-tests/${editing.id}`, body);
      return apiRequest("POST", "/api/kick-tests", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kick-tests"] });
      toast({ title: L("Kick-test lagret", "Kick test saved") });
      onClose();
    },
    onError: (e: any) => toast({ title: L("Feil", "Error"), description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? L("Rediger kick-test", "Edit kick test") : L("Ny kick-test", "New kick test")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">{L("Dato", "Date")}</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">{L("Lokasjon", "Location")}</label>
              <LocationAutocomplete value={location} onChange={setLocation} placeholder={L("f.eks. Sjusjøen", "e.g. Park City")} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">{L("Vær / føre", "Weather / conditions")}</label>
            <div className="flex items-center gap-2 mt-1">
              <Select
                value={weatherId ? String(weatherId) : ""}
                onValueChange={(v) => { setWeatherId(v ? Number(v) : null); setNoWeather(false); }}
                disabled={noWeather}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder={L("Velg værrapport…", "Select weather report…")} /></SelectTrigger>
                <SelectContent>
                  {weather.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.date} · {w.location}{w.airTemperatureC != null ? ` · ${w.airTemperatureC}°C` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" disabled={noWeather} onClick={() => setManualOpen(true)}>
                <Cloud className="mr-1.5 h-4 w-4" />{L("Legg til manuelt", "Add manual")}
              </Button>
            </div>
            <label className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Checkbox checked={noWeather} onCheckedChange={(c) => { setNoWeather(!!c); if (c) setWeatherId(null); }} />
              {L("Ikke legg til vær", "Do not add weather")}
            </label>
          </div>

          <div>
            <label className="text-sm font-medium">{L("Testpersoner", "Test persons")}</label>
            <Input value={testPersons} onChange={(e) => setTestPersons(e.target.value)} placeholder={L("navn, kommaseparert", "names, comma-separated")} />
          </div>

          <div>
            <label className="text-sm font-medium">{L("Testski", "Test skis")}</label>
            {skis.length === 0 && <p className="text-sm text-muted-foreground mt-1">{L("Legg til testski først.", "Add test skis first.")}</p>}
            <div className="flex flex-wrap gap-2 mt-1">
              {skis.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSki(s.id)}
                  className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 transition-colors",
                    selectedIds.has(s.id) ? "bg-primary text-primary-foreground ring-primary" : "ring-border text-muted-foreground hover:bg-muted")}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", colorDot(s.color))} />
                  {skiLabel(s)}
                </button>
              ))}
            </div>
          </div>

          {entries.length > 0 && (
            <div className="space-y-3">
              {entries.map((e) => (
                <div key={e.kickSkiId} className="rounded-lg border p-3 space-y-2">
                  <div className="font-medium text-sm">{skiLabel(skiById.get(e.kickSkiId))}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">{L("Binder", "Binder")}</label>
                      <Input value={e.binder ?? ""} onChange={(ev) => updateEntry(e.kickSkiId, { binder: ev.target.value })} className="h-8" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{L("Kick-løsning", "Kick solution")}</label>
                      <Input value={e.kickSolution ?? ""} onChange={(ev) => updateEntry(e.kickSkiId, { kickSolution: ev.target.value })} className="h-8" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{L("Feeling rank", "Feeling rank")}</label>
                      <Input type="number" value={e.feelingRank ?? ""} onChange={(ev) => updateEntry(e.kickSkiId, { feelingRank: ev.target.value === "" ? null : Number(ev.target.value) })} className="h-8" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{L("Feeling notes", "Feeling notes")}</label>
                      <Input value={e.feelingNotes ?? ""} onChange={(ev) => updateEntry(e.kickSkiId, { feelingNotes: ev.target.value })} className="h-8" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">{L("Generelle notater", "General notes")}</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{L("Avbryt", "Cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
      <ManualWeatherDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={(id) => { setWeatherId(id); setNoWeather(false); setManualOpen(false); queryClient.invalidateQueries({ queryKey: ["/api/weather/for-filtering"] }); }}
        defaults={{ date, location }}
      />
    </Dialog>
  );
}

// ── Kick mix add/edit dialog ────────────────────────────────────────────────
function KickMixDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: KickMix | null }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const [name, setName] = useState(editing?.name ?? "");
  const [mixType, setMixType] = useState<"hardwax" | "klister">(editing?.mixType ?? "hardwax");
  const [rollerTemperature, setRollerTemperature] = useState(editing?.rollerTemperature ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const initialProducts = editing ? parseMixProducts(editing.products) : [];
  const [products, setProducts] = useState<MixProduct[]>(
    initialProducts.length >= 2 ? initialProducts : [{ name: "", parts: 1 }, { name: "", parts: 1 }],
  );

  const setProduct = (i: number, patch: Partial<MixProduct>) =>
    setProducts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addProduct = () => setProducts((prev) => [...prev, { name: "", parts: 1 }]);
  const removeProduct = (i: number) => setProducts((prev) => prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev);

  const cleanProducts = products.filter((p) => p.name.trim());
  const { ratio, pct } = mixRatio(cleanProducts);

  const save = useMutation({
    mutationFn: async () => {
      const body = { name, mixType, rollerTemperature, notes, products: cleanProducts.map((p) => ({ name: p.name.trim(), parts: Number(p.parts) || 0 })) };
      if (editing) return apiRequest("PUT", `/api/kick-mixes/${editing.id}`, body);
      return apiRequest("POST", "/api/kick-mixes", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kick-mixes"] });
      toast({ title: L("Blanding lagret", "Mix saved") });
      onClose();
    },
    onError: (e: any) => toast({ title: L("Feil", "Error"), description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? L("Rediger blanding", "Edit mix") : L("Ny blanding", "New mix")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{L("Navn på blanding", "Mix name")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">{L("Type", "Type")}</label>
              <Select value={mixType} onValueChange={(v) => setMixType(v as "hardwax" | "klister")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hardwax">{L("Hardvoks", "Hardwax")}</SelectItem>
                  <SelectItem value="klister">Klister</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mixType === "klister" && (
              <div>
                <label className="text-sm font-medium">{L("Rulletemperatur", "Roller temperature")}</label>
                <Input value={rollerTemperature} onChange={(e) => setRollerTemperature(e.target.value)} placeholder={L("f.eks. 60°C", "e.g. 60°C")} />
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{L("Produkter og blandingsforhold", "Products and ratio")}</label>
              <Button type="button" variant="ghost" size="sm" onClick={addProduct}>
                <Plus className="mr-1 h-3.5 w-3.5" />{L("Legg til produkt", "Add product")}
              </Button>
            </div>
            <div className="space-y-2 mt-1">
              {products.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={p.name} onChange={(e) => setProduct(i, { name: e.target.value })} placeholder={`${L("Produkt", "Product")} ${i + 1}`} className="flex-1 h-8" />
                  <Input type="number" min={0} value={p.parts} onChange={(e) => setProduct(i, { parts: e.target.value === "" ? 0 : Number(e.target.value) })} className="w-20 h-8" title={L("Deler", "Parts")} />
                  {pct[i] != null && cleanProducts.length > 0 && p.name.trim() && (
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct[i]}%</span>
                  )}
                  <button type="button" onClick={() => removeProduct(i)} disabled={products.length <= 2} className="text-muted-foreground hover:text-rose-600 disabled:opacity-30">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {ratio && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">{L("Blandingsforhold:", "Mixing ratio:")} </span>
                <span className="font-semibold">{ratio}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">{L("Notater", "Notes")}</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{L("Avbryt", "Cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>{save.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Kick() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();

  const { data: skis = [] } = useQuery<KickSki[]>({ queryKey: ["/api/kick-skis"] });
  const { data: tests = [] } = useQuery<KickTest[]>({ queryKey: ["/api/kick-tests"] });
  const { data: mixes = [] } = useQuery<KickMix[]>({ queryKey: ["/api/kick-mixes"] });
  const { data: weather = [] } = useQuery<WeatherItem[]>({ queryKey: ["/api/weather/for-filtering"] });
  const skiById = useMemo(() => new Map(skis.map((s) => [s.id, s])), [skis]);
  const weatherById = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);

  const [skiDialog, setSkiDialog] = useState(false);
  const [editingSki, setEditingSki] = useState<KickSki | null>(null);
  const [duplicatingSki, setDuplicatingSki] = useState<KickSki | null>(null);
  const [testDialog, setTestDialog] = useState(false);
  const [editingTest, setEditingTest] = useState<KickTest | null>(null);
  const [mixDialog, setMixDialog] = useState(false);
  const [editingMix, setEditingMix] = useState<KickMix | null>(null);

  const deleteSki = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/kick-skis/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kick-skis"] }); toast({ title: L("Slettet", "Deleted") }); },
  });
  const deleteTest = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/kick-tests/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kick-tests"] }); toast({ title: L("Slettet", "Deleted") }); },
  });
  const deleteMix = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/kick-mixes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kick-mixes"] }); toast({ title: L("Slettet", "Deleted") }); },
  });

  return (
    <AppShell activeNav="/kick">
      <div className="space-y-8 p-1">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 dark:bg-green-900/20">
            <Footprints className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Kick</h1>
            <p className="text-sm text-muted-foreground">{L("Festetesting for klassisk — testski, tester og rapport.", "Kick testing for classic — test skis, tests and report.")}</p>
          </div>
        </div>

        {/* ── Test skis overview ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{L("Testski", "Test skis")}</h2>
            <Button size="sm" onClick={() => { setEditingSki(null); setDuplicatingSki(null); setSkiDialog(true); }} data-testid="button-add-kick-ski">
              <Plus className="mr-1.5 h-4 w-4" />{L("Legg til ski", "Add ski")}
            </Button>
          </div>
          <Card className="overflow-hidden">
            {skis.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">{L("Ingen testski ennå.", "No test skis yet.")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">{L("Navn", "Name")}</th>
                    <th className="px-4 py-2 font-medium">{L("Merke", "Brand")}</th>
                    <th className="px-4 py-2 font-medium">{L("Slip", "Grind")}</th>
                    <th className="px-4 py-2 font-medium">{L("Høyder", "Heights")}</th>
                    <th className="px-4 py-2 font-medium">{L("Type", "Type")}</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {skis.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-4 py-2 font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("h-3 w-3 rounded-full shrink-0", colorDot(s.color))} />
                          {s.name || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2">{s.brand || "—"}</td>
                      <td className="px-4 py-2">{s.grind || "—"}</td>
                      <td className="px-4 py-2">{s.heights || "—"}</td>
                      <td className="px-4 py-2">{s.typeOfSki || "—"}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button className="text-muted-foreground hover:text-foreground" onClick={() => { setEditingSki(null); setDuplicatingSki(s); setSkiDialog(true); }} title={L("Dupliser", "Duplicate")}>
                            <Copy className="h-4 w-4" />
                          </button>
                          <button className="text-muted-foreground hover:text-foreground" onClick={() => { setDuplicatingSki(null); setEditingSki(s); setSkiDialog(true); }} title={L("Rediger", "Edit")}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className="text-muted-foreground hover:text-rose-600" onClick={() => { if (confirm(L("Slette denne testskien?", "Delete this test ski?"))) deleteSki.mutate(s.id); }} title={L("Slett", "Delete")}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </section>

        {/* ── Kick tests ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{L("Kick-tester", "Kick tests")}</h2>
            <Button size="sm" onClick={() => { setEditingTest(null); setTestDialog(true); }} data-testid="button-add-kick-test" disabled={skis.length === 0}>
              <Plus className="mr-1.5 h-4 w-4" />{L("Legg til kick-test", "Add kick test")}
            </Button>
          </div>
          {tests.length === 0 ? (
            <Card><p className="p-6 text-sm text-muted-foreground text-center">{L("Ingen kick-tester ennå.", "No kick tests yet.")}</p></Card>
          ) : (
            <div className="space-y-4">
              {tests.map((test) => {
                const w = test.weatherId ? weatherById.get(test.weatherId) : null;
                return (
                  <Card key={test.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="font-semibold">{test.date}</span>
                        {test.location && <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{test.location}</span>}
                        {w && <span className="inline-flex items-center gap-1 text-muted-foreground"><Cloud className="h-3.5 w-3.5" />{w.airTemperatureC != null ? `${w.airTemperatureC}°C` : w.location}</span>}
                        {test.testPersons && <span className="inline-flex items-center gap-1 text-muted-foreground"><Users className="h-3.5 w-3.5" />{test.testPersons}</span>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button className="text-muted-foreground hover:text-foreground" onClick={() => { setEditingTest(test); setTestDialog(true); }} title={L("Rediger", "Edit")}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="text-muted-foreground hover:text-rose-600" onClick={() => { if (confirm(L("Slette denne kick-testen?", "Delete this kick test?"))) deleteTest.mutate(test.id); }} title={L("Slett", "Delete")}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {test.report && (
                      <div className="mt-3 rounded-lg bg-green-50 dark:bg-green-900/15 px-3 py-2 text-sm">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400 mb-1">
                          <FileText className="h-3.5 w-3.5" />{L("Rapport", "Report")}
                        </div>
                        {test.report}
                      </div>
                    )}

                    {test.entries.length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs text-muted-foreground">
                            <tr>
                              <th className="py-1 pr-3 font-medium">{L("Ski", "Ski")}</th>
                              <th className="py-1 pr-3 font-medium">{L("Binder", "Binder")}</th>
                              <th className="py-1 pr-3 font-medium">{L("Kick-løsning", "Kick solution")}</th>
                              <th className="py-1 pr-3 font-medium">{L("Rank", "Rank")}</th>
                              <th className="py-1 font-medium">{L("Notater", "Notes")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {test.entries.map((e, i) => (
                              <tr key={e.id ?? i} className="border-t">
                                <td className="py-1.5 pr-3 font-medium">{skiLabel(skiById.get(e.kickSkiId))}</td>
                                <td className="py-1.5 pr-3">{e.binder || "—"}</td>
                                <td className="py-1.5 pr-3">{e.kickSolution || "—"}</td>
                                <td className="py-1.5 pr-3">{e.feelingRank ?? "—"}</td>
                                <td className="py-1.5 text-muted-foreground">{e.feelingNotes || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {test.notes && <p className="mt-3 text-sm text-muted-foreground italic">{test.notes}</p>}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Mixes ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Mixes</h2>
              <p className="text-sm text-muted-foreground">{L("Oppskrifter for blandede festeprodukter.", "Recipes for blended kick products.")}</p>
            </div>
            <Button size="sm" onClick={() => { setEditingMix(null); setMixDialog(true); }} data-testid="button-add-kick-mix">
              <Plus className="mr-1.5 h-4 w-4" />{L("Legg til blanding", "Add mix")}
            </Button>
          </div>
          {mixes.length === 0 ? (
            <Card><p className="p-6 text-sm text-muted-foreground text-center">{L("Ingen blandinger ennå.", "No mixes yet.")}</p></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mixes.map((mix) => {
                const prods = parseMixProducts(mix.products);
                const { ratio } = mixRatio(prods);
                return (
                  <Card key={mix.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">{mix.name}</div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs">
                          <span className={cn("rounded-full px-2 py-0.5 ring-1", mix.mixType === "klister" ? "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-300" : "bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-900/30 dark:text-sky-300")}>
                            {mix.mixType === "klister" ? "Klister" : L("Hardvoks", "Hardwax")}
                          </span>
                          {mix.mixType === "klister" && mix.rollerTemperature && (
                            <span className="text-muted-foreground">{L("Rulletemp", "Roller temp")}: {mix.rollerTemperature}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button className="text-muted-foreground hover:text-foreground" onClick={() => { setEditingMix(mix); setMixDialog(true); }} title={L("Rediger", "Edit")}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="text-muted-foreground hover:text-rose-600" onClick={() => { if (confirm(L("Slette denne blandingen?", "Delete this mix?"))) deleteMix.mutate(mix.id); }} title={L("Slett", "Delete")}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {prods.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {prods.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-sm rounded bg-muted/40 px-2 py-1">
                            <span className="font-medium truncate">{p.name}</span>
                            <span className="text-muted-foreground whitespace-nowrap">{p.parts} {L("deler", "parts")}</span>
                          </div>
                        ))}
                        {ratio && (
                          <div className="text-sm pt-1">
                            <span className="text-muted-foreground">{L("Blandingsforhold:", "Mixing ratio:")} </span>
                            <span className="font-semibold">{ratio}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {mix.notes && <p className="mt-2 text-sm text-muted-foreground italic">{mix.notes}</p>}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {skiDialog && <KickSkiDialog open={skiDialog} onClose={() => { setSkiDialog(false); setDuplicatingSki(null); }} editing={editingSki} duplicating={duplicatingSki} />}
      {testDialog && <KickTestDialog open={testDialog} onClose={() => setTestDialog(false)} editing={editingTest} skis={skis} weather={weather} />}
      {mixDialog && <KickMixDialog open={mixDialog} onClose={() => setMixDialog(false)} editing={editingMix} />}
    </AppShell>
  );
}
