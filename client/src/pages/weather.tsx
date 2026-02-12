import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Thermometer, Droplets, Snowflake, MapPin, Cloud, Wind, Eye, Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const SNOW_STAGES = [
  "Falling new",
  "New",
  "Irreg. dir. new",
  "Irreg. dir. transf.",
  "Transformed",
] as const;

const GRAIN_SIZES = [
  "Extra fine",
  "Very fine",
  "Fine",
  "Average",
  "Coarse",
  "Very coarse",
] as const;

const SNOW_HUMIDITY_TYPES = [
  "Dry",
  "Moist",
  "Wet",
  "Very wet",
  "Slush",
] as const;

const TRACK_HARDNESS = [
  "Very soft",
  "Soft",
  "Medium hard",
  "Hard",
  "Very hard",
  "Ice",
] as const;

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
  createdAt: string;
  createdById: number;
  createdByName: string;
  groupScope: string;
};

const NONE_VALUE = "__none__";

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  location: z.string().min(1, "Location is required"),
  snowTemperatureC: z.coerce.number(),
  airTemperatureC: z.coerce.number(),
  snowHumidityPct: z.coerce.number().min(0).max(100),
  airHumidityPct: z.coerce.number().min(0).max(100),
  clouds: z.coerce.number().min(0).max(8).nullable().optional(),
  visibility: z.string().optional(),
  wind: z.string().optional(),
  precipitation: z.string().optional(),
  artificialSnow: z.string().optional(),
  naturalSnow: z.string().optional(),
  grainSize: z.string().optional(),
  snowHumidityType: z.string().optional(),
  trackHardness: z.string().optional(),
  testQuality: z.coerce.number().min(1).max(10).nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

