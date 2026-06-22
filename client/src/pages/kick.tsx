// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// #9: Kick — a dedicated page (under Athlete skis) for classic kick testing.
// An overview of kick test skis (brand / grind / heights / type), kick tests
// (date, weather, location, test persons, per-ski binder + kick solution +
// feeling rank + notes), and an interpreted report tied to weather/conditions.
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Footprints, Pencil, Trash2, Cloud, MapPin, Users, FileText } from "lucide-react";
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
  notes: string | null;
};

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
function KickSkiDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: KickSki | null }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const [name, setName] = useState(editing?.name ?? "");
  const [brand, setBrand] = useState(editing?.brand ?? "");
  const [grind, setGrind] = useState(editing?.grind ?? "");
  const [heights, setHeights] = useState(editing?.heights ?? "");
  const [typeOfSki, setTypeOfSki] = useState(editing?.typeOfSki ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const body = { name, brand, grind, heights, typeOfSki, notes };
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
          <DialogTitle>{editing ? L("Rediger testski", "Edit test ski") : L("Ny testski", "New test ski")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{L("Navn / Ski-ID", "Name / Ski ID")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={L("valgfritt", "optional")} />
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
              <Input value={typeOfSki} onChange={(e) => setTypeOfSki(e.target.value)} placeholder={L("f.eks. Klister/Cover, Zero", "e.g. Klister/Cover, Zero")} />
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
                  className={cn("rounded-full px-3 py-1 text-sm ring-1 transition-colors",
                    selectedIds.has(s.id) ? "bg-primary text-primary-foreground ring-primary" : "ring-border text-muted-foreground hover:bg-muted")}
                >
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

// ── Main page ───────────────────────────────────────────────────────────────
export default function Kick() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();

  const { data: skis = [] } = useQuery<KickSki[]>({ queryKey: ["/api/kick-skis"] });
  const { data: tests = [] } = useQuery<KickTest[]>({ queryKey: ["/api/kick-tests"] });
  const { data: weather = [] } = useQuery<WeatherItem[]>({ queryKey: ["/api/weather/for-filtering"] });
  const skiById = useMemo(() => new Map(skis.map((s) => [s.id, s])), [skis]);
  const weatherById = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);

  const [skiDialog, setSkiDialog] = useState(false);
  const [editingSki, setEditingSki] = useState<KickSki | null>(null);
  const [testDialog, setTestDialog] = useState(false);
  const [editingTest, setEditingTest] = useState<KickTest | null>(null);

  const deleteSki = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/kick-skis/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kick-skis"] }); toast({ title: L("Slettet", "Deleted") }); },
  });
  const deleteTest = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/kick-tests/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kick-tests"] }); toast({ title: L("Slettet", "Deleted") }); },
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
            <Button size="sm" onClick={() => { setEditingSki(null); setSkiDialog(true); }} data-testid="button-add-kick-ski">
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
                      <td className="px-4 py-2 font-medium">{s.name || "—"}</td>
                      <td className="px-4 py-2">{s.brand || "—"}</td>
                      <td className="px-4 py-2">{s.grind || "—"}</td>
                      <td className="px-4 py-2">{s.heights || "—"}</td>
                      <td className="px-4 py-2">{s.typeOfSki || "—"}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button className="text-muted-foreground hover:text-foreground" onClick={() => { setEditingSki(s); setSkiDialog(true); }} title={L("Rediger", "Edit")}>
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
      </div>

      {skiDialog && <KickSkiDialog open={skiDialog} onClose={() => setSkiDialog(false)} editing={editingSki} />}
      {testDialog && <KickTestDialog open={testDialog} onClose={() => setTestDialog(false)} editing={editingTest} skis={skis} weather={weather} />}
    </AppShell>
  );
}
