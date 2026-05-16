import { Fragment, useMemo, useState, useRef, useCallback } from "react";
import { Plus, Trophy, Filter, MapPin, Thermometer, Droplets, CalendarDays, Award, EyeOff, Eye, LayoutGrid, LayoutList, Table2, Camera, Loader2, CheckCircle2, AlertCircle, ImagePlus } from "lucide-react";
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
import { cn, fmtDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type Test = {
  id: number;
  date: string;
  startTime: string | null;
  location: string;
  testName: string | null;
  weatherId: number | null;
  testType: string;
  seriesId: number;
  notes: string | null;
  distanceLabels: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
};

type Series = { id: number; name: string };
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
};

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
      setErrorMsg("Only JPEG, PNG, GIF or WebP images are supported.");
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
        setErrorMsg(data.message || "Failed to analyze image");
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
      setErrorMsg(e.message || "Unknown error");
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
        setErrorMsg(data.message || "Failed to create test");
        setStep("error");
        return;
      }
      setCreatedTestId(data.testId);
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      setStep("done");
    } catch (e: any) {
      setErrorMsg(e.message || "Unknown error");
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
                      <SelectItem value="Glide">Glide</SelectItem>
                      <SelectItem value="Structure">Structure</SelectItem>
                      <SelectItem value="Classic">Classic</SelectItem>
                      <SelectItem value="Skating">Skating</SelectItem>
                      <SelectItem value="Double Poling">Double Poling</SelectItem>
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
                  Products ({editProducts.length})
                </p>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setEditProducts((prev) => [...prev, { skiNumber: 0, brand: "", name: "", category: "" }])}
                >
                  + Add product
                </button>
              </div>
              {editProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No products</p>
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
                              placeholder="Brand"
                              className="h-7 w-20 rounded border border-input bg-background px-1.5 text-xs flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={p.name}
                              onChange={(e) => setEditProducts((prev) => prev.map((r, j) => j === p._i ? { ...r, name: e.target.value } : r))}
                              placeholder="Name"
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
                    <span>Ski</span><span>Result</span><span>Rank</span><span>Feel</span><span>Method</span><span></span>
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

export default function Tests() {
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const { isBlindTester, can } = useAuth();
  const canViewGrinding = can("grinding", "view");
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });

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
  const [filterDate, setFilterDate] = useState("");
  const [filterAirTempMin, setFilterAirTempMin] = useState("");
  const [filterAirTempMax, setFilterAirTempMax] = useState("");
  const [filterSnowTempMin, setFilterSnowTempMin] = useState("");
  const [filterSnowTempMax, setFilterSnowTempMax] = useState("");
  const [filterAirHumMin, setFilterAirHumMin] = useState("");
  const [filterAirHumMax, setFilterAirHumMax] = useState("");
  const [filterSnowHumMin, setFilterSnowHumMin] = useState("");
  const [filterSnowHumMax, setFilterSnowHumMax] = useState("");

  const seriesById = new Map(series.map((s) => [s.id, s.name] as const));
  const productsById = new Map(products.map((p) => [p.id, p] as const));
  const weatherById = new Map(weather.map((w) => [w.id, w] as const));

  function getSeason(dateStr: string): string {
    const d = new Date(dateStr);
    const month = d.getMonth();
    const year = d.getFullYear();
    return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
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
      if (filterDate && t.date !== filterDate) return false;

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

      if (filterAirTempMin && (!w || w.airTemperatureC < parseFloat(filterAirTempMin))) return false;
      if (filterAirTempMax && (!w || w.airTemperatureC > parseFloat(filterAirTempMax))) return false;
      if (filterSnowTempMin && (!w || w.snowTemperatureC < parseFloat(filterSnowTempMin))) return false;
      if (filterSnowTempMax && (!w || w.snowTemperatureC > parseFloat(filterSnowTempMax))) return false;
      if (filterAirHumMin && (!w || w.airHumidityPct < parseFloat(filterAirHumMin))) return false;
      if (filterAirHumMax && (!w || w.airHumidityPct > parseFloat(filterAirHumMax))) return false;
      if (filterSnowHumMin && (!w || w.snowHumidityPct < parseFloat(filterSnowHumMin))) return false;
      if (filterSnowHumMax && (!w || w.snowHumidityPct > parseFloat(filterSnowHumMax))) return false;

      return true;
    });

    // In day view, always sort by startTime ascending
    if (filterDate) {
      result.sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"));
    } else {
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
  }, [tests, filterSeason, filterType, filterProduct, filterSnowType, filterLocation, filterDate, filterAirTempMin, filterAirTempMax, filterSnowTempMin, filterSnowTempMax, filterAirHumMin, filterAirHumMax, filterSnowHumMin, filterSnowHumMax, allEntries, weatherById, sortOrder]);

  const hasFilters = filterSeason !== "All" || filterType !== "All" || filterProduct !== "All" || filterSnowType || filterLocation || filterDate || filterAirTempMin || filterAirTempMax || filterSnowTempMin || filterSnowTempMax || filterAirHumMin || filterAirHumMax || filterSnowHumMin || filterSnowHumMax;

  const [hideDayDetailsState, setHideDayDetails] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "cards2" | "table">(() => {
    const saved = localStorage.getItem("glidr-tests-viewmode");
    if (saved === "table" || saved === "cards2") return saved;
    if (localStorage.getItem("glidr-tests-twocol") === "true") return "cards2";
    return "cards";
  });
  const twoColLayout = viewMode === "cards2";
  const hideDayDetails = isBlindTester || hideDayDetailsState;
  const isDayView = !!filterDate;

  function cycleViewMode() {
    const next = viewMode === "cards" ? "cards2" : viewMode === "cards2" ? "table" : "cards";
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
          {/* Quick type filter pills */}
          {!isDayView && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(["All", "Glide", "Structure", "Classic", "Skating", "Grind"] as const).filter(
                (type) => type !== "Grind" || canViewGrinding
              ).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    filterType === type
                      ? "bg-foreground text-background"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {type}{type === "All" ? ` ${filtered.length}` : ""}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
                <Filter className="h-3.5 w-3.5 text-primary" />
              </div>
              Filters
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="min-w-[140px]">
                <Select value={filterSeason} onValueChange={setFilterSeason}>
                  <SelectTrigger data-testid="select-filter-season">
                    <SelectValue placeholder="Season" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All seasons</SelectItem>
                    {availableSeasons.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[170px]">
                <Select value={filterDate || "all"} onValueChange={(v) => { setFilterDate(v === "all" ? "" : v); setHideDayDetails(false); }}>
                  <SelectTrigger data-testid="select-filter-date">
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All dates</SelectItem>
                    {availableDates.map((d) => (
                      <SelectItem key={d} value={d}>
                        {fmtDate(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px]">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger data-testid="select-filter-test-type">
                    <SelectValue placeholder="Test type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">{t("tests.filterByType")}</SelectItem>
                    <SelectItem value="Glide">Glide</SelectItem>
                    <SelectItem value="Structure">Structure</SelectItem>
                    <SelectItem value="Classic">Classic</SelectItem>
                    <SelectItem value="Skating">Skating</SelectItem>
                    <SelectItem value="Double Poling">Double Poling</SelectItem>
                    {canViewGrinding && <SelectItem value="Grind">Grind</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {!isBlindTester && <div className="min-w-[200px]">
                <Select value={filterProduct} onValueChange={setFilterProduct}>
                  <SelectTrigger data-testid="select-filter-product">
                    <SelectValue placeholder="Product" />
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
                  placeholder="Snow type…"
                  data-testid="input-filter-snow-type"
                />
              </div>
              <div className="min-w-[160px]">
                <LocationAutocomplete
                  value={filterLocation}
                  onChange={setFilterLocation}
                  placeholder="Location…"
                  data-testid="input-filter-location"
                />
              </div>
              <div className="min-w-[150px]">
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger data-testid="select-sort-order">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">Date ↓</SelectItem>
                    <SelectItem value="date-asc">Date ↑</SelectItem>
                    <SelectItem value="location-az">Location A-Z</SelectItem>
                    <SelectItem value="location-za">Location Z-A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={cycleViewMode}
                data-testid="button-toggle-layout-list"
                title={viewMode === "cards" ? "Single column" : viewMode === "cards2" ? "Two columns" : "Table view"}
              >
                {viewMode === "table" ? <Table2 className="h-4 w-4" /> : viewMode === "cards2" ? <LayoutGrid className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
              </Button>
            </div>
            {hasFilters && (
              <Button
                variant="secondary"
                data-testid="button-clear-test-filters"
                onClick={() => {
                  setFilterSeason("All");
                  setFilterType("All");
                  setFilterProduct("All");
                  setFilterSnowType("");
                  setFilterLocation("");
                  setFilterDate("");
                  setFilterAirTempMin("");
                  setFilterAirTempMax("");
                  setFilterSnowTempMin("");
                  setFilterSnowTempMax("");
                  setFilterAirHumMin("");
                  setFilterAirHumMax("");
                  setFilterSnowHumMin("");
                  setFilterSnowHumMax("");
                }}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Thermometer className="h-3 w-3" />
              Weather conditions
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
                  Air temp (°C)
                </label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" value={filterAirTempMin} onChange={(e) => setFilterAirTempMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-air-temp-min" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="number" value={filterAirTempMax} onChange={(e) => setFilterAirTempMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-air-temp-max" />
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Snow temp (°C)
                </label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" value={filterSnowTempMin} onChange={(e) => setFilterSnowTempMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-snow-temp-min" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="number" value={filterSnowTempMax} onChange={(e) => setFilterSnowTempMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-snow-temp-max" />
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400" />
                  Air humidity (%)
                </label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" value={filterAirHumMin} onChange={(e) => setFilterAirHumMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-air-hum-min" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="number" value={filterAirHumMax} onChange={(e) => setFilterAirHumMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-air-hum-max" />
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Snow humidity (%)
                </label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" value={filterSnowHumMin} onChange={(e) => setFilterSnowHumMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-snow-hum-min" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="number" value={filterSnowHumMax} onChange={(e) => setFilterSnowHumMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-snow-hum-max" />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {isDayView ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Day view: {fmtDate(filterDate)}</h2>
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
                title={viewMode === "cards" ? "Single column" : viewMode === "cards2" ? "Two columns" : "Table view"}
              >
                {viewMode === "table" ? <Table2 className="h-3.5 w-3.5" /> : viewMode === "cards2" ? <LayoutGrid className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
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
                        <th className="px-4 py-3 font-semibold">Time</th>
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold">{t("common.location")}</th>
                        <th className="px-4 py-3 font-semibold">{t("common.type")}</th>
                        <th className="px-4 py-3 font-semibold">{t("tests.series")}</th>
                        <th className="px-4 py-3 font-semibold">Air temp</th>
                        <th className="px-4 py-3 font-semibold">Snow temp</th>
                        <th className="px-4 py-3 font-semibold">Created by</th>
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
              {filtered.map((t) => {
                const distLabels = getDistanceLabels(t);
                const testEntries = allEntries.filter((e) => e.testId === t.id);
                const sortedEntries = [...testEntries].sort((a, b) => a.skiNumber - b.skiNumber);
                const w = t.weatherId ? weatherById.get(t.weatherId) : null;
                const winner = winnersByTest.get(t.id);

                return (
                  <Card key={t.id} className="fs-card rounded-2xl p-4 sm:p-5" data-testid={`card-day-test-${t.id}`}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {t.startTime && (
                          <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">{t.startTime}</span>
                        )}
                        <AppLink href={`/tests/${t.id}`} testId={`link-test-${t.id}`}>
                          <span className="text-base font-semibold hover:text-primary transition-colors cursor-pointer">
                            {t.testName || t.location}
                          </span>
                        </AppLink>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", t.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure")}>
                          {t.testType}
                        </span>
                        <span className="text-xs text-muted-foreground">{(t as any).seriesName || seriesById.get(t.seriesId) || ""}</span>
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
                        <table className="w-full text-sm table-fixed" data-testid={`table-day-test-${t.id}`}>
                          <colgroup>
                            <col style={{ width: 52 }} />
                            {!hideDayDetails && <col style={{ width: "30%" }} />}
                            {!hideDayDetails && <col style={{ width: "20%" }} />}
                            {distLabels.map((_, i) => (
                              <col key={i} style={{ width: 64 }} />
                            ))}
                            <col style={{ width: 52 }} />
                            <col style={{ width: 44 }} />
                            {t.testType === "Classic" && <col style={{ width: 44 }} />}
                          </colgroup>
                          <thead>
                            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                              <th className="pb-2 pr-3">Ski</th>
                              {!hideDayDetails && <th className="pb-2 pr-3">Product</th>}
                              {!hideDayDetails && <th className="pb-2 pr-3">Method</th>}
                              {distLabels.map((label, i) => (
                                <th key={i} className="pb-2 pr-3">
                                  {label?.trim() || `R${i + 1}`}
                                </th>
                              ))}
                              <th className="pb-2 pr-3">Rank</th>
                              <th className="pb-2">Feel</th>
                              {t.testType === "Classic" && <th className="pb-2 pl-2">Kick</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedEntries.map((entry) => {
                              const product = entry.productId ? productsById.get(entry.productId) : null;
                              const additionalIds = entry.additionalProductIds
                                ? entry.additionalProductIds.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
                                : [];
                              const allProducts = [
                                product ? `${product.brand} ${product.name}` : null,
                                ...additionalIds.map((aid) => {
                                  const p = productsById.get(aid);
                                  return p ? `${p.brand} ${p.name}` : null;
                                }),
                              ].filter(Boolean);
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
                                    <span className="inline-flex h-6 w-8 items-center justify-center rounded bg-background/50 text-xs font-semibold ring-1 ring-border/50">
                                      {entry.skiNumber}
                                    </span>
                                  </td>
                                  {!hideDayDetails && (
                                    <td className="py-2 pr-3 text-xs truncate">
                                      {allProducts.length > 0 ? allProducts.join(" + ") : "—"}
                                    </td>
                                  )}
                                  {!hideDayDetails && (
                                    <td className="py-2 pr-3 text-xs text-muted-foreground truncate">
                                      {entry.methodology || "—"}
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
                                  {t.testType === "Classic" && (
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
                      <th className="px-4 py-3 font-semibold">{t("common.type")}</th>
                      <th className="px-4 py-3 font-semibold">{t("common.date")}</th>
                      <th className="px-4 py-3 font-semibold">{t("common.location")} · {t("tests.series")}</th>
                      {!isBlindTester && <th className="px-4 py-3 font-semibold">{t("tests.product")}</th>}
                      <th className="px-4 py-3 font-semibold">{t("tests.tester")}</th>
                      <th className="px-4 py-3 font-semibold">{t("tests.results")}</th>
                      <th className="px-4 py-3 font-semibold">{t("tests.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((test) => {
                      const winner = winnersByTest.get(test.id);
                      const testEntries = allEntries.filter((e) => e.testId === test.id);
                      const entryCount = testEntries.length;
                      const resultsCount = testEntries.filter((e) => e.rank0km != null).length;
                      const seriesName = (test as any).seriesName || seriesById.get(test.seriesId) || null;

                      // Avatar color based on name length % 4
                      const name = test.createdByName || "";
                      const nameParts = name.trim().split(/\s+/);
                      const initials = nameParts.length >= 2
                        ? (nameParts[0][0] || "") + (nameParts[nameParts.length - 1][0] || "")
                        : name.slice(0, 2);
                      const avatarColors = [
                        "bg-blue-100 text-blue-700",
                        "bg-emerald-100 text-emerald-700",
                        "bg-amber-100 text-amber-700",
                        "bg-violet-100 text-violet-700",
                      ];
                      const avatarColor = avatarColors[name.length % 4];

                      return (
                        <tr
                          key={test.id}
                          className="border-b border-border/30 transition-colors hover:bg-muted/20 cursor-pointer"
                          onClick={() => navigate(`/tests/${test.id}`)}
                          data-testid={`row-test-${test.id}`}
                        >
                          {/* TYPE */}
                          <td className="px-4 py-3">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", test.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure")}>
                              {test.testType}
                            </span>
                          </td>
                          {/* DATE */}
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{fmtDate(test.date)}</td>
                          {/* LOCATION · SERIES */}
                          <td className="px-4 py-3">
                            <span className="font-medium text-sm text-foreground">{test.location}</span>
                            {seriesName && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{seriesName}</p>
                            )}
                          </td>
                          {/* PRODUCTS (winner/top product) */}
                          {!isBlindTester && (
                            <td className="px-4 py-3 text-xs">
                              {winner ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                  <Trophy className="h-3 w-3 shrink-0" />
                                  <span className="truncate max-w-[140px]">{winner.productName}</span>
                                </span>
                              ) : "—"}
                            </td>
                          )}
                          {/* TESTER */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase", avatarColor)}>
                                {initials.toUpperCase()}
                              </span>
                              <span className="text-xs text-foreground/80 truncate max-w-[100px]">{name || "—"}</span>
                            </div>
                          </td>
                          {/* RESULTS */}
                          <td className="px-4 py-3">
                            {entryCount === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : isBlindTester ? (
                              <div className="flex flex-col gap-0.5 min-w-[52px]">
                                <span className="text-xs font-medium text-foreground">— / {entryCount}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5 min-w-[52px]">
                                <span className="text-xs font-medium text-foreground">{resultsCount}/{entryCount}</span>
                                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${entryCount > 0 ? (resultsCount / entryCount) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                          {/* STATUS */}
                          <td className="px-4 py-3">
                            {!isBlindTester && resultsCount === entryCount && entryCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                <CheckCircle2 className="h-3 w-3" /> Done
                              </span>
                            ) : !isBlindTester && resultsCount > 0 && resultsCount < entryCount ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
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
                    <Card className="fs-card rounded-2xl p-4 transition-all duration-200 hover:bg-card/90 hover:shadow-lg hover:shadow-primary/5 cursor-pointer" data-testid={`card-test-${t.id}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", t.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure")}>
                              {t.testType}
                            </span>
                            <span className="text-base font-semibold">{t.testName || t.location}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{fmtDate(t.date)}</span>
                            {t.startTime && <span className="font-mono tabular-nums">{t.startTime}</span>}
                            <span className="text-border">·</span>
                            <span>{(t as any).seriesName || seriesById.get(t.seriesId) || ""}</span>
                          </div>
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
                          <div className="mt-2 text-xs text-muted-foreground">
                            <span className="text-foreground/70">{t.createdByName}</span>
                            <span className="text-border"> · </span>
                            <span>{t.groupScope}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="inline-flex rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </div>
                          {!hideDayDetails && winner && (
                            <div
                              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500/15 to-emerald-400/5 px-3 py-1 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-200"
                              data-testid={`badge-winner-${t.id}`}
                            >
                              <Trophy className="h-3 w-3" />
                              {winner.productName}
                            </div>
                          )}
                        </div>
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