function WeatherForm({
  initial,
  onSaved,
}: {
  initial?: Weather;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: initial?.date ?? today,
      time: initial?.time ?? "09:30",
      location: initial?.location ?? "",
      snowTemperatureC: initial?.snowTemperatureC ?? 0,
      airTemperatureC: initial?.airTemperatureC ?? 0,
      snowHumidityPct: initial?.snowHumidityPct ?? 50,
      airHumidityPct: initial?.airHumidityPct ?? 50,
      clouds: initial?.clouds ?? null,
      visibility: initial?.visibility ?? "",
      wind: initial?.wind ?? "",
      precipitation: initial?.precipitation ?? "",
      artificialSnow: initial?.artificialSnow ?? "",
      naturalSnow: initial?.naturalSnow ?? "",
      grainSize: initial?.grainSize ?? "",
      snowHumidityType: initial?.snowHumidityType ?? "",
      trackHardness: initial?.trackHardness ?? "",
      testQuality: initial?.testQuality ?? null,
    },
  });

  const preparePayload = (data: FormValues) => ({
    ...data,
    clouds: data.clouds || null,
    visibility: data.visibility || null,
    wind: data.wind || null,
    precipitation: data.precipitation || null,
    artificialSnow: data.artificialSnow || null,
    naturalSnow: data.naturalSnow || null,
    grainSize: data.grainSize || null,
    snowHumidityType: data.snowHumidityType || null,
    trackHardness: data.trackHardness || null,
    testQuality: data.testQuality || null,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/weather", preparePayload(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weather"] });
      toast({ title: "Weather added" });
      onSaved();
    },
    onError: (e) => {
      toast({
        title: "Could not save weather",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("PUT", `/api/weather/${initial!.id}`, preparePayload(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weather"] });
      toast({ title: "Weather updated" });
      onSaved();
    },
    onError: (e) => {
      toast({
        title: "Could not save weather",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          if (initial) {
            updateMutation.mutate(values);
          } else {
            createMutation.mutate(values);
          }
        })}
        className="space-y-5 max-h-[70vh] overflow-y-auto pr-1"
      >
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date & Location</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-weather-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <Input {...field} type="time" data-testid="input-weather-time" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-weather-location" placeholder="e.g., Park City" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Temperature & Humidity</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField
              control={form.control}
              name="snowTemperatureC"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Snow temp (°C)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.1" inputMode="decimal" data-testid="input-weather-snowtemp" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="airTemperatureC"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Air temp (°C)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.1" inputMode="decimal" data-testid="input-weather-airtemp" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="snowHumidityPct"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Snow hum. (Doser)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" inputMode="numeric" data-testid="input-weather-snowhum" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="airHumidityPct"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Air hum. (%rH)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" inputMode="numeric" data-testid="input-weather-airhum" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weather Conditions</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField
              control={form.control}
              name="clouds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clouds (0–8)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={8}
                      inputMode="numeric"
                      data-testid="input-weather-clouds"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-weather-visibility" placeholder="e.g., Good" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="wind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Wind</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-weather-wind" placeholder="e.g., Light NW" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="precipitation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Precipitation</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-weather-precipitation" placeholder="e.g., Light snow" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Snow Type</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="artificialSnow"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Artificial snow</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-weather-artificial-snow">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {SNOW_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="naturalSnow"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Natural snow</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-weather-natural-snow">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {SNOW_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Snow & Track</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField
              control={form.control}
              name="grainSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grain size</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-weather-grain-size">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>—</SelectItem>
                      {GRAIN_SIZES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="snowHumidityType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Snow humidity</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-weather-snow-humidity-type">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>—</SelectItem>
                      {SNOW_HUMIDITY_TYPES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="trackHardness"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Track hardness</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-weather-track-hardness">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>—</SelectItem>
                      {TRACK_HARDNESS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="testQuality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test quality (1–10)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      inputMode="numeric"
                      data-testid="input-weather-test-quality"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" data-testid="button-save-weather">
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
}

function WeatherBadge({ label, value, colorClass }: { label: string; value: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${colorClass}`}>
      {label}: {value}
    </span>
  );
}

export default function WeatherPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Weather | undefined>();

  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">Weather</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-weather-subtitle">
              {weather.length} weather log{weather.length !== 1 ? "s" : ""} · One entry per date and location
            </p>
          </div>

          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setEditing(undefined);
            }}
          >
            <DialogTrigger asChild>
              <Button data-testid="button-add-weather" className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Add weather
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit weather" : "Add weather"}</DialogTitle>
              </DialogHeader>
              <WeatherForm initial={editing} onSaved={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {weather.length === 0 ? (
            <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-weather">
              No weather entries yet.
            </Card>
          ) : (
            weather.map((w) => (
              <Card
                key={w.id}
                className="fs-card rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/5"
                data-testid={`card-weather-${w.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-violet-400" />
                      <span className="text-base font-semibold">{w.location}</span>
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/20">
                        {w.date} · {w.time}
                      </span>
                      {w.testQuality != null && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/20">
                          <Star className="h-3 w-3" /> {w.testQuality}/10
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl fs-gradient-emerald px-3 py-2.5 ring-1 ring-emerald-500/10" data-testid={`text-snowtemp-${w.id}`}>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-300/70">
                          <Thermometer className="h-3 w-3" /> Snow Temp
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-emerald-300">{w.snowTemperatureC}°C</div>
                      </div>
                      <div className="rounded-xl fs-gradient-blue px-3 py-2.5 ring-1 ring-sky-500/10" data-testid={`text-airtemp-${w.id}`}>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-sky-300/70">
                          <Thermometer className="h-3 w-3" /> Air Temp
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-sky-300">{w.airTemperatureC}°C</div>
                      </div>
                      <div className="rounded-xl fs-gradient-amber px-3 py-2.5 ring-1 ring-amber-500/10" data-testid={`text-snowhum-${w.id}`}>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-300/70">
                          <Droplets className="h-3 w-3" /> Snow Hum (Doser)
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-amber-300">{w.snowHumidityPct}%</div>
                      </div>
                      <div className="rounded-xl fs-gradient-violet px-3 py-2.5 ring-1 ring-violet-500/10" data-testid={`text-airhum-${w.id}`}>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-violet-300/70">
                          <Droplets className="h-3 w-3" /> Air Hum
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-violet-300">{w.airHumidityPct}%rH</div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {w.clouds != null && (
                        <WeatherBadge label="Clouds" value={`${w.clouds}/8`} colorClass="bg-slate-500/10 text-slate-300 ring-slate-500/20" />
                      )}
                      {w.visibility && (
                        <WeatherBadge label="Vis" value={w.visibility} colorClass="bg-cyan-500/10 text-cyan-300 ring-cyan-500/20" />
                      )}
                      {w.wind && (
                        <WeatherBadge label="Wind" value={w.wind} colorClass="bg-teal-500/10 text-teal-300 ring-teal-500/20" />
                      )}
                      {w.precipitation && (
                        <WeatherBadge label="Precip" value={w.precipitation} colorClass="bg-blue-500/10 text-blue-300 ring-blue-500/20" />
                      )}
                      {w.artificialSnow && (
                        <WeatherBadge label="Art. snow" value={w.artificialSnow} colorClass="bg-pink-500/10 text-pink-300 ring-pink-500/20" />
                      )}
                      {w.naturalSnow && (
                        <WeatherBadge label="Nat. snow" value={w.naturalSnow} colorClass="bg-sky-500/10 text-sky-300 ring-sky-500/20" />
                      )}
                      {w.grainSize && (
                        <WeatherBadge label="Grain" value={w.grainSize} colorClass="bg-orange-500/10 text-orange-300 ring-orange-500/20" />
                      )}
                      {w.snowHumidityType && (
                        <WeatherBadge label="Snow hum" value={w.snowHumidityType} colorClass="bg-indigo-500/10 text-indigo-300 ring-indigo-500/20" />
                      )}
                      {w.trackHardness && (
                        <WeatherBadge label="Track" value={w.trackHardness} colorClass="bg-rose-500/10 text-rose-300 ring-rose-500/20" />
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        <span className="text-foreground/70">{w.createdByName}</span> · {w.groupScope}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    data-testid={`button-edit-weather-${w.id}`}
                    onClick={() => {
                      setEditing(w);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
