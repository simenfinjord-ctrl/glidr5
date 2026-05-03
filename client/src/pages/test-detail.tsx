import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, EyeOff, Eye, Download, MapPin, Calendar, Thermometer, Droplets, Snowflake, Award, FlaskConical, Pencil, Trash2, FileText, Copy, Trophy, ClipboardList, Share2, Watch } from "lucide-react";
import { generateTestPDF } from "@/lib/pdf-report";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { RunsheetDialog, type BracketResult } from "@/components/runsheet-dialog";
import { ReviewRunsheetDialog } from "@/components/review-runsheet-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Test = {
  id: number;
  date: string;
  location: string;
  testName: string | null;
  weatherId: number | null;
  testType: string;
  seriesId: number;
  notes: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  distanceLabels: string | null;
  grindParameters: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
  testSkiSource: string;
  athleteId: number | null;
  teamId: number;
};

type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  additionalProductIds: string | null;
  freeTextProduct: string | null;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  resultXkmCmBehind: number | null;
  rankXkm: number | null;
  results: string | null;
  feelingRank: number | null;
  kickRank: number | null;
  raceSkiId: number | null;
  grindType: string | null;
  grindStone: string | null;
  grindPattern: string | null;
  grindExtraParams: string | null;
};

type RaceSki = {
  id: number;
  serialNumber: string | null;
  skiId: string;
};

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
};

type Series = {
  id: number;
  name: string;
};

type Weather = {
  id: number;
  date: string;
  time: string;
  location: string;
  snowTemperatureC: number;
  airTemperatureC: number;
  snowHumidityPct: number;
  airHumidityPct: number;
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
  if (test.distanceLabelXkm) {
    labels.push(test.distanceLabelXkm);
  }
  return labels;
}

function getEntryRounds(entry: TestEntry, numRounds: number): RoundResult[] {
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
    results.push({ result: entry.resultXkmCmBehind, rank: entry.rankXkm });
  }
  while (results.length < numRounds) results.push({ result: null, rank: null });
  return results;
}

function RankBadge({ rank, size = "sm" }: { rank: number | null; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "min-w-12 px-3 py-1.5 text-sm" : "min-w-8 px-2 py-0.5 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold",
        sizeClass,
        rank === 1 && "bg-gradient-to-r from-yellow-500/20 to-yellow-400/10 text-yellow-400 ring-1 ring-yellow-500/30",
        rank === 2 && "bg-gradient-to-r from-slate-300/20 to-slate-200/10 text-slate-300 ring-1 ring-slate-300/30",
        rank === 3 && "bg-gradient-to-r from-amber-700/20 to-amber-600/10 text-amber-600 ring-1 ring-amber-700/30",
        rank !== null && rank > 3 && "bg-muted/60 text-muted-foreground",
        rank === null && "text-muted-foreground",
      )}
    >
      {rank ?? "—"}
    </span>
  );
}

function AddToWatchButton({ testId, testName, seriesId, hasAccess }: { testId: number; testName: string; seriesId: number; hasAccess: boolean }) {
  const { toast } = useToast();
  const { data: queue = [] } = useQuery<any[]>({
    queryKey: ["/api/watch/queue"],
    enabled: hasAccess,
  });
  const inQueue = queue.some((q: any) => q.test_id === testId && q.status === "active");

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/watch/queue", { testId, seriesId, testName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watch/queue"] });
      toast({ title: "Added to watch queue", description: "Open the Garmin app and select «From list»." });
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("409") || msg.includes("Already")) {
        toast({ title: "Already in queue", description: "This test is already in the watch queue.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Could not add to watch queue.", variant: "destructive" });
      }
    },
  });

  return (
    <Button
      variant={inQueue ? "secondary" : "outline"}
      size="sm"
      disabled={inQueue || addMutation.isPending}
      onClick={() => addMutation.mutate()}
      data-testid="button-add-to-watch"
    >
      <Watch className="mr-2 h-4 w-4" />
      {inQueue ? "On Watch" : "Add to Watch"}
    </Button>
  );
}

