import { useState, useMemo } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Snowflake, Hash, Table, ArrowUpDown } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, OfflineError } from "@/lib/queryClient";
import { useOffline } from "@/lib/offline-context";
import { cn } from "@/lib/utils";

type Series = {
  id: number;
  name: string;
  type: string;
  brand: string | null;
  grind: string | null;
  numberOfSkis: number;
  lastRegrind: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
  groupScope: string;
};

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["Structure", "Glide", "Grind"]),
  brand: z.string().optional(),
  grind: z.string().optional(),
  numberOfSkis: z.coerce.number().int().min(1, "Must be at least 1"),
  lastRegrind: z.string().optional(),
});

function typeBadgeClass(type: string) {
  if (type === "Glide") return "fs-badge-glide";
  if (type === "Structure") return "fs-badge-structure";
  return "fs-badge-topping";
}

function SeriesForm({
  initial,
  onSaved,
}: {
  initial?: Series;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { queueMutation } = useOffline();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      type: (initial?.type ?? "Glide") as "Structure" | "Glide" | "Grind",
      brand: initial?.brand ?? "",
      grind: initial?.grind ?? "",
      numberOfSkis: initial?.numberOfSkis ?? 8,
      lastRegrind: initial?.lastRegrind ?? "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      try {
        const res = await apiRequest("POST", "/api/series", {
          name: data.name,
          type: data.type,
          brand: data.brand?.trim() || null,
          grind: data.grind?.trim() || null,
          numberOfSkis: data.numberOfSkis,
          lastRegrind: data.lastRegrind || null,
        });
        return res.json();
      } catch (err) {
        if (err instanceof OfflineError) {
          await queueMutation(err.method, err.url, err.body, "Save new series");
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
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      toast({ title: "Series created" });
      onSaved();
    },
    onError: (e) => {
      toast({
        title: "Could not save series",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      const res = await apiRequest("PUT", `/api/series/${initial!.id}`, {
        name: data.name,
        type: data.type,
        brand: data.brand?.trim() || null,
        grind: data.grind?.trim() || null,
        numberOfSkis: data.numberOfSkis,
        lastRegrind: data.lastRegrind || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      toast({ title: "Series updated" });
      onSaved();
    },
    onError: (e) => {
      toast({
        title: "Could not save series",
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-series-name" placeholder="e.g., Testskis Blue 1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="brand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Brand</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-series-brand" placeholder="e.g., Fischer" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-series-type">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Structure">Structure</SelectItem>
                    <SelectItem value="Glide">Glide</SelectItem>
                    <SelectItem value="Grind">Grind</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numberOfSkis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of skis</FormLabel>
                <FormControl>
                  <Input {...field} type="number" inputMode="numeric" data-testid="input-series-count" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="grind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grind (optional)</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-series-grind" placeholder="e.g., R3" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastRegrind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last regrind (optional)</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-series-lastregrind" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="submit" data-testid="button-save-series">
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function TestSkis() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Series | undefined>();
  const [sortAZ, setSortAZ] = useState(false);

  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });

  const sortedSeries = useMemo(() => {
    if (!sortAZ) return series;
    return [...series].sort((a, b) => a.name.localeCompare(b.name, "nb"));
  }, [series, sortAZ]);

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">TestSkis</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-testskis-subtitle">
              {series.length} series · Create and manage test ski series
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={sortAZ ? "secondary" : "outline"}
              size="sm"
              data-testid="button-sort-series"
              onClick={() => setSortAZ(!sortAZ)}
              className={sortAZ ? "ring-1 ring-sky-500/30" : ""}
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
              A–Z
            </Button>

            <Dialog open={open} onOpenChange={(v) => {
              setOpen(v);
              if (!v) setEditing(undefined);
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-series" onClick={() => setEditing(undefined)} className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  New series
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit series" : "New series"}</DialogTitle>
              </DialogHeader>
              <SeriesForm
                initial={editing}
                onSaved={() => {
                  setOpen(false);
                  toast({ title: "Saved" });
                }}
              />
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sortedSeries.length === 0 ? (
            <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground sm:col-span-2" data-testid="empty-series">
              No test series yet.
            </Card>
          ) : (
            sortedSeries.map((s) => (
              <Card
                key={s.id}
                className="fs-card rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-sky-500/5"
                data-testid={`card-series-${s.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", typeBadgeClass(s.type))}>
                        {s.type}
                      </span>
                      <span className="truncate text-base font-semibold">{s.name}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.brand && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                          {s.brand}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-sky-500/20">
                        <Hash className="h-2.5 w-2.5" /> {s.numberOfSkis} skis
                      </span>
                      {s.grind && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-500/20">
                          Grind {s.grind}
                        </span>
                      )}
                      {s.lastRegrind && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/20">
                          Regrind {s.lastRegrind}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="text-foreground/70">{s.createdByName}</span>
                      <span className="text-border"> · </span>
                      <span>{s.groupScope}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <AppLink href={`/testskis/${s.id}`} testId={`link-series-tests-${s.id}`}>
                      <Button variant="secondary" size="sm" data-testid={`button-view-series-${s.id}`}>
                        <Table className="mr-2 h-4 w-4" />
                        Tests
                      </Button>
                    </AppLink>
                    <Button
                      variant="secondary"
                      size="sm"
                      data-testid={`button-edit-series-${s.id}`}
                      onClick={() => {
                        setEditing(s);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
