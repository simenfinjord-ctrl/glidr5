// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flag, Plus, X, ChevronDown, ChevronRight, Pencil, Check, Trash2, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Product = { id: number; category: string; brand: string; name: string };

type RacePrep = {
  id: number;
  teamId: number;
  date: string;
  location: string;
  raceType: string;
  discipline: string;
  products: string | null;
  method: string | null;
  structure: string | null;
  notes: string | null;
  productIds: string | null;
  structureIds: string | null;
  kickProductIds: string | null;
  tette: string | null;
  createdById: number;
  createdByName: string;
  createdAt: string;
};

type RacePrepEntry = {
  id: number;
  racePrepId: number;
  athleteId: number;
  athleteName: string;
  skiId: string | null;
  waxerId: number | null;
  waxerName: string | null;
  notes: string | null;
  createdAt: string;
};

type Athlete = {
  id: number;
  name: string;
  team: string | null;
};

const parseIds = (s: string | null) => s ? s.split(",").map(Number).filter(Boolean) : [];

function productNames(ids: string | null, products: Product[]): string {
  if (!ids) return "";
  return ids.split(",").map(id => {
    const p = products.find(p => p.id === parseInt(id));
    return p ? `${p.brand} ${p.name}` : "";
  }).filter(Boolean).join(" + ");
}

const EMPTY_FORM = {
  date: "",
  location: "",
  raceType: "",
  discipline: "Klassisk",
  productIds: [] as number[],
  structureIds: [] as number[],
  kickProductIds: [] as number[],
  tette: "",
  method: "",
  notes: "",
};

// Values stored in DB as English; labels shown per language
const DISCIPLINES = ["Classic", "Skating", "Skiathlon"];
const DISCIPLINE_LABEL: Record<string, { no: string; en: string }> = {
  Classic:   { no: "Klassisk",  en: "Classic" },
  Skating:   { no: "Skøyting",  en: "Skating" },
  Skiathlon: { no: "Skiathlon", en: "Skiathlon" },
};

const DISCIPLINE_COLORS: Record<string, string> = {
  Classic:   "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800",
  Skating:   "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800",
  Skiathlon: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-800",
};

function fmtDate(d: string, lang: string) {
  try {
    return new Date(d).toLocaleDateString(lang === "en" ? "en-GB" : "nb-NO", { dateStyle: "medium" });
  } catch {
    return d;
  }
}