export default function TestDetail() {
  const [, params] = useRoute("/tests/:id");
  const id = params?.id;
  const { isBlindTester, isSuperAdmin, can } = useAuth();
  const hasWatchAccess = can("garmin_watch");
  const [hideDetailsState, setHideDetails] = useState(false);
  const hideDetails = isBlindTester || hideDetailsState;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRunsheet, setShowRunsheet] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);

  const [showReviewRunsheet, setShowReviewRunsheet] = useState(false);
  const [visibleGrindCols, setVisibleGrindCols] = useState<string[]>(["grindType"]);

  const runsheetMutation = useMutation({
    mutationFn: async ({ results, bracket }: { results: BracketResult[]; bracket: any[][] }) => {
      await apiRequest("PATCH", `/api/tests/${id}/runsheet-results`, { results, bracket });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${id}/entries`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${id}`] });
      toast({ title: "Runsheet results applied" });
      setShowRunsheet(false);
    },
    onError: (e) => {
      toast({
        title: "Could not apply runsheet results",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/tests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      toast({ title: "Test deleted" });
      setLocation(test?.testType === "Grind" ? "/grinding" : "/tests");
    },
    onError: (e) => {
      toast({
        title: "Could not delete test",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  type TeamItem = { id: number; name: string };
  const { data: allTeams = [] } = useQuery<TeamItem[]>({
    queryKey: ["/api/teams"],
    enabled: isSuperAdmin && showShareDialog,
  });

  const shareMutation = useMutation({
    mutationFn: async (targetTeamIds: number[]) => {
      const res = await apiRequest("POST", `/api/tests/${id}/share`, { targetTeamIds });
      return res.json();
    },
    onSuccess: (data: { sharedTeams: string[] }) => {
      setShowShareDialog(false);
      setSelectedTeamIds([]);
      toast({ title: `Test shared with: ${data.sharedTeams.join(", ")}` });
    },
    onError: (e) => {
      toast({
        title: "Could not share test",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const { data: test, isLoading: testLoading } = useQuery<Test>({
    queryKey: [`/api/tests/${id}`],
    enabled: !!id,
  });

  const { data: entries = [] } = useQuery<TestEntry[]>({
    queryKey: [`/api/tests/${id}/entries`],
    enabled: !!id,
  });

  const { data: series = [] } = useQuery<Series[]>({
    queryKey: ["/api/series"],
  });

  const { data: weatherList = [] } = useQuery<Weather[]>({
    queryKey: ["/api/weather"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const isRaceSkiTest = test?.testSkiSource === "raceskis";
  const athleteId = test?.athleteId;

  const { data: raceSkisData = [] } = useQuery<RaceSki[]>({
    queryKey: [`/api/athletes/${athleteId}/skis?includeArchived=true`],
    enabled: isRaceSkiTest && !!athleteId,
  });

  const skiLabels = useMemo(() => {
    if (isRaceSkiTest) {
      if (raceSkisData.length === 0) return undefined;
      const raceSkiById = new Map(raceSkisData.map((rs) => [rs.id, rs]));
      const labels: Record<number, string> = {};
      for (const entry of entries) {
        if (entry.raceSkiId) {
          const rs = raceSkiById.get(entry.raceSkiId);
          if (rs) {
            labels[entry.skiNumber] = rs.serialNumber || rs.skiId;
          }
        }
      }
      return Object.keys(labels).length > 0 ? labels : undefined;
    }
    if (test?.seriesId) {
      const s = series.find((sr) => sr.id === test.seriesId);
      if (s && (s as any).pairLabels) {
        try {
          const parsed = JSON.parse((s as any).pairLabels);
          if (typeof parsed === "object" && parsed !== null) {
            const labels: Record<number, string> = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === "string" && v) labels[Number(k)] = v;
            }
            if (Object.keys(labels).length > 0) return labels;
          }
        } catch {}
      }
    }
    return undefined;
  }, [isRaceSkiTest, raceSkisData, entries, test?.seriesId, series]);

  const seriesById = new Map(series.map((s) => [s.id, s.name] as const));
  const productsById = new Map(products.map((p) => [p.id, p] as const));

  const weather = test?.weatherId
    ? weatherList.find((w) => w.id === test.weatherId)
    : null;

  const distLabels = test ? getDistanceLabels(test) : ["0 km"];

  const sortedEntries = [...entries].sort((a, b) => a.skiNumber - b.skiNumber);

  if (testLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20 text-muted-foreground" data-testid="loading-test">
          Loading…
        </div>
      </AppShell>
    );
  }

  if (!test) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-20" data-testid="not-found-test">
          <p className="text-muted-foreground">Test not found.</p>
          <AppLink href="/tests">
            <Button variant="secondary" data-testid="button-back-tests">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to tests
            </Button>
          </AppLink>
        </div>
      </AppShell>
    );
  }

  const isGrind = test.testType === "Grind";
  const isClassic = test.testType === "Classic";
  const grindParams = isGrind && test.grindParameters ? (() => { try { return JSON.parse(test.grindParameters); } catch { return {}; } })() : {};

  // Grind column chooser — discover extra param keys from entries
  function parseExtraParams(json: string | null): Record<string, string> {
    if (!json) return {};
    try { return JSON.parse(json); } catch { return {}; }
  }
  const grindExtraParamKeys = useMemo(() => {
    if (!isGrind) return [];
    const keys = new Set<string>();
    for (const e of sortedEntries) {
      for (const k of Object.keys(parseExtraParams(e.grindExtraParams))) keys.add(k);
    }
    return Array.from(keys);
  }, [isGrind, sortedEntries]);
  const allGrindCols = useMemo(
    () => ["grindType", "grindStone", "grindPattern", ...grindExtraParamKeys],
    [grindExtraParamKeys]
  );
  const GRIND_COL_LABELS: Record<string, string> = { grindType: "Grind", grindStone: "Stone", grindPattern: "Pattern" };
  function getEntryGrindValue(entry: TestEntry, col: string): string | null {
    if (col === "grindType") return entry.grindType || null;
    if (col === "grindStone") return entry.grindStone || null;
    if (col === "grindPattern") return entry.grindPattern || null;
    return parseExtraParams(entry.grindExtraParams)[col] ?? null;
  }
  function toggleGrindCol(col: string) {
    setVisibleGrindCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }
  const testTypeBadgeClass = test.testType === "Glide" ? "fs-badge-glide" : test.testType === "Grind" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "fs-badge-structure";

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-center justify-between">
            <AppLink href={isGrind ? "/grinding" : "/tests"} testId="link-back-tests">
              <Button variant="ghost" size="sm" data-testid="button-back-tests">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {isGrind ? "Back to grinding" : "Back to tests"}
              </Button>
            </AppLink>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {sortedEntries.length >= 2 && (
                <Button variant="outline" size="sm" onClick={() => setShowRunsheet(true)} data-testid="button-complete-runsheet">
                  <Trophy className="mr-2 h-4 w-4" />
                  Complete Runsheet
                </Button>
              )}
              {(test as any)?.runsheetBracket && (
                <Button variant="outline" size="sm" onClick={() => setShowReviewRunsheet(true)} data-testid="button-review-runsheet">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Review runsheet
                </Button>
              )}
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)} data-testid="button-share-test">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share with
                </Button>
              )}
              <AppLink href={`/tests/new?duplicate=${id}`} testId="link-duplicate-test">
                <Button variant="outline" size="sm" data-testid="button-duplicate-test">
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </Button>
              </AppLink>
              <AppLink href={`/tests/${id}/edit`} testId="link-edit-test">
                <Button variant="outline" size="sm" data-testid="button-edit-test">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </AppLink>
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" data-testid="button-delete-test">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this test?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the test "{(test as any).testName || test.location}" ({test.date}) and all its entries. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate()}
                      data-testid="button-confirm-delete-test"
                    >
                      {deleteMutation.isPending ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl" data-testid="text-test-title">
              {(test as any).testName || test.location}
            </h1>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", testTypeBadgeClass)} data-testid="badge-test-type">
              {test.testType}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{test.date} · {seriesById.get(test.seriesId) ?? "Series"} · {test.groupScope}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="fs-card rounded-2xl p-4 sm:p-5" data-testid="card-test-metadata">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <FlaskConical className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-base font-semibold">Test Details</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-background/40 px-3 py-2.5">
                <Calendar className="h-4 w-4 text-primary/70" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</div>
                  <div className="text-sm font-medium" data-testid="text-test-date">{test.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-background/40 px-3 py-2.5">
                <MapPin className="h-4 w-4 text-emerald-600/70" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Location</div>
                  <div className="text-sm font-medium" data-testid="text-test-location">{test.location}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Series</div>
                  <div className="text-sm font-medium" data-testid="text-test-series">{seriesById.get(test.seriesId) ?? "—"}</div>
                </div>
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Created By</div>
                  <div className="text-sm font-medium" data-testid="text-test-created-by">{test.createdByName}</div>
                </div>
              </div>
              {distLabels.length > 0 && (
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Rounds</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {distLabels.map((label, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {label || `Round ${i + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {test.notes && (
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes</div>
                  <div className="text-sm" data-testid="text-test-notes">{test.notes}</div>
                </div>
              )}
              {isGrind && (grindParams.grindType || grindParams.stone || grindParams.pattern) && (
                <div className="rounded-xl bg-indigo-50/50 px-3 py-2.5 ring-1 ring-indigo-100">
                  <div className="text-[11px] uppercase tracking-wider text-indigo-600/70 mb-1">Grind Parameters</div>
                  <div className="flex flex-wrap gap-2">
                    {grindParams.grindType && (
                      <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700" data-testid="text-grind-type">{grindParams.grindType}</span>
                    )}
                    {grindParams.stone && (
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80" data-testid="text-grind-stone">{grindParams.stone}</span>
                    )}
                    {grindParams.pattern && (
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80" data-testid="text-grind-pattern">{grindParams.pattern}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {weather && (
            <Card className="fs-card rounded-2xl p-4 sm:p-5" data-testid="card-test-weather">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50">
                  <Snowflake className="h-4 w-4 text-sky-600" />
                </div>
                <h2 className="text-base font-semibold">Weather Conditions</h2>
                {weather.testQuality != null && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-200">
                    Quality {weather.testQuality}/10
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl fs-gradient-emerald px-3 py-3 ring-1 ring-emerald-500/10" data-testid="text-weather-snow-temp">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-700/70">
                    <Thermometer className="h-3 w-3" /> Snow Temp
                  </div>
                  <div className="mt-1 text-lg font-bold text-emerald-700">{weather.snowTemperatureC}°C</div>
                </div>
                <div className="rounded-xl fs-gradient-blue px-3 py-3 ring-1 ring-sky-500/10" data-testid="text-weather-air-temp">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-sky-700/70">
                    <Thermometer className="h-3 w-3" /> Air Temp
                  </div>
                  <div className="mt-1 text-lg font-bold text-sky-700">{weather.airTemperatureC}°C</div>
                </div>
                <div className="rounded-xl fs-gradient-amber px-3 py-3 ring-1 ring-amber-500/10" data-testid="text-weather-snow-humidity">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-300/70">
                    <Droplets className="h-3 w-3" /> Snow Hum (Doser)
                  </div>
                  <div className="mt-1 text-lg font-bold text-amber-300">{weather.snowHumidityPct}%</div>
                </div>
                <div className="rounded-xl fs-gradient-violet px-3 py-3 ring-1 ring-violet-500/10" data-testid="text-weather-air-humidity">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-violet-700/70">
                    <Droplets className="h-3 w-3" /> Air Hum
                  </div>
                  <div className="mt-1 text-lg font-bold text-violet-700">{weather.airHumidityPct}%rH</div>
                </div>
              </div>

              {(weather.clouds != null || weather.visibility || weather.wind || weather.precipitation) && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {weather.clouds != null && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Clouds</div>
                      <div className="text-sm font-medium">{weather.clouds}/8</div>
                    </div>
                  )}
                  {weather.visibility && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Visibility</div>
                      <div className="text-sm font-medium">{weather.visibility}</div>
                    </div>
                  )}
                  {weather.wind && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Wind</div>
                      <div className="text-sm font-medium">{weather.wind}</div>
                    </div>
                  )}
                  {weather.precipitation && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Precipitation</div>
                      <div className="text-sm font-medium">{weather.precipitation}</div>
                    </div>
                  )}
                </div>
              )}

              {(weather.artificialSnow || weather.naturalSnow || weather.grainSize || weather.snowHumidityType || weather.trackHardness) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {weather.artificialSnow && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-medium text-pink-700 ring-1 ring-pink-200">
                      Art. snow: {weather.artificialSnow}
                    </span>
                  )}
                  {weather.naturalSnow && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                      Nat. snow: {weather.naturalSnow}
                    </span>
                  )}
                  {weather.grainSize && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-300 ring-1 ring-orange-500/20">
                      Grain: {weather.grainSize}
                    </span>
                  )}
                  {weather.snowHumidityType && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-500/20">
                      Snow hum: {weather.snowHumidityType}
                    </span>
                  )}
                  {weather.trackHardness && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-300 ring-1 ring-rose-200">
                      Track: {weather.trackHardness}
                    </span>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>

        <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-test-results">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
                <Award className="h-4 w-4 text-emerald-600" />
              </div>
              <h2 className="text-base font-semibold">Results</h2>
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">{sortedEntries.length} entries</span>
            </div>
            <div className="flex items-center gap-2">
              {!isBlindTester && <>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-export-pdf"
                onClick={async () => {
                  const seriesMap = new Map(series.map((s) => [s.id, s]));
                  generateTestPDF(test, entries, productsById, seriesMap, weather ?? null, user?.name ?? "Unknown");
                  try {
                    const s = seriesMap.get(test.seriesId);
                    await apiRequest("POST", "/api/action-log", {
                      action: "pdf_download",
                      details: `Test ${test.date} — ${s?.name || ""}`,
                    });
                  } catch (_) {}
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-export-xlsx"
                onClick={() => {
                  const wb = XLSX.utils.book_new();
                  const rows = sortedEntries.map((entry) => {
                    const prod = entry.productId ? productsById.get(entry.productId) : null;
                    const additionalIds = entry.additionalProductIds
                      ? entry.additionalProductIds.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
                      : [];
                    const allProducts = [
                      prod ? `${prod.brand} ${prod.name}` : null,
                      ...additionalIds.map((aid: number) => {
                        const p = productsById.get(aid);
                        return p ? `${p.brand} ${p.name}` : null;
                      }),
                    ].filter(Boolean).join(" + ");
                    const rounds = getEntryRounds(entry, distLabels.length);
                    const row: Record<string, string | number> = {
                      Rank: rounds[0]?.rank ?? "",
                      "Ski No.": entry.skiNumber,
                      Product: allProducts,
                      Method: entry.methodology,
                    };
                    distLabels.forEach((label, i) => {
                      const lbl = label?.trim() || `Round ${i + 1}`;
                      row[`Result ${lbl}`] = rounds[i]?.result ?? "";
                      row[`Rank ${lbl}`] = rounds[i]?.rank ?? "";
                    });
                    row["Feeling"] = entry.feelingRank ?? "";
                    if (isClassic) row["Kick"] = entry.kickRank ?? "";
                    return row;
                  });
                  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Results");
                  // Confidential metadata sheet
                  const metaWs = XLSX.utils.aoa_to_sheet([
                    ["CONFIDENTIAL — Glidr Ski Testing Platform"],
                    [`Exported by: ${user?.name ?? "Unknown"}`],
                    [`Test: ${test.location} · ${test.date}`],
                    [`Exported at: ${new Date().toLocaleString()}`],
                    ["This file contains confidential ski testing data. Do not distribute."],
                  ]);
                  XLSX.utils.book_append_sheet(wb, metaWs, "Export Info");
                  XLSX.writeFile(wb, `test-${test.location}-${test.date}.xlsx`);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
              {hasWatchAccess && <AddToWatchButton testId={test.id} testName={test.testName || `${test.location} · ${test.date}`} seriesId={test.seriesId} />}
              </>}
              {!isBlindTester && (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-toggle-hide"
                  onClick={() => setHideDetails((v) => !v)}
                >
                  {hideDetails ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                  {hideDetails ? "Show" : "Hide"}
                </Button>
              )}
            </div>
          </div>
          {/* Grind column chooser */}
          {isGrind && allGrindCols.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mr-1">Vis per ski:</span>
              {allGrindCols.map((col) => {
                const active = visibleGrindCols.includes(col);
                const label = GRIND_COL_LABELS[col] ?? col;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => toggleGrindCol(col)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition-colors",
                      active
                        ? "bg-violet-600 text-white ring-violet-600"
                        : "bg-muted text-muted-foreground ring-border hover:ring-violet-400 hover:text-foreground"
                    )}
                    data-testid={`toggle-grind-col-${col}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {sortedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="empty-entries">
              No entries recorded.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-results">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-3">Ski</th>
                    {!isGrind && <th className="pb-3 pr-3">Product</th>}
                    {!isGrind && <th className="pb-3 pr-3">Method</th>}
                    {isGrind && visibleGrindCols.map((col) => (
                      <th key={col} className="pb-3 pr-3">{GRIND_COL_LABELS[col] ?? col}</th>
                    ))}
                    {distLabels.map((label, i) => (
                      <th key={i} className="pb-3 pr-3">
                        {(label?.trim() || `Round ${i + 1}`)} (cm)
                      </th>
                    ))}
                    <th className="pb-3 pr-3">Rank</th>
                    <th className="pb-3">Feeling</th>
                    {isClassic && <th className="pb-3 pl-3">Kick</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry, idx) => {
                    const product = entry.productId
                      ? productsById.get(entry.productId)
                      : null;
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
                        data-testid={`row-entry-${entry.id}`}
                        className={cn(
                          "border-b border-border/30 last:border-0 transition-colors",
                          firstRank === 1 && "bg-emerald-500/8",
                          firstRank === 2 && "bg-sky-500/8",
                          firstRank === 3 && "bg-amber-500/8",
                          idx % 2 === 0 && !firstRank && "bg-background/20",
                        )}
                      >
                        <td className="py-3 pr-3" data-testid={`text-ski-number-${entry.id}`}>
                          <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-lg bg-background/50 px-2 text-sm font-semibold ring-1 ring-border/50">
                            {skiLabels?.[entry.skiNumber] ?? entry.skiNumber}
                          </span>
                        </td>
                        {!isGrind && (
                          <td className="py-3 pr-3" data-testid={`text-product-${entry.id}`}>
                            {hideDetails ? "" : (allProducts.length > 0 ? allProducts.join(" + ") : "—")}
                          </td>
                        )}
                        {!isGrind && (
                          <td className="py-3 pr-3 text-muted-foreground" data-testid={`text-method-${entry.id}`}>
                            {hideDetails ? "" : (entry.methodology || "—")}
                          </td>
                        )}
                        {isGrind && visibleGrindCols.map((col) => (
                          <td key={col} className="py-3 pr-3 text-sm text-muted-foreground" data-testid={`text-grind-${col}-${entry.id}`}>
                            {getEntryGrindValue(entry, col) ?? <span className="opacity-40">—</span>}
                          </td>
                        ))}
                        {rounds.map((rr, roundIdx) => (
                          <td key={`res-${roundIdx}`} className="py-3 pr-3 font-mono text-sm" data-testid={`text-result-${roundIdx}-${entry.id}`}>
                            {rr.result ?? "—"}
                          </td>
                        ))}
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <RankBadge rank={firstRank} size="lg" />
                            {!hideDetails && firstRank === 1 && (
                              <span
                                className="rounded-full bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 ring-1 ring-emerald-500/30"
                                data-testid={`badge-winner-${entry.id}`}
                              >
                                Winner
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3" data-testid={`text-feeling-${entry.id}`}>
                          {entry.feelingRank != null ? (
                            <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-700">
                              {entry.feelingRank}
                            </span>
                          ) : "—"}
                        </td>
                        {isClassic && (
                        <td className="py-3 pl-3" data-testid={`text-kick-${entry.id}`}>
                          {entry.kickRank != null ? (
                            <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-semibold text-orange-700">
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

        {sortedEntries.length >= 2 && (
          <RunsheetDialog
            open={showRunsheet}
            onOpenChange={setShowRunsheet}
            skiPairs={sortedEntries.map((e) => e.skiNumber)}
            skiLabels={skiLabels}
            testId={test.id}
            onApplyResults={(results, bracket) => runsheetMutation.mutate({ results, bracket })}
          />
        )}

        {(test as any)?.runsheetBracket && (
          <ReviewRunsheetDialog
            open={showReviewRunsheet}
            onOpenChange={setShowReviewRunsheet}
            bracketJson={(test as any).runsheetBracket}
            skiLabels={skiLabels}
            watchOperatorName={(test as any).watchOperatorName}
          />
        )}

        {isSuperAdmin && (
          <Dialog open={showShareDialog} onOpenChange={(open) => { setShowShareDialog(open); if (!open) setSelectedTeamIds([]); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share test with other teams</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto py-2">
                {allTeams
                  .filter((t: TeamItem) => t.id !== test?.teamId)
                  .map((t: TeamItem) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`team-${t.id}`}
                        checked={selectedTeamIds.includes(t.id)}
                        onCheckedChange={(checked) => {
                          setSelectedTeamIds((prev) =>
                            checked ? [...prev, t.id] : prev.filter((tid) => tid !== t.id)
                          );
                        }}
                        data-testid={`checkbox-team-${t.id}`}
                      />
                      <label htmlFor={`team-${t.id}`} className="cursor-pointer text-sm">{t.name}</label>
                    </div>
                  ))}
                {allTeams.filter((t: TeamItem) => t.id !== test?.teamId).length === 0 && (
                  <p className="text-sm text-muted-foreground">No other teams available.</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setShowShareDialog(false); setSelectedTeamIds([]); }} data-testid="button-cancel-share">
                  Cancel
                </Button>
                <Button
                  disabled={selectedTeamIds.length === 0 || shareMutation.isPending}
                  onClick={() => shareMutation.mutate(selectedTeamIds)}
                  data-testid="button-confirm-share"
                >
                  {shareMutation.isPending ? "Sharing..." : `Share with ${selectedTeamIds.length} team${selectedTeamIds.length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </AppShell>
  );
}
