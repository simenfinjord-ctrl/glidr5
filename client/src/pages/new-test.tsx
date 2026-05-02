import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, Save, Sparkles, ClipboardList } from "lucide-react";
import { useOffline } from "@/lib/offline-context";
import { OfflineError } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
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
import { TestEntryTable, type EntryRow, type RoundResult, type RaceSkiOption, type GrindProfile, cleanAdditionalIds } from "@/components/test-entry-table";
import { RunsheetDialog, type BracketResult } from "@/components/runsheet-dialog";

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
    roundResults: Array.from({ length: numRounds }, () => ({ result: null, rank: null })),
    feelingRank: null,
    kickRank: null,
  }));
}

export default function NewTest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, can } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const duplicateId = urlParams.get("duplicate");
  const initialType = (urlParams.get("type") as TestType) || "Glide";
  const returnTo = urlParams.get("returnTo") || "/tests";

  const today = new Date().toISOString().slice(0, 10);

  const initialSource = urlParams.get("source") === "raceskis" ? "raceskis" : "series";
  const [testSkiSource, setTestSkiSource] = useState<"series" | "raceskis">(initialSource as any);

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

  // Grind column visibility: compute from profiles once loaded, default all on
  const allGrindParamKeys = useMemo(() => {
    const keys = new Set<string>(["stone", "pattern"]);
    for (const p of grindProfiles) {
      if (p.extraParams) {
        try {
          const parsed = JSON.parse(p.extraParams);
          for (const k of Object.keys(parsed)) keys.add(k);
        } catch {}
      }
    }
    return Array.from(keys);
  }, [grindProfiles]);

  const [visibleGrindCols, setVisibleGrindCols] = useState<string[]>(["stone", "pattern", "ra_value"]);

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
      testType: initialType,
      seriesId: "",
      location: defaultLocation,
      testName: "",
      weatherId: undefined,
      notes: "",
      groupScope: userGroups[0] ?? "",
    },
  });

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
      setRows(makeRows(n, distanceLabels.length));
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
          title: "Saved offline",
          description: "Test will sync when you reconnect.",
        });
      } else {
        toast({
          title: "Test saved",
          description: `Saved ${rows.length} entries.`,
        });
      }
      setLocation(returnTo);
    },
    onError: (e) => {
      toast({
        title: "Could not save test",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href={returnTo} data-testid="button-back-tests">
              <Button asChild variant="secondary" size="sm">
                <span className="inline-flex items-center">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {initialType === "Grind" ? "Grinding" : "Tests"}
                </span>
              </Button>
            </a>
            <div>
              <h1 className="text-2xl sm:text-3xl">{duplicateId ? "Duplicate test" : initialType === "Grind" ? "New grind test" : "New test"}</h1>
              <p
                className="mt-1 text-sm text-muted-foreground"
                data-testid="text-newtest-subtitle"
              >
                Fast, table-first logging with live ranking.
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
                    roundResults: Array.from({ length: distanceLabels.length }, () => ({ result: null, rank: null })),
                    feelingRank: null,
                    kickRank: null,
                  },
                ])
              }
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Add ski
            </Button>
            {rows.length >= 2 && (
              <Button
                variant="outline"
                data-testid="button-open-runsheet"
                onClick={() => setRunsheetOpen(true)}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                Complete Runsheet
              </Button>
            )}
            <Button
              type="submit"
              form="new-test-form"
              data-testid="button-save-test"
            >
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>

        <Card className="fs-card rounded-2xl p-4 sm:p-5">
          <Form {...form}>
            <form
              id="new-test-form"
              onSubmit={form.handleSubmit((values) => {
                if (testSkiSource === "series" && !values.seriesId) {
                  form.setError("seriesId", { message: "Select a series" });
                  return;
                }
                const chosenWeatherId = values.weatherId
                  ? Number(values.weatherId)
                  : autoWeather?.id;
                const effectiveGroup = values.testType === "Grind" ? (userGroups[0] || "Grinding") : values.groupScope;
                saveMutation.mutate({
                  date: values.date,
                  location: values.location,
                  testName: values.testName || null,
                  weatherId: chosenWeatherId,
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
                    productId: testSkiSource === "raceskis" ? null : r.productId,
                    additionalProductIds: testSkiSource === "raceskis" ? null : cleanAdditionalIds(r.additionalProductIds),
                    methodology: r.methodology,
                    result0kmCmBehind: r.roundResults[0]?.result ?? null,
                    rank0km: r.roundResults[0]?.rank ?? null,
                    resultXkmCmBehind: r.roundResults[1]?.result ?? null,
                    rankXkm: r.roundResults[1]?.rank ?? null,
                    results: JSON.stringify(r.roundResults),
                    feelingRank: r.feelingRank,
                    kickRank: r.kickRank,
                    grindType: r.grindType || null,
                    grindStone: r.grindStone || null,
                    grindPattern: r.grindPattern || null,
                    grindExtraParams: r.grindExtraParams ? JSON.stringify(r.grindExtraParams) : null,
                    raceSkiId: testSkiSource === "raceskis" ? (r.raceSkiId || null) : null,
                  })),
                });
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {can("raceskis") && (
                  <div className="lg:col-span-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none">Ski source</label>
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
                          <SelectItem value="series">Testskis</SelectItem>
                          <SelectItem value="raceskis">Raceskis</SelectItem>
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
                        <FormLabel>Series</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-test-series">
                              <SelectValue placeholder="Select series" />
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

                <div className="lg:col-span-2">
                  <FormField
                    control={form.control}
                    name="testType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test type</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            form.setValue("seriesId", "", { shouldValidate: false });
                            setRows((prev) =>
                              prev.map((r) => ({ ...r, productId: undefined })),
                            );
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-test-type">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {testSkiSource !== "raceskis" && (
                              <>
                                <SelectItem value="Glide">Glide</SelectItem>
                                <SelectItem value="Structure">Structure</SelectItem>
                              </>
                            )}
                            {testSkiSource === "raceskis" && (
                              <>
                                <SelectItem value="Classic">Classic</SelectItem>
                                <SelectItem value="Skating">Skating</SelectItem>
                                <SelectItem value="Double Poling">Double Poling</SelectItem>
                              </>
                            )}
                            {can("grinding") && testSkiSource !== "raceskis" && (
                              <SelectItem value="Grind">Grind</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="lg:col-span-2">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
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

                <div className="lg:col-span-2">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <LocationAutocomplete
                            value={field.value}
                            onChange={field.onChange}
                            data-testid="input-test-location"
                            placeholder="e.g., Park City"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="lg:col-span-2">
                  <FormField
                    control={form.control}
                    name="testName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-test-name"
                            placeholder="Uses location if empty"
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
                        <FormLabel>Weather</FormLabel>
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
                                    : "Select weather"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem
                              value="__auto__"
                              data-testid="option-weather-auto"
                            >
                              Auto
                            </SelectItem>
                            {weather.map((w) => (
                              <SelectItem
                                key={w.id}
                                value={String(w.id)}
                                data-testid={`option-weather-${w.id}`}
                              >
                                {w.date} · {w.location} · {w.time} · Air {w.airTemperatureC}°C
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          <FormLabel>Group</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-test-group">
                                <SelectValue placeholder="Select group" />
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
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={2}
                            placeholder="Optional notes…"
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
        </Card>

        {/* Grind column chooser */}
        {watchTestType === "Grind" && allGrindParamKeys.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm">
            <span className="font-medium text-foreground mr-1">Visible columns:</span>
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
            Ranking uses dense ranking: same result = same rank. Click "+ Round" to add more distance tests.
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
            title: "Runsheet applied",
            description: "Results and rankings have been applied to the test entries.",
          });
        }}
      />
    </AppShell>
  );
}