// ── Multi-product picker ──────────────────────────────────────────────────────
function MultiProductPicker({
  value,
  onChange,
  products,
  placeholder,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  products: Product[];
  placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const selected = products.filter(p => value.includes(p.id));
  const filtered = search.trim()
    ? products.filter(p =>
        !value.includes(p.id) &&
        `${p.brand} ${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase())
      )
    : products.filter(p => !value.includes(p.id)).slice(0, 20);

  return (
    <div className="space-y-1.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(p => (
            <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
              {p.brand} {p.name}
              <button type="button" onClick={() => onChange(value.filter(id => id !== p.id))} className="ml-0.5 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        placeholder={placeholder}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      {search.trim() && filtered.length > 0 && (
        <div className="rounded-lg border border-border bg-card shadow-sm max-h-40 overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors"
              onClick={() => { onChange([...value, p.id]); setSearch(""); }}
            >
              <span className="font-medium">{p.brand} {p.name}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">{p.category}</span>
            </button>
          ))}
        </div>
      )}
      {search.trim() && filtered.length === 0 && (
        <p className="text-xs text-muted-foreground px-1">No products found</p>
      )}
    </div>
  );
}

// ── Inline ski-ID editor ──────────────────────────────────────────────────────
function SkiIdCell({
  entry,
  canEdit,
  prepId,
  onSaved,
}: {
  entry: RacePrepEntry;
  canEdit: boolean;
  prepId: number;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(entry.skiId ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiRequest("PUT", `/api/race-preps/${prepId}/entries/${entry.id}`, {
        skiId: val.trim() || null,
        notes: entry.notes,
      });
      onSaved();
      setEditing(false);
    } catch {
      toast({ title: "Feil", description: "Kunne ikke lagre Ski-ID", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return <span className="text-sm">{entry.skiId ?? <span className="text-muted-foreground">—</span>}</span>;
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          className="h-7 w-24 text-xs"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setVal(entry.skiId ?? ""); } }}
          autoFocus
        />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={save} disabled={saving}>
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditing(false); setVal(entry.skiId ?? ""); }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <button
      className="flex items-center gap-1.5 group text-sm"
      onClick={() => setEditing(true)}
    >
      <span>{entry.skiId ?? <span className="text-muted-foreground">—</span>}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ── Detail dialog ─────────────────────────────────────────────────────────────
function PrepDetailDialog({
  prep,
  open,
  onClose,
  isAdmin,
  userId,
  lang,
}: {
  prep: RacePrep;
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  userId: number;
  lang: string;
}) {
  const { toast } = useToast();
  const [addAthletesOpen, setAddAthletesOpen] = useState(false);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<number>>(new Set());
  const [addingSaving, setAddingSaving] = useState(false);

  const { data: entries = [], refetch: refetchEntries } = useQuery<RacePrepEntry[]>({
    queryKey: [`/api/race-preps/${prep.id}/entries`],
    enabled: open,
  });

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ["/api/athletes"],
    enabled: addAthletesOpen,
  });

  const alreadyAddedIds = useMemo(() => new Set(entries.map((e) => e.athleteId)), [entries]);
  const L = (no: string, en: string) => lang === "en" ? en : no;

  function canEditEntry(entry: RacePrepEntry): boolean {
    return isAdmin || entry.waxerId === null || entry.waxerId === userId;
  }

  async function removeEntry(entryId: number) {
    try {
      await apiRequest("DELETE", `/api/race-preps/${prep.id}/entries/${entryId}`);
      refetchEntries();
    } catch {
      toast({ title: "Feil", description: "Kunne ikke fjerne løper", variant: "destructive" });
    }
  }

  async function addAthletes() {
    if (selectedAthleteIds.size === 0) return;
    setAddingSaving(true);
    try {
      const toAdd = athletes.filter((a) => selectedAthleteIds.has(a.id) && !alreadyAddedIds.has(a.id));
      await Promise.all(
        toAdd.map((a) =>
          apiRequest("POST", `/api/race-preps/${prep.id}/entries`, { athleteId: a.id, athleteName: a.name })
        )
      );
      await refetchEntries();
      setSelectedAthleteIds(new Set());
      setAddAthletesOpen(false);
    } catch {
      toast({ title: "Feil", description: "Kunne ikke legge til løpere", variant: "destructive" });
    } finally {
      setAddingSaving(false);
    }
  }

  const glideNames = productNames(prep.productIds, products);
  const structureNamesStr = productNames(prep.structureIds, products);
  const kickNames = productNames(prep.kickProductIds, products);
  const showKick = prep.discipline === "Classic" || prep.discipline === "Skiathlon";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-primary" />
            {prep.location} — {fmtDate(prep.date, lang)}
          </DialogTitle>
        </DialogHeader>

        {/* Race info */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{L("Renntype", "Race type")}</p>
            <p className="font-medium">{prep.raceType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{L("Stilart", "Discipline")}</p>
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", DISCIPLINE_COLORS[prep.discipline] ?? "")}>
              {DISCIPLINE_LABEL[prep.discipline]?.[lang] ?? prep.discipline}
            </span>
          </div>
          {glideNames && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{L("Produkter (glid)", "Products (glide)")}</p>
              <p className="font-medium">{glideNames}</p>
            </div>
          )}
          {structureNamesStr && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{L("Struktur", "Structure")}</p>
              <p className="font-medium">{structureNamesStr}</p>
            </div>
          )}
          {showKick && kickNames && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Kick</p>
              <p className="font-medium">{kickNames}</p>
            </div>
          )}
          {showKick && prep.tette && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{lang === "en" ? "Binder" : "Tette"}</p>
              <p className="font-medium">{prep.tette}</p>
            </div>
          )}
          {prep.method && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{L("Metode", "Method")}</p>
              <p className="font-medium">{prep.method}</p>
            </div>
          )}
          {/* Legacy text fields fallback */}
          {!glideNames && prep.products && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{L("Produkter", "Products")}</p>
              <p className="font-medium">{prep.products}</p>
            </div>
          )}
          {!structureNamesStr && prep.structure && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{L("Struktur", "Structure")}</p>
              <p className="font-medium">{prep.structure}</p>
            </div>
          )}
          {prep.notes && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-muted-foreground mb-0.5">{L("Notater", "Notes")}</p>
              <p className="text-muted-foreground">{prep.notes}</p>
            </div>
          )}
        </div>

        {/* Start list */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              {L("Startliste", "Start list")}
              <span className="text-xs font-normal text-muted-foreground">({entries.length})</span>
            </h3>
            {isAdmin && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setAddAthletesOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />
                {L("Legg til løper", "Add athlete")}
              </Button>
            )}
          </div>

          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">
              {L("Ingen løpere lagt til ennå.", "No athletes added yet.")}
            </p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">{L("Løper", "Athlete")}</th>
                    <th className="px-3 py-2">Ski-ID</th>
                    <th className="px-3 py-2">{L("Smører", "Waxer")}</th>
                    {isAdmin && <th className="px-3 py-2 w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-medium">{entry.athleteName}</td>
                      <td className="px-3 py-2.5">
                        <SkiIdCell
                          entry={entry}
                          canEdit={canEditEntry(entry)}
                          prepId={prep.id}
                          onSaved={refetchEntries}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{entry.waxerName ?? "—"}</td>
                      {isAdmin && (
                        <td className="px-3 py-2.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() => removeEntry(entry.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add athletes sub-dialog */}
        <Dialog open={addAthletesOpen} onOpenChange={setAddAthletesOpen}>
          <DialogContent className="max-w-sm max-h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{L("Legg til løpere på startlisten", "Add athletes to start list")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {athletes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{L("Ingen løpere registrert.", "No athletes found.")}</p>
              ) : (
                athletes.map((a) => {
                  const alreadyAdded = alreadyAddedIds.has(a.id);
                  return (
                    <div key={a.id} className={cn("flex items-center gap-3 rounded-lg px-3 py-2", alreadyAdded ? "opacity-40" : "hover:bg-muted/30")}>
                      <Checkbox
                        id={`ath-${a.id}`}
                        checked={alreadyAdded || selectedAthleteIds.has(a.id)}
                        disabled={alreadyAdded}
                        onCheckedChange={(checked) => {
                          setSelectedAthleteIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(a.id); else next.delete(a.id);
                            return next;
                          });
                        }}
                      />
                      <label htmlFor={`ath-${a.id}`} className={cn("text-sm cursor-pointer", alreadyAdded && "cursor-default")}>
                        {a.name}
                        {alreadyAdded && <span className="ml-2 text-xs text-muted-foreground">({L("allerede lagt til", "already added")})</span>}
                      </label>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setAddAthletesOpen(false)}>{L("Avbryt", "Cancel")}</Button>
              <Button size="sm" onClick={addAthletes} disabled={selectedAthleteIds.size === 0 || addingSaving}>
                {L(`Legg til (${selectedAthleteIds.size})`, `Add (${selectedAthleteIds.size})`)}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

// ── Create / Edit form dialog ─────────────────────────────────────────────────
function PrepFormDialog({
  open,
  onClose,
  editPrep,
  lang,
}: {
  open: boolean;
  onClose: (saved: boolean) => void;
  editPrep?: RacePrep;
  lang: string;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const [form, setForm] = useState(() =>
    editPrep
      ? {
          date: editPrep.date,
          location: editPrep.location,
          raceType: editPrep.raceType,
          discipline: editPrep.discipline,
          productIds: parseIds(editPrep.productIds),
          structureIds: parseIds(editPrep.structureIds),
          kickProductIds: parseIds(editPrep.kickProductIds),
          tette: editPrep.tette ?? "",
          method: editPrep.method ?? "",
          notes: editPrep.notes ?? "",
        }
      : { ...EMPTY_FORM }
  );

  const L = (no: string, en: string) => lang === "en" ? en : no;

  function f<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  const showKick = form.discipline === "Classic" || form.discipline === "Skiathlon";

  async function submit() {
    if (!form.date || !form.location || !form.raceType || !form.discipline) return;
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        location: form.location,
        raceType: form.raceType,
        discipline: form.discipline,
        productIds: form.productIds.join(","),
        structureIds: form.structureIds.join(","),
        kickProductIds: form.kickProductIds.join(","),
        tette: form.tette,
        method: form.method,
        notes: form.notes,
      };
      if (editPrep) {
        await apiRequest("PUT", `/api/race-preps/${editPrep.id}`, payload);
      } else {
        await apiRequest("POST", "/api/race-preps", payload);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/race-preps"] });
      onClose(true);
    } catch {
      toast({ title: L("Feil", "Error"), description: L("Kunne ikke lagre", "Could not save"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(false); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editPrep ? L("Rediger raceprep", "Edit race prep") : L("Ny raceprep", "New race prep")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium">{L("Dato", "Date")} *</label>
            <Input type="date" value={form.date} onChange={(e) => f("date", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{L("Lokasjon", "Location")} *</label>
            <Input value={form.location} onChange={(e) => f("location", e.target.value)} placeholder={L("f.eks. Davos", "e.g. Davos")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{L("Renntype", "Race type")} *</label>
            <Input value={form.raceType} onChange={(e) => f("raceType", e.target.value)} placeholder={L("f.eks. 10km", "e.g. 10km")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{L("Stilart", "Discipline")} *</label>
            <Select value={form.discipline} onValueChange={(v) => f("discipline", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{DISCIPLINE_LABEL[d]?.[lang] ?? d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{L("Produkt(er) — glid", "Product(s) — glide")}</label>
            <MultiProductPicker
              value={form.productIds}
              onChange={(ids) => f("productIds", ids)}
              products={products}
              placeholder={L("Søk etter produkt...", "Search for product...")}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{L("Struktur", "Structure")}</label>
            <MultiProductPicker
              value={form.structureIds}
              onChange={(ids) => f("structureIds", ids)}
              products={products.filter(p => p.category === "Structure tool")}
              placeholder={L("Søk etter struktur...", "Search for structure tool...")}
            />
          </div>
          {showKick && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Kick</label>
              <MultiProductPicker
                value={form.kickProductIds}
                onChange={(ids) => f("kickProductIds", ids)}
                products={products}
                placeholder={L("Søk etter kick-produkt...", "Search for kick product...")}
              />
            </div>
          )}
          {showKick && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">{L("Tette", "Binder")}</label>
              <Input value={form.tette} onChange={(e) => f("tette", e.target.value)} placeholder={L("f.eks. Rode Violet", "e.g. Rode Violet")} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{L("Metode", "Method")}</label>
            <Input value={form.method} onChange={(e) => f("method", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">{L("Notater", "Notes")}</label>
            <Textarea value={form.notes} onChange={(e) => f("notes", e.target.value)} rows={2} className="resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onClose(false)}>{L("Avbryt", "Cancel")}</Button>
          <Button onClick={submit} disabled={saving || !form.date || !form.location || !form.raceType}>{L("Lagre", "Save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RacePrep() {
  const { user, can, isTeamAdmin, isSuperAdmin } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const isAdmin = !!(isTeamAdmin || isSuperAdmin);

  const { data: preps = [], isLoading } = useQuery<RacePrep[]>({
    queryKey: ["/api/race-preps"],
    enabled: can("raceskis", "view"),
  });

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editPrep, setEditPrep] = useState<RacePrep | null>(null);
  const [detailPrep, setDetailPrep] = useState<RacePrep | null>(null);

  const L = (no: string, en: string) => lang === "en" ? en : no;

  async function deletePrep(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(L("Slett denne racepreppen?", "Delete this race prep?"))) return;
    try {
      await apiRequest("DELETE", `/api/race-preps/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/race-preps"] });
      toast({ title: L("Slettet", "Deleted") });
    } catch {
      toast({ title: L("Feil", "Error"), variant: "destructive" });
    }
  }

  if (!can("raceskis", "view")) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[40vh]">
          <p className="text-muted-foreground text-sm">{L("Ingen tilgang", "No access")}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Flag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Raceprep</h1>
          </div>
          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {L("Ny raceprep", "New race prep")}
            </Button>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : preps.length === 0 ? (
          <Card className="rounded-2xl p-10 text-center">
            <Flag className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">
              {L("Ingen raceprep registrert ennå.", "No race preps registered yet.")}
            </p>
            {isAdmin && (
              <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                {L("Opprett den første", "Create the first one")}
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {preps.map((prep) => {
              const glideDisplay = productNames(prep.productIds, products) || prep.products || null;
              return (
                <Card
                  key={prep.id}
                  className="rounded-2xl px-5 py-4 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4"
                  onClick={() => setDetailPrep(prep)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{prep.location}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(prep.date, lang)}</span>
                      <Badge variant="outline" className="text-xs">{prep.raceType}</Badge>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1", DISCIPLINE_COLORS[prep.discipline] ?? "")}>
                        {prep.discipline}
                      </span>
                    </div>
                    {glideDisplay && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{glideDisplay}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); setEditPrep(prep); }}
                        title={L("Rediger", "Edit")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                        onClick={(e) => deletePrep(prep.id, e)}
                        title={L("Slett", "Delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      {createOpen && (
        <PrepFormDialog
          open={createOpen}
          onClose={(saved) => { setCreateOpen(false); }}
          lang={lang}
        />
      )}

      {/* Edit dialog */}
      {editPrep && (
        <PrepFormDialog
          open={!!editPrep}
          onClose={() => setEditPrep(null)}
          editPrep={editPrep}
          lang={lang}
        />
      )}

      {/* Detail dialog */}
      {detailPrep && (
        <PrepDetailDialog
          prep={detailPrep}
          open={!!detailPrep}
          onClose={() => setDetailPrep(null)}
          isAdmin={isAdmin}
          userId={user?.id ?? 0}
          lang={lang}
        />
      )}
    </AppShell>
  );
}
