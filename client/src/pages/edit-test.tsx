import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, Save, Sparkles, CloudSun, Plus, Check, Zap } from "lucide-react";
import { useOffline } from "@/lib/offline-context";
import { OfflineError } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDate, cn } from "@/lib/utils";
import { TestEntryTable, type EntryRow, type RoundResult, type RaceSkiOption, type GrindProfile, cleanAdditionalIds } from "@/components/test-entry-table";
import { Spinner } from "@/components/ui/spinner";
import { ManualWeatherDialog } from "@/components/manual-weather-dialog";

type TestType = "Glide" | "Structure" | "Grind" | "Classic" | "Skating" | "Double Poling";

type Athlete = {
  id: number;
  name: string;
};

type RaceSkiData = {
  id: number;
  athleteId: number;
  skiId: string;
  serialNumber: string | null;
  brand: string | null;
  discipline: string;
  grind: string | null;
};

type Test = {
  id: number;
  date: string;
  location: string;
  weatherId: number | null;
  testType: string;
  testSkiSource?: string;
  seriesId: number | null;
  notes: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  distanceLabels: string | null;
  grindParameters: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
};

type Series = {
  id: number;
  name: string;
  type: string;
  skiType?: string | null;
  groupScope: string;
  numberOfSkis: number;
  pairLabels: string | null;
};

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
};

type Weather = {
  id: number;
  date: string;
  time: string;
  location: string;
  airTemperatureC: number;
};

type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  additionalProductIds: string | null;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  resultXkmCmBehind: number | null;
  rankXkm: number | null;
  results: string | null;
  feelingRank: number | null;
  feelingNote: string | null;
  kickRank: number | null;
  grindType?: string | null;
  grindStone?: string | null;
  grindPattern?: string | null;
  grindExtraParams?: string | null;
  grindProfileId?: number | null;
  raceSkiId?: number | null;
};

const formSchemaEdit = z.object({
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  seriesId: z.string().optional(),
  testType: z.enum(["Glide", "Structure", "Grind", "Classic", "Skating", "Double Poling"]),
  location: z.string().min(1, "Location is required"),
  testName: z.string().optional(),
  weatherId: z.string().optional(),
  notes: z.string().optional(),
  groupScope: z.string().min(1, "Select a group"),
});

type FormValues = z.infer<typeof formSchemaEdit>;

