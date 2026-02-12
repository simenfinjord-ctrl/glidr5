import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, Save, Sparkles } from "lucide-react";
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
import { TestEntryTable, type EntryRow } from "@/components/test-entry-table";
import { Spinner } from "@/components/ui/spinner";

type TestType = "Glide" | "Structure";

type Test = {
  id: number;
  date: string;
  location: string;
  weatherId: number | null;
  testType: string;
  seriesId: number;
  notes: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
};

type Series = {
  id: number;
  name: string;
  type: string;
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
  feelingRank: number | null;
};

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  seriesId: z.string().min(1, "Select a series"),
  testType: z.enum(["Glide", "Structure"]),
  location: z.string().min(1, "Location is required"),
  weatherId: z.string().optional(),
  notes: z.string().optional(),
  distanceLabel0km: z.string().optional(),
  distanceLabelXkm: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function EditTest() {
  const [, params] = useRoute("/tests/:id/edit");
  const testId = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [initialized, setInitialized] = useState(false);

  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: test, isLoading: testLoading } = useQuery<Test>({
    queryKey: [`/api/tests/${testId}`],
    enabled: !!testId,
  });
  const { data: entries = [] } = useQuery<TestEntry[]>({
    queryKey: [`/api/tests/${testId}/entries`],
    enabled: !!testId,
  });

  const [rows, setRows] = useState<EntryRow[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: "",
      testType: "Glide",
      seriesId: "",
      location: "",
      weatherId: undefined,
      notes: "",
    },
  });

  useEffect(() => {
    if (!test || initialized) return;
    form.reset({
      date: test.date,
      testType: test.testType as "Glide" | "Structure",
      seriesId: String(test.seriesId),
      location: test.location,
      weatherId: test.weatherId ? String(test.weatherId) : undefined,
      notes: test.notes || "",
      distanceLabel0km: test.distanceLabel0km || "",
      distanceLabelXkm: test.distanceLabelXkm || "",
    });
    setInitialized(true);
  }, [test, initialized, form]);

  useEffect(() => {
    if (!entries.length || rows.length > 0) return;
    setRows(
      entries.map((e, i) => ({
        id: `row_${i}_${e.id}`,
        skiNumber: e.skiNumber,
        productId: e.productId ?? undefined,
        additionalProductIds: e.additionalProductIds ?? undefined,
        methodology: e.methodology,
        result0kmCmBehind: e.result0kmCmBehind,
        rank0km: e.rank0km,
        resultXkmCmBehind: e.resultXkmCmBehind,
        rankXkm: e.rankXkm,
        feelingRank: e.feelingRank ?? null,
      }))
    );
  }, [entries, rows.length]);

  const watchTestType = form.watch("testType") as TestType;
  const watchDate = form.watch("date");
  const watchLocation = form.watch("location");

  const autoWeather = useMemo(() => {
    if (!watchDate || !watchLocation) return undefined;
    return weather.find(
      (w) =>
        w.date === watchDate &&
        w.location.toLowerCase() === watchLocation.trim().toLowerCase(),
    );
  }, [weather, watchDate, watchLocation]);

  const saveMutation = useMutation({
    mutationFn: async (data: {
      date: string;
      location: string;
      weatherId?: number;
      testType: string;
      seriesId: number;
      notes?: string;
      distanceLabel0km?: string;
      distanceLabelXkm?: string;
      entries: Array<{
        skiNumber: number;
        productId?: number;
        additionalProductIds?: string;
        methodology: string;
        result0kmCmBehind: number | null;
        resultXkmCmBehind?: number | null;
        feelingRank?: number | null;
      }>;
    }) => {
      const res = await apiRequest("PUT", `/api/tests/${testId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${testId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${testId}/entries`] });
      toast({
        title: "Test updated",
        description: `Updated ${rows.length} entries.`,
      });
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
                    result0kmCmBehind: null,
                    rank0km: null,
                    resultXkmCmBehind: null,
                    rankXkm: null,
                    feelingRank: null,
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
              disabled={saveMutation.isPending}
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
                saveMutation.mutate({
                  date: values.date,
                  location: values.location,
                  weatherId: chosenWeatherId,
                  testType: values.testType,
                  seriesId: Number(values.seriesId),
                  notes: values.notes,
                  distanceLabel0km: values.distanceLabel0km || undefined,
                  distanceLabelXkm: values.distanceLabelXkm || undefined,
                  entries: rows.map((r) => ({
                    skiNumber: r.skiNumber,
                    productId: r.productId,
                    additionalProductIds: r.additionalProductIds,
                    methodology: r.methodology,
                    result0kmCmBehind: r.result0kmCmBehind,
                    resultXkmCmBehind: r.resultXkmCmBehind,
                    feelingRank: r.feelingRank,
                  })),
                });
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
                            {series.map((s) => (
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

                <div className="lg:col-span-2">
                  <FormField
                    control={form.control}
                    name="distanceLabel0km"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Distance 1 label</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="0 km"
                            data-testid="input-distance-label-0"
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
                    name="distanceLabelXkm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Distance 2 label</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="X km"
                            data-testid="input-distance-label-x"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="lg:col-span-8">
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
            distanceLabel0km={form.watch("distanceLabel0km")}
            distanceLabelXkm={form.watch("distanceLabelXkm")}
          />
          <div className="mt-2 text-xs text-muted-foreground" data-testid="text-ranking-hint">
            Ranking uses dense ranking: same result = same rank.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
