import { Fragment, useMemo, useState, useRef, useCallback } from "react";
import { Plus, Trophy, Filter, MapPin, Thermometer, Droplets, CalendarDays, Award, EyeOff, Eye, LayoutGrid, LayoutList, Table2, Camera, Loader2, CheckCircle2, AlertCircle, ImagePlus, ChevronDown, Calendar } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, fmtDate, fmtDateShort } from "@/lib/utils";
import { parseApplication } from "@/lib/parse-application";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { SkeletonCards } from "@/components/skeleton-card";

type Test = {
  id: number;
  date: string;
  startTime: string | null;
  location: string;
  testName: string | null;
  weatherId: number | null;
  testType: string;
  seriesId: number;
  testSkiSource?: string;
  athleteId?: number | null;
  notes: string | null;
  distanceLabels: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
};

type Series = { id: number; name: string; pairLabels?: string | null };
type Product = { id: number; category: string; brand: string; name: string };
type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  additionalProductIds: string | null;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  results: string | null;
  feelingRank: number | null;
  kickRank: number | null;
};
type Weather = {
  id: number;
  date: string;
  location: string;
  airTemperatureC: number;
  airHumidityPct: number;
  snowTemperatureC: number;
  snowHumidityPct: number;
  snowType: string | null;
  artificialSnow: string | null;
  naturalSnow: string | null;
  grainSize: string | null;
  snowHumidityType: string | null;
  trackHardness: string | null;
  testQuality: number | null;
  precipitation: string | null;
  wind: string | null;
  visibility: string | null;
  clouds: number | null;
};

const TRACK_HARDNESS_OPTIONS = ["Very soft", "Soft", "Medium hard", "Hard", "Very hard", "Ice"] as const;
const SNOW_HUMIDITY_TYPE_OPTIONS = ["Dry", "Moist", "Wet", "Very wet", "Slush"] as const;
const GRAIN_SIZE_OPTIONS = ["Extra fine", "Very fine", "Fine", "Average", "Coarse", "Very coarse"] as const;
const SNOW_STAGE_OPTIONS = ["Falling new", "New", "Irreg. dir. new", "Irreg. dir. transf.", "Transformed"] as const;

type RoundResult = { result: number | null; rank: number | null };

function getDistanceLabels(test: Test): string[] {
  if (test.distanceLabels) {
    try {
      const parsed = JSON.parse(test.distanceLabels);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  const labels: string[] = [test.distanceLabel0km || "0 km"];
  if (test.distanceLabelXkm) labels.push(test.distanceLabelXkm);
  return labels;
}

function getEntryRounds(entry: TestEntry & { resultXkmCmBehind?: number | null; rankXkm?: number | null }, numRounds: number): RoundResult[] {
  if (entry.results) {
    try {
      const parsed = JSON.parse(entry.results);
      if (Array.isArray(parsed)) {
        while (parsed.length < numRounds) parsed.push({ result: null, rank: null });
        return parsed.slice(0, numRounds);
      }
    } catch {}
  }
  const results: RoundResult[] = [
    { result: entry.result0kmCmBehind, rank: entry.rank0km },
  ];
  if (numRounds > 1) {
    results.push({ result: entry.resultXkmCmBehind ?? null, rank: entry.rankXkm ?? null });
  }
  while (results.length < numRounds) results.push({ result: null, rank: null });
  return results;
}

function RankBadge({ rank }: { rank: number | null }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-7 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold",
        rank === 1 && "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30",
        rank === 2 && "bg-slate-300/20 text-slate-300 ring-1 ring-slate-300/30",
        rank === 3 && "bg-amber-700/20 text-amber-600 ring-1 ring-amber-700/30",
        rank !== null && rank > 3 && "bg-muted/60 text-muted-foreground",
        rank === null && "text-muted-foreground",
      )}
    >
      {rank ?? "—"}
    </span>
  );
}

// ── Add from picture ─────────────────────────────────────────────────────────

type PictureAnalysis = {
  date: string | null;
  location: string | null;
  testType: string | null;
  testName: string | null;
  notes: string | null;
  weather: Record<string, any> | null;
  products: Array<{ skiNumber: number; category: string; brand: string; name: string }>;
  entries: Array<{ skiNumber: number; result0kmCmBehind: number | null; rank0km: number | null; methodology: string; feelingRank: number | null; kickRank: number | null }>;
};

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // strip data:...;base64, prefix
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
  });
}

function AddFromPictureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  type Step = "upload" | "analyzing" | "review" | "creating" | "done" | "error";
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [analysis, setAnalysis] = useState<PictureAnalysis | null>(null);
  const [createdTestId, setCreatedTestId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Editable fields
  const [editDate, setEditDate] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editTestType, setEditTestType] = useState("");
  const [editTestName, setEditTestName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editEntries, setEditEntries] = useState<Array<{
    skiNumber: number;
    result0kmCmBehind: number | null;
    rank0km: number | null;
    methodology: string;
    feelingRank: number | null;
  }>>([]);
  const [editProducts, setEditProducts] = useState<Array<{
    skiNumber: number;
    brand: string;
    name: string;
    category: string;
  }>>([]);

  function reset() {
    setStep("upload");
    setAnalysis(null);
    setCreatedTestId(null);
    setErrorMsg("");
    setDragOver(false);
    setEditEntries([]);
    setEditProducts([]);
  }

  async function processFile(file: File) {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setErrorMsg(t("tests.imageError"));
      setStep("error");
      return;
    }
    setStep("analyzing");
    try {
      const base64 = await toBase64(file);
      const res = await fetch("/api/tests/from-picture/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || t("tests.analyzeError"));
        setStep("error");
        return;
      }
      setAnalysis(data as PictureAnalysis);
      setEditDate(data.date || "");
      setEditLocation(data.location || "");
      setEditTestType(data.testType || "Glide");
      setEditTestName(data.testName || "");
      setEditNotes(data.notes || "");
      setEditEntries((data.entries || []).map((e: any) => ({
        skiNumber: e.skiNumber,
        result0kmCmBehind: e.result0kmCmBehind ?? null,
        rank0km: e.rank0km ?? null,
        methodology: e.methodology || "",
        feelingRank: e.feelingRank ?? null,
      })));
      setEditProducts((data.products || []).map((p: any) => ({
        skiNumber: p.skiNumber,
        brand: p.brand || "",
        name: p.name || "",
        category: p.category || "",
      })));
      setStep("review");
    } catch (e: any) {
      setErrorMsg(e.message || t("tests.unknownError"));
      setStep("error");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  async function handleCreate() {
    if (!analysis) return;
    setStep("creating");
    try {
      const payload = {
        ...analysis,
        date: editDate || analysis.date || new Date().toISOString().slice(0, 10),
        location: editLocation || analysis.location || "Unknown",
        testType: editTestType || analysis.testType || "Glide",
        testName: editTestName || null,
        notes: editNotes || null,
        entries: editEntries,
        products: editProducts,
      };
      const res = await fetch("/api/tests/from-picture/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || t("tests.createError"));
        setStep("error");
        return;
      }
      setCreatedTestId(data.testId);
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      setStep("done");
    } catch (e: any) {
      setErrorMsg(e.message || t("tests.unknownError"));
      setStep("error");
    }
  }

  const weatherFields = analysis?.weather
    ? Object.entries(analysis.weather).filter(([, v]) => v != null && v !== "")
    : [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Add from picture
          </DialogTitle>
        </DialogHeader>

        {/* ── Upload step ── */}
        {step === "upload" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Take a photo or upload an image of an existing test sheet. AI will extract the data and create the test automatically.
            </p>
            <div
              ref={dropRef}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-10 w-10 text-muted-foreground/60" />
              <div className="text-center">
                <p className="text-sm font-medium">Drop image here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP supported</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              capture="environment"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Take photo / Choose image
            </Button>
          </div>
        )}

        {/* ── Analyzing step ── */}
        {step === "analyzing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Analyzing with AI…</p>
            <p className="text-xs text-muted-foreground">This usually takes 5–15 seconds</p>
          </div>
        )}

        {/* ── Review step ── */}
        {step === "review" && analysis && (
          <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
            <p className="text-sm text-muted-foreground">Review and edit the extracted data before saving.</p>

            {/* Basic info */}
            <div className="rounded-lg border border-border p-3 flex flex-col gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Test info</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Date</label>
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-8 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <Select value={editTestType} onValueChange={setEditTestType}>
                    <SelectTrigger className="h-8 text-sm mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Glide">{t("tests.glide")}</SelectItem>
                      <SelectItem value="Structure">{t("tests.structure")}</SelectItem>
                      <SelectItem value="Classic">{t("tests.classic")}</SelectItem>
                      <SelectItem value="Skating">{t("tests.skating")}</SelectItem>
                      <SelectItem value="Double Poling">{t("tests.doublePole")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Location</label>
                <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="h-8 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Test name (optional)</label>
                <Input value={editTestName} onChange={(e) => setEditTestName(e.target.value)} placeholder="e.g. Morning glide test" className="h-8 text-sm mt-0.5" />
              </div>
              {editNotes && (
                <div>
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <p className="text-xs text-foreground mt-0.5 leading-relaxed">{editNotes}</p>
                </div>
              )}
            </div>

            {/* Weather */}
            {weatherFields.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Weather</p>
                <div className="flex flex-wrap gap-1.5">
                  {weatherFields.map(([key, val]) => (
                    <span key={key} className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-foreground/80">
                      {key.replace(/([A-Z])/g, " $1").toLowerCase()}: <strong>{String(val)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Products — editable, grouped by ski number */}
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("tests.products", { n: editProducts.length })}
                </p>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setEditProducts((prev) => [...prev, { skiNumber: 0, brand: "", name: "", category: "" }])}
                >
                  + {t("tests.addProduct")}
                </button>
              </div>
              {editProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t("tests.noProducts")}</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {(() => {
                    // Group products by skiNumber; preserve original indices for editing
                    const indexed = editProducts.map((p, i) => ({ ...p, _i: i }));
                    const grouped = new Map<number, typeof indexed>();
                    for (const p of indexed) {
                      const key = p.skiNumber || 0;
                      if (!grouped.has(key)) grouped.set(key, []);
                      grouped.get(key)!.push(p);
                    }
                    // Sort groups by ski number
                    const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => a - b);
                    return sortedGroups.map(([skiNum, group]) => (
                      <div key={skiNum} className="flex items-center gap-1 flex-wrap">
                        {/* Ski number — shared across all products in group */}
                        <input
                          type="number"
                          value={skiNum || ""}
                          onChange={(e) => {
                            const n = parseInt(e.target.value) || 0;
                            setEditProducts((prev) =>
                              prev.map((r, j) => group.some((g) => g._i === j) ? { ...r, skiNumber: n } : r)
                            );
                          }}
                          placeholder="#"
                          className="h-7 w-12 rounded border border-input bg-background px-1.5 text-xs text-center flex-shrink-0"
                        />
                        {/* All products for this ski, inline with "+" separator */}
                        {group.map((p, pos) => (
                          <Fragment key={p._i}>
                            {pos > 0 && (
                              <span className="text-xs font-bold text-muted-foreground px-0.5">+</span>
                            )}
                            <input
                              type="text"
                              value={p.brand}
                              onChange={(e) => setEditProducts((prev) => prev.map((r, j) => j === p._i ? { ...r, brand: e.target.value } : r))}
                              placeholder={t("tests.brandPlaceholder")}
                              className="h-7 w-20 rounded border border-input bg-background px-1.5 text-xs flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={p.name}
                              onChange={(e) => setEditProducts((prev) => prev.map((r, j) => j === p._i ? { ...r, name: e.target.value } : r))}
                              placeholder={t("tests.namePlaceholder")}
                              className="h-7 w-24 rounded border border-input bg-background px-1.5 text-xs flex-shrink-0"
                            />
                            <button
                              type="button"
                              onClick={() => setEditProducts((prev) => prev.filter((_, j) => j !== p._i))}
                              className="h-7 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted text-sm flex-shrink-0"
                            >
                              ×
                            </button>
                          </Fragment>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Entries — editable */}
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Results ({editEntries.length} entries)
                </p>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setEditEntries((prev) => [...prev, { skiNumber: 0, result0kmCmBehind: null, rank0km: null, methodology: "", feelingRank: null }])}
                >
                  + Add row
                </button>
              </div>
              {editEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No entries</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="grid gap-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold" style={{ gridTemplateColumns: "2rem 3rem 3rem 3rem 1fr 1.5rem" }}>
                    <span>{t("tests.skiCol")}</span><span>{t("tests.resultCol")}</span><span>{t("common.rank")}</span><span>{t("tests.feelCol")}</span><span>{t("tests.methodCol")}</span><span></span>
                  </div>
                  {editEntries.map((e, i) => (
                    <div key={i} className="grid gap-1 items-center" style={{ gridTemplateColumns: "2rem 3rem 3rem 3rem 1fr 1.5rem" }}>
                      <input
                        type="number"
                        value={e.skiNumber || ""}
                        onChange={(ev) => setEditEntries((prev) => prev.map((r, j) => j === i ? { ...r, skiNumber: parseInt(ev.target.value) || 0 } : r))}
                        className="h-7 w-full rounded border border-input bg-background px-1 text-xs text-center"
                      />
                      <input
                        type="number"
                        value={e.result0kmCmBehind ?? ""}
                        onChange={(ev) => setEditEntries((prev) => prev.map((r, j) => j === i ? { ...r, result0kmCmBehind: ev.target.value !== "" ? parseFloat(ev.target.value) : null } : r))}
                        className="h-7 w-full rounded border border-input bg-background px-1 text-xs text-center"
                      />
                      <input
                        type="number"
                        value={e.rank0km ?? ""}
                        onChange={(ev) => setEditEntries((prev) => prev.map((r, j) => j === i ? { ...r, rank0km: ev.target.value !== "" ? parseInt(ev.target.value) : null } : r))}
                        className="h-7 w-full rounded border border-input bg-background px-1 text-xs text-center"
                      />
                      <input
                        type="number"
                        value={e.feelingRank ?? ""}
                        onChange={(ev) => setEditEntries((prev) => prev.map((r, j) => j === i ? { ...r, feelingRank: ev.target.value !== "" ? parseInt(ev.target.value) : null } : r))}
                        className="h-7 w-full rounded border border-input bg-background px-1 text-xs text-center"
                      />
                      <input
                        type="text"
                        value={e.methodology}
                        onChange={(ev) => setEditEntries((prev) => prev.map((r, j) => j === i ? { ...r, methodology: ev.target.value } : r))}
                        placeholder="method"
                        className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setEditEntries((prev) => prev.filter((_, j) => j !== i))}
                        className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted text-sm"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={reset}>
                Re-upload
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleCreate}>
                Create test
              </Button>
            </div>
          </div>
        )}

        {/* ── Creating step ── */}
        {step === "creating" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Creating test…</p>
          </div>
        )}

        {/* ── Done step ── */}
        {step === "done" && createdTestId && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-base font-semibold">Test created!</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
                Close
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { reset(); onOpenChange(false); navigate(`/tests/${createdTestId}`); }}
              >
                View test
              </Button>
            </div>
          </div>
        )}

        {/* ── Error step ── */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-sm font-semibold text-destructive">Something went wrong</p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">{errorMsg}</p>
            <Button variant="outline" onClick={reset}>Try again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CalendarView({
  tests,
  seriesById,
  winnersByTest,
  isBlindTester,
}: {
  tests: Test[];
  seriesById: Map<number, string>;
  winnersByTest: Map<number, { productName: string; skiNumber: number } | null>;
  isBlindTester: boolean;
}) {
  const [, navigate] = useLocation();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  const testsByDate = useMemo(() => {
    const map = new Map<string, Test[]>();
    for (const t of tests) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return map;
  }, [tests]);

  // Build days grid for the current month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Start on Monday (1), not Sunday (0)
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalCells = startOffset + lastDay.getDate();
  const weeks = Math.ceil(totalCells / 7);
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const TYPE_COLOR: Record<string, string> = {
    Glide: "bg-emerald-500",
    Structure: "bg-sky-500",
    Classic: "bg-violet-500",
    Skating: "bg-orange-500",
    Grind: "bg-indigo-500",
  };

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          ‹
        </button>
        <span className="font-semibold">{MONTH_NAMES[month]} {year}</span>
        <button
          onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          ›
        </button>
      </div>

      {/* Grid */}
      <div className="fs-card rounded-2xl overflow-hidden">
        {/* Day labels */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_LABELS.map(d => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
          ))}
        </div>
        {/* Weeks */}
        {Array.from({ length: weeks }).map((_, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {Array.from({ length: 7 }).map((_, dayIdx) => {
              const cellIdx = weekIdx * 7 + dayIdx;
              const dayNum = cellIdx - startOffset + 1;
              if (dayNum < 1 || dayNum > lastDay.getDate()) {
                return <div key={dayIdx} className="min-h-[70px] border-r border-border last:border-r-0 bg-muted/20" />;
              }
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const dayTests = testsByDate.get(dateStr) ?? [];
              const isToday = dateStr === today.toISOString().slice(0, 10);
              return (
                <div key={dayIdx} className="min-h-[70px] border-r border-border last:border-r-0 p-1.5">
                  <div className={cn(
                    "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}>
                    {dayNum}
                  </div>
                  <div className="space-y-0.5">
                    {dayTests.slice(0, 3).map(t => (
                      <button
                        key={t.id}
                        onClick={() => navigate(`/tests/${t.id}`)}
                        className="w-full text-left truncate rounded px-1.5 py-0.5 text-[10px] font-medium hover:opacity-80 transition-opacity flex items-center gap-1"
                        style={{ backgroundColor: `hsl(var(--muted))` }}
                        data-testid={`calendar-test-${t.id}`}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", TYPE_COLOR[t.testType] ?? "bg-gray-400")} />
                        <span className="truncate">{t.testName || t.location}</span>
                      </button>
                    ))}
                    {dayTests.length > 3 && (
                      <div className="text-[9px] text-muted-foreground pl-1">+{dayTests.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", color)} />
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Tests() {
  const [, navigate] = useLocation();
  const { t, language } = useI18n();
  const { isBlindTester, can } = useAuth();
  const canViewGrinding = can("grinding", "view");
  const { data: tests = [], isLoading: testsLoading } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather/for-filtering"] });

  const allTestIds = tests.map((t) => t.id);
  const { data: allEntries = [] } = useQuery<TestEntry[]>({
    queryKey: ["/api/tests/entries/all", allTestIds],
    queryFn: async () => {
      if (allTestIds.length === 0) return [];
      const results = await Promise.all(
        allTestIds.map((id) =>
          fetch(`/api/tests/${id}/entries`, { credentials: "include" }).then((r) => r.json())
        )
      );
      return results.flat();
    },
    enabled: allTestIds.length > 0,
  });

  const [fromPictureOpen, setFromPictureOpen] = useState(false);

  const [sortOrder, setSortOrder] = useState<string>("date-desc");
  const [filterSeason, setFilterSeason] = useState<string>("All");
  const [filterType, setFilterType] = useState<string>("All");
  const [filterProduct, setFilterProduct] = useState<string>("All");
  const [filterSnowType, setFilterSnowType] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [quickDayDate, setQuickDayDate] = useState("");
  const [filterAirTempMin, setFilterAirTempMin] = useState("");
  const [filterAirTempMax, setFilterAirTempMax] = useState("");
  const [filterSnowTempMin, setFilterSnowTempMin] = useState("");
  const [filterSnowTempMax, setFilterSnowTempMax] = useState("");
  const [filterAirHumMin, setFilterAirHumMin] = useState("");
  const [filterAirHumMax, setFilterAirHumMax] = useState("");
  const [filterSnowHumMin, setFilterSnowHumMin] = useState("");
  const [filterSnowHumMax, setFilterSnowHumMax] = useState("");
  const [filterTrackHardness, setFilterTrackHardness] = useState("");
  const [filterSnowHumidityType, setFilterSnowHumidityType] = useState("");
  const [filterGrainSize, setFilterGrainSize] = useState("");
  const [filterArtSnow, setFilterArtSnow] = useState("");
  const [filterNatSnow, setFilterNatSnow] = useState("");
  const [filterPrecipitation, setFilterPrecipitation] = useState("");
  const [filterWind, setFilterWind] = useState("");
  const [filterVisibility, setFilterVisibility] = useState("");
  const [filterCloudMin, setFilterCloudMin] = useState("");
  const [filterCloudMax, setFilterCloudMax] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);

  const seriesById = new Map(series.map((s) => [s.id, s.name] as const));
  const seriesFullById = new Map(series.map((s) => [s.id, s] as const));
  const productsById = new Map(products.map((p) => [p.id, p] as const));
  const weatherById = new Map(weather.map((w) => [w.id, w] as const));

  function getSeason(dateStr: string): string {
    const d = new Date(dateStr);
    const month = d.getMonth();
    const year = d.getFullYear();
    return month >= 4 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  }

  const availableSeasons = useMemo(() => {
    const seasons = Array.from(new Set(tests.map((t) => getSeason(t.date))));
    return seasons.sort().reverse();
  }, [tests]);

  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(tests.map((t) => t.date)));
    return dates.sort().reverse();
  }, [tests]);

  const winnersByTest = useMemo(() => {
    const map = new Map<number, { productName: string; skiNumber: number } | null>();
    for (const t of tests) {
      const entries = allEntries.filter((e) => e.testId === t.id);
      const winner = entries.find((e) => e.rank0km === 1);
      if (winner) {
        const names: string[] = [];
        if (winner.productId) {
          const prod = productsById.get(winner.productId);
          if (prod) names.push(`${prod.brand} ${prod.name}`);
        }
        if (winner.additionalProductIds) {
          for (const idStr of winner.additionalProductIds.split(",")) {
            const id = parseInt(idStr.trim(), 10);
            if (!isNaN(id)) {
              const p = productsById.get(id);
              if (p) names.push(`${p.brand} ${p.name}`);
            }
          }
        }
        map.set(t.id, {
          productName: names.length > 0 ? names.join(" + ") : `Ski #${winner.skiNumber}`,
          skiNumber: winner.skiNumber,
        });
      } else {
        map.set(t.id, null);
      }
    }
    return map;
  }, [tests, allEntries, productsById]);

  const filtered = useMemo(() => {
    const result = tests.filter((t) => {
      // Grind tests are only shown when user has grinding access AND explicitly selects "Grind"
      if (t.testType === "Grind" && !(canViewGrinding && filterType === "Grind")) return false;
      if (filterSeason !== "All" && getSeason(t.date) !== filterSeason) return false;
      if (filterType !== "All" && t.testType !== filterType) return false;
      if (filterLocation && !t.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
      if (quickDayDate && t.date !== quickDayDate) return false;
      if (!quickDayDate && filterDateFrom && t.date < filterDateFrom) return false;
      if (!quickDayDate && filterDateTo && t.date > filterDateTo) return false;

      if (filterProduct !== "All") {
        const entries = allEntries.filter((e) => e.testId === t.id);
        const pid = parseInt(filterProduct);
        if (!entries.some((e) => e.productId === pid)) return false;
      }

      const w = t.weatherId ? weatherById.get(t.weatherId) : null;

      if (filterSnowType) {
        const snowLabel = [w?.artificialSnow, w?.naturalSnow, w?.snowType].filter(Boolean).join(" ").toLowerCase();
        if (!w || !snowLabel.includes(filterSnowType.toLowerCase())) return false;
      }

      // Temperature filters with auto-swap (handles negative temperature confusion)
      const airMin = filterAirTempMin !== "" ? parseFloat(filterAirTempMin) : null;
      const airMax = filterAirTempMax !== "" ? parseFloat(filterAirTempMax) : null;
      const snowMin = filterSnowTempMin !== "" ? parseFloat(filterSnowTempMin) : null;
      const snowMax = filterSnowTempMax !== "" ? parseFloat(filterSnowTempMax) : null;
      const [effAirMin, effAirMax] = airMin != null && airMax != null && airMin > airMax ? [airMax, airMin] : [airMin, airMax];
      const [effSnowMin, effSnowMax] = snowMin != null && snowMax != null && snowMin > snowMax ? [snowMax, snowMin] : [snowMin, snowMax];

      if (effAirMin != null && (!w || (w.airTemperatureC ?? null) == null || w.airTemperatureC! < effAirMin)) return false;
      if (effAirMax != null && (!w || (w.airTemperatureC ?? null) == null || w.airTemperatureC! > effAirMax)) return false;
      if (effSnowMin != null && (!w || (w.snowTemperatureC ?? null) == null || w.snowTemperatureC! < effSnowMin)) return false;
      if (effSnowMax != null && (!w || (w.snowTemperatureC ?? null) == null || w.snowTemperatureC! > effSnowMax)) return false;
      if (filterAirHumMin && (!w || w.airHumidityPct < parseFloat(filterAirHumMin))) return false;
      if (filterAirHumMax && (!w || w.airHumidityPct > parseFloat(filterAirHumMax))) return false;
      if (filterSnowHumMin && (!w || w.snowHumidityPct < parseFloat(filterSnowHumMin))) return false;
      if (filterSnowHumMax && (!w || w.snowHumidityPct > parseFloat(filterSnowHumMax))) return false;
      if (filterTrackHardness && !(w?.trackHardness ?? "").toLowerCase().includes(filterTrackHardness.toLowerCase())) return false;
      if (filterSnowHumidityType && !(w?.snowHumidityType ?? "").toLowerCase().includes(filterSnowHumidityType.toLowerCase())) return false;
      if (filterGrainSize && !(w?.grainSize ?? "").toLowerCase().includes(filterGrainSize.toLowerCase())) return false;
      if (filterArtSnow && !(w?.artificialSnow ?? "").toLowerCase().includes(filterArtSnow.toLowerCase())) return false;
      if (filterNatSnow && !(w?.naturalSnow ?? "").toLowerCase().includes(filterNatSnow.toLowerCase())) return false;
      if (filterPrecipitation && !(w?.precipitation ?? "").toLowerCase().includes(filterPrecipitation.toLowerCase())) return false;
      if (filterWind && !(w?.wind ?? "").toLowerCase().includes(filterWind.toLowerCase())) return false;
      if (filterVisibility && !(w?.visibility ?? "").toLowerCase().includes(filterVisibility.toLowerCase())) return false;
      if (filterCloudMin !== "" && (!w || (w.clouds ?? 999) < parseFloat(filterCloudMin))) return false;
      if (filterCloudMax !== "" && (!w || (w.clouds ?? -999) > parseFloat(filterCloudMax))) return false;

      return true;
    });

    {
      result.sort((a, b) => {
        switch (sortOrder) {
          case "date-asc":
            return a.date.localeCompare(b.date);
          case "date-desc":
            return b.date.localeCompare(a.date);
          case "location-az":
            return a.location.localeCompare(b.location);
          case "location-za":
            return b.location.localeCompare(a.location);
          default:
            return b.date.localeCompare(a.date);
        }
      });
    }

    return result;
  }, [tests, filterSeason, filterType, filterProduct, filterSnowType, filterLocation, quickDayDate, filterDateFrom, filterDateTo, filterAirTempMin, filterAirTempMax, filterSnowTempMin, filterSnowTempMax, filterAirHumMin, filterAirHumMax, filterSnowHumMin, filterSnowHumMax, filterTrackHardness, filterSnowHumidityType, filterGrainSize, filterArtSnow, filterNatSnow, filterPrecipitation, filterWind, filterVisibility, filterCloudMin, filterCloudMax, allEntries, weatherById, sortOrder]);

  const hasFilters = filterSeason !== "All" || filterType !== "All" || filterProduct !== "All" || filterSnowType || filterLocation || (filterDateFrom || filterDateTo) || filterAirTempMin || filterAirTempMax || filterSnowTempMin || filterSnowTempMax || filterAirHumMin || filterAirHumMax || filterSnowHumMin || filterSnowHumMax || filterTrackHardness || filterSnowHumidityType || filterGrainSize || filterArtSnow || filterNatSnow || filterPrecipitation || filterWind || filterVisibility || filterCloudMin || filterCloudMax;

  const activeFilterCount = [
    filterSeason !== "All",
    filterType !== "All",
    filterProduct !== "All",
    !!filterSnowType,
    !!filterLocation,
    !!(filterDateFrom || filterDateTo),
    !!filterAirTempMin,
    !!filterAirTempMax,
    !!filterSnowTempMin,
    !!filterSnowTempMax,
    !!filterAirHumMin,
    !!filterAirHumMax,
    !!filterSnowHumMin,
    !!filterSnowHumMax,
  ].filter(Boolean).length;

  function clearFilters() {
    setFilterSeason("All");
    setFilterType("All");
    setFilterProduct("All");
    setFilterSnowType("");
    setFilterLocation("");
    setFilterDateFrom(""); setFilterDateTo(""); setQuickDayDate("");
    setFilterAirTempMin("");
    setFilterAirTempMax("");
    setFilterSnowTempMin("");
    setFilterSnowTempMax("");
    setFilterAirHumMin("");
    setFilterAirHumMax("");
    setFilterSnowHumMin("");
    setFilterSnowHumMax("");
    setFilterTrackHardness("");
    setFilterSnowHumidityType("");
    setFilterGrainSize("");
    setFilterArtSnow("");
    setFilterNatSnow("");
    setFilterPrecipitation("");
    setFilterWind("");
    setFilterVisibility("");
    setFilterCloudMin("");
    setFilterCloudMax("");
  }

  const [hideDayDetailsState, setHideDayDetails] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "cards2" | "table" | "calendar">(() => {
    const saved = localStorage.getItem("glidr-tests-viewmode");
    if (saved === "table" || saved === "cards2" || saved === "calendar") return saved;
    if (localStorage.getItem("glidr-tests-twocol") === "true") return "cards2";
    return "cards";
  });
  const twoColLayout = viewMode === "cards2";
  const hideDayDetails = isBlindTester || hideDayDetailsState;
  const isDayView = !!quickDayDate;

  function cycleViewMode() {
    const next = viewMode === "cards" ? "cards2" : viewMode === "cards2" ? "table" : viewMode === "table" ? "calendar" : "cards";
    setViewMode(next);
    localStorage.setItem("glidr-tests-viewmode", next);
    localStorage.setItem("glidr-tests-twocol", String(next === "cards2"));
  }

  return (
    <AppShell>
      <AddFromPictureDialog open={fromPictureOpen} onOpenChange={setFromPictureOpen} />
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">{t("tests.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-tests-subtitle">
              {t("tests.subtitle", { count: filtered.length, hasFilters })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground gap-1.5"
              onClick={() => setFromPictureOpen(true)}
              title={t("tests.addImage")}
            >
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">{t("tests.addImage")}</span>
            </Button>
            <AppLink href="/tests/new">
              <Button data-testid="button-new-test" className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                {t("tests.newTest")}
              </Button>
            </AppLink>
          </div>
        </div>

        <Card className="fs-card rounded-2xl p-4">
          {/* Filter toggle */}
          <div className="flex items-center gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen(v => !v)}
              className="gap-1.5"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", filtersOpen && "rotate-180")} />
            </Button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort + view toggle — always visible */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="min-w-[150px]">
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger data-testid="select-sort-order">
                  <SelectValue placeholder={t("tests.filterSort")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">{t("tests.sortNewest")}</SelectItem>
                  <SelectItem value="date-asc">{t("tests.sortOldest")}</SelectItem>
                  <SelectItem value="location-az">{t("tests.sortLocation")} A-Z</SelectItem>
                  <SelectItem value="location-za">{t("tests.sortLocation")} Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={cycleViewMode}
              data-testid="button-toggle-layout-list"
              title={viewMode === "cards" ? t("tests.singleColumn") : viewMode === "cards2" ? t("tests.twoColumns") : viewMode === "table" ? t("tests.tableView") : "Calendar"}
            >
              {viewMode === "table" ? <Table2 className="h-4 w-4" /> : viewMode === "cards2" ? <LayoutGrid className="h-4 w-4" /> : viewMode === "calendar" ? <Calendar className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
            </Button>
          </div>

          {/* Filters — togglable */}
          <div className={cn("flex flex-wrap items-center gap-3", !filtersOpen && "hidden")}>
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
                <Filter className="h-3.5 w-3.5 text-primary" />
              </div>
              {t("common.filter")}
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="min-w-[140px]">
                <Select value={filterSeason} onValueChange={setFilterSeason}>
                  <SelectTrigger data-testid="select-filter-season">
                    <SelectValue placeholder={t("tests.filterSeason")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All seasons</SelectItem>
                    {availableSeasons.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <div className="relative h-9 w-[130px]">
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center px-3 text-xs">
                    {filterDateFrom ? fmtDate(filterDateFrom) : <span className="text-muted-foreground">—</span>}
                  </div>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-9 w-full text-xs"
                    style={{ color: "transparent" }}
                    title="Fra dato"
                    data-testid="input-filter-date-from"
                  />
                </div>
                <span className="text-muted-foreground text-xs shrink-0">–</span>
                <div className="relative h-9 w-[130px]">
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center px-3 text-xs">
                    {filterDateTo ? fmtDate(filterDateTo) : <span className="text-muted-foreground">—</span>}
                  </div>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-9 w-full text-xs"
                    style={{ color: "transparent" }}
                    title="Til dato"
                    data-testid="input-filter-date-to"
                  />
                </div>
              </div>
              <div className="min-w-[140px]">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger data-testid="select-filter-test-type">
                    <SelectValue placeholder={t("tests.testType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">{t("tests.filterByType")}</SelectItem>
                    <SelectItem value="Glide">{t("tests.glide")}</SelectItem>
                    <SelectItem value="Structure">{t("tests.structure")}</SelectItem>
                    <SelectItem value="Classic">{t("tests.classic")}</SelectItem>
                    <SelectItem value="Skating">{t("tests.skating")}</SelectItem>
                    <SelectItem value="Double Poling">{t("tests.doublePole")}</SelectItem>
                    {canViewGrinding && <SelectItem value="Grind">{t("tests.grind")}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {!isBlindTester && <div className="min-w-[200px]">
                <Select value={filterProduct} onValueChange={setFilterProduct}>
                  <SelectTrigger data-testid="select-filter-product">
                    <SelectValue placeholder={t("tests.filterProduct")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All products</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.brand} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>}
              <div className="min-w-[160px]">
                <Input
                  value={filterSnowType}
                  onChange={(e) => setFilterSnowType(e.target.value)}
                  placeholder={t("tests.filterSnowType")}
                  data-testid="input-filter-snow-type"
                />
              </div>
              <div className="min-w-[160px]">
                <LocationAutocomplete
                  value={filterLocation}
                  onChange={setFilterLocation}
                  placeholder={t("common.location")}
                  data-testid="input-filter-location"
                />
              </div>
            </div>
            {hasFilters && (
              <Button
                variant="secondary"
                data-testid="button-clear-test-filters"
                onClick={clearFilters}
              >
                {t("tests.clearFilters")}
              </Button>
            )}
          </div>

          <div className={cn("mt-3 border-t border-border pt-3 space-y-4", !filtersOpen && "hidden")}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Thermometer className="h-3 w-3" />
              {t("testDetail.weather")}
            </div>
            {/* Temperature & Humidity */}
            <div>
              <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Temperature & Humidity</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />Air temp (°C)</label>
                  <div className="flex items-center gap-1">
                    <Input type="number" value={filterAirTempMin} onChange={e => setFilterAirTempMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-air-temp-min" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input type="number" value={filterAirTempMax} onChange={e => setFilterAirTempMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-air-temp-max" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />Snow temp (°C)</label>
                  <div className="flex items-center gap-1">
                    <Input type="number" value={filterSnowTempMin} onChange={e => setFilterSnowTempMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-snow-temp-min" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input type="number" value={filterSnowTempMax} onChange={e => setFilterSnowTempMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-snow-temp-max" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400" />Air humidity (%rH)</label>
                  <div className="flex items-center gap-1">
                    <Input type="number" value={filterAirHumMin} onChange={e => setFilterAirHumMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-air-hum-min" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input type="number" value={filterAirHumMax} onChange={e => setFilterAirHumMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-air-hum-max" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />Snow humidity (%)</label>
                  <div className="flex items-center gap-1">
                    <Input type="number" value={filterSnowHumMin} onChange={e => setFilterSnowHumMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-snow-hum-min" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input type="number" value={filterSnowHumMax} onChange={e => setFilterSnowHumMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-snow-hum-max" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />Cloud cover (%)</label>
                  <div className="flex items-center gap-1">
                    <Input type="number" value={filterCloudMin} onChange={e => setFilterCloudMin(e.target.value)} placeholder="Min" className="h-8 text-xs" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input type="number" value={filterCloudMax} onChange={e => setFilterCloudMax(e.target.value)} placeholder="Max" className="h-8 text-xs" />
                  </div>
                </div>
              </div>
            </div>
            {/* Snow Type */}
            <div>
              <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Snow Type</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />Artificial snow</label>
                  <Select value={filterArtSnow || "__any__"} onValueChange={v => setFilterArtSnow(v === "__any__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">— Any —</SelectItem>
                      {SNOW_STAGE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-400" />Natural snow</label>
                  <Select value={filterNatSnow || "__any__"} onValueChange={v => setFilterNatSnow(v === "__any__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">— Any —</SelectItem>
                      {SNOW_STAGE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />Snow humidity type</label>
                  <Select value={filterSnowHumidityType || "__any__"} onValueChange={v => setFilterSnowHumidityType(v === "__any__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">— Any —</SelectItem>
                      {SNOW_HUMIDITY_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-lime-400" />Grain size</label>
                  <Select value={filterGrainSize || "__any__"} onValueChange={v => setFilterGrainSize(v === "__any__" ? "" : v)}>
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
              <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Snow & Track</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />Track hardness</label>
                  <Select value={filterTrackHardness || "__any__"} onValueChange={v => setFilterTrackHardness(v === "__any__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">— Any —</SelectItem>
                      {TRACK_HARDNESS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />Precipitation</label>
                  <Input className="h-8 text-xs" placeholder="e.g. Light snow" value={filterPrecipitation} onChange={e => setFilterPrecipitation(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />Wind</label>
                  <Input className="h-8 text-xs" placeholder="e.g. Light NW" value={filterWind} onChange={e => setFilterWind(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-pink-400" />Visibility</label>
                  <Input className="h-8 text-xs" placeholder="e.g. Good" value={filterVisibility} onChange={e => setFilterVisibility(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Quick day select */}
          {availableDates.length > 0 && (
            <div className={cn("mt-3 border-t border-border pt-3", !filtersOpen && "hidden")}>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <CalendarDays className="h-3 w-3" />
                Quick day select
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {availableDates.slice(0, 10).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setQuickDayDate(prev => prev === d ? "" : d); setHideDayDetails(false); }}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      quickDayDate === d
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    {fmtDate(d)}
                  </button>
                ))}
                {availableDates.length > 10 && (
                  <Select
                    value={quickDayDate && !availableDates.slice(0, 10).includes(quickDayDate) ? quickDayDate : "__none__"}
                    onValueChange={(v) => { setQuickDayDate(v === "__none__" ? "" : v); if (v !== "__none__") setHideDayDetails(false); }}
                  >
                    <SelectTrigger className="h-7 rounded-full border-0 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20 min-w-0 w-auto gap-1 [&>svg]:h-3 [&>svg]:w-3">
                      <SelectValue placeholder={t("common.more") + "…"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {availableDates.slice(10).map((d) => {
                        const locs = [...new Set(tests.filter(tt => tt.date === d).map(tt => tt.location))];
                        const locale = language === 'no' ? 'nb-NO' : 'en-US';
                        const day = new Date(d + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long' });
                        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
                        const label = [fmtDateShort(d), dayName, ...locs].join(' · ');
                        return <SelectItem key={d} value={d}>{label}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}
        </Card>

        {testsLoading && <SkeletonCards count={5} />}

        {isDayView ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t("tests.dayView") || "Day view"}</h2>
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">{filtered.length} test{filtered.length !== 1 ? "s" : ""}</span>
              {filtered.length > 0 && !isBlindTester && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHideDayDetails((v) => !v)}
                  data-testid="button-toggle-day-details"
                >
                  {hideDayDetails ? <Eye className="mr-1.5 h-3.5 w-3.5" /> : <EyeOff className="mr-1.5 h-3.5 w-3.5" />}
                  {hideDayDetails ? t("tests.showBlind") : t("tests.hideBlind")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={cycleViewMode}
                data-testid="button-toggle-layout"
                title={viewMode === "cards" ? t("tests.singleColumn") : viewMode === "cards2" ? t("tests.twoColumns") : viewMode === "table" ? t("tests.tableView") : "Calendar"}
              >
                {viewMode === "table" ? <Table2 className="h-3.5 w-3.5" /> : viewMode === "cards2" ? <LayoutGrid className="h-3.5 w-3.5" /> : viewMode === "calendar" ? <Calendar className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {filtered.length === 0 ? (
              <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-day-tests">
                {t("tests.noTests")}
              </Card>
            ) : viewMode === "table" ? (
              <Card className="fs-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-day-tests-overview">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">{t("tests.startTime")}</th>
                        <th className="px-4 py-3 font-semibold">{t("common.name")}</th>
                        <th className="px-4 py-3 font-semibold">{t("common.location")}</th>
                        <th className="px-4 py-3 font-semibold">{t("common.type")}</th>
                        <th className="px-4 py-3 font-semibold">{t("tests.series")}</th>
                        <th className="px-4 py-3 font-semibold">{t("testDetail.airTemp")}</th>
                        <th className="px-4 py-3 font-semibold">{t("testDetail.snowTemp")}</th>
                        <th className="px-4 py-3 font-semibold">{t("common.created")} {t("common.by")}</th>
                        {!isBlindTester && <th className="px-4 py-3 font-semibold">{t("tests.winner")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => {
                        const winner = winnersByTest.get(t.id);
                        const w = t.weatherId ? weatherById.get(t.weatherId) : null;
                        return (
                          <tr
                            key={t.id}
                            className="border-b border-border/30 transition-colors hover:bg-muted/20 cursor-pointer"
                            onClick={() => navigate(`/tests/${t.id}`)}
                            data-testid={`row-day-test-${t.id}`}
                          >
                            <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{t.startTime || "—"}</td>
                            <td className="px-4 py-3 font-medium">{t.testName || t.location}</td>
                            <td className="px-4 py-3">{t.location}</td>
                            <td className="px-4 py-3">
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", t.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure")}>
                                {t.testType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{(t as any).seriesName || seriesById.get(t.seriesId) || "—"}</td>
                            <td className="px-4 py-3 text-xs">
                              {w ? <span className="text-sky-600">{w.airTemperatureC}°C</span> : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {w ? <span className="text-emerald-600">{w.snowTemperatureC}°C</span> : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{t.createdByName}</td>
                            {!isBlindTester && (
                              <td className="px-4 py-3 text-xs">
                                {winner ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                    <Trophy className="h-3 w-3" />
                                    {winner.productName}
                                  </span>
                                ) : "—"}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <div className={cn("grid gap-4", twoColLayout ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
              {filtered.map((tst) => {
                const distLabels = getDistanceLabels(tst);
                const testEntries = allEntries.filter((e) => e.testId === tst.id);
                const sortedEntries = [...testEntries].sort((a, b) => a.skiNumber - b.skiNumber);
                const w = tst.weatherId ? weatherById.get(tst.weatherId) : null;
                const winner = winnersByTest.get(tst.id);

                // Build ski labels from series pairLabels
                const skiLabels = (() => {
                  const s = tst.seriesId ? seriesFullById.get(tst.seriesId) : null;
                  if (!s?.pairLabels) return null;
                  try {
                    const parsed = JSON.parse(s.pairLabels);
                    if (typeof parsed === "object" && parsed !== null) {
                      const labels: Record<number, string> = {};
                      for (const [k, v] of Object.entries(parsed)) {
                        if (typeof v === "string" && v) labels[Number(k)] = v;
                      }
                      return Object.keys(labels).length > 0 ? labels : null;
                    }
                  } catch {}
                  return null;
                })();

                return (
                  <Card key={tst.id} className="fs-card rounded-2xl p-4 sm:p-5" data-testid={`card-day-test-${tst.id}`}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {tst.startTime && (
                          <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">{tst.startTime}</span>
                        )}
                        <AppLink href={`/tests/${tst.id}`} testId={`link-test-${tst.id}`}>
                          <span className="text-base font-semibold hover:text-primary transition-colors cursor-pointer">
                            {tst.testName || tst.location}
                          </span>
                        </AppLink>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tst.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure")}>
                          {tst.testType}
                        </span>
                        <span className="text-xs text-muted-foreground">{(tst as any).seriesName || seriesById.get(tst.seriesId) || ""}</span>
                        {w && (
                          <>
                            <span className="inline-flex items-center gap-1 rounded-full fs-gradient-blue px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-500/10">
                              <Thermometer className="h-2.5 w-2.5" /> Air {w.airTemperatureC}°C
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full fs-gradient-emerald px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/10">
                              <Thermometer className="h-2.5 w-2.5" /> Snow {w.snowTemperatureC}°C
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!hideDayDetails && winner && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500/15 to-emerald-400/5 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-200">
                            <Trophy className="h-3 w-3" />
                            {winner.productName}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{sortedEntries.length} {t("tests.entries")}</span>
                      </div>
                    </div>

                    {sortedEntries.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm table-fixed" data-testid={`table-day-test-${tst.id}`}>
                          <colgroup>
                            <col style={{ width: 52 }} />
                            {!hideDayDetails && <col style={{ width: "40%" }} />}
                            {distLabels.map((_, i) => (
                              <col key={i} style={{ width: 64 }} />
                            ))}
                            <col style={{ width: 52 }} />
                            <col style={{ width: 44 }} />
                            {tst.testType === "Classic" && <col style={{ width: 44 }} />}
                          </colgroup>
                          <thead>
                            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                              <th className="pb-2 pr-3">{t("tests.skiCol")}</th>
                              {!hideDayDetails && <th className="pb-2 pr-3">{t("tests.product")}</th>}
                              {distLabels.map((label, i) => (
                                <th key={i} className="pb-2 pr-3">
                                  {label?.trim() || `R${i + 1}`}
                                </th>
                              ))}
                              <th className="pb-2 pr-3">{t("tests.rank")}</th>
                              <th className="pb-2">{t("tests.feelCol")}</th>
                              {tst.testType === "Classic" && <th className="pb-2 pl-2">{t("newTest.kick")}</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedEntries.map((entry) => {
                              const product = entry.productId ? productsById.get(entry.productId) : null;
                              const additionalIds = entry.additionalProductIds
                                ? entry.additionalProductIds.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
                                : [];
                              // Pair each product with its parsed application
                              const appParts = entry.methodology ? entry.methodology.split("|") : [];
                              const productEntries = [
                                product ? { name: `${product.brand} ${product.name}`, app: parseApplication(appParts[0]?.trim() ?? "").interpreted } : null,
                                ...additionalIds.map((aid, i) => {
                                  const p = productsById.get(aid);
                                  return p ? { name: `${p.brand} ${p.name}`, app: parseApplication(appParts[i + 1]?.trim() ?? "").interpreted } : null;
                                }),
                              ].filter((x): x is { name: string; app: string } => !!x);
                              const rounds = getEntryRounds(entry, distLabels.length);
                              const firstRank = rounds[0]?.rank ?? null;

                              return (
                                <tr
                                  key={entry.id}
                                  className={cn(
                                    "border-b border-border/20 last:border-0",
                                    firstRank === 1 && "bg-emerald-500/8",
                                  )}
                                  data-testid={`row-day-entry-${entry.id}`}
                                >
                                  <td className="py-2 pr-3">
                                    <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded bg-background/50 px-1 text-xs font-semibold ring-1 ring-border/50">
                                      {skiLabels?.[entry.skiNumber] ?? entry.skiNumber}
                                    </span>
                                  </td>
                                  {!hideDayDetails && (
                                    <td className="py-2 pr-4 text-xs">
                                      {productEntries.length > 0 ? (
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                          {productEntries.map((pe, i) => (
                                            <span key={i} className="flex items-baseline gap-1">
                                              <span className="font-medium">{pe.name}</span>
                                              {pe.app && <span className="text-muted-foreground">{pe.app}</span>}
                                            </span>
                                          ))}
                                        </div>
                                      ) : "—"}
                                    </td>
                                  )}
                                  {rounds.map((rr, i) => (
                                    <td key={i} className="py-2 pr-3 font-mono text-xs">
                                      {rr.result ?? "—"}
                                    </td>
                                  ))}
                                  <td className="py-2 pr-3">
                                    <RankBadge rank={firstRank} />
                                  </td>
                                  <td className="py-2 text-xs">
                                    {entry.feelingRank != null ? (
                                      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                                        {entry.feelingRank}
                                      </span>
                                    ) : "—"}
                                  </td>
                                  {tst.testType === "Classic" && (
                                  <td className="py-2 pl-2 text-xs">
                                    {entry.kickRank != null ? (
                                      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                                        {entry.kickRank}
                                      </span>
                                    ) : "—"}
                                  </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                );
              })}
              </div>
            )}
          </div>
        ) : viewMode === "table" ? (
          <Card className="fs-card rounded-2xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground" data-testid="empty-tests">
                {t("tests.noTests")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-tests-overview">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">{t("common.date")}</th>
                      <th className="px-4 py-3 font-semibold">{t("common.name")}</th>
                      <th className="px-4 py-3 font-semibold">{t("common.location")}</th>
                      <th className="px-4 py-3 font-semibold">{t("common.type")}</th>
                      <th className="px-4 py-3 font-semibold">{t("tests.series")}</th>
                      <th className="px-4 py-3 font-semibold">{t("testDetail.airTemp")}</th>
                      <th className="px-4 py-3 font-semibold">{t("testDetail.snowTemp")}</th>
                      <th className="px-4 py-3 font-semibold">{t("common.created")} {t("common.by")}</th>
                      {!isBlindTester && <th className="px-4 py-3 font-semibold">{t("tests.winner")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => {
                      const winner = winnersByTest.get(t.id);
                      const w = t.weatherId ? weatherById.get(t.weatherId) : null;
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-border/30 transition-colors hover:bg-muted/20 cursor-pointer"
                          onClick={() => navigate(`/tests/${t.id}`)}
                          data-testid={`row-test-${t.id}`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-xs">{fmtDate(t.date)}</td>
                          <td className="px-4 py-3 font-medium">{t.testName || t.location}</td>
                          <td className="px-4 py-3">{t.location}</td>
                          <td className="px-4 py-3">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", t.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure")}>
                              {t.testType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{(t as any).seriesName || seriesById.get(t.seriesId) || "—"}</td>
                          <td className="px-4 py-3 text-xs">
                            {w ? (
                              <span className="inline-flex items-center gap-1 text-sky-600">
                                {w.airTemperatureC}°C
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {w ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                {w.snowTemperatureC}°C
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{t.createdByName}</td>
                          {!isBlindTester && (
                            <td className="px-4 py-3 text-xs">
                              {winner ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                  <Trophy className="h-3 w-3" />
                                  {winner.productName}
                                </span>
                              ) : "—"}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : viewMode === "calendar" ? (
          <CalendarView tests={filtered} seriesById={seriesById} winnersByTest={winnersByTest} isBlindTester={isBlindTester} />
        ) : (
          <div className={cn("grid gap-3", twoColLayout ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
            {filtered.length === 0 ? (
              <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-tests">
                {t("tests.noTests")}
              </Card>
            ) : (
              filtered.map((t) => {
                const winner = winnersByTest.get(t.id);
                const w = t.weatherId ? weatherById.get(t.weatherId) : null;
                return (
                  <AppLink key={t.id} href={`/tests/${t.id}`} testId={`link-test-${t.id}`}>
                    <Card className="fs-card rounded-2xl p-4 transition-all duration-200 hover:shadow-md hover:shadow-black/[0.07] cursor-pointer group" data-testid={`card-test-${t.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {/* Title row: type badge + test name */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0", t.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure")}>
                              {t.testType}
                            </span>
                            <span className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
                              {t.testName || t.location}
                            </span>
                          </div>
                          {/* Meta: date · series */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{fmtDate(t.date)}</span>
                            {t.startTime && <span className="font-mono tabular-nums">{t.startTime}</span>}
                            {((t as any).seriesName || seriesById.get(t.seriesId)) && (
                              <>
                                <span className="text-border">·</span>
                                <span className="font-medium text-foreground/60">{(t as any).seriesName || seriesById.get(t.seriesId)}</span>
                              </>
                            )}
                            <span className="text-border">·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {t.location}
                            </span>
                          </div>
                          {/* Weather chips */}
                          {w && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-full fs-gradient-blue px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-500/10">
                                <Thermometer className="h-2.5 w-2.5" /> Air {w.airTemperatureC}°C
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full fs-gradient-emerald px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/10">
                                <Thermometer className="h-2.5 w-2.5" /> Snow {w.snowTemperatureC}°C
                              </span>
                              {w.artificialSnow && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-medium text-pink-700 ring-1 ring-pink-500/10">
                                  Art: {w.artificialSnow}
                                </span>
                              )}
                              {w.naturalSnow && (
                                <span className="inline-flex items-center gap-1 rounded-full fs-gradient-violet px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-500/10">
                                  Nat: {w.naturalSnow}
                                </span>
                              )}
                              {w.snowHumidityType && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-500/10">
                                  <Droplets className="h-2.5 w-2.5" /> {w.snowHumidityType}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Created by + winner on same bottom row */}
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-xs text-muted-foreground">{t.createdByName}</span>
                            {!hideDayDetails && winner && (
                              <div
                                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500/15 to-emerald-400/5 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-200"
                                data-testid={`badge-winner-${t.id}`}
                              >
                                <Trophy className="h-3 w-3" />
                                {winner.productName}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Right arrow — indicates clickable */}
                        <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0 mt-0.5" />
                      </div>
                    </Card>
                  </AppLink>
                );
              })
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
