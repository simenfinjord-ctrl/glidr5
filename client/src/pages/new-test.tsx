import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, Save, Sparkles, ClipboardList, CloudSun, Plus, Check, Zap } from "lucide-react";
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
import { RunsheetDialog, type BracketResult } from "@/components/runsheet-dialog";
import { ManualWeatherDialog } from "@/components/manual-weather-dialog";

type TestType = "Glide" | "Structure" | "Grind" | "Classic" | "Skating" | "Double Poling";

type Athlete = {
  id: number;
  name: string;
};

type RaceSki = {
  id: number;
  athleteId: number;
  skiId: string;
  serialNumber: string | null;
  brand: string | null;
  discipline: string;
  grind: string | null;
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

const formSchema = z.object({
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  seriesId: z.string().optional(),
  testType: z.enum(["Glide", "Structure", "Grind", "Classic", "Skating", "Double Poling"]),
  location: z.string().min(1, "Location is required"),
  testName: z.string().optional(),
  weatherId: z.string().optional(),
  notes: z.string().optional(),
  groupScope: z.string().min(1, "Select a group"),
});

type FormValues = z.infer<typeof formSchema>;

function parsePairLabels(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try { const p = JSON.parse(raw); return typeof p === "object" && p !== null ? p : {}; } catch { return {}; }
}

function makeRows(n = 8, numRounds = 1): EntryRow[] {
  return Array.from({ length: n }).map((_, i) => ({
    id: `row_${i + 1}_${Math.random().toString(16).slice(2)}`,
    skiNumber: i + 1,
    productId: undefined,
    methodology: "",
    applications: [],
    roundResults: Array.from({ length: numRounds }, () => ({ result: null, rank: null })),
    feelingRank: null,
    kickRank: null,
  }));
}

export default function NewTest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, can } = useAuth();
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);

  const urlParams = new URLSearchParams(window.location.search);
  const duplicateId = urlParams.get("duplicate");
  const initialType = (urlParams.get("type") as TestType) || "Glide";
  const returnTo = urlParams.get("returnTo") || "/tests";

  const today = new Date().toISOString().slice(0, 10);

  const initialSource = urlParams.get("source") === "raceskis" ? "raceskis" : "series";
  const [testSkiSource, setTestSkiSource] = useState<"series" | "raceskis">(initialSource as any);
  // Race-ski tests are only created from the Athlete Skis page (?source=raceskis or
  // when duplicating a race-ski test). The general New test page is Testfleets-only.
  const isRaceSkiFlow = initialSource === "raceskis" || testSkiSource === "raceskis";

  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: groups = [] } = useQuery<{ id: number; name: string }[]>({ queryKey: ["/api/groups"] });
  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ["/api/athletes"],
    enabled: can("raceskis"),
  });
  const { data: allRaceSkis = [] } = useQuery<RaceSki[]>({
    queryKey: ["/api/race-skis/all"],
    enabled: testSkiSource === "raceskis" && can("raceskis"),
  });

  const { data: grindProfiles = [] } = useQuery<GrindProfile[]>({
    queryKey: ["/api/grind-profiles"],
  });

  const { data: sourceTest } = useQuery<any>({
    queryKey: [`/api/tests/${duplicateId}`],
    enabled: !!duplicateId,
  });
  const { data: sourceEntries = [] } = useQuery<any[]>({
    queryKey: [`/api/tests/${duplicateId}/entries`],
    enabled: !!duplicateId,
  });

  const [duplicateApplied, setDuplicateApplied] = useState(false);
  const [runsheetOpen, setRunsheetOpen] = useState(false);
  const [manualWeatherOpen, setManualWeatherOpen] = useState(false);
  const [noWeather, setNoWeather] = useState(false);
  // Weather picker UI: "auto" (match by date/location), "pick" (choose a record), "none".
  const [pickWeather, setPickWeather] = useState(false);
  // Notes are collapsed behind a "+ add note" link until used.
  const [showNotes, setShowNotes] = useState(false);
  const [weatherDefaults, setWeatherDefaults] = useState<{ date?: string; time?: string; location?: string; groupScope?: string }>({});

  // Grind column visibility: only include stone/pattern if at least one profile uses them
  const allGrindParamKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of grindProfiles) {
      if (p.stone) keys.add("stone");
      if (p.pattern) keys.add("pattern");
      if (p.extraParams) {
        try {
          const parsed = JSON.parse(p.extraParams);
          for (const [k, v] of Object.entries(parsed)) {
            if (v && k !== "stone" && k !== "pattern") keys.add(k);
          }
        } catch {}
      }
    }
    const ordered: string[] = [];
    if (keys.has("stone")) ordered.push("stone");
    if (keys.has("pattern")) ordered.push("pattern");
    for (const k of keys) if (k !== "stone" && k !== "pattern") ordered.push(k);
    return ordered;
  }, [grindProfiles]);

  const [visibleGrindCols, setVisibleGrindCols] = useState<string[]>([]);

  const userGroups = useMemo(() => {
    if (user?.isAdmin && groups.length > 0) {
      return groups.map((g) => g.name);
    }
    return (user?.groupScope ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }, [user, groups]);

  const [rows, setRows] = useState<EntryRow[]>(() => makeRows(8, 1));
  const [distanceLabels, setDistanceLabels] = useState<string[]>(["0 km"]);

  const defaultLocation = "";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: today,
      startTime: "",
      testType: initialType,
      seriesId: "",
      location: defaultLocation,
      testName: "",
      weatherId: undefined,
      notes: "",
      groupScope: userGroups[0] ?? "",
    },
  });

  const handleWeatherCreated = useCallback((id: number) => {
    form.setValue("weatherId", String(id));
  }, [form]);

  const watchSeriesId = form.watch("seriesId");
  const watchDate = form.watch("date");
  const watchLocation = form.watch("location");
  const watchTestType = form.watch("testType") as TestType;

  const filteredSeries = useMemo(() => {
    if (watchTestType === "Classic" || watchTestType === "Skating" || watchTestType === "Double Poling") {
      return series.filter((s) => s.skiType?.toLowerCase() === watchTestType.toLowerCase());
    }
    return series.filter((s) => s.type === watchTestType);
  }, [series, watchTestType]);

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

  const seriesPairLabels = useMemo(() => {
    if (testSkiSource === "raceskis" || !watchSeriesId) return undefined;
    const selected = series.find((s) => String(s.id) === watchSeriesId);
    if (!selected?.pairLabels) return undefined;
    const parsed = parsePairLabels(selected.pairLabels);
    const labels: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v) labels[Number(k)] = v;
    }
    return Object.keys(labels).length > 0 ? labels : undefined;
  }, [watchSeriesId, series, testSkiSource]);

  useEffect(() => {
    if (testSkiSource === "raceskis") return;
    if (!filteredSeries.length) return;
    const current = form.getValues("seriesId");
    const stillValid = current && filteredSeries.some((s) => String(s.id) === current);
    if (stillValid) return;
    form.setValue("seriesId", String(filteredSeries[0]!.id), { shouldValidate: true });
    if (filteredSeries[0]?.groupScope) {
      form.setValue("groupScope", filteredSeries[0].groupScope, { shouldValidate: true });
    }
  }, [filteredSeries, form, testSkiSource]);

  useEffect(() => {
    if (!watchSeriesId || !series.length) return;
    const selected = series.find((s) => String(s.id) === watchSeriesId);
    if (selected?.groupScope) {
      form.setValue("groupScope", selected.groupScope, { shouldValidate: true });
    }
    if (selected && testSkiSource !== "raceskis" && !duplicateApplied && !duplicateId) {
      const n = selected.numberOfSkis || 8;
      setRows((prev) => {
        if (n === prev.length) return prev; // same count — keep all data
        if (n > prev.length) {
          // Add blank rows at the end, preserve existing
          const extra = makeRows(n - prev.length, distanceLabels.length).map((r, i) => ({
            ...r,
            skiNumber: prev.length + i + 1,
          }));
          return [...prev, ...extra];
        }
        // Fewer skis — trim from the end
        return prev.slice(0, n);
      });
    }
  }, [watchSeriesId, series, form]);

  const [dupFormApplied, setDupFormApplied] = useState(false);
  const [dupEntriesApplied, setDupEntriesApplied] = useState(false);

  useEffect(() => {
    if (dupFormApplied || !sourceTest) return;
    setDupFormApplied(true);

    form.setValue("testType", sourceTest.testType as TestType, { shouldValidate: true });
    if (sourceTest.seriesId) {
      form.setValue("seriesId", String(sourceTest.seriesId), { shouldValidate: true });
    }
    if (sourceTest.groupScope) {
      form.setValue("groupScope", sourceTest.groupScope, { shouldValidate: true });
    }
    if (sourceTest.notes) {
      form.setValue("notes", sourceTest.notes, { shouldValidate: true });
    }
    if (sourceTest.testSkiSource === "raceskis") {
      setTestSkiSource("raceskis");
    }

    const srcLabels: string[] = sourceTest.distanceLabels
      ? (() => { try { const p = JSON.parse(sourceTest.distanceLabels); return Array.isArray(p) ? p : ["0 km"]; } catch { return ["0 km"]; } })()
      : [sourceTest.distanceLabel0km || "0 km", ...(sourceTest.distanceLabelXkm ? [sourceTest.distanceLabelXkm] : [])];
    setDistanceLabels(srcLabels);
  }, [sourceTest, dupFormApplied, form]);

  useEffect(() => {
    if (dupEntriesApplied || !sourceTest || sourceEntries.length === 0) return;
    setDupEntriesApplied(true);
    setDuplicateApplied(true);

    const srcLabels: string[] = sourceTest.distanceLabels
      ? (() => { try { const p = JSON.parse(sourceTest.distanceLabels); return Array.isArray(p) ? p : ["0 km"]; } catch { return ["0 km"]; } })()
      : [sourceTest.distanceLabel0km || "0 km", ...(sourceTest.distanceLabelXkm ? [sourceTest.distanceLabelXkm] : [])];

    const dupRows: EntryRow[] = [...sourceEntries]
      .sort((a: any, b: any) => a.skiNumber - b.skiNumber)
      .map((e: any) => ({
        id: `row_${e.skiNumber}_${Math.random().toString(16).slice(2)}`,
        skiNumber: e.skiNumber,
        productId: e.productId || undefined,
        additionalProductIds: e.additionalProductIds || undefined,
        methodology: e.methodology || "",
        applications: e.methodology ? e.methodology.split('|') : [],
        roundResults: Array.from({ length: srcLabels.length }, () => ({ result: null, rank: null })),
        feelingRank: null,
        kickRank: null,
        grindType: e.grindType || undefined,
        grindStone: e.grindStone || undefined,
        grindPattern: e.grindPattern || undefined,
        raceSkiId: e.raceSkiId || undefined,
      }));
    setRows(dupRows);
  }, [sourceTest, sourceEntries, dupEntriesApplied, form]);

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
        const res = await apiRequest("POST", "/api/tests", data);
        return res.json();
      } catch (err) {
        if (err instanceof OfflineError) {
          await queueMutation("POST", "/api/tests", data, "Save new test");
          return { offline: true };
        }
        throw err;
      }
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      if (result?.offline) {
        toast({
          title: t("newTest.savedOffline"),
          description: t("newTest.savedOfflineDesc"),
        });
      } else {
        toast({
          title: t("newTest.saved"),
          description: `Saved ${rows.length} entries.`,
        });
      }
      setLocation(returnTo);
    },
    onError: (e) => {
      toast({
        title: t("newTest.couldNotSave"),
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return (
    <AppShell activeNav={testSkiSource === "raceskis" ? "/raceskis" : undefined}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              data-testid="button-back-tests"
              onClick={() => {
                const dirty = form.formState.isDirty || rows.some(r => r.productId || r.methodology || r.roundResults.some(rr => rr.result != null || rr.rank != null));
                if (dirty && !window.confirm(t("newTest.confirmLeave") ?? "You have unsaved changes. Leave anyway?")) return;
                setLocation(returnTo);
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {initialType === "Grind" ? t("nav.grinding") : t("nav.tests")}
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{duplicateId ? t("newTest.duplicateTest") : initialType === "Grind" ? t("newTest.newGrindTest") : t("newTest.title")}</h1>
              <p
                className="mt-1 text-sm text-muted-foreground"
                data-testid="text-newtest-subtitle"
              >
                {t("newTest.subtitle")}
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
                    id: `row_${r.length + 1}_${Math.random().toString(16).slice(2)}`,
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
            {rows.length >= 2 && (
              <Button
                variant="outline"
                data-testid="button-open-runsheet"
                onClick={() => setRunsheetOpen(true)}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                {t("newTest.completeRunsheet")}
              </Button>
            )}
            <Button
              type="submit"
              form="new-test-form"
              data-testid="button-save-test"
              disabled={saveMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? (t("common.saving") ?? "Saving…") : t("common.save")}
            </Button>
          </div>
        </div>

        <Card className="fs-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border bg-muted/20 px-4 py-3 sm:px-5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">1</span>
            <p className="text-sm font-semibold text-foreground">{L("Testdetaljer", "Test details")}</p>
            <p className="ml-auto hidden text-xs text-muted-foreground sm:block">{L("Type og dato er alt som kreves", "Type and date are all that's required")}</p>
          </div>
          <div className="p-4 sm:p-5">
          <Form {...form}>
            <form
              id="new-test-form"
              onSubmit={form.handleSubmit((values) => {
                if (testSkiSource === "series" && !values.seriesId) {
                  form.setError("seriesId", { message: "Select a series" });
                  return;
                }
                const chosenWeatherId = noWeather ? undefined : (values.weatherId
                  ? Number(values.weatherId)
                  : autoWeather?.id);
                const effectiveGroup = values.testType === "Grind" ? (userGroups[0] || "Grinding") : values.groupScope;
                saveMutation.mutate({
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
                  entries: rows.map((r) => ({
                    skiNumber: r.skiNumber,
                    productId: testSkiSource === "raceskis" ? null : (r.freeTextProduct ? null : r.productId),
                    freeTextProduct: r.freeTextProduct || null,
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
                    raceSkiId: testSkiSource === "raceskis" ? (r.freeTextProduct ? null : (r.raceSkiId || null)) : null,
                  })),
                });
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {/* Race-ski tests must be started from the Athlete Skis page. On the
                    general New test page only Testfleets is selectable; when started as
                    a race-ski test the source is locked. */}
                {can("raceskis") && isRaceSkiFlow && (
                  <div className="lg:col-span-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none">{t("newTest.skiSource")}</label>
                      <Select value={testSkiSource} disabled>
                        <SelectTrigger data-testid="select-ski-source">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="series">{t("nav.testskis")}</SelectItem>
                          <SelectItem value="raceskis">{t("nav.raceskis")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {testSkiSource === "series" && (
                <div className="lg:col-span-3">
                  <FormField
                    control={form.control}
                    name="seriesId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("newTest.series")}</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-test-series">
                              <SelectValue placeholder={t("newTest.selectSeriesPlaceholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredSeries.map((s) => (
                              <SelectItem
                                key={s.id}
                                value={String(s.id)}
                                data-testid={`option-series-${s.id}`}
                              >
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
                      const typeOptions: { value: TestType; label: string }[] = testSkiSource === "raceskis"
                        ? [
                            { value: "Classic", label: t("tests.classic") },
                            { value: "Skating", label: t("tests.skating") },
                            { value: "Double Poling", label: t("tests.doublePole") },
                          ]
                        : [
                            { value: "Glide", label: t("tests.glide") },
                            { value: "Structure", label: t("tests.structure") },
                            ...(can("grinding") ? [{ value: "Grind" as TestType, label: t("tests.grind") }] : []),
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
                          <Input
                            {...field}
                            type="date"
                            data-testid="input-test-date"
                          />
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
                          <Input
                            {...field}
                            type="time"
                            data-testid="input-test-start-time"
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
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("newTest.location")}</FormLabel>
                        <FormControl>
                          <LocationAutocomplete
                            value={field.value}
                            onChange={field.onChange}
                            data-testid="input-test-location"
                            placeholder={t("newTest.locationPlaceholder")}
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
                          <Input
                            {...field}
                            data-testid="input-test-name"
                            placeholder={t("newTest.namePlaceholder")}
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
                    name="weatherId"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between mb-1">
                          <FormLabel className="mb-0">{t("newTest.weather")}</FormLabel>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none" data-testid="checkbox-no-weather">
                              <input
                                type="checkbox"
                                checked={noWeather}
                                onChange={(e) => { setNoWeather(e.target.checked); if (e.target.checked) field.onChange(undefined); }}
                                className="h-3.5 w-3.5"
                              />
                              {language === "no" ? "Ikke legg til vær" : "Do not add weather"}
                            </label>
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
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            >
                              <CloudSun className="h-3 w-3" />
                              {t("newTest.addManualWeather") ?? "+ Add manual"}
                            </button>
                          </div>
                        </div>
                        <div className={noWeather ? "opacity-40 pointer-events-none" : ""}>
                        <Select
                          value={field.value ?? "__auto__"}
                          onValueChange={(v) => {
                            field.onChange(v === "__auto__" ? undefined : v);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-test-weather">
                              <SelectValue
                                placeholder={
                                  autoWeather
                                    ? `Auto: ${autoWeather.location} ${autoWeather.time}`
                                    : t("newTest.selectWeather")
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem
                              value="__auto__"
                              data-testid="option-weather-auto"
                            >
                              {t("newTest.auto")}
                            </SelectItem>
                            {weather.map((w) => (
                              <SelectItem
                                key={w.id}
                                value={String(w.id)}
                                data-testid={`option-weather-${w.id}`}
                              >
                                {fmtDate(w.date)} · {w.location} · {w.time} · Air {w.airTemperatureC}°C
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {userGroups.length > 1 && watchTestType !== "Grind" && (
                  <div className="lg:col-span-2">
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

                <div className={userGroups.length > 1 ? "lg:col-span-6" : "lg:col-span-8"}>
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
                </div>

              </div>
            </form>
          </Form>
          </div>
        </Card>

        {/* Grind column chooser */}
        {watchTestType === "Grind" && allGrindParamKeys.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm">
            <span className="font-medium text-foreground mr-1">{t("newTest.visibleColumns")}</span>
            {allGrindParamKeys.map((col) => {
              const label = col === "stone" ? t("testskis.stone") : col === "pattern" ? t("testskis.pattern") : col === "ra_value" ? t("newTest.raValue") : col;
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
          <div
            className="mt-2 text-xs text-muted-foreground"
            data-testid="text-ranking-hint"
          >
            {t("newTest.rankingHint")}
          </div>
        </div>
      </div>

      <RunsheetDialog
        open={runsheetOpen}
        onOpenChange={setRunsheetOpen}
        skiPairs={rows.map((r) => r.skiNumber)}
        skiLabels={seriesPairLabels}
        onApplyResults={(results: BracketResult[], _bracket: any) => {
          setRows((prev) =>
            prev.map((row) => {
              const br = results.find((r) => r.skiNumber === row.skiNumber);
              if (!br) return row;
              const newRoundResults = [...row.roundResults];
              if (newRoundResults.length === 0) {
                newRoundResults.push({ result: br.diff, rank: br.rank });
              } else {
                newRoundResults[0] = { result: br.diff, rank: br.rank };
              }
              return { ...row, roundResults: newRoundResults };
            }),
          );
          toast({
            title: t("newTest.runsheetApplied"),
            description: t("newTest.runsheetAppliedDesc"),
          });
        }}
      />

      <ManualWeatherDialog
        open={manualWeatherOpen}
        onClose={() => setManualWeatherOpen(false)}
        onCreated={handleWeatherCreated}
        defaults={weatherDefaults}
      />
    </AppShell>
  );
}
