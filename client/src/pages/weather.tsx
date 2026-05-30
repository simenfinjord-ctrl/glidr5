// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { useState, useMemo } from "react";
import { fmtDate, cn } from "@/lib/utils";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Thermometer, Droplets, Snowflake, MapPin, Cloud, Wind, Eye, Star, Wifi, WifiOff, LayoutGrid, List, Search, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { apiRequest, queryClient, OfflineError } from "@/lib/queryClient";
import { useOffline } from "@/lib/offline-context";
import { useI18n } from "@/lib/i18n";
import { LocationAutocomplete } from "@/components/location-autocomplete";

function snowTypeKey(v: string) {
  const map: Record<string, string> = { "Falling new": "snow.fallingNew", "New": "snow.new", "Irreg. dir. new": "snow.irregDirNew", "Irreg. dir. transf.": "snow.irregDirTransf", "Transformed": "snow.transformed" };
  return map[v] ?? v;
}
function grainSizeKey(v: string) {
  const map: Record<string, string> = { "Extra fine": "grain.extraFine", "Very fine": "grain.veryFine", "Fine": "grain.fine", "Average": "grain.average", "Coarse": "grain.coarse", "Very coarse": "grain.veryCoarse" };
  return map[v] ?? v;
}
function snowHumidityKey(v: string) {
  const map: Record<string, string> = { "Dry": "humidity.dry", "Moist": "humidity.moist", "Wet": "humidity.wet", "Very wet": "humidity.veryWet", "Slush": "humidity.slush" };
  return map[v] ?? v;
}
function trackHardnessKey(v: string) {
  const map: Record<string, string> = { "Very soft": "hardness.verySoft", "Soft": "hardness.soft", "Medium hard": "hardness.mediumHard", "Hard": "hardness.hard", "Very hard": "hardness.veryHard", "Ice": "hardness.ice" };
  return map[v] ?? v;
}

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

const WEATHER_LAST_GROUP_KEY = "glidr-weather-last-group";
const WEATHER_VIEW_MODE_KEY = "glidr-weather-view-mode";