function parseDistanceLabels(test: Test): string[] {
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

function parseEntryResults(entry: TestEntry, numRounds: number): RoundResult[] {
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

export default function EditTest() {
  const [, params] = useRoute("/tests/:id/edit");
  const testId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, can } = useAuth();
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);

  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: groups = [] } = useQuery<{ id: number; name: string }[]>({ queryKey: ["/api/groups"] });
  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ["/api/athletes"],
    enabled: can("raceskis"),
  });

  // Test + entries queries come first so their cached data is available for lazy
  // state initialisers and useForm defaultValues on the very first render.
  const { data: test, isLoading: testLoading } = useQuery<Test>({
    queryKey: [`/api/tests/${testId}`],
    enabled: !!testId,
  });
  const { data: entries = [], isLoading: entriesLoading } = useQuery<TestEntry[]>({
    queryKey: [`/api/tests/${testId}/entries`],
    enabled: !!testId,
  });

  // Lazy initialisers run once at mount. When React Query cache is warm (e.g.
  // after prefetchQuery in test-detail or a previous SPA visit) `test` is
  // available synchronously, so these start with the correct values and avoid
  // the Radix Select race condition.
  const [testSkiSource, setTestSkiSource] = useState<"series" | "raceskis">(
    () => test?.testSkiSource === "raceskis" ? "raceskis" : "series"
  );
  const [initialized, setInitialized] = useState(() => !!test);

  const { data: allRaceSkis = [] } = useQuery<RaceSkiData[]>({
    queryKey: ["/api/race-skis/all"],
    enabled: testSkiSource === "raceskis" && can("raceskis"),
  });

  const { data: grindProfiles = [] } = useQuery<GrindProfile[]>({
    queryKey: ["/api/grind-profiles"],
  });

  const userGroups = useMemo(() => {
    if (user?.isAdmin && groups.length > 0) {
      return groups.map((g) => g.name);
    }
    return (user?.groupScope ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }, [user, groups]);

  const [rows, setRows] = useState<EntryRow[]>([]);
  const [distanceLabels, setDistanceLabels] = useState<string[]>(
    () => test ? parseDistanceLabels(test) : ["0 km"]
  );
  const [entriesLoaded, setEntriesLoaded] = useState(false);

  const allGrindParamKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of grindProfiles) {
      // Only include stone/pattern if at least one profile actually has a value
      if (p.stone) keys.add("stone");
      if (p.pattern) keys.add("pattern");
      if (p.extraParams) {
        try {
          const parsed = JSON.parse(p.extraParams);
          for (const [k, v] of Object.entries(parsed)) {
            if (v) keys.add(k);
          }
        } catch {}
      }
    }
    // Preferred order: stone → pattern → rest
    const ordered: string[] = [];
    if (keys.has("stone")) ordered.push("stone");
    if (keys.has("pattern")) ordered.push("pattern");
    for (const k of keys) if (k !== "stone" && k !== "pattern") ordered.push(k);
    return ordered;
  }, [grindProfiles]);

  const [visibleGrindCols, setVisibleGrindCols] = useState<string[]>([]);
  const [manualWeatherOpen, setManualWeatherOpen] = useState(false);
  const [noWeather, setNoWeather] = useState(false);
  // Weather picker UI: "auto" (match by date/location), "pick" (choose a record), "none".
  const [pickWeather, setPickWeather] = useState(false);
  // Notes are collapsed behind a "+ add note" link until used.
  const [showNotes, setShowNotes] = useState(false);
  const [weatherDefaults, setWeatherDefaults] = useState<{ date?: string; time?: string; location?: string; groupScope?: string }>({});

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchemaEdit),
    defaultValues: test
      ? {
          date: test.date,
          startTime: (test as any).startTime || "",
          testType: test.testType as TestType,
          seriesId: test.seriesId ? String(test.seriesId) : "",
          location: test.location,
          testName: (test as any).testName || "",
          weatherId: test.weatherId ? String(test.weatherId) : undefined,
          notes: test.notes || "",
          groupScope: test.groupScope || "",
        }
      : {
          date: "",
          startTime: "",
          testType: "Glide",
          seriesId: "",
          location: "",
          testName: "",
          weatherId: undefined,
          notes: "",
          groupScope: "",
        },
  });

  useEffect(() => {
    if (!test || initialized) return;
    setTestSkiSource(test.testSkiSource === "raceskis" ? "raceskis" : "series");
    setNoWeather((test as any).noWeather === 1);
    form.reset({
      date: test.date,
      startTime: (test as any).startTime || "",
      testType: test.testType as TestType,
      seriesId: test.seriesId ? String(test.seriesId) : "",
      location: test.location,
      testName: (test as any).testName || "",
      weatherId: test.weatherId ? String(test.weatherId) : undefined,
      notes: test.notes || "",
      groupScope: test.groupScope || userGroups[0] || "",
    });
    const labels = parseDistanceLabels(test);
    setDistanceLabels(labels);
    setInitialized(true);
  }, [test, initialized, form]);

  useEffect(() => {
    if (!test || !initialized || entriesLoaded || entriesLoading) return;
    if (entries.length === 0) {
      setEntriesLoaded(true);
      return;
    }
    const labels = parseDistanceLabels(test);
    const numRounds = labels.length;
    setRows(
      entries.map((e, i) => ({
        id: `row_${i}_${e.id}`,
        skiNumber: e.skiNumber,
        productId: e.productId ?? undefined,
        freeTextProduct: (e as any).freeTextProduct ?? null,
        additionalProductIds: e.additionalProductIds ?? undefined,
        methodology: e.methodology,
        applications: e.methodology ? e.methodology.split('|') : [],
        roundResults: parseEntryResults(e, numRounds),
        feelingRank: e.feelingRank ?? null,
        feelingNote: (e as any).feelingNote ?? null,
        kickRank: e.kickRank ?? null,
        kickSolution: (e as any).kickSolution ?? null,
        grindType: e.grindType ?? undefined,
        grindStone: e.grindStone ?? undefined,
        grindPattern: e.grindPattern ?? undefined,
        grindExtraParams: e.grindExtraParams ? (() => { try { return JSON.parse(e.grindExtraParams!); } catch { return undefined; } })() : undefined,
        // Use the stored grind_profile_id directly; fall back to name-based lookup if needed
        grindProfileId: e.grindProfileId
          ?? grindProfiles.find((p) => p.name === e.grindType)?.id,
        raceSkiId: e.raceSkiId ?? undefined,
      }))
    );
    setEntriesLoaded(true);
  }, [entries, test, initialized, entriesLoaded, entriesLoading, grindProfiles]);

  // If grindProfiles loaded after rows were initialised, back-fill any missing grindProfileId.
  // This handles the first-visit case where grindProfiles weren't in cache yet.
  useEffect(() => {
    if (!entriesLoaded || grindProfiles.length === 0) return;
    setRows((prev) => {
      const needsUpdate = prev.some((r) => !r.grindProfileId && r.grindType);
      if (!needsUpdate) return prev;
      return prev.map((r) => {
        if (r.grindProfileId || !r.grindType) return r;
        const found = grindProfiles.find((p) => p.name === r.grindType);
        return found ? { ...r, grindProfileId: found.id } : r;
      });
    });
  }, [grindProfiles, entriesLoaded]);

  const handleWeatherCreated = useCallback((id: number) => {
    form.setValue("weatherId", String(id));
  }, [form]);

  const watchSeriesId = form.watch("seriesId");
  useEffect(() => {
    if (!watchSeriesId || !series.length || !initialized) return;
    const selected = series.find((s) => String(s.id) === watchSeriesId);
    if (selected?.groupScope) {
      form.setValue("groupScope", selected.groupScope, { shouldValidate: true });
    }
  }, [watchSeriesId, series, form, initialized]);

  const watchTestType = form.watch("testType") as TestType;
  const watchDate = form.watch("date");
  const watchLocation = form.watch("location");

  const seriesPairLabels = useMemo(() => {
    if (testSkiSource === "raceskis" || !watchSeriesId) return undefined;
    const selected = series.find((s) => String(s.id) === watchSeriesId);
    if (!selected?.pairLabels) return undefined;
    try {
      const parsed = JSON.parse(selected.pairLabels);
      if (typeof parsed === "object" && parsed !== null) {
        const labels: Record<number, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string" && v) labels[Number(k)] = v;
        }
        return Object.keys(labels).length > 0 ? labels : undefined;
      }
    } catch {}
    return undefined;
  }, [watchSeriesId, series, testSkiSource]);

  const filteredSeries = useMemo(() => {
    if (watchTestType === "Classic" || watchTestType === "Skating" || watchTestType === "Double Poling") {
      return series.filter((s) => s.skiType?.toLowerCase() === watchTestType.toLowerCase());
    }
    return series.filter((s) => s.type === watchTestType);
  },
    [series, watchTestType],
  );

  const raceSkiOptions: RaceSkiOption[] = useMemo(() => {
    return allRaceSkis
      .filter((ski) => {
        if (watchTestType === "Classic" || watchTestType === "Skating" || watchTestType === "Double Poling") {
          return ski.discipline === watchTestType;
        }
        return true;
      })
      .map((ski) => {
        const athlete = athletes.find((a) => a.id === ski.athleteId);
        return {
          id: ski.id,
          skiId: ski.skiId,
          serialNumber: ski.serialNumber,
          brand: ski.brand,
          discipline: ski.discipline,
          athleteName: athlete?.name || "Unknown",
          grind: ski.grind,
        };
      });
  }, [allRaceSkis, athletes, watchTestType]);

  const autoWeather = useMemo(() => {
    if (!watchDate || !watchLocation) return undefined;
    return weather.find(
      (w) =>
        w.date === watchDate &&
        w.location.toLowerCase() === watchLocation.trim().toLowerCase(),
    );
  }, [weather, watchDate, watchLocation]);

  const { queueMutation } = useOffline();

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        const res = await apiRequest("PUT", `/api/tests/${testId}`, data);
        return res.json();
      } catch (err) {
        if (err instanceof OfflineError) {
          await queueMutation("PUT", `/api/tests/${testId}`, data, "Update test");
          return { offline: true };
        }
        throw err;
      }
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${testId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${testId}/entries`] });
      if (result?.offline) {
        toast({
          title: L("Lagret offline", "Saved offline"),
          description: L("Endringer synkroniseres når du er tilkoblet igjen.", "Changes will sync when you reconnect."),
        });
      } else {
        toast({
          title: L("Test oppdatert", "Test updated"),
          description: `Updated ${rows.length} entries.`,
        });
      }
      setLocation(`/tests/${testId}`);
    },
    onError: (e) => {
      toast({
        title: L("Kunne ikke oppdatere test", "Could not update test"),
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  if (testLoading || entriesLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      </AppShell>
    );
  }

  if (!test) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-20" data-testid="not-found-test">
          <p className="text-muted-foreground">{L("Fant ikke testen.", "Test not found.")}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeNav={testSkiSource === "raceskis" ? "/raceskis" : undefined}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              data-testid="button-back-test-detail"
              onClick={() => {
                const dirty = form.formState.isDirty || entriesLoaded;
                if (dirty && !window.confirm(t("newTest.confirmLeave") ?? "You have unsaved changes. Leave anyway?")) return;
                setLocation(`/tests/${testId}`);
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t("common.back")}
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("newTest.editTitle")}</h1>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="text-edit-test-subtitle">
                Update test details and results.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              data-testid="button-add-row"
              onClick={() =>
                setRows((r) => [
                  ...r,
                  {
                    id: `row_new_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                    skiNumber: r.length + 1,
                    productId: undefined,
                    methodology: "",
                    applications: [],
                    roundResults: Array.from({ length: distanceLabels.length }, () => ({ result: null, rank: null })),
                    feelingRank: null,
                    kickRank: null,
                  },
                ])
              }
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t("newTest.addEntry")}
            </Button>
            <Button
              type="submit"
              form="edit-test-form"
              data-testid="button-save-test"
              disabled={saveMutation.isPending || entriesLoading || (!entriesLoaded && entries.length > 0)}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? t("common.saving") : t("newTest.save")}
            </Button>
          </div>
        </div>

        <Card className="fs-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border bg-muted/20 px-4 py-3 sm:px-5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">1</span>
            <p className="text-sm font-semibold text-foreground">{L("Testdetaljer", "Test details")}</p>
          </div>
          <div className="p-4 sm:p-5">
          <Form {...form}>
            <form
              id="edit-test-form"
              onSubmit={form.handleSubmit((values) => {
                if (testSkiSource === "series" && !values.seriesId) {
                  form.setError("seriesId", { message: "Select a series" });
                  return;
                }
                const chosenWeatherId = noWeather ? undefined : (values.weatherId
                  ? Number(values.weatherId)
                  : autoWeather?.id);
                const effectiveGroup = values.testType === "Grind" ? (userGroups[0] || "Grinding") : values.groupScope;
                const payload: any = {
                  date: values.date,
                  startTime: values.startTime || null,
                  location: values.location,
                  testName: values.testName || null,
                  weatherId: chosenWeatherId,
                  noWeather,
                  testType: values.testType,
                  testSkiSource,
                  seriesId: testSkiSource === "raceskis" ? null : Number(values.seriesId),
                  notes: values.notes,
                  groupScope: effectiveGroup,
                  grindParameters: null,
                  distanceLabel0km: distanceLabels[0] || null,
                  distanceLabelXkm: distanceLabels[1] || null,
                  distanceLabels: JSON.stringify(distanceLabels),
                };
                if (entriesLoaded) {
                  payload.entries = rows.map((r) => ({
                    skiNumber: r.skiNumber,
                    productId: testSkiSource === "raceskis" ? null : ((r as any).freeTextProduct ? null : r.productId),
                    freeTextProduct: (r as any).freeTextProduct || null,
                    additionalProductIds: testSkiSource === "raceskis" ? null : cleanAdditionalIds(r.additionalProductIds),
                    methodology: r.methodology,
                    result0kmCmBehind: r.roundResults[0]?.result ?? null,
                    rank0km: r.roundResults[0]?.rank ?? null,
                    resultXkmCmBehind: r.roundResults[1]?.result ?? null,
                    rankXkm: r.roundResults[1]?.rank ?? null,
                    results: JSON.stringify(r.roundResults),
                    feelingRank: r.feelingRank,
                    feelingNote: r.feelingNote ?? null,
                    kickRank: r.kickRank,
                    kickSolution: r.kickSolution ?? null,
                    grindType: r.grindType || null,
                    grindStone: r.grindStone || null,
                    grindPattern: r.grindPattern || null,
                    grindExtraParams: r.grindExtraParams ? JSON.stringify(r.grindExtraParams) : null,
                    grindProfileId: r.grindProfileId || null,
                    raceSkiId: testSkiSource === "raceskis" ? ((r as any).freeTextProduct ? null : (r.raceSkiId || null)) : null,
                  }));
                }
                saveMutation.mutate(payload);
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {can("raceskis") && (
                  <div className="lg:col-span-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none">{L("Skikilde", "Ski source")}</label>
                      <Select
                        value={testSkiSource}
                        onValueChange={(v) => {
                          setTestSkiSource(v as "series" | "raceskis");
                          const currentType = form.getValues("testType");
                          if (v === "raceskis" && ["Glide", "Structure", "Grind"].includes(currentType)) {
                            form.setValue("testType", "Classic");
                          }
                          if (v === "series" && ["Classic", "Skating", "Double Poling"].includes(currentType)) {
                            form.setValue("testType", "Glide");
                          }
                        }}
                      >
                        <SelectTrigger data-testid="select-ski-source">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="series">{L("Testski", "Testskis")}</SelectItem>
                          <SelectItem value="raceskis">{L("Løpsski", "Raceskis")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {testSkiSource === "series" && (
                <div className={can("raceskis") ? "lg:col-span-2" : "lg:col-span-3"}>
                  <FormField
                    control={form.control}
                    name="seriesId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("newTest.series")}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-test-series">
                              <SelectValue placeholder={t("newTest.selectSeries")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredSeries.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)} data-testid={`option-series-${s.id}`}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                )}

                <div className="order-first lg:col-span-12">
                  <FormField
                    control={form.control}
                    name="testType"
                    render={({ field }) => {
                      // All possible types for the current source, so the stored value
                      // always has a matching segment (legacy Classic on series incl.).
                      const typeOptions: { value: string; label: string }[] = testSkiSource === "raceskis"
                        ? [
                            { value: "Classic", label: t("tests.classic") },
                            { value: "Skating", label: t("tests.skating") },
                            { value: "Double Poling", label: t("tests.doublePole") },
                          ]
                        : [
                            { value: "Glide", label: t("tests.glide") },
                            { value: "Structure", label: t("tests.structure") },
                            { value: "Classic", label: t("tests.classic") },
                            { value: "Grind", label: t("tests.grind") },
                          ];
                      return (
                        <FormItem>
                          <FormLabel>{t("newTest.type")}</FormLabel>
                          <div className="flex w-fit flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1" data-testid="select-test-type">
                            {typeOptions.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  field.onChange(opt.value);
                                  form.setValue("seriesId", "", { shouldValidate: false });
                                  setRows((prev) =>
                                    prev.map((r) => ({ ...r, productId: undefined })),
                                  );
                                }}
                                className={cn(
                                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                  field.value === opt.value
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                                data-testid={`option-type-${opt.value.replace(/\s+/g, "-").toLowerCase()}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>

                <div className="lg:col-span-2">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("newTest.date")}</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-test-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="lg:col-span-1">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("newTest.time")}</FormLabel>
                        <FormControl>
                          <Input {...field} type="time" data-testid="input-test-start-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="lg:col-span-3">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("newTest.location")}</FormLabel>
                        <FormControl>
                          <LocationAutocomplete
                            value={field.value}
                            onChange={field.onChange}
                            data-testid="input-test-location"
                            placeholder={L("f.eks. Park City", "e.g., Park City")}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="lg:col-span-3">
                  <FormField
                    control={form.control}
                    name="testName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("newTest.name")}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-test-name" placeholder={t("newTest.namePlaceholder")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="lg:col-span-8">
                  <FormField
                    control={form.control}
                    name="weatherId"
                    render={({ field }) => {
                      const weatherMode: "none" | "pick" | "auto" = noWeather ? "none" : (pickWeather || field.value) ? "pick" : "auto";
                      return (
                        <FormItem>
                          <FormLabel>{t("newTest.weather")}</FormLabel>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex w-fit gap-1 rounded-lg border border-border bg-muted/30 p-1">
                              <button
                                type="button"
                                onClick={() => { setNoWeather(false); setPickWeather(false); field.onChange(undefined); }}
                                className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors", weatherMode === "auto" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                data-testid="option-weather-auto"
                              >
                                <Zap className="h-3 w-3" />
                                {t("newTest.auto")}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setNoWeather(false); setPickWeather(true); }}
                                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", weatherMode === "pick" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                data-testid="button-weather-pick"
                              >
                                {language === "no" ? "Velg måling" : "Pick record"}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setNoWeather(true); setPickWeather(false); field.onChange(undefined); }}
                                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", weatherMode === "none" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                data-testid="checkbox-no-weather"
                              >
                                {language === "no" ? "Uten vær" : "No weather"}
                              </button>
                            </div>
                            <button
                              type="button"
                              disabled={noWeather}
                              onClick={() => {
                                setWeatherDefaults({
                                  date: form.getValues("date"),
                                  time: form.getValues("startTime"),
                                  location: form.getValues("location"),
                                  groupScope: form.getValues("groupScope"),
                                });
                                setManualWeatherOpen(true);
                              }}
                              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                              data-testid="button-add-manual-weather"
                            >
                              <CloudSun className="h-3 w-3" />
                              {language === "no" ? "Manuelt" : "Manual"}
                            </button>
                            {/* Live receipt for the auto match, so it's obvious what will be linked */}
                            {weatherMode === "auto" && (
                              autoWeather ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400" data-testid="text-auto-weather-match">
                                  <Check className="h-3 w-3" />
                                  {autoWeather.location} {autoWeather.time} · {autoWeather.airTemperatureC}°C
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground" data-testid="text-auto-weather-none">
                                  {language === "no" ? "Ingen måling matcher dato/sted ennå" : "No record matches date/location yet"}
                                </span>
                              )
                            )}
                          </div>
                          {weatherMode === "pick" && (
                            <Select
                              value={field.value ?? ""}
                              onValueChange={(v) => field.onChange(v || undefined)}
                            >
                              <FormControl>
                                <SelectTrigger className="mt-1.5" data-testid="select-test-weather">
                                  <SelectValue placeholder={t("newTest.selectWeather")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {weather.map((w) => (
                                  <SelectItem key={w.id} value={String(w.id)} data-testid={`option-weather-${w.id}`}>
                                    {fmtDate(w.date)} · {w.location} · {w.time} · Air {w.airTemperatureC}°C
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>

                {userGroups.length > 1 && watchTestType !== "Grind" && (
                  <div className="lg:col-span-4">
                    <FormField
                      control={form.control}
                      name="groupScope"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("newTest.group")}</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-test-group">
                                <SelectValue placeholder={t("newTest.selectGroup")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {userGroups.map((g) => (
                                <SelectItem key={g} value={g} data-testid={`option-test-group-${g}`}>
                                  {g}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="lg:col-span-12">
                  {/* Notes stay collapsed behind a quiet link until needed. */}
                  {!showNotes && !form.watch("notes") ? (
                    <button
                      type="button"
                      onClick={() => setShowNotes(true)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      data-testid="button-add-notes"
                    >
                      <Plus className="h-3 w-3" />
                      {L("Legg til notat", "Add note")}
                    </button>
                  ) : (
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("common.notes")}</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={2}
                              placeholder={L("Valgfrie notater…", "Optional notes…")}
                              data-testid="input-test-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

              </div>
            </form>
          </Form>
          </div>
        </Card>

        {/* Grind column chooser */}
        {watchTestType === "Grind" && allGrindParamKeys.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm">
            <span className="font-medium text-foreground mr-1">{L("Synlige kolonner:", "Visible columns:")}</span>
            {allGrindParamKeys.map((col) => {
              const label = col === "stone" ? "Stone" : col === "pattern" ? "Pattern" : col === "ra_value" ? "RA-value" : col;
              const checked = visibleGrindCols.includes(col);
              return (
                <label key={col} className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setVisibleGrindCols((prev) => [...prev, col]);
                      } else {
                        setVisibleGrindCols((prev) => prev.filter((k) => k !== col));
                      }
                    }}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <span className="text-foreground/80">{label}</span>
                </label>
              );
            })}
          </div>
        )}

        <div>
          {/* Results section header — mirrors the numbered card header above */}
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">2</span>
            <p className="text-sm font-semibold text-foreground">{L("Resultater", "Results")}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <Zap className="h-2.5 w-2.5" />
              {L("Rangeres automatisk", "Ranked automatically")}
            </span>
          </div>
          <TestEntryTable
            testType={watchTestType}
            products={products}
            rows={rows}
            setRows={setRows}
            distanceLabels={distanceLabels}
            onDistanceLabelsChange={setDistanceLabels}
            testSkiSource={testSkiSource}
            raceSkis={raceSkiOptions}
            skiLabels={seriesPairLabels}
            grindProfiles={grindProfiles}
            visibleGrindCols={visibleGrindCols}
          />
          <div className="mt-2 text-xs text-muted-foreground" data-testid="text-ranking-hint">
            {t("newTest.rankingHint")}
          </div>
        </div>
      </div>

      <ManualWeatherDialog
        open={manualWeatherOpen}
        onClose={() => setManualWeatherOpen(false)}
        onCreated={handleWeatherCreated}
        defaults={weatherDefaults}
      />
    </AppShell>
  );
}
