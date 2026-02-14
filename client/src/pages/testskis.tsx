import { useState, useMemo } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Snowflake, Hash, Table, ArrowUpDown, Archive, RotateCcw, Trash2 } from "lucide-react";
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

type Series = {
  id: number;
  name: string;
  type: string;
  brand: string | null;
  skiType: string | null;
  grind: string | null;
  numberOfSkis: number;
  lastRegrind: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
  groupScope: string;
  archivedAt: string | null;
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
  const { toast } = useToast();
  const { queueMutation } = useOffline();

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

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      try {
        const res = await apiRequest("POST", "/api/series", {
          name: data.name,
          type: data.type,
          brand: data.brand?.trim() || null,
          skiType: data.skiType?.trim() || null,
          grind: data.grind?.trim() || null,
          numberOfSkis: data.numberOfSkis,
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
        skiType: data.skiType?.trim() || null,
        grind: data.grind?.trim() || null,
        numberOfSkis: data.numberOfSkis,
        lastRegrind: data.lastRegrind || null,
        groupScope: data.groupScope,
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
            name="skiType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ski type</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-series-skitype" placeholder="e.g., Classic, Skate" />
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

        {userGroups.length > 1 && (
          <FormField
            control={form.control}
            name="groupScope"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Group</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="select-series-group">
                      <SelectValue placeholder="Select group" />
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
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function TestSkis() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Series | undefined>();
  const [sortAZ, setSortAZ] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
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
    if (!sortAZ) return series;
    return [...series].sort((a, b) => a.name.localeCompare(b.name, "nb"));
  }, [series, sortAZ]);

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/series/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/series/archived"] });
      toast({ title: "Series archived" });
      setConfirmArchive(undefined);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/series/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      queryClient.invalidateQueries({ queryKey: ["/api/series/archived"] });
      toast({ title: "Series restored" });
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/series/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series/archived"] });
      toast({ title: "Series permanently deleted" });
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
            <h1 className="text-2xl sm:text-3xl">TestSkis</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-testskis-subtitle">
              {series.length} series{archived.length > 0 ? ` · ${archived.length} archived` : ""} · Create and manage test ski series
            </p>
          </div>

          <div className="flex items-center gap-2">
            {archived.length > 0 && (
              <Button
                variant={showArchive ? "secondary" : "outline"}
                size="sm"
                data-testid="button-toggle-archive"
                onClick={() => setShowArchive(!showArchive)}
                className={showArchive ? "ring-1 ring-amber-500/30" : ""}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive ({archived.length})
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
                userGroups={userGroups}
              />
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {showArchive && archived.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-amber-400">Archived series</h2>
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
                          {s.type}
                        </span>
                        <span className="truncate text-base font-semibold">{s.name}</span>
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground">
                        {[s.brand, s.skiType, `${s.numberOfSkis} skis`].filter(Boolean).join(" · ")}
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
                        Restore
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
            <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground sm:col-span-2" data-testid="empty-series">
              No test series yet.
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
                        {s.type}
                      </span>
                      <span className="truncate text-base font-semibold">{s.name}</span>
                    </div>
                    <div className="mt-1.5 text-sm text-muted-foreground">
                      {[
                        s.brand,
                        s.skiType,
                        `${s.numberOfSkis} skis`,
                        s.grind ? `Grind ${s.grind}` : null,
                        s.lastRegrind ? `Regrind ${s.lastRegrind}` : null,
                      ].filter(Boolean).join(" · ")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground/60">
                      {s.createdByName} · {s.groupScope}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <AppLink href={`/testskis/${s.id}`} testId={`link-series-tests-${s.id}`}>
                      <Button variant="secondary" size="sm" data-testid={`button-view-series-${s.id}`}>
                        <Table className="mr-2 h-4 w-4" />
                        Tests
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
                      className="text-muted-foreground/50 hover:text-amber-400 hover:bg-amber-500/10"
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
            <DialogHeader><DialogTitle>Archive series</DialogTitle></DialogHeader>
            {confirmArchive && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to archive <span className="font-medium text-foreground">{confirmArchive.name}</span>? You can restore it later from the archive.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setConfirmArchive(undefined)}>Cancel</Button>
                  <Button
                    data-testid="button-confirm-archive"
                    disabled={archiveMutation.isPending}
                    onClick={() => archiveMutation.mutate(confirmArchive.id)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!confirmDelete} onOpenChange={(v) => { if (!v) setConfirmDelete(undefined); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Delete permanently</DialogTitle></DialogHeader>
            {confirmDelete && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to permanently delete <span className="font-medium text-foreground">{confirmDelete.name}</span>? This cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setConfirmDelete(undefined)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    data-testid="button-confirm-delete-series"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(confirmDelete.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete permanently
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
