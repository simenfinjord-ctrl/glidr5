import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2, Disc3 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

type GrindingRecord = {
  id: number;
  seriesId: number | null;
  date: string;
  grindType: string;
  stone: string | null;
  notes: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
  groupScope: string;
};

type Series = { id: number; name: string; type: string; groupScope: string };

const grindSchema = z.object({
  date: z.string().min(1, "Date is required"),
  grindType: z.string().min(1, "Grind type is required"),
  stone: z.string().optional(),
  notes: z.string().optional(),
  seriesId: z.string().optional(),
});

function GrindForm({ onDone, series, editRecord }: { onDone: () => void; series: Series[]; editRecord?: GrindingRecord }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof grindSchema>>({
    resolver: zodResolver(grindSchema),
    defaultValues: editRecord ? {
      date: editRecord.date,
      grindType: editRecord.grindType,
      stone: editRecord.stone || "",
      notes: editRecord.notes || "",
      seriesId: editRecord.seriesId ? String(editRecord.seriesId) : "",
    } : {
      date: new Date().toISOString().slice(0, 10),
      grindType: "",
      stone: "",
      notes: "",
      seriesId: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof grindSchema>) => {
      const payload = {
        ...data,
        seriesId: data.seriesId ? parseInt(data.seriesId) : null,
      };
      if (editRecord) {
        const res = await apiRequest("PUT", `/api/grinding/${editRecord.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/grinding", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grinding"] });
      toast({ title: editRecord ? "Record updated" : "Record created" });
      onDone();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const grindTypes = ["New grind", "Regrind", "Hand finish", "Stone grind", "Linear", "Cross-hatch", "Custom"];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <FormField control={form.control} name="date" render={({ field }) => (
          <FormItem><FormLabel>Date</FormLabel><FormControl><Input {...field} type="date" data-testid="input-grind-date" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="grindType" render={({ field }) => (
          <FormItem>
            <FormLabel>Grind Type</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger data-testid="select-grind-type"><SelectValue placeholder="Select type..." /></SelectTrigger></FormControl>
              <SelectContent>
                {grindTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="stone" render={({ field }) => (
          <FormItem><FormLabel>Stone / Tool</FormLabel><FormControl><Input {...field} placeholder="e.g. SG12, Diamond..." data-testid="input-grind-stone" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="seriesId" render={({ field }) => (
          <FormItem>
            <FormLabel>Series (optional)</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger data-testid="select-grind-series"><SelectValue placeholder="Link to series..." /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {series.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem><FormLabel>Notes</FormLabel><FormControl><Input {...field} placeholder="Any additional notes..." data-testid="input-grind-notes" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="flex justify-end">
          <Button type="submit" data-testid="button-save-grind" disabled={mutation.isPending}>
            {editRecord ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function Grinding() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<GrindingRecord | undefined>();

  const { data: records = [], isLoading, error } = useQuery<GrindingRecord[]>({
    queryKey: ["/api/grinding"],
  });

  const { data: series = [] } = useQuery<Series[]>({
    queryKey: ["/api/series"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/grinding/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grinding"] });
      toast({ title: "Record deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (error) {
    return (
      <AppShell>
        <Card className="fs-card rounded-2xl p-6" data-testid="status-grinding-forbidden">
          <div className="text-base font-semibold">Access Denied</div>
          <div className="mt-2 text-sm text-muted-foreground">
            You don't have permission to view grinding records. Contact your administrator to get access.
          </div>
        </Card>
      </AppShell>
    );
  }

  const seriesMap = new Map(series.map((s) => [s.id, s]));

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900" data-testid="text-grinding-title">
              <Disc3 className="inline-block mr-2 h-7 w-7 text-indigo-600" />
              Grinding
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Track ski grinding and preparation history</p>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-grind" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                New Record
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader><DialogTitle>New Grinding Record</DialogTitle></DialogHeader>
              <GrindForm onDone={() => setCreateOpen(false)} series={series} />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
        ) : records.length === 0 ? (
          <Card className="fs-card rounded-2xl p-8 text-center">
            <Disc3 className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <div className="text-sm text-muted-foreground">No grinding records yet. Add your first record above.</div>
          </Card>
        ) : (
          <Card className="fs-card rounded-2xl p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-grinding">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Type</th>
                    <th className="pb-2 pr-3">Stone</th>
                    <th className="pb-2 pr-3">Series</th>
                    <th className="pb-2 pr-3">Notes</th>
                    <th className="pb-2 pr-3">By</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border/20" data-testid={`row-grind-${r.id}`}>
                      <td className="py-2 pr-3 font-medium">{r.date}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                          {r.grindType}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.stone || "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.seriesId ? seriesMap.get(r.seriesId)?.name || `#${r.seriesId}` : "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground max-w-[200px] truncate">{r.notes || "—"}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{r.createdByName}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" data-testid={`button-edit-grind-${r.id}`} onClick={() => setEditRecord(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-delete-grind-${r.id}`} onClick={() => {
                            if (confirm("Delete this grinding record?")) deleteMutation.mutate(r.id);
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Dialog open={!!editRecord} onOpenChange={(v) => { if (!v) setEditRecord(undefined); }}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader><DialogTitle>Edit Grinding Record</DialogTitle></DialogHeader>
            {editRecord && <GrindForm onDone={() => setEditRecord(undefined)} series={series} editRecord={editRecord} />}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
