import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { CloudSun } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ── Option lists (mirrored from weather.tsx) ─────────────────────────────────
const SNOW_STAGES = ["Falling new", "New", "Irreg. dir. new", "Irreg. dir. transf.", "Transformed"] as const;
const GRAIN_SIZES = ["Extra fine", "Very fine", "Fine", "Average", "Coarse", "Very coarse"] as const;
const SNOW_HUMIDITY_TYPES = ["Dry", "Moist", "Wet", "Very wet", "Slush"] as const;
const TRACK_HARDNESS = ["Very soft", "Soft", "Medium hard", "Hard", "Very hard", "Ice"] as const;
const NONE = "__none__";

function snowTypeKey(v: string) {
  const m: Record<string, string> = { "Falling new": "snow.fallingNew", "New": "snow.new", "Irreg. dir. new": "snow.irregDirNew", "Irreg. dir. transf.": "snow.irregDirTransf", "Transformed": "snow.transformed" };
  return m[v] ?? v;
}
function grainSizeKey(v: string) {
  const m: Record<string, string> = { "Extra fine": "grain.extraFine", "Very fine": "grain.veryFine", "Fine": "grain.fine", "Average": "grain.average", "Coarse": "grain.coarse", "Very coarse": "grain.veryCoarse" };
  return m[v] ?? v;
}
function snowHumidityKey(v: string) {
  const m: Record<string, string> = { "Dry": "humidity.dry", "Moist": "humidity.moist", "Wet": "humidity.wet", "Very wet": "humidity.veryWet", "Slush": "humidity.slush" };
  return m[v] ?? v;
}
function trackHardnessKey(v: string) {
  const m: Record<string, string> = { "Very soft": "hardness.verySoft", "Soft": "hardness.soft", "Medium hard": "hardness.mediumHard", "Hard": "hardness.hard", "Very hard": "hardness.veryHard", "Ice": "hardness.ice" };
  return m[v] ?? v;
}

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  date: z.string().min(1),
  time: z.string().min(1),
  location: z.string().min(1),
  snowTemperatureC: z.coerce.number(),
  airTemperatureC: z.coerce.number(),
  snowHumidityPct: z.preprocess((v) => v === "" || v == null ? null : Number(v), z.number().min(0).max(100).nullable()),
  airHumidityPct: z.preprocess((v) => v === "" || v == null ? null : Number(v), z.number().min(0).max(100).nullable()),
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

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (weatherId: number) => void;
  /** Snapshot of test form values captured at click time */
  defaults?: {
    date?: string;
    time?: string;
    location?: string;
    groupScope?: string;
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ManualWeatherDialog({ open, onClose, onCreated, defaults }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);

  const blankValues = {
    snowTemperatureC: 0 as number,
    airTemperatureC: 0 as number,
    snowHumidityPct: null as null,
    airHumidityPct: null as null,
    clouds: null as null,
    visibility: "",
    wind: "",
    precipitation: "",
    artificialSnow: "",
    naturalSnow: "",
    grainSize: "",
    snowHumidityType: "",
    trackHardness: "",
    testQuality: null as null,
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: defaults?.date ?? todayStr,
      time: defaults?.time ?? timeStr,
      location: defaults?.location ?? "",
      ...blankValues,
    },
  });

  // Reset form with the latest defaults snapshot every time the dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      form.reset({
        date: defaults?.date ?? todayStr,
        time: defaults?.time ?? timeStr,
        location: defaults?.location ?? "",
        ...blankValues,
      });
    } else {
      onClose();
    }
  };

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        artificialSnow: values.artificialSnow || null,
        naturalSnow: values.naturalSnow || null,
        grainSize: values.grainSize || null,
        snowHumidityType: values.snowHumidityType || null,
        trackHardness: values.trackHardness || null,
        visibility: values.visibility || null,
        wind: values.wind || null,
        precipitation: values.precipitation || null,
        clouds: values.clouds ?? null,
        testQuality: values.testQuality ?? null,
        groupScope: defaults?.groupScope ?? user?.groupScope?.split(",")[0].trim() ?? "",
      };
      // Use /for-test endpoint — requires test edit permission (not weather edit permission)
      const res = await apiRequest("POST", "/api/weather/for-test", payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/weather"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weather/for-filtering"] });
      toast({ title: t("weather.created") ?? "Weather saved", description: `${data.location} · ${data.date} · ${data.time}` });
      onCreated(data.id);
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save weather.", variant: "destructive" });
    },
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudSun className="h-4 w-4 text-sky-500" />
            {t("newTest.addManualWeather") ?? "Add weather conditions"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* ── Basic info ── */}
            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("weather.date")}</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="time" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("weather.time")}</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("weather.location")}</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Beitostølen" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* ── Temperature & humidity ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("weather.sectionTemperature") ?? "Temperature & Humidity"}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <FormField control={form.control} name="snowTemperatureC" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.snowTemp")}</FormLabel>
                    <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="airTemperatureC" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.airTemp")}</FormLabel>
                    <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="snowHumidityPct" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.snowHumidity")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number" min={0} max={100} step="0.1"
                        placeholder="—"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="airHumidityPct" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.airHumidity")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number" min={0} max={100} step="0.1"
                        placeholder="—"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* ── Conditions ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("weather.sectionConditions") ?? "Conditions"}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <FormField control={form.control} name="clouds" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.clouds")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={8} inputMode="numeric" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="visibility" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.visibility")}</FormLabel>
                    <FormControl><Input {...field} placeholder={t("weather.visibilityPlaceholder") ?? "e.g. Good"} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="wind" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.wind")}</FormLabel>
                    <FormControl><Input {...field} placeholder={t("weather.windPlaceholder") ?? "e.g. 3 m/s"} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="precipitation" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.precipitation")}</FormLabel>
                    <FormControl><Input {...field} placeholder={t("weather.precipPlaceholder") ?? "e.g. None"} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* ── Snow type ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("weather.sectionSnowType") ?? "Snow Type"}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(["artificialSnow", "naturalSnow"] as const).map((name) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t(`weather.${name}`) ?? name}</FormLabel>
                      <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder={t("weather.noneOption") ?? "—"} /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>{t("weather.noneOption") ?? "—"}</SelectItem>
                          {SNOW_STAGES.map((s) => <SelectItem key={s} value={s}>{t(snowTypeKey(s))}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                ))}
              </div>
            </div>

            {/* ── Snow & track ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("weather.sectionSnowTrack") ?? "Snow & Track"}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <FormField control={form.control} name="grainSize" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.grainSize")}</FormLabel>
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {GRAIN_SIZES.map((s) => <SelectItem key={s} value={s}>{t(grainSizeKey(s))}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="snowHumidityType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.snowHumidityType")}</FormLabel>
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {SNOW_HUMIDITY_TYPES.map((s) => <SelectItem key={s} value={s}>{t(snowHumidityKey(s))}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="trackHardness" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.trackHardness")}</FormLabel>
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {TRACK_HARDNESS.map((s) => <SelectItem key={s} value={s}>{t(trackHardnessKey(s))}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="testQuality" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("weather.testQuality")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={10} inputMode="numeric" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                {t("common.cancel") ?? "Cancel"}
              </Button>
              <Button type="submit" size="sm" disabled={mutation.isPending}>
                <CloudSun className="mr-1.5 h-3.5 w-3.5" />
                {mutation.isPending ? (t("common.saving") ?? "Saving…") : (t("newTest.saveWeather") ?? "Save & link weather")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
