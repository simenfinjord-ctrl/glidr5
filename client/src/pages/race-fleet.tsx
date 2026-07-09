import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Boxes, Pencil, Trash2, Accessibility } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type FleetSki = {
  id: number;
  serialNumber: string | null;
  skiId: string;
  brand: string | null;
  discipline: string;
  construction: string | null;
  mold: string | null;
  base: string | null;
  grind: string | null;
  heights: string | null;
  year: string | null;
  length: string | null;
  typeOfSki: string | null;
  whereReceived: string | null;
  notes: string | null;
  isTrainingSki: number;
  isSitski: number;
  createdByName: string | null;
};

const EMPTY = {
  skiId: "", serialNumber: "", brand: "", discipline: "", construction: "", mold: "", base: "",
  grind: "", heights: "", year: "", length: "", typeOfSki: "", whereReceived: "", notes: "",
  isTrainingSki: false, isSitski: false,
};

export default function RaceFleet() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const { can } = useAuth();
  const canEdit = can("raceskis", "edit");

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const set = (k: keyof typeof EMPTY, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const { data: skis = [], isLoading, error } = useQuery<FleetSki[]>({ queryKey: ["/api/race-fleet"], retry: false });
  const forbidden = (error as any)?.message?.includes("403");

  const openAdd = () => { setEditId(null); setForm({ ...EMPTY }); setOpen(true); };
  const openEdit = (s: FleetSki) => {
    setEditId(s.id);
    setForm({
      skiId: s.skiId ?? "", serialNumber: s.serialNumber ?? "", brand: s.brand ?? "", discipline: s.discipline ?? "",
      construction: s.construction ?? "", mold: s.mold ?? "", base: s.base ?? "", grind: s.grind ?? "",
      heights: s.heights ?? "", year: s.year ?? "", length: s.length ?? "", typeOfSki: s.typeOfSki ?? "",
      whereReceived: s.whereReceived ?? "", notes: s.notes ?? "", isTrainingSki: s.isTrainingSki === 1, isSitski: s.isSitski === 1,
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (editId) return (await apiRequest("PUT", `/api/race-fleet/${editId}`, payload)).json();
      return (await apiRequest("POST", "/api/race-fleet", payload)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/race-fleet"] });
      toast({ title: editId ? L("Ski oppdatert", "Ski updated") : L("Ski lagt til", "Ski added") });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: L("Kunne ikke lagre", "Could not save"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/race-fleet/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/race-fleet"] }); toast({ title: L("Ski slettet", "Ski deleted") }); },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  const field = (key: keyof typeof EMPTY, label: string, placeholder?: string) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={form[key] as string} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} className="h-9 text-sm" data-testid={`fleet-input-${key}`} />
    </div>
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2" data-testid="text-racefleet-title">
              <Boxes className="h-6 w-6 text-primary" />{L("Konkurranseski (lag)", "Race fleets")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {L("Lagets konkurranseski som ikke tilhører en bestemt utøver.", "Your team's competition skis that don't belong to a specific athlete.")}
            </p>
          </div>
          {canEdit && (
            <Button onClick={openAdd} className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white" data-testid="button-add-fleet-ski">
              <Plus className="mr-2 h-4 w-4" />{L("Legg til ski", "Add ski")}
            </Button>
          )}
        </div>

        {forbidden ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="fleet-forbidden">
            {L("Race fleets er ikke aktivert for dette laget. En Super Admin må slå på «Para team».", "Race fleets is not enabled for this team. A Super Admin must turn on 'Para team'.")}
          </Card>
        ) : isLoading ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Laster…", "Loading…")}</Card>
        ) : skis.length === 0 ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-fleet">
            {L("Ingen konkurranseski lagt inn ennå.", "No competition skis added yet.")}
          </Card>
        ) : (
          <Card className="fs-card rounded-2xl overflow-hidden" data-testid="list-fleet">
            <div className="divide-y divide-border/40">
              {skis.map((s) => (
                <div key={s.id} className="flex items-start gap-3 px-4 py-3" data-testid={`row-fleet-${s.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{s.skiId}</span>
                      {s.discipline && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{s.discipline}</span>}
                      {s.isSitski === 1 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-50 dark:bg-fuchsia-950/30 px-2 py-0.5 text-[10px] font-medium text-fuchsia-700 dark:text-fuchsia-300"><Accessibility className="h-3 w-3" />{L("Sitski", "Sit-ski")}</span>
                      )}
                      {s.isTrainingSki === 1 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">{L("Trening", "Training")}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {([
                        [L("Merke", "Brand"), s.brand],
                        [L("Konstruksjon", "Construction"), s.construction],
                        ["Mold", s.mold],
                        ["Base", s.base],
                        [L("Slip", "Grind"), s.grind],
                        [L("Høyder", "Heights"), s.heights],
                        ["Year", s.year],
                        [L("Lengde", "Length"), s.length],
                        [L("Type", "Type"), s.typeOfSki],
                        [L("Serienr.", "Serial"), s.serialNumber],
                      ] as [string, string | null][]).filter(([, v]) => !!v).map(([label, v]) => (
                        <span key={label}><span className="font-medium text-foreground">{label}:</span> {v}</span>
                      ))}
                    </div>
                    {s.notes && <div className="mt-0.5 text-[11px] text-muted-foreground italic">{s.notes}</div>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => openEdit(s)} data-testid={`button-edit-fleet-${s.id}`} title={L("Rediger", "Edit")}><Pencil className="h-4 w-4" /></button>
                      <button className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => { if (confirm(L("Slette denne skien?", "Delete this ski?"))) deleteMutation.mutate(s.id); }} data-testid={`button-delete-fleet-${s.id}`} title={L("Slett", "Delete")}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? L("Rediger konkurranseski", "Edit competition ski") : L("Legg til konkurranseski", "Add competition ski")}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (form.skiId.trim() && form.discipline.trim()) saveMutation.mutate(); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {field("skiId", L("Ski-ID *", "Ski ID *"), "e.g. 003")}
                {field("discipline", L("Stilart *", "Discipline *"), L("Skøyt / Klassisk", "Skate / Classic"))}
                {field("serialNumber", L("Serienummer", "Serial number"))}
                {field("brand", L("Merke", "Brand"), "Madshus")}
                {field("construction", L("Konstruksjon", "Construction"))}
                {field("mold", "Mold")}
                {field("base", "Base")}
                {field("grind", L("Slip", "Grind"))}
                {field("heights", L("Høyder", "Heights"))}
                {field("year", "Year")}
                {field("length", L("Lengde", "Length"))}
                {field("typeOfSki", L("Type ski", "Type of ski"), L("Klister/Cover, Zero", "Klister/Cover, Zero"))}
              </div>
              {field("whereReceived", L("Hvor mottatt", "Where received"))}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{L("Notater", "Notes")}</label>
                <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} data-testid="fleet-input-notes" />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isSitski} onChange={(e) => set("isSitski", e.target.checked)} className="h-4 w-4" data-testid="fleet-input-sitski" />
                  <span className="inline-flex items-center gap-1"><Accessibility className="h-4 w-4 text-fuchsia-600" />{L("Sitski (kjelke)", "Sit-ski (sledge)")}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isTrainingSki} onChange={(e) => set("isTrainingSki", e.target.checked)} className="h-4 w-4" data-testid="fleet-input-training" />
                  {L("Treningsski", "Training ski")}
                </label>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saveMutation.isPending || !form.skiId.trim() || !form.discipline.trim()} data-testid="button-save-fleet">
                  {saveMutation.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
