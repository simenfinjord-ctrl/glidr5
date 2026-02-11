import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Weather = {
  id: number;
  date: string;
  time: string;
  location: string;
  airTemperatureC: number;
  airHumidityPct: number;
  snowTemperatureC: number;
  snowHumidityPct: number;
  snowType: string;
  createdAt: string;
  createdById: number;
  createdByName: string;
  groupScope: string;
};

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  location: z.string().min(1, "Location is required"),
  airTemperatureC: z.coerce.number(),
  airHumidityPct: z.coerce.number().min(0).max(100),
  snowTemperatureC: z.coerce.number(),
  snowHumidityPct: z.coerce.number().min(0).max(100),
  snowType: z.string().min(1, "Snow type is required"),
});

function WeatherForm({
  initial,
  onSaved,
}: {
  initial?: Weather;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: initial?.date ?? today,
      time: initial?.time ?? "09:30",
      location: initial?.location ?? "",
      airTemperatureC: initial?.airTemperatureC ?? 0,
      airHumidityPct: initial?.airHumidityPct ?? 50,
      snowTemperatureC: initial?.snowTemperatureC ?? 0,
      snowHumidityPct: initial?.snowHumidityPct ?? 50,
      snowType: initial?.snowType ?? "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      const res = await apiRequest("POST", "/api/weather", data);
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
    mutationFn: async (data: z.infer<typeof schema>) => {
      const res = await apiRequest("PUT", `/api/weather/${initial!.id}`, data);
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
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                    data-testid="input-weather-date"
                  />
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
                  <Input
                    {...field}
                    type="time"
                    data-testid="input-weather-time"
                  />
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
                  <Input
                    {...field}
                    data-testid="input-weather-location"
                    placeholder="e.g., Park City"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="airTemperatureC"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Air temperature (°C)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    inputMode="decimal"
                    data-testid="input-weather-airtemp"
                  />
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
                <FormLabel>Air humidity (%)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    inputMode="numeric"
                    data-testid="input-weather-airhum"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="snowTemperatureC"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Snow temperature (°C)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    inputMode="decimal"
                    data-testid="input-weather-snowtemp"
                  />
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
                <FormLabel>Snow humidity (%)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    inputMode="numeric"
                    data-testid="input-weather-snowhum"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="snowType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Snow type</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  data-testid="input-weather-snowtype"
                  placeholder="e.g., New snow"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-end">
          <Button type="submit" data-testid="button-save-weather">
            Save
          </Button>
        </div>
      </form>
    </Form>
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
            <p
              className="mt-1 text-sm text-muted-foreground"
              data-testid="text-weather-subtitle"
            >
              Daily weather entries per date and location.
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
              <Button data-testid="button-add-weather">
                <Plus className="mr-2 h-4 w-4" />
                Add weather
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit weather" : "Add weather"}</DialogTitle>
              </DialogHeader>
              <WeatherForm initial={editing} onSaved={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {weather.length === 0 ? (
            <Card
              className="fs-card rounded-2xl p-6 text-sm text-muted-foreground"
              data-testid="empty-weather"
            >
              No weather entries yet.
            </Card>
          ) : (
            weather.map((w) => (
              <Card
                key={w.id}
                className="fs-card rounded-2xl p-4"
                data-testid={`card-weather-${w.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{w.location}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {w.date} · {w.time} · Snow {w.snowTemperatureC}°C · {w.snowType}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                      <div
                        className="rounded-xl border bg-background/50 px-3 py-2"
                        data-testid={`text-airtemp-${w.id}`}
                      >
                        Air {w.airTemperatureC}°C
                      </div>
                      <div
                        className="rounded-xl border bg-background/50 px-3 py-2"
                        data-testid={`text-airhum-${w.id}`}
                      >
                        Air {w.airHumidityPct}%
                      </div>
                      <div
                        className="rounded-xl border bg-background/50 px-3 py-2"
                        data-testid={`text-snowtemp-${w.id}`}
                      >
                        Snow {w.snowTemperatureC}°C
                      </div>
                      <div
                        className="rounded-xl border bg-background/50 px-3 py-2"
                        data-testid={`text-snowhum-${w.id}`}
                      >
                        Snow {w.snowHumidityPct}%
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Created by <span className="text-foreground">{w.createdByName}</span>
                      {` · Group ${w.groupScope}`}
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
