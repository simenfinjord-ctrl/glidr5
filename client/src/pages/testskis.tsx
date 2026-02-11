import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Series = {
  id: number;
  name: string;
  type: string;
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
  grind: z.string().optional(),
  numberOfSkis: z.coerce.number().int().min(1, "Must be at least 1"),
  lastRegrind: z.string().optional(),
});

function SeriesForm({
  initial,
  onSaved,
}: {
  initial?: Series;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      type: (initial?.type ?? "Glide") as "Structure" | "Glide" | "Grind",
      grind: initial?.grind ?? "",
      numberOfSkis: initial?.numberOfSkis ?? 8,
      lastRegrind: initial?.lastRegrind ?? "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      const res = await apiRequest("POST", "/api/series", {
        name: data.name,
        type: data.type,
        grind: data.grind?.trim() || null,
        numberOfSkis: data.numberOfSkis,
        lastRegrind: data.lastRegrind || null,
      });
      return res.json();
    },
    onSuccess: () => {
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

  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">TestSkis</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-testskis-subtitle">
              Create and manage test ski series for your group.
            </p>
          </div>

          <Dialog open={open} onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(undefined);
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-series" onClick={() => setEditing(undefined)}>
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

        <div className="grid grid-cols-1 gap-3">
          {series.length === 0 ? (
            <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-series">
              No test series yet.
            </Card>
          ) : (
            series.map((s) => (
              <Card
                key={s.id}
                className="fs-card rounded-2xl p-4"
                data-testid={`card-series-${s.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{s.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.type}
                      {s.grind ? ` · Grind ${s.grind}` : ""}
                      {` · ${s.numberOfSkis} skis`}
                      {s.lastRegrind ? ` · Last regrind ${s.lastRegrind}` : ""}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Created by <span className="text-foreground">{s.createdByName}</span>
                      {` · Group ${s.groupScope}`}
                    </div>
                  </div>

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
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
