import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ChevronLeft, Save, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/mock-auth";
import {
  createTestWithEntries,
  getWeatherFor,
  listLanes,
  listProducts,
  listSeries,
  listWeather,
  type TestType,
} from "@/lib/mock-db";
import { TestEntryTable, type EntryRow } from "@/components/test-entry-table";

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  seriesId: z.string().min(1, "Select a series"),
  testType: z.enum(["Glide", "Structure"]),
  lane: z.string().min(1, "Select a lane"),
  location: z.string().min(1, "Location is required"),
  weatherId: z.string().optional(),
  notes: z.string().optional(),
});

function makeRows(n = 8): EntryRow[] {
  return Array.from({ length: n }).map((_, i) => ({
    id: `row_${i + 1}_${Math.random().toString(16).slice(2)}`,
    skiNumber: i + 1,
    productId: undefined,
    methodology: "",
    result0kmCmBehind: null,
    rank0km: null,
    resultXkmCmBehind: null,
    rankXkm: null,
  }));
}

export default function NewTest() {
  const user = getCurrentUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const today = new Date().toISOString().slice(0, 10);

  const lanes = useMemo(() => listLanes(), []);
  const series = useMemo(() => (user ? listSeries(user) : []), [user]);
  const products = useMemo(() => (user ? listProducts(user) : []), [user]);
  const weather = useMemo(() => (user ? listWeather(user) : []), [user]);

  const [rows, setRows] = useState<EntryRow[]>(() => makeRows(8));

  const defaultLocation = weather[0]?.location ?? "";
  const defaultWeatherId = weather[0]?.id ?? undefined;

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: today,
      testType: "Glide",
      lane: lanes[0] ?? "Blue 1",
      seriesId: series[0]?.id ?? "",
      location: defaultLocation,
      weatherId: defaultWeatherId,
      notes: "",
    },
  });

  const watchDate = form.watch("date");
  const watchLocation = form.watch("location");
  const watchTestType = form.watch("testType") as TestType;

  const autoWeather = useMemo(() => {
    if (!user) return undefined;
    if (!watchDate || !watchLocation) return undefined;
    return getWeatherFor(watchDate, watchLocation, user);
  }, [user, watchDate, watchLocation]);

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/tests">
              <Button variant="secondary" size="sm" data-testid="button-back-tests">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Tests
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl">New test</h1>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="text-newtest-subtitle">
                Fast, table-first logging with live ranking.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              data-testid="button-add-row"
              onClick={() => setRows((r) => [...r, ...makeRows(1).map((x) => ({ ...x, skiNumber: r.length + 1 }))])}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Add ski
            </Button>
            <Button type="submit" form="new-test-form" data-testid="button-save-test">
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
                try {
                  const chosenWeather = values.weatherId || autoWeather?.id;
                  const test = createTestWithEntries(
                    {
                      date: values.date,
                      location: values.location,
                      weatherId: chosenWeather,
                      testType: values.testType,
                      seriesId: values.seriesId,
                      lane: values.lane,
                      notes: values.notes,
                      entries: rows.map((r) => ({
                        skiNumber: r.skiNumber,
                        productId: r.productId,
                        methodology: r.methodology,
                        result0kmCmBehind: r.result0kmCmBehind,
                        resultXkmCmBehind: r.resultXkmCmBehind,
                      })),
                    },
                    user,
                  );

                  toast({
                    title: "Test saved",
                    description: `Saved ${rows.length} entries.`,
                  });
                  setLocation("/tests");
                  void test;
                } catch (e) {
                  toast({
                    title: "Could not save test",
                    description: e instanceof Error ? e.message : "Unknown error",
                    variant: "destructive",
                  });
                }
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
                              <SelectItem key={s.id} value={s.id} data-testid={`option-series-${s.id}`}>
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
                            // reset products when switching types
                            setRows((prev) => prev.map((r) => ({ ...r, productId: undefined })));
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
                    name="lane"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lane</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-test-lane">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {lanes.map((l) => (
                              <SelectItem key={l} value={l} data-testid={`option-lane-${l}`}>
                                {l}
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
                        <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v)}>
                          <FormControl>
                            <SelectTrigger data-testid="select-test-weather">
                              <SelectValue placeholder={autoWeather ? `Auto: ${autoWeather.location} ${autoWeather.time}` : "Select weather"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="" data-testid="option-weather-none">Auto</SelectItem>
                            {weather.map((w) => (
                              <SelectItem key={w.id} value={w.id} data-testid={`option-weather-${w.id}`}>
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
          <TestEntryTable testType={watchTestType} products={products} rows={rows} setRows={setRows} />
          <div className="mt-2 text-xs text-muted-foreground" data-testid="text-ranking-hint">
            Ranking uses dense ranking: same result = same rank.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
