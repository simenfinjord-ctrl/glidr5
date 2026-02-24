import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, Save, Sparkles } from "lucide-react";
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
import { TestEntryTable, type EntryRow, type RoundResult, cleanAdditionalIds } from "@/components/test-entry-table";
import { Spinner } from "@/components/ui/spinner";

type TestType = "Glide" | "Structure" | "Grind" | "Classic" | "Skating";

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
  kickRank: number | null;
};

const formSchemaEdit = z.object({
  date: z.string().min(1, "Date is required"),
  seriesId: z.string().min(1, "Select a series"),
  testType: z.enum(["Glide", "Structure", "Grind", "Classic", "Skating"]),
  location: z.string().min(1, "Location is required"),
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
  const [initialized, setInitialized] = useState(false);

  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: groups = [] } = useQuery<{ id: number; name: string }[]>({ queryKey: ["/api/groups"] });

  const userGroups = useMemo(() => {
    if (user?.isAdmin && groups.length > 0) {
      return groups.map((g) => g.name);
    }
    return (user?.groupScope ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }, [user, groups]);
  const { data: test, isLoading: testLoading } = useQuery<Test>({
    queryKey: [`/api/tests/${testId}`],
    enabled: !!testId,
  });
  const { data: entries = [] } = useQuery<TestEntry[]>({
    queryKey: [`/api/tests/${testId}/entries`],
    enabled: !!testId,
  });

  const [rows, setRows] = useState<EntryRow[]>([]);
  const [distanceLabels, setDistanceLabels] = useState<string[]>(["0 km"]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchemaEdit),
    defaultValues: {
      date: "",
      testType: "Glide",
      seriesId: "",
      location: "",
      weatherId: undefined,
      notes: "",
      groupScope: "",
    },
  });

  useEffect(() => {
    if (!test || initialized) return;
    form.reset({
      date: test.date,
      testType: test.testType as TestType,
      seriesId: String(test.seriesId),
      location: test.location,
      weatherId: test.weatherId ? String(test.weatherId) : undefined,
      notes: test.notes || "",
      groupScope: test.groupScope || userGroups[0] || "",
    });
    const labels = parseDistanceLabels(test);
    setDistanceLabels(labels);
    setInitialized(true);
  }, [test, initialized, form]);

  useEffect(() => {
    if (!entries.length || !test || !initialized || entriesLoaded) return;
    const labels = parseDistanceLabels(test);
    const numRounds = labels.length;
    setRows(
      entries.map((e, i) => ({
        id: `row_${i}_${e.id}`,
        skiNumber: e.skiNumber,
        productId: e.productId ?? undefined,
        additionalProductIds: e.additionalProductIds ?? undefined,
        methodology: e.methodology,
        roundResults: parseEntryResults(e, numRounds),
        feelingRank: e.feelingRank ?? null,
        kickRank: e.kickRank ?? null,
        grindType: (e as any).grindType ?? undefined,
        grindStone: (e as any).grindStone ?? undefined,
        grindPattern: (e as any).grindPattern ?? undefined,
        raceSkiId: (e as any).raceSkiId ?? undefined,
      }))
    );
    setEntriesLoaded(true);
  }, [entries, test, initialized, entriesLoaded]);

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

  const filteredSeries = useMemo(() => {
    if (watchTestType === "Classic" || watchTestType === "Skating") {
      return series.filter((s) => s.skiType?.toLowerCase() === watchTestType.toLowerCase());
    }
    return series.filter((s) => s.type === watchTestType);
  },
    [series, watchTestType],
  );

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
          title: "Saved offline",
          description: "Changes will sync when you reconnect.",
        });
      } else {
        toast({
          title: "Test updated",
          description: `Updated ${rows.length} entries.`,
        });
      }
      setLocation(`/tests/${testId}`);
    },
    onError: (e) => {
      toast({
        title: "Could not update test",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  if (testLoading) {
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
          <p className="text-muted-foreground">Test not found.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href={`/tests/${testId}`} data-testid="button-back-test-detail">
              <Button asChild variant="secondary" size="sm">
                <span className="inline-flex items-center">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </span>
              </Button>
            </a>
            <div>
              <h1 className="text-2xl sm:text-3xl">Edit test</h1>
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
            <Button
              type="submit"
              form="edit-test-form"
              data-testid="button-save-test"
              disabled={saveMutation.isPending || (!entriesLoaded && entries.length > 0)}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <Card className="fs-card rounded-2xl p-4 sm:p-5">
          <Form {...form}>
            <form
              id="edit-test-form"
              onSubmit={form.handleSubmit((values) => {
                const chosenWeatherId = values.weatherId
                  ? Number(values.weatherId)
                  : autoWeather?.id;
                const effectiveGroup = values.testType === "Grind" ? (userGroups[0] || "Grinding") : values.groupScope;
                const payload: any = {
                  date: values.date,
                  location: values.location,
                  weatherId: chosenWeatherId,
                  testType: values.testType,
                  seriesId: Number(values.seriesId),
                  notes: values.notes,
                  groupScope: effectiveGroup,
                  grindParameters: null,
                  distanceLabel0km: distanceLabels[0] || null,
                  distanceLabelXkm: distanceLabels[1] || null,
                  distanceLabels: JSON.stringify(distanceLabels),
                };
                if (entriesLoaded || entries.length === 0) {
                  payload.entries = rows.map((r) => ({
                    skiNumber: r.skiNumber,
                    productId: r.productId,
                    additionalProductIds: cleanAdditionalIds(r.additionalProductIds),
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
                    raceSkiId: r.raceSkiId || null,
                  }));
                }
                saveMutation.mutate(payload);
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-3">
                  <FormField
                    control={form.control}
                    name="seriesId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Series</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-test-series">
                              <SelectValue placeholder="Select series" />
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
                            <SelectItem value="Glide">Glide</SelectItem>
                            <SelectItem value="Structure">Structure</SelectItem>
                            <SelectItem value="Classic">Classic</SelectItem>
                            <SelectItem value="Skating">Skating</SelectItem>
                            {can("grinding") && (
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
                          <Input {...field} type="date" data-testid="input-test-date" />
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
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-test-location" placeholder="e.g., Park City" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="lg:col-span-4">
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
                            <SelectItem value="__auto__" data-testid="option-weather-auto">
                              Auto
                            </SelectItem>
                            {weather.map((w) => (
                              <SelectItem key={w.id} value={String(w.id)} data-testid={`option-weather-${w.id}`}>
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

        <div>
          <TestEntryTable
            testType={watchTestType}
            products={products}
            rows={rows}
            setRows={setRows}
            distanceLabels={distanceLabels}
            onDistanceLabelsChange={setDistanceLabels}
          />
          <div className="mt-2 text-xs text-muted-foreground" data-testid="text-ranking-hint">
            Ranking uses dense ranking: same result = same rank. Click "+ Round" to add more distance tests.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