function WeatherForm({
  initial,
  onSaved,
  userGroups,
  selectedGroup,
  onGroupChange,
}: {
  initial?: Weather;
  onSaved: () => void;
  userGroups: string[];
  selectedGroup: string;
  onGroupChange: (group: string) => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { queueMutation } = useOffline();
  const today = new Date().toISOString().slice(0, 10);
  const [fetchingStation, setFetchingStation] = useState(false);

  const { data: stationConfig } = useQuery<{ connected: boolean; stationType: string | null; stationLabel: string | null }>({
    queryKey: ["/api/weather-station/config"],
  });

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
    groupScope: selectedGroup,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      try {
        const res = await apiRequest("POST", "/api/weather", preparePayload(data));
        return res.json();
      } catch (err) {
        if (err instanceof OfflineError) {
          await queueMutation(err.method, err.url, err.body, "Save weather entry");
          return { offline: true };
        }
        throw err;
      }
    },
    onSuccess: (result) => {
      if (result?.offline) {
        toast({ title: "Saved offline", description: "Will sync when you reconnect." });
        onSaved();
        return;
      }
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
        {userGroups.length > 1 && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Group</h3>
            <Select
              value={selectedGroup}
              onValueChange={(v) => onGroupChange(v)}
            >
              <SelectTrigger data-testid="select-weather-group">
                <SelectValue placeholder={t("weather.selectGroup")} />
              </SelectTrigger>
              <SelectContent>
                {userGroups.map((g) => (
                  <SelectItem key={g} value={g} data-testid={`option-weather-group-${g}`}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date & Location</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("weather.date")}</FormLabel>
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
                  <FormLabel>{t("weather.time")}</FormLabel>
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
                  <FormLabel>{t("weather.location")}</FormLabel>
                  <FormControl>
                    <LocationAutocomplete
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t("weather.locationPlaceholder")}
                      data-testid="input-weather-location"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {stationConfig?.connected && (
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fetchingStation}
                onClick={async () => {
                  const date = form.getValues("date");
                  const time = form.getValues("time");
                  if (!date || !time) {
                    toast({ title: "Date and time required", variant: "destructive" });
                    return;
                  }
                  setFetchingStation(true);
                  try {
                    const res = await apiRequest("GET", `/api/weather-station/fetch?date=${date}&time=${time}`);
                    const result = await res.json();
                    const filled: string[] = [];
                    if (result.airTemperatureC != null) { form.setValue("airTemperatureC", result.airTemperatureC); filled.push("air temp"); }
                    if (result.snowTemperatureC != null) { form.setValue("snowTemperatureC", result.snowTemperatureC); filled.push("snow temp"); }
                    if (result.airHumidityPct != null) { form.setValue("airHumidityPct", result.airHumidityPct); filled.push("air humidity"); }
                    if (result.snowHumidityPct != null) { form.setValue("snowHumidityPct", result.snowHumidityPct); filled.push("snow humidity"); }
                    if (result.wind != null) { form.setValue("wind", result.wind); filled.push("wind"); }
                    if (result.precipitation != null) { form.setValue("precipitation", result.precipitation); filled.push("precipitation"); }
                    if (result.clouds != null) { form.setValue("clouds", result.clouds); filled.push("clouds"); }
                    if (result.visibility != null) { form.setValue("visibility", result.visibility); filled.push("visibility"); }
                    toast({
                      title: t("weatherStation.fetchSuccess"),
                      description: filled.length ? filled.join(", ") : "No data returned",
                    });
                  } catch (err) {
                    toast({ title: t("weatherStation.testFailed"), variant: "destructive" });
                  } finally {
                    setFetchingStation(false);
                  }
                }}
              >
                <Wifi className="mr-1.5 h-3.5 w-3.5" />
                {fetchingStation ? "Fetching…" : t("weatherStation.fetchFromStation")}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Temperature & Humidity</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormField
              control={form.control}
              name="snowTemperatureC"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("weather.snowTemp")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.1" data-testid="input-weather-snowtemp" />
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
                  <FormLabel>{t("weather.airTemp")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.1" data-testid="input-weather-airtemp" />
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
                  <FormLabel>{t("weather.snowHumidity")}</FormLabel>
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
                  <FormLabel>{t("weather.airHumidity")}</FormLabel>
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
                  <FormLabel>{t("weather.clouds")}</FormLabel>
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
                  <FormLabel>{t("weather.visibility")}</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-weather-visibility" placeholder={t("weather.visibilityPlaceholder")} />
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
                  <FormLabel>{t("weather.wind")}</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-weather-wind" placeholder={t("weather.windPlaceholder")} />
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
                  <FormLabel>{t("weather.precipitation")}</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-weather-precipitation" placeholder={t("weather.precipPlaceholder")} />
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
                  <FormLabel>{t("weather.artificialSnow")}</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-weather-artificial-snow">
                        <SelectValue placeholder={t("weather.noneOption")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>{t("weather.noneOption")}</SelectItem>
                      {SNOW_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{t(snowTypeKey(s))}</SelectItem>
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
                  <FormLabel>{t("weather.naturalSnow")}</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-weather-natural-snow">
                        <SelectValue placeholder={t("weather.noneOption")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>{t("weather.noneOption")}</SelectItem>
                      {SNOW_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{t(snowTypeKey(s))}</SelectItem>
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
                  <FormLabel>{t("weather.grainSize")}</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-weather-grain-size">
                        <SelectValue placeholder={t("weather.selectOption")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>—</SelectItem>
                      {GRAIN_SIZES.map((s) => (
                        <SelectItem key={s} value={s}>{t(grainSizeKey(s))}</SelectItem>
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
                  <FormLabel>{t("weather.snowHumidityType")}</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-weather-snow-humidity-type">
                        <SelectValue placeholder={t("weather.selectOption")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>—</SelectItem>
                      {SNOW_HUMIDITY_TYPES.map((s) => (
                        <SelectItem key={s} value={s}>{t(snowHumidityKey(s))}</SelectItem>
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
                  <FormLabel>{t("weather.trackHardness")}</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-weather-track-hardness">
                        <SelectValue placeholder={t("weather.selectOption")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>—</SelectItem>
                      {TRACK_HARDNESS.map((s) => (
                        <SelectItem key={s} value={s}>{t(trackHardnessKey(s))}</SelectItem>
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
                  <FormLabel>{t("weather.testQuality")}</FormLabel>
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
            {t("common.save")}
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

// ── Weather station config fields per type ────────────────────────────────────

const STATION_TYPES = [
  { value: "netatmo", labelKey: "weatherStation.netatmo" },
  { value: "davis", labelKey: "weatherStation.davis" },
  { value: "ambient", labelKey: "weatherStation.ambient" },
  { value: "ecowitt", labelKey: "weatherStation.ecowitt" },
  { value: "wunderground", labelKey: "weatherStation.wunderground" },
  { value: "openmeteo", labelKey: "weatherStation.openmeteo" },
  { value: "generic", labelKey: "weatherStation.generic" },
] as const;

type StationType = (typeof STATION_TYPES)[number]["value"];

function StationFields({ stationType, config, onChange }: {
  stationType: StationType;
  config: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const { t } = useI18n();

  const field = (key: string, labelKey: string, type: "text" | "password" = "text", placeholder?: string) => (
    <div className="space-y-1" key={key}>
      <label className="text-sm font-medium">{t(labelKey)}</label>
      <Input
        type={type}
        value={config[key] ?? ""}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  if (stationType === "netatmo") return (
    <div className="space-y-3">
      {field("clientId", "weatherStation.clientId")}
      {field("clientSecret", "weatherStation.clientSecret", "password")}
      {field("username", "weatherStation.username")}
      {field("password", "weatherStation.password", "password")}
      {field("deviceId", "weatherStation.deviceId")}
    </div>
  );

  if (stationType === "davis") return (
    <div className="space-y-3">
      {field("apiKey", "weatherStation.apiKey")}
      {field("apiSecret", "weatherStation.apiSecret", "password")}
      {field("stationId", "weatherStation.stationId")}
    </div>
  );

  if (stationType === "ambient") return (
    <div className="space-y-3">
      {field("applicationKey", "weatherStation.applicationKey")}
      {field("apiKey", "weatherStation.apiKey")}
      {field("macAddress", "weatherStation.macAddress")}
    </div>
  );

  if (stationType === "ecowitt") return (
    <div className="space-y-3">
      {field("applicationKey", "weatherStation.applicationKey")}
      {field("apiKey", "weatherStation.apiKey")}
      {field("mac", "weatherStation.macAddress")}
    </div>
  );

  if (stationType === "wunderground") return (
    <div className="space-y-3">
      {field("apiKey", "weatherStation.apiKey")}
      {field("stationId", "weatherStation.stationId")}
    </div>
  );

  if (stationType === "openmeteo") return (
    <div className="space-y-3">
      {field("latitude", "weatherStation.latitude", "text", "e.g. 59.91")}
      {field("longitude", "weatherStation.longitude", "text", "e.g. 10.75")}
    </div>
  );

  if (stationType === "generic") return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium">{t("weatherStation.urlTemplate")}</label>
        <Input
          value={config["urlTemplate"] ?? ""}
          onChange={(e) => onChange("urlTemplate", e.target.value)}
          placeholder="https://mystation.example.com/data?date={date}&time={time}"
        />
        <p className="text-xs text-muted-foreground">{t("weatherStation.urlTemplateHelp")}</p>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">{t("weatherStation.authType")}</label>
        <Select value={config["authType"] ?? "none"} onValueChange={(v) => onChange("authType", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("weatherStation.authNone")}</SelectItem>
            <SelectItem value="bearer">{t("weatherStation.authBearer")}</SelectItem>
            <SelectItem value="basic">{t("weatherStation.authBasic")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {config["authType"] === "bearer" && (
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("weatherStation.bearerToken")}</label>
          <Input
            type="password"
            value={config["bearerToken"] ?? ""}
            onChange={(e) => onChange("bearerToken", e.target.value)}
          />
        </div>
      )}
      {config["authType"] === "basic" && (
        <>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("weatherStation.username")}</label>
            <Input value={config["basicUsername"] ?? ""} onChange={(e) => onChange("basicUsername", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("weatherStation.password")}</label>
            <Input type="password" value={config["basicPassword"] ?? ""} onChange={(e) => onChange("basicPassword", e.target.value)} />
          </div>
        </>
      )}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("weatherStation.fieldMapping")}</p>
        {(["fieldAirTemp", "fieldSnowTemp", "fieldAirHumidity", "fieldWind", "fieldPrecipitation"] as const).map((fk) => {
          const configKey = fk === "fieldAirTemp" ? "fieldMap.airTemperatureC"
            : fk === "fieldSnowTemp" ? "fieldMap.snowTemperatureC"
            : fk === "fieldAirHumidity" ? "fieldMap.airHumidityPct"
            : fk === "fieldWind" ? "fieldMap.wind"
            : "fieldMap.precipitation";
          return (
            <div className="space-y-1" key={fk}>
              <label className="text-sm font-medium">{t(`weatherStation.${fk}`)}</label>
              <Input
                value={config[configKey] ?? ""}
                onChange={(e) => onChange(configKey, e.target.value)}
                placeholder="e.g. data.temperature"
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  return null;
}

// For generic type, extract fieldMap.* keys into nested object
function buildConfig(stationType: string, flat: Record<string, string>): Record<string, any> {
  if (stationType !== "generic") return { ...flat };
  const result: Record<string, any> = {};
  const fieldMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (k.startsWith("fieldMap.")) {
      fieldMap[k.replace("fieldMap.", "")] = v;
    } else {
      result[k] = v;
    }
  }
  if (Object.keys(fieldMap).length) result.fieldMap = fieldMap;
  return result;
}

function WeatherStationDialog() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [stationType, setStationType] = useState<StationType | "">("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: stationStatus, refetch: refetchStatus } = useQuery<{
    connected: boolean;
    stationType: string | null;
    stationLabel: string | null;
  }>({ queryKey: ["/api/weather-station/config"] });

  const handleConfigChange = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && stationStatus?.stationType) {
      setStationType(stationStatus.stationType as StationType);
    } else if (!isOpen) {
      setConfig({});
    }
  };

  const handleTest = async () => {
    if (!stationType) return;
    setTesting(true);
    try {
      // Build fieldMap for generic type
      const builtConfig = buildConfig(stationType, config);
      const res = await apiRequest("POST", "/api/weather-station/test", {
        stationType,
        config: builtConfig,
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: t("weatherStation.testSuccess"), description: JSON.stringify(data.sample) });
      } else {
        toast({ title: t("weatherStation.testFailed"), description: data.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: t("weatherStation.testFailed"), description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!stationType) return;
    setSaving(true);
    try {
      const builtConfig = buildConfig(stationType, config);
      await apiRequest("PUT", "/api/weather-station/config", {
        stationType,
        config: builtConfig,
      });
      await refetchStatus();
      toast({ title: t("weatherStation.connected") });
      setOpen(false);
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/weather-station/config", { stationType: null, config: null });
      await refetchStatus();
      toast({ title: t("weatherStation.disconnect") });
      setOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {stationStatus?.connected ? (
            <>
              <Wifi className="mr-1.5 h-4 w-4 text-emerald-500" />
              <span className="hidden sm:inline">{t("weatherStation.connected")}</span>
            </>
          ) : (
            <>
              <WifiOff className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">{t("weatherStation.connect")}</span>
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {stationStatus?.connected ? t("weatherStation.connected") : t("weatherStation.connect")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {stationStatus?.connected && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <Wifi className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-700">
                {STATION_TYPES.find((s) => s.value === stationStatus.stationLabel)
                  ? t(STATION_TYPES.find((s) => s.value === stationStatus.stationLabel)!.labelKey)
                  : stationStatus.stationLabel}
              </span>
              <Badge variant="secondary" className="ml-auto text-emerald-700 bg-emerald-100">
                {t("weatherStation.connected")}
              </Badge>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("weatherStation.stationType")}</label>
            <Select value={stationType} onValueChange={(v) => { setStationType(v as StationType); setConfig({}); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a station type…" />
              </SelectTrigger>
              <SelectContent>
                {STATION_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {stationType && (
            <StationFields
              stationType={stationType as StationType}
              config={config}
              onChange={handleConfigChange}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {stationStatus?.connected && (
              <Button variant="destructive" size="sm" disabled={saving} onClick={handleDisconnect}>
                <WifiOff className="mr-1.5 h-4 w-4" />
                {t("weatherStation.disconnect")}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              {stationType && (
                <Button variant="outline" size="sm" disabled={testing} onClick={handleTest}>
                  {testing ? "Testing…" : t("weatherStation.testConnection")}
                </Button>
              )}
              {stationType && (
                <Button size="sm" disabled={saving} onClick={handleSave}>
                  {saving ? "Saving…" : t("weatherStation.save")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WeatherPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Weather | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<Weather | undefined>();
  const [viewMode, setViewMode] = useState<"card" | "list">(() => {
    try {
      const v = localStorage.getItem(WEATHER_VIEW_MODE_KEY);
      if (v === "list" || v === "card") return v;
    } catch {}
    return "card";
  });
  const [locationSearch, setLocationSearch] = useState("");

  function setView(mode: "card" | "list") {
    setViewMode(mode);
    try { localStorage.setItem(WEATHER_VIEW_MODE_KEY, mode); } catch {}
  }

  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: groups = [] } = useQuery<{ id: number; name: string }[]>({ queryKey: ["/api/groups"] });

  const userGroups = useMemo(() => {
    if (user?.isAdmin && groups.length > 0) {
      return groups.map((g) => g.name);
    }
    return (user?.groupScope ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }, [user, groups]);

  const [selectedGroup, setSelectedGroup] = useState<string>(() => {
    const stored = localStorage.getItem(WEATHER_LAST_GROUP_KEY);
    return stored || "";
  });

  const effectiveGroup = useMemo(() => {
    if (selectedGroup && userGroups.includes(selectedGroup)) return selectedGroup;
    return userGroups[0] ?? "";
  }, [selectedGroup, userGroups]);

  const filteredWeather = useMemo(() => {
    if (!locationSearch.trim()) return weather;
    const q = locationSearch.trim().toLowerCase();
    return weather.filter((w) => w.location.toLowerCase().includes(q));
  }, [weather, locationSearch]);

  const handleGroupChange = (group: string) => {
    setSelectedGroup(group);
    localStorage.setItem(WEATHER_LAST_GROUP_KEY, group);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/weather/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weather"] });
      toast({ title: "Weather log deleted" });
      setConfirmDelete(undefined);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("weather.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-weather-subtitle">
              {t("weather.subtitle", { count: weather.length })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(user?.isTeamAdmin || user?.isAdmin) && <WeatherStationDialog />}
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
                {t("weather.addEntry")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{editing ? t("weather.addEntry") : t("weather.addEntry")}</DialogTitle>
              </DialogHeader>
              <WeatherForm initial={editing} onSaved={() => setOpen(false)} userGroups={userGroups} selectedGroup={effectiveGroup} onGroupChange={handleGroupChange} />
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Search + view toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <LocationAutocomplete
              value={locationSearch}
              onChange={setLocationSearch}
              placeholder="Search location…"
              searchMode
              data-testid="input-weather-search"
              inputClassName="h-8 text-sm"
            />
            {locationSearch && (
              <button
                onClick={() => setLocationSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setView("card")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium transition-colors",
                viewMode === "card"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
              title="Card view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium transition-colors",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>

        {/* No results from search */}
        {weather.length > 0 && filteredWeather.length === 0 && (
          <Card className="fs-card rounded-2xl">
            <EmptyState
              icon={Search}
              title="No results"
              description={`No weather entries found for "${locationSearch}".`}
            />
          </Card>
        )}

        {/* ── List view ── */}
        {viewMode === "list" && filteredWeather.length > 0 && (
          <Card className="fs-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Location</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Snow °C</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Air °C</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Snow Hum</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Air Hum</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Conditions</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Quality</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredWeather.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-weather-${w.id}`}>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        <div>{fmtDate(w.date)}</div>
                        <div className="text-[10px] opacity-60">{w.time}</div>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground max-w-[140px] truncate">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-violet-500 shrink-0" />
                          <span className="truncate">{w.location}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">{w.snowTemperatureC}°</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-sky-600 dark:text-sky-400">{w.airTemperatureC}°</td>
                      <td className="px-3 py-2.5 text-right text-xs text-muted-foreground hidden sm:table-cell">{w.snowHumidityPct}%</td>
                      <td className="px-3 py-2.5 text-right text-xs text-muted-foreground hidden sm:table-cell">{w.airHumidityPct}%</td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {w.trackHardness && (
                            <span className="rounded-full bg-rose-50 dark:bg-rose-900/20 px-1.5 py-0.5 text-[10px] text-rose-700 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-800">
                              {w.trackHardness}
                            </span>
                          )}
                          {w.snowHumidityType && (
                            <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800">
                              {w.snowHumidityType}
                            </span>
                          )}
                          {w.wind && (
                            <span className="rounded-full bg-teal-50 dark:bg-teal-900/20 px-1.5 py-0.5 text-[10px] text-teal-700 dark:text-teal-400 ring-1 ring-teal-200 dark:ring-teal-800">
                              💨 {w.wind}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                        {w.testQuality != null ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-500">
                            <Star className="h-3 w-3" />{w.testQuality}/10
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            data-testid={`button-edit-weather-${w.id}`}
                            onClick={() => { setEditing(w); setOpen(true); }}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            data-testid={`button-delete-weather-${w.id}`}
                            onClick={() => setConfirmDelete(w)}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── Card view ── */}
        <div className={cn("grid grid-cols-1 gap-3", viewMode !== "card" && "hidden")}>
          {weather.length === 0 ? (
            <Card className="fs-card rounded-2xl" data-testid="empty-weather">
              <EmptyState
                icon={Cloud}
                title={t("weather.noEntries")}
                description="Add your first weather entry using the button above."
              />
            </Card>
          ) : (
            filteredWeather.map((w) => (
              <Card
                key={w.id}
                className="fs-card rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/5"
                data-testid={`card-weather-${w.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-violet-600" />
                      <span className="text-base font-semibold">{w.location}</span>
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200">
                        {fmtDate(w.date)} · {w.time}
                      </span>
                      {w.testQuality != null && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-200">
                          <Star className="h-3 w-3" /> {w.testQuality}/10
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl fs-gradient-emerald px-3 py-2.5 ring-1 ring-emerald-500/10" data-testid={`text-snowtemp-${w.id}`}>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700/70">
                          <Thermometer className="h-3 w-3" /> Snow Temp
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-emerald-700">{w.snowTemperatureC}°C</div>
                      </div>
                      <div className="rounded-xl fs-gradient-blue px-3 py-2.5 ring-1 ring-sky-500/10" data-testid={`text-airtemp-${w.id}`}>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-sky-700/70">
                          <Thermometer className="h-3 w-3" /> Air Temp
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-sky-700">{w.airTemperatureC}°C</div>
                      </div>
                      <div className="rounded-xl fs-gradient-amber px-3 py-2.5 ring-1 ring-amber-500/10" data-testid={`text-snowhum-${w.id}`}>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-300/70">
                          <Droplets className="h-3 w-3" /> Snow Hum (Doser)
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-amber-300">{w.snowHumidityPct}%</div>
                      </div>
                      <div className="rounded-xl fs-gradient-violet px-3 py-2.5 ring-1 ring-violet-500/10" data-testid={`text-airhum-${w.id}`}>
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-violet-700/70">
                          <Droplets className="h-3 w-3" /> Air Hum
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-violet-700">{w.airHumidityPct}%rH</div>
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
                        <WeatherBadge label="Precip" value={w.precipitation} colorClass="bg-blue-50 text-blue-300 ring-blue-200" />
                      )}
                      {w.artificialSnow && (
                        <WeatherBadge label="Art. snow" value={w.artificialSnow} colorClass="bg-pink-50 text-pink-700 ring-pink-200" />
                      )}
                      {w.naturalSnow && (
                        <WeatherBadge label="Nat. snow" value={w.naturalSnow} colorClass="bg-sky-50 text-sky-700 ring-sky-200" />
                      )}
                      {w.grainSize && (
                        <WeatherBadge label="Grain" value={w.grainSize} colorClass="bg-orange-500/10 text-orange-300 ring-orange-500/20" />
                      )}
                      {w.snowHumidityType && (
                        <WeatherBadge label="Snow hum" value={w.snowHumidityType} colorClass="bg-indigo-50 text-indigo-700 ring-indigo-500/20" />
                      )}
                      {w.trackHardness && (
                        <WeatherBadge label="Track" value={w.trackHardness} colorClass="bg-rose-50 text-rose-300 ring-rose-200" />
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        <span className="text-foreground/70">{w.createdByName}</span> · {w.groupScope}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
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
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10"
                      data-testid={`button-delete-weather-${w.id}`}
                      onClick={() => setConfirmDelete(w)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <Dialog open={!!confirmDelete} onOpenChange={(v) => { if (!v) setConfirmDelete(undefined); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>{t("common.delete")}</DialogTitle></DialogHeader>
            {confirmDelete && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete the weather log for <span className="font-medium text-foreground">{confirmDelete.location}</span> on <span className="font-medium text-foreground">{fmtDate(confirmDelete.date)}</span>?
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setConfirmDelete(undefined)}>{t("common.cancel")}</Button>
                  <Button
                    variant="destructive"
                    data-testid="button-confirm-delete-weather"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(confirmDelete.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
