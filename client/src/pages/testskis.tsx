// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { useState, useMemo } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Snowflake, Hash, Table, ArrowUpDown, Archive, RotateCcw, Trash2, Filter, ChevronDown } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient, OfflineError } from "@/lib/queryClient";
import { useOffline } from "@/lib/offline-context";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

type Series = {
  id: number;
  name: string;
  type: string;
  brand: string | null;
  skiType: string | null;
  grind: string | null;
  numberOfSkis: number;
  pairLabels: string | null;
  lastRegrind: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
  groupScope: string;
  archivedAt: string | null;
  actionStatus: string | null;
  actionLocation: string | null;
};

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["Structure", "Glide", "Grind"]),
  brand: z.string().optional(),
  skiType: z.string().optional(),
  grind: z.string().optional(),
  numberOfSkis: z.coerce.number().int().min(1, "Must be at least 1"),
  lastRegrind: z.string().optional(),
  groupScope: z.string().min(1, "Select a group"),
});

function typeBadgeClass(type: string) {
  if (type === "Glide") return "fs-badge-glide";
  if (type === "Structure") return "fs-badge-structure";
  return "fs-badge-topping";
}

function SeriesForm({
  initial,
  onSaved,
  userGroups,
}: {
  initial?: Series;
  onSaved: () => void;
  userGroups: string[];
}) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const { queueMutation } = useOffline();

  const parsedInitialLabels = useMemo(() => {
    if (!initial?.pairLabels) return {};
    try { return JSON.parse(initial.pairLabels); } catch { return {}; }
  }, [initial?.pairLabels]);

  const [pairLabels, setPairLabels] = useState<Record<string, string>>(parsedInitialLabels);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      type: (initial?.type ?? "Glide") as "Structure" | "Glide" | "Grind",
      brand: initial?.brand ?? "",
      skiType: initial?.skiType ?? "",
      grind: initial?.grind ?? "",
      numberOfSkis: initial?.numberOfSkis ?? 8,
      lastRegrind: initial?.lastRegrind ?? "",
      groupScope: initial?.groupScope ?? userGroups[0] ?? "",
    },
  });

  const watchNumberOfSkis = form.watch("numberOfSkis");

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      try {
        const labelsToSave = Object.keys(pairLabels).length > 0 ? JSON.stringify(pairLabels) : null;
        const res = await apiRequest("POST", "/api/series", {
          name: data.name,
          type: data.type,
          brand: data.brand?.trim() || null,
          skiType: data.skiType?.trim() || null,
          grind: data.grind?.trim() || null,
          numberOfSkis: data.numberOfSkis,
          pairLabels: labelsToSave,
          lastRegrind: data.lastRegrind || null,
          groupScope: data.groupScope,
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
        toast({ title: t("testskis.savedOffline"), description: t("testskis.savedOfflineDesc") });
        onSaved();
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      toast({ title: t("testskis.seriesCreated") });
      onSaved();
    },
    onError: (e) => {
      toast({
        title: t("testskis.saveError"),
        description: e instanceof Error ? e.message : t("common.error"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      const labelsToSave = Object.keys(pairLabels).length > 0 ? JSON.stringify(pairLabels) : null;
      const res = await apiRequest("PUT", `/api/series/${initial!.id}`, {
        name: data.name,
        type: data.type,
        brand: data.brand?.trim() || null,
        skiType: data.skiType?.trim() || null,
        grind: data.grind?.trim() || null,
        numberOfSkis: data.numberOfSkis,
        pairLabels: labelsToSave,
        lastRegrind: data.lastRegrind || null,
        groupScope: data.groupScope,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      toast({ title: t("testskis.seriesUpdated") });
      onSaved();
    },
    onError: (e) => {
      toast({
        title: t("testskis.saveError"),
        description: e instanceof Error ? e.message : t("common.error"),
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
                <FormLabel>{t("testskis.seriesName")}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-series-name" placeholder={L("f.eks. Testski Blå 1", "e.g., Testskis Blue 1")} />
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
                <FormLabel>{t("testskis.brand")}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-series-brand" placeholder={L("f.eks. Fischer", "e.g., Fischer")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="skiType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("testskis.skiType")}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-series-skitype" placeholder={L("f.eks. Klassisk, Skøyting", "e.g., Classic, Skating")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("testskis.seriesType")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-series-type">
                      <SelectValue placeholder={L("Velg", "Select")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Structure">{t("tests.structure")}</SelectItem>
                    <SelectItem value="Glide">{t("tests.glide")}</SelectItem>
                    <SelectItem value="Grind">{t("tests.grind")}</SelectItem>
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
                <FormLabel>{t("testskis.numberOfSkis")}</FormLabel>
                <FormControl>
                  <Input {...field} type="number" inputMode="numeric" data-testid="input-series-count" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {Number(watchNumberOfSkis) > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">{t("testskis.pairLabels")}</label>
            <p className="text-xs text-muted-foreground">{t("testskis.pairLabelsDesc")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Array.from({ length: Math.min(Number(watchNumberOfSkis) || 0, 32) }).map((_, i) => {
                const pairNum = i + 1;
                return (
                  <div key={pairNum} className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{pairNum}.</span>
                    <Input
                      className="h-8 text-sm"
                      placeholder={String(pairNum)}
                      value={pairLabels[String(pairNum)] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setPairLabels((prev) => {
                          const next = { ...prev };
                          if (val) next[String(pairNum)] = val;
                          else delete next[String(pairNum)];
                          return next;
                        });
                      }}
                      data-testid={`input-pair-label-${pairNum}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="grind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("testskis.grind")} ({t("common.optional")})</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-series-grind" placeholder={L("f.eks. R3", "e.g., R3")} />
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
                <FormLabel>{t("testskis.lastRegrind")} ({t("common.optional")})</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-series-lastregrind" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {userGroups.length > 1 && (
          <FormField
            control={form.control}
            name="groupScope"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("common.group")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-series-group">
                      <SelectValue placeholder={L("Velg gruppe", "Select group")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {userGroups.map((g) => (
                      <SelectItem key={g} value={g} data-testid={`option-group-${g}`}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex items-center justify-end gap-2">
          <Button type="submit" data-testid="button-save-series">
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// #28: action-status control on a testfleet (Need regrind / In for regrind / Grinded / In use).
const SERIES_ACTION_STATUSES = ["Need regrind", "In for regrind", "Grinded", "In use"] as const;
function seriesActionClass(s: string | null): string {
  return s === "Need regrind" ? "bg-red-100 text-red-700 ring-red-300 dark:bg-red-900/30 dark:text-red-300"
    : s === "In for regrind" ? "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-300"
    : s === "Grinded" ? "bg-sky-100 text-sky-700 ring-sky-300 dark:bg-sky-900/30 dark:text-sky-300"
    : s === "In use" ? "bg-emerald-100 text-emerald-700 ring-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300"
    : "bg-muted text-muted-foreground ring-border";
}
function SeriesActionStatus({ series }: { series: Series }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const m = useMutation({
    mutationFn: async (vars: { status: string; location: string }) =>
      apiRequest("PATCH", `/api/series/${series.id}/action`, { actionStatus: vars.status || null, actionLocation: vars.location || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/series"] }),
  });
  const onChange = (val: string) => {
    const status = val === "__none__" ? "" : val;
    let location = series.actionLocation || "";
    if (status === "In for regrind") {
      location = window.prompt(L("Hvor sendes de til sliping?", "Where is it in for regrind?"), location) || "";
    }
    m.mutate({ status, location });
  };
  return (
    <div className="flex items-center gap-1.5">
      <Select value={series.actionStatus || "__none__"} onValueChange={onChange}>
        <SelectTrigger className={cn("h-7 w-auto min-w-[120px] text-[11px] font-medium ring-1 border-0", seriesActionClass(series.actionStatus))} data-testid={`series-action-${series.id}`}>
          <SelectValue placeholder={L("Status", "Status")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{L("Ingen status", "No status")}</SelectItem>
          {SERIES_ACTION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      {series.actionStatus === "In for regrind" && series.actionLocation && (
        <span className="text-[10px] text-muted-foreground">@ {series.actionLocation}</span>
      )}
    </div>
  );
}

export default function TestSkis() {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Series | undefined>();
  const [sortAZ, setSortAZ] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [nameSearch, setNameSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<Series | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<Series | undefined>();

  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: archived = [] } = useQuery<Series[]>({ queryKey: ["/api/series/archived"] });
  const { data: groups = [] } = useQuery<{ id: number; name: string }[]>({ queryKey: ["/api/groups"] });

  const userGroups = useMemo(() => {
    if (user?.isAdmin && groups.length > 0) {
      return groups.map((g) => g.name);
    }
    return (user?.groupScope ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }, [user, groups]);

  const sortedSeries = useMemo(() => {
    const n = nameSearch.trim().toLowerCase();
    let result = n ? series.filter((s) => s.name.toLowerCase().includes(n)) : series;
    if (sortAZ) result = [...result].sort((a, b) => a.name.localeCompare(b.name, "nb"));
    return result;
  }, [series, sortAZ, nameSearch]);

  function seriesTypeLabel(type: string) {
    const map: Record<string, string> = { "Glide": "tests.glide", "Grind": "tests.grind", "Structure": "tests.structure" };
    return t(map[type] ?? type);
  }

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/series/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/series/archived"] });
      toast({ title: t("testskis.seriesArchived") });
      setConfirmArchive(undefined);
    },
    onError: (e) => {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/series/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/series/archived"] });
      toast({ title: L("Serie gjenopprettet", "Series restored") });
    },
    onError: (e) => {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/series/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series/archived"] });
      toast({ title: L("Serie slettet permanent", "Series permanently deleted") });
      setConfirmDelete(undefined);
    },
    onError: (e) => {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("testskis.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-testskis-subtitle">
              {sortedSeries.length}{sortedSeries.length !== series.length ? ` of ${series.length}` : ""} series{archived.length > 0 ? ` · ${archived.length} archived` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter toggle — mobile only */}
            <div className="sm:hidden flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersOpen(v => !v)}
                className="gap-1.5"
              >
                <Filter className="h-4 w-4" />
                Filters
                {nameSearch.trim() && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
                    1
                  </span>
                )}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", filtersOpen && "rotate-180")} />
              </Button>
              {nameSearch.trim() && (
                <button
                  onClick={() => setNameSearch("")}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Name search — always visible on desktop, togglable on mobile */}
            <Input
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder={L("Søk navn…", "Search name…")}
              className={cn("h-9 w-[180px]", !filtersOpen && "hidden sm:block")}
              data-testid="input-search-series"
            />

            {archived.length > 0 && (
              <Button
                variant={showArchive ? "secondary" : "outline"}
                size="sm"
                data-testid="button-toggle-archive"
                onClick={() => setShowArchive(!showArchive)}
                className={showArchive ? "ring-1 ring-amber-200" : ""}
              >
                <Archive className="mr-2 h-4 w-4" />
                {showArchive ? t("testskis.hideArchived") : t("testskis.showArchived")} ({archived.length})
              </Button>
            )}

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
                  {t("testskis.newSeries")}
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{editing ? t("testskis.editSeries") : t("testskis.newSeries")}</DialogTitle>
              </DialogHeader>
              <SeriesForm
                initial={editing}
                onSaved={() => {
                  setOpen(false);
                  toast({ title: t("common.save") });
                }}
                userGroups={userGroups}
              />
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {showArchive && archived.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-amber-600">{L("Arkiverte serier", "Archived series")}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {archived.map((s) => (
                <Card
                  key={s.id}
                  className="fs-card rounded-2xl p-4 opacity-60 transition-all duration-200"
                  data-testid={`card-archived-series-${s.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", typeBadgeClass(s.type))}>
                          {seriesTypeLabel(s.type)}
                        </span>
                        <span className="truncate text-base font-semibold">{s.name}</span>
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground">
                        {[s.brand, s.skiType, `${s.numberOfSkis} ${t("testskis.skiCount").replace("{n}", String(s.numberOfSkis))}`].filter(Boolean).join(" · ")}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground/60">
                        Archived {s.archivedAt ? new Date(s.archivedAt).toLocaleDateString() : ""}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        data-testid={`button-restore-series-${s.id}`}
                        disabled={restoreMutation.isPending}
                        onClick={() => restoreMutation.mutate(s.id)}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {t("common.restore")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                        data-testid={`button-delete-series-${s.id}`}
                        onClick={() => setConfirmDelete(s)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sortedSeries.length === 0 ? (
            <Card className="fs-card rounded-2xl sm:col-span-2" data-testid="empty-series">
              <EmptyState
                icon={Snowflake}
                title={t("testskis.noSeries")}
                description="Create your first test ski series using the button above."
              />
            </Card>
          ) : (
            sortedSeries.map((s) => (
              <Card
                key={s.id}
                className="fs-card rounded-2xl p-4 transition-all duration-200"
                data-testid={`card-series-${s.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", typeBadgeClass(s.type))}>
                        {seriesTypeLabel(s.type)}
                      </span>
                      <span className="truncate text-base font-semibold">{s.name}</span>
                    </div>
                    <div className="mt-1.5 text-sm text-muted-foreground">
                      {[
                        s.brand,
                        s.skiType,
                        `${s.numberOfSkis} ${t("testskis.skiCount").replace("{n}", String(s.numberOfSkis))}`,
                        s.grind ? `Grind ${s.grind}` : null,
                        s.lastRegrind ? `Regrind ${s.lastRegrind}` : null,
                      ].filter(Boolean).join(" · ")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground/60">
                      {s.createdByName} · {s.groupScope}
                    </div>
                    <div className="mt-2">
                      <SeriesActionStatus series={s} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <AppLink href={`/testskis/${s.id}`} testId={`link-series-tests-${s.id}`}>
                      <Button variant="secondary" size="sm" data-testid={`button-view-series-${s.id}`}>
                        <Table className="mr-2 h-4 w-4" />
                        {t("testskis.viewTests")}
                      </Button>
                    </AppLink>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-edit-series-${s.id}`}
                      onClick={() => {
                        setEditing(s);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground/50 hover:text-amber-600 hover:bg-amber-50"
                      data-testid={`button-archive-series-${s.id}`}
                      onClick={() => setConfirmArchive(s)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <Dialog open={!!confirmArchive} onOpenChange={(v) => { if (!v) setConfirmArchive(undefined); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>{t("common.archive")} series</DialogTitle></DialogHeader>
            {confirmArchive && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to archive <span className="font-medium text-foreground">{confirmArchive.name}</span>? You can restore it later from the archive.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setConfirmArchive(undefined)}>{t("common.cancel")}</Button>
                  <Button
                    data-testid="button-confirm-archive"
                    disabled={archiveMutation.isPending}
                    onClick={() => archiveMutation.mutate(confirmArchive.id)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    {t("common.archive")}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!confirmDelete} onOpenChange={(v) => { if (!v) setConfirmDelete(undefined); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>{t("common.delete")} permanently</DialogTitle></DialogHeader>
            {confirmDelete && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to permanently delete <span className="font-medium text-foreground">{confirmDelete.name}</span>? This cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setConfirmDelete(undefined)}>{t("common.cancel")}</Button>
                  <Button
                    variant="destructive"
                    data-testid="button-confirm-delete-series"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(confirmDelete.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("common.delete")} permanently
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
