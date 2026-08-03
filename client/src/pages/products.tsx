// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { Fragment, useMemo, useState, useEffect } from "react";
import { fmtT } from "@/lib/temperature";
import { fetchEntriesBulk } from "@/lib/entries-bulk";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Filter, PackagePlus, Pencil, Trash2, Users, Minus, Plus, Warehouse, History, ArrowUp, ArrowDown, CheckSquare, Square, FlaskConical, MapPin, Thermometer, Droplets, Snowflake, ChevronDown, Archive, ArchiveRestore, MoreHorizontal, LayoutGrid, Table2, Layers } from "lucide-react";
import { ProductCompare } from "@/pages/analytics";
import { EmptyState } from "@/components/empty-state";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient, OfflineError } from "@/lib/queryClient";
import { useOffline } from "@/lib/offline-context";
import { cn, fmtDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

// Product categories === the product tags used across Glidr / Google Sheet sync.
const PRODUCT_CATEGORIES = ["Paraffin", "Liquid", "Block", "Structure Tool"] as const;

function productCategoryKey(v: string) {
  // Categories are now plain tag names (no i18n key); show as-is.
  return v;
}

type ProductCategory = typeof PRODUCT_CATEGORIES[number];

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
  createdAt: string;
  createdById: number;
  createdByName: string;
  groupScope: string;
  stockQuantity: number;
  orderQuantity?: number;
  archivedAt: string | null;
};

type ApiGroup = { id: number; name: string };


const schema = z.object({
  category: z.enum(["Paraffin", "Liquid", "Block", "Structure Tool"]),
  brand: z.string().min(1, "Brand is required"),
  name: z.string().min(1, "Name is required"),
});

function categoryBadgeClass(cat: string) {
  if (cat === "Paraffin") return "fs-badge-glide";
  if (cat === "Liquid") return "fs-badge-topping";
  if (cat === "Block") return "fs-badge-glide";
  return "fs-badge-structure";
}

function AddProductModal({ onSaved }: { onSaved: () => void }) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const { queueMutation } = useOffline();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "Paraffin",
      brand: "",
      name: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      try {
        const res = await apiRequest("POST", "/api/products", data);
        return res.json();
      } catch (err) {
        if (err instanceof OfflineError) {
          await queueMutation(err.method, err.url, err.body, "Save new product");
          return { offline: true };
        }
        throw err;
      }
    },
    onSuccess: (result) => {
      if (result?.offline) {
        toast({ title: L("Lagret offline", "Saved offline"), description: L("Synkroniseres når du er tilkoblet igjen.", "Will sync when you reconnect.") });
        onSaved();
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: L("Produkt lagt til", "Product added") });
      onSaved();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Unknown error";
      const isLimitError = msg.toLowerCase().includes("limit");
      toast({
        title: L("Kunne ikke legge til produkt", "Could not add product"),
        description: isLimitError ? t("products.limitReached") : msg,
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("products.category")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid="select-product-category">
                    <SelectValue placeholder={L("Velg", "Select")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Powder">Powder</SelectItem>
                  <SelectItem value="Paraffin">Paraffin</SelectItem>
                  <SelectItem value="Liquid">Liquid</SelectItem>
                  <SelectItem value="Block">Block</SelectItem>
                  <SelectItem value="Structure Tool">Structure Tool</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="brand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("products.brand")}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-product-brand" placeholder={L("f.eks. Swix", "e.g., Swix")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("products.name")}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-product-name" placeholder={L("f.eks. HS10", "e.g., HS10")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end">
          <Button type="submit" data-testid="button-save-product">
            {t("products.addProduct")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function EditProductModal({
  product,
  onSaved,
}: {
  product: Product;
  onSaved: () => void;
}) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: product.category as ProductCategory,
      brand: product.brand,
      name: product.name,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      const res = await apiRequest("PUT", `/api/products/${product.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: L("Produkt oppdatert", "Product updated") });
      onSaved();
    },
    onError: (e) => {
      toast({
        title: L("Kunne ikke oppdatere produkt", "Could not update product"),
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("products.category")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid="select-edit-product-category">
                    <SelectValue placeholder={L("Velg", "Select")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Powder">Powder</SelectItem>
                  <SelectItem value="Paraffin">Paraffin</SelectItem>
                  <SelectItem value="Liquid">Liquid</SelectItem>
                  <SelectItem value="Block">Block</SelectItem>
                  <SelectItem value="Structure Tool">Structure Tool</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="brand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("products.brand")}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-edit-product-brand" placeholder={L("f.eks. Swix", "e.g., Swix")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("products.name")}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-edit-product-name" placeholder={L("f.eks. HS10", "e.g., HS10")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end">
          <Button type="submit" data-testid="button-update-product" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : t("common.save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function GroupAssignModal({
  product,
  groupNames,
  onDone,
}: {
  product: Product;
  groupNames: string[];
  onDone: () => void;
}) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const currentGroups = product.groupScope.split(",").map((s) => s.trim()).filter(Boolean);
  const [selected, setSelected] = useState<string[]>(currentGroups);

  const toggle = (g: string) => {
    setSelected((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/products/${product.id}`, {
        groupScope: selected.join(","),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: L("Grupper oppdatert", "Groups updated"), description: L(`${product.brand} ${product.name} tilordnet ${selected.join(", ")}`, `${product.brand} ${product.name} assigned to ${selected.join(", ")}`) });
      onDone();
    },
    onError: (e) => {
      toast({ title: L("Feil", "Error"), description: e instanceof Error ? e.message : L("Ukjent feil", "Unknown error"), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <div className="text-sm font-medium">{product.brand} {product.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {L("Nå i:", "Currently in:")} <span className="font-medium text-foreground">{product.groupScope}</span>
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">{L("Tilordne til grupper", "Assign to groups")}</label>
        <div className="space-y-2">
          {groupNames.map((g) => (
            <label
              key={g}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                selected.includes(g)
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-muted/30 hover:bg-background/50"
              )}
            >
              <Checkbox
                checked={selected.includes(g)}
                onCheckedChange={() => toggle(g)}
                data-testid={`checkbox-group-${g}`}
              />
              <span className="text-sm">{g}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          data-testid="button-save-groups"
          disabled={selected.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <Users className="mr-2 h-4 w-4" />
          {L("Lagre", "Save")}
        </Button>
      </div>
    </div>
  );
}

// ── Google Sheet → Products connection (admin only) ──────────────────────────
function ProductSheetDialog({ teamId, lang }: { teamId: number; lang: string }) {
  const L = (no: string, en: string) => (lang === "no" ? no : en);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const { data: teams = [] } = useQuery<any[]>({ queryKey: ["/api/teams"], enabled: open });
  const { data: status } = useQuery<any>({ queryKey: ["/api/backup/status"], enabled: open });
  const team = teams.find((t) => t.id === teamId) ?? teams[0];

  useEffect(() => {
    if (team) setUrl(team.productSheetUrl ?? "");
  }, [team?.id, team?.productSheetUrl]);

  const saveMutation = useMutation({
    mutationFn: async () => apiRequest("PUT", `/api/teams/${teamId}/product-sheet`, { url: url.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: L("Lenke lagret", "Link saved") });
    },
    onError: (e: any) => toast({ title: L("Kunne ikke lagre", "Could not save"), description: e?.message, variant: "destructive" }),
  });

  const [report, setReport] = useState<any>(null);
  const archiveMissing = useMutation({
    mutationFn: async (ids: number[]) => {
      let n = 0;
      for (const id of ids) {
        const res = await apiRequest("POST", `/api/products/${id}/archive`, { archived: true }).catch(() => null);
        if (res?.ok) n++;
      }
      return n;
    },
    onSuccess: (n: number) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: L(`${n} produkter arkivert`, `${n} products archived`), description: L("Kjør «Synkroniser nå» igjen for oppdatert avstemming.", "Run Sync now again for a fresh reconciliation.") });
    },
    onError: (e: any) => toast({ title: L("Kunne ikke arkivere", "Could not archive"), description: e?.message, variant: "destructive" }),
  });
  const pushMissing = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/products/push-to-sheet", { ids });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: L(`${data.pushed} produkter lagt inn i arket`, `${data.pushed} products added to the sheet`), description: L("Kjør «Synkroniser nå» igjen for oppdatert avstemming.", "Run Sync now again for a fresh reconciliation.") });
    },
    onError: (e: any) => toast({ title: L("Kunne ikke legge til", "Could not add"), description: e?.message, variant: "destructive" }),
  });
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/teams/${teamId}/product-sync`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setResult(L(`${data.added} lagt til, ${data.updated ?? 0} oppdatert, ${data.skipped} hoppet over (av ${data.rows} rader).`,
                  `${data.added} added, ${data.updated ?? 0} updated, ${data.skipped} skipped (of ${data.rows} rows).`));
      setReport(data.report ?? null);
      toast({ title: L("Synkronisering fullført", "Sync complete") });
    },
    onError: (e: any) => toast({ title: L("Synkronisering feilet", "Sync failed"), description: e?.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-product-sheet">
          <Table2 className="mr-2 h-4 w-4" />
          {L("Google Sheet", "Google Sheet")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{L("Koble til Google Sheet", "Connect Google Sheet")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {L("Lim inn lenken til regnearket med produktene deres. Nye rader synkroniseres automatisk hvert 5. minutt (eller med «Synkroniser nå»). Produkter fjernes aldri fra Glidr selv om de fjernes fra arket.",
               "Paste the link to your products spreadsheet. New rows sync automatically every 5 minutes (or with “Sync now”). Products are never removed from Glidr even if removed from the sheet.")}
          </p>
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">{L("Slik gjør du:", "How to:")}</p>
            <p>{L("1. Del regnearket (Del → Alle med lenken kan se), eller del direkte med:", "1. Share the sheet (Share → Anyone with the link can view), or share directly with:")}</p>
            {status?.serviceAccountEmail
              ? <p className="font-mono break-all text-foreground mt-1">{status.serviceAccountEmail}</p>
              : <p className="italic mt-1">{L("(tjenestekonto ikke konfigurert på serveren)", "(service account not configured on the server)")}</p>}
            <p className="mt-2">{L("2. Header-raden må ha kolonner for Merke/Brand og Navn/Name. Valgfritt: Kategori/Category, Lager/Stock.",
                                   "2. The header row must have columns for Brand/Merke and Name/Navn. Optional: Category/Kategori, Stock/Lager.")}</p>
            <p className="mt-1">{L("3. Kategori tolkes automatisk til riktig tag: Paraffin, Liquid, Block eller Structure Tool.",
                                   "3. Category is interpreted automatically into the right tag: Paraffin, Liquid, Block or Structure Tool.")}</p>
          </div>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            data-testid="input-product-sheet-url"
          />
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-product-sheet">
              {saveMutation.isPending ? L("Lagrer…", "Saving…") : L("Lagre lenke", "Save link")}
            </Button>
            <Button size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || !team?.productSheetUrl} data-testid="button-sync-products">
              {syncMutation.isPending ? L("Synkroniserer…", "Syncing…") : L("Synkroniser nå", "Sync now")}
            </Button>
          </div>
          {result && <p className="text-xs text-emerald-600">{result}</p>}
          {report && (
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-2.5 text-[11px]" data-testid="sync-report">
              <div className="font-semibold">{L("Avstemming ark ↔ Glidr", "Reconciliation sheet ↔ Glidr")}</div>
              <div className="text-muted-foreground">
                {L(`${report.matchedProducts} produkter dekket av arket`, `${report.matchedProducts} products covered by the sheet`)}
                {report.blankRows > 0 && L(` · ${report.blankRows} tomme rader`, ` · ${report.blankRows} blank rows`)}
              </div>
              {(report.collisions ?? []).length > 0 && (
                <div>
                  <div className="font-medium text-amber-700 dark:text-amber-400">{L(`${report.collisions.length} rader delte produkt med en annen rad:`, `${report.collisions.length} rows shared a product with another row:`)}</div>
                  <div className="text-muted-foreground">{report.collisions.slice(0, 12).map((c: any) => `rad ${c.row}: ${c.label}`).join(" · ")}{report.collisions.length > 12 ? " …" : ""}</div>
                </div>
              )}
              {(report.notInSheet ?? []).length > 0 && (
                <div className="space-y-1">
                  <div className="font-medium">{L(`${report.notInSheet.length} Glidr-produkter finnes ikke i arket:`, `${report.notInSheet.length} Glidr products not in the sheet:`)}</div>
                  <div className="text-muted-foreground">
                    {report.notInSheet.slice(0, 15).map((x: any) => `${x.label}${x.isMix ? L(" (mix)", " (mix)") : ""}${x.archived ? L(" (arkivert)", " (archived)") : ""}`).join(" · ")}
                    {report.notInSheet.length > 15 ? " …" : ""}
                  </div>
                  {report.notInSheet.some((x: any) => !x.archived) && (
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]"
                        disabled={pushMissing.isPending || archiveMissing.isPending}
                        onClick={() => pushMissing.mutate(report.notInSheet.filter((x: any) => !x.archived).map((x: any) => x.id))}
                        data-testid="button-push-missing">
                        {pushMissing.isPending
                          ? L("Legger til i arket…", "Adding to sheet…")
                          : L(`Legg de ${report.notInSheet.filter((x: any) => !x.archived).length} aktive inn i arket`, `Add the ${report.notInSheet.filter((x: any) => !x.archived).length} active ones to the sheet`)}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] text-amber-700 dark:text-amber-400"
                        disabled={pushMissing.isPending || archiveMissing.isPending}
                        onClick={() => {
                          const list = report.notInSheet.filter((x: any) => !x.archived);
                          if (confirm(L(`Arkivere ${list.length} produkter? De skjules fra lister og telling, men historikken beholdes og de kan gjenopprettes fra arkivet.`, `Archive ${list.length} products? They are hidden from lists and counts, but history is kept and they can be restored from the archive.`)))
                            archiveMissing.mutate(list.map((x: any) => x.id));
                        }}
                        data-testid="button-archive-missing">
                        {archiveMissing.isPending
                          ? L("Arkiverer…", "Archiving…")
                          : L(`Arkiver de ${report.notInSheet.filter((x: any) => !x.archived).length} i stedet`, `Archive the ${report.notInSheet.filter((x: any) => !x.archived).length} instead`)}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {team?.productSheetGroup && (
            <p className="text-[11px] text-muted-foreground">{L("Importeres til gruppe:", "Imported into group:")} <span className="font-medium text-foreground">{team.productSheetGroup}</span></p>
          )}
          {team?.lastProductSyncAt && (
            <p className="text-[11px] text-muted-foreground">{L("Sist synkronisert:", "Last synced:")} {fmtDate(team.lastProductSyncAt)}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Glide mix builder ────────────────────────────────────────────────────────
// A mix becomes a REAL product with a per-team 3-digit serial: pick the type
// (which decides the serial range), compose it from existing products and/or
// free text, and it is immediately testable, searchable and analysable.
function GlideMixDialog({ products }: { products: Product[] }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("powder");
  const [notes, setNotes] = useState("");
  const [components, setComponents] = useState<{ productId: string; freeText: string; note: string }[]>([
    { productId: "", freeText: "", note: "" },
    { productId: "", freeText: "", note: "" },
  ]);

  const KINDS = [
    { v: "powder", label: L("Pulver", "Powder"), range: "001–300" },
    { v: "liquid", label: "Liquid", range: "301–399" },
    { v: "solid", label: L("Fast glider", "Solid glider"), range: "400–600" },
    { v: "other", label: L("Annet", "Other"), range: "601–699" },
  ];

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/glide-mixes", {
        name: name.trim(),
        mixKind: kind,
        notes: notes.trim() || null,
        components: components
          .filter((c) => c.productId || c.freeText.trim())
          .map((c) => ({
            productId: c.productId ? parseInt(c.productId) : null,
            freeText: c.freeText.trim() || null,
            note: c.note.trim() || null,
          })),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: L("Mix opprettet", "Mix created"),
        description: L(`«${data.name}» fikk serienummer ${data.serialNumber}.`, `"${data.name}" was assigned serial ${data.serialNumber}.`),
      });
      setOpen(false);
      setName(""); setNotes("");
      setComponents([{ productId: "", freeText: "", note: "" }, { productId: "", freeText: "", note: "" }]);
    },
    onError: (e: any) => toast({ title: L("Feil", "Error"), description: e?.message, variant: "destructive" }),
  });

  const glideProducts = products.filter((p) => !/structure|kick/i.test(p.category));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-add-glide-mix">
          <Layers className="mr-2 h-4 w-4" />
          {L("Ny mix", "New mix")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{L("Ny glide-mix", "New glide mix")}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {L("Mixen blir et eget produkt med serienummer — kan velges i tester, søkes opp og analyseres som alle andre produkter.",
               "The mix becomes its own product with a serial number — testable, searchable and analysable like any other product.")}
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{L("Navn *", "Name *")}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={L("f.eks. Kaldføre spesial", "e.g. Cold special")} data-testid="input-mix-name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{L("Type (bestemmer serienummer)", "Type (decides serial range)")}</label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger data-testid="select-mix-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.v} value={k.v}>{k.label} ({k.range})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{L("Komponenter", "Components")}</label>
            {components.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select value={c.productId || "none"} onValueChange={(v) => setComponents((prev) => prev.map((x, j) => j === i ? { ...x, productId: v === "none" ? "" : v } : x))}>
                  <SelectTrigger className="w-[210px] h-9 text-xs" data-testid={`select-mix-comp-${i}`}>
                    <SelectValue placeholder={L("Velg produkt", "Pick product")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[40vh]">
                    <SelectItem value="none">{L("— fritekst —", "— free text —")}</SelectItem>
                    {glideProducts.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <span>
                          {p.brand} {p.name}
                          {p.category && <span className="ml-1 text-muted-foreground">{p.category}</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!c.productId && (
                  <Input className="h-9 w-[150px] text-xs" placeholder={L("Fritekst", "Free text")} value={c.freeText}
                    onChange={(e) => setComponents((prev) => prev.map((x, j) => j === i ? { ...x, freeText: e.target.value } : x))} />
                )}
                <Input className="h-9 flex-1 min-w-[110px] text-xs" placeholder={L("Andel/notat (f.eks. 60 %)", "Share/note (e.g. 60%)")} value={c.note}
                  onChange={(e) => setComponents((prev) => prev.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
                {components.length > 1 && (
                  <button type="button" className="p-1 text-muted-foreground hover:text-red-500" onClick={() => setComponents((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setComponents((prev) => [...prev, { productId: "", freeText: "", note: "" }])}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />{L("Legg til komponent", "Add component")}
            </Button>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{L("Notater", "Notes")}</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={L("Påføring, temperaturvindu …", "Application, temperature window …")} />
          </div>
          <div className="flex justify-end">
            <Button disabled={createMutation.isPending || !name.trim()} onClick={() => createMutation.mutate()} data-testid="button-save-glide-mix">
              {createMutation.isPending ? L("Lagrer…", "Saving…") : L("Opprett mix", "Create mix")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Products() {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin || !!user?.isTeamAdmin;
  const activeTeamId = (user as any)?.activeTeamId || (user as any)?.teamId;
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"products" | "storage" | "archived" | "compare">("products");
  // Layout: cards or table, with a 1-3 column choice for card views —
  // persisted, and applied to Products, Storage and Archive alike.
  const [productLayout, setProductLayoutState] = useState<"grid" | "list" | "table">(() => {
    try {
      const v = localStorage.getItem("glidr-products-layout");
      if (v === "table") return "table";
    } catch {}
    return "grid";
  });
  const setProductLayout = (v: "grid" | "table") => {
    setProductLayoutState(v);
    try { localStorage.setItem("glidr-products-layout", v); } catch {}
  };
  const [prodCols, setProdColsState] = useState<1 | 2 | 3>(() => {
    try { const n = parseInt(localStorage.getItem("glidr-products-cols") || "2"); if (n === 1 || n === 2 || n === 3) return n as any; } catch {}
    return 2;
  });
  const setProdCols = (n: 1 | 2 | 3) => {
    setProdColsState(n);
    try { localStorage.setItem("glidr-products-cols", String(n)); } catch {}
  };
  const colsClass = prodCols === 1 ? "grid-cols-1" : prodCols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
  const [stockChangeGroupFilter, setStockChangeGroupFilter] = useState("All");
  const [stockSort, setStockSort] = useState<"asc" | "desc" | "alpha">("alpha");
  // Category multi-select: every category is ON by default; unchecking hides
  // it. Mixes act as their own pseudo-category regardless of base category.
  const [excludedCats, setExcludedCats] = useState<Set<string>>(new Set());
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const catKeyOf = (p: Product) => ((p as any).isMix ? "Mixes" : p.category);
  const { data: orderHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/product-orders"],
    enabled: viewMode === "storage",
  });
  const [groupFilter, setGroupFilter] = useState("All");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [nameSearch, setNameSearch] = useState("");
  const [racedFilter, setRacedFilter] = useState<"All" | "Raced" | "Not Raced">("All");
  const [testedFilter, setTestedFilter] = useState<"All" | "Tested" | "Not Tested">("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [editingDetailsProduct, setEditingDetailsProduct] = useState<Product | undefined>();
  const [deletingProduct, setDeletingProduct] = useState<Product | undefined>();
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkGroup, setBulkGroup] = useState<string>("");
  const { toast } = useToast();

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  // Categories are whatever the team's sheet/products actually use (Powder,
  // Paraffin, Block, …) — never a hard-coded list. Mixes is a pseudo-category.
  const FILTER_CATS = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category && !(p as any).isMix) set.add(p.category);
    return [...Array.from(set).sort(), "Mixes"];
  }, [products]);
  const { data: archivedProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products/archived"],
    enabled: viewMode === "archived" && isAdmin,
  });
  const { data: usageStats } = useQuery<{ racedIds: number[]; testedIds: number[] }>({
    queryKey: ["/api/products/usage-stats"],
  });
  const racedSet = useMemo(() => new Set(usageStats?.racedIds ?? []), [usageStats]);
  const testedSet = useMemo(() => new Set(usageStats?.testedIds ?? []), [usageStats]);

  const { data: apiGroups = [] } = useQuery<ApiGroup[]>({
    queryKey: ["/api/groups"],
    enabled: isAdmin,
  });
  const groupNames = apiGroups.map((g) => g.name);

  // Data for Compare view
  const { data: compareTests = [] } = useQuery<any[]>({
    queryKey: ["/api/tests"],
    enabled: viewMode === "compare",
  });
  const compareTestIds = useMemo(() => compareTests.map((t: any) => t.id), [compareTests]);
  const { data: compareEntriesAll = [] } = useQuery<any[]>({
    queryKey: ["/api/tests/entries/all-analytics", compareTestIds],
    enabled: viewMode === "compare" && compareTestIds.length > 0,
    queryFn: () => fetchEntriesBulk(compareTestIds),
  });
  const { data: compareWeatherAll = [] } = useQuery<any[]>({
    queryKey: ["/api/weather"],
    enabled: viewMode === "compare",
  });
  const compareProductsById = useMemo(() => {
    const map = new Map<number, any>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);
  const compareTestsById = useMemo(() => {
    const map = new Map<number, any>();
    for (const t of compareTests) map.set(t.id, t);
    return map;
  }, [compareTests]);
  const compareWeatherById = useMemo(() => {
    const map = new Map<number, any>();
    for (const w of compareWeatherAll) map.set(w.id, w);
    return map;
  }, [compareWeatherAll]);
  const compareFilteredTestIds = useMemo(() => new Set<number>(compareTests.map((t: any) => t.id)), [compareTests]);

  const uniqueGroups = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      p.groupScope.split(",").forEach((g) => {
        const trimmed = g.trim();
        // Skip a literal "All" group — it collides with the "All groups"
        // sentinel option (both use value "All") and showed as a duplicate.
        if (trimmed && trimmed.toLowerCase() !== "all") set.add(trimmed);
      });
    });
    return Array.from(set).sort();
  }, [products]);

  const uniqueBrands = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      counts[p.brand] = (counts[p.brand] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const filtered = useMemo(() => {
    const n = nameSearch.trim().toLowerCase();
    return products.filter((p) => {
      const okCategory = !excludedCats.has(catKeyOf(p));
      const okBrand = selectedBrand === "All" ? true : p.brand === selectedBrand;
      const okName = n
        ? (p.name.toLowerCase().includes(n)
           || ((p as any).serialNumber ? String((p as any).serialNumber).includes(n) : false))
        : true;
      const okGroup = groupFilter === "All" ? true : p.groupScope.split(",").map((g) => g.trim()).includes(groupFilter);
      const okRaced = racedFilter === "All" ? true : racedFilter === "Raced" ? racedSet.has(p.id) : !racedSet.has(p.id);
      const okTested = testedFilter === "All" ? true : testedFilter === "Tested" ? testedSet.has(p.id) : !testedSet.has(p.id);
      return okCategory && okBrand && okName && okGroup && okRaced && okTested;
    });
  }, [products, excludedCats, selectedBrand, nameSearch, groupFilter, racedFilter, testedFilter, racedSet, testedSet]);

  const activeFilterCount = [
    excludedCats.size > 0,
    groupFilter !== "All",
    selectedBrand !== "All",
    !!nameSearch.trim(),
    racedFilter !== "All",
    testedFilter !== "All",
  ].filter(Boolean).length;

  function clearFilters() {
    setExcludedCats(new Set());
    setGroupFilter("All");
    setSelectedBrand("All");
    setNameSearch("");
    setRacedFilter("All");
    setTestedFilter("All");
  }

  const sortedFiltered = useMemo(() => {
    if (viewMode !== "storage") return filtered;
    return [...filtered].sort((a, b) => {
      if (stockSort === "alpha") {
        const cmp = `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`);
        return cmp;
      }
      return stockSort === "asc"
        ? a.stockQuantity - b.stockQuantity
        : b.stockQuantity - a.stockQuantity;
    });
  }, [filtered, viewMode, stockSort]);

  const filteredArchived = useMemo(() => {
    const n = nameSearch.trim().toLowerCase();
    return archivedProducts.filter((p) => {
      const okCategory = !excludedCats.has(catKeyOf(p));
      const okBrand = selectedBrand === "All" ? true : p.brand === selectedBrand;
      const okName = n
        ? (p.name.toLowerCase().includes(n)
           || ((p as any).serialNumber ? String((p as any).serialNumber).includes(n) : false))
        : true;
      const okGroup = groupFilter === "All" ? true : p.groupScope.split(",").map((g) => g.trim()).includes(groupFilter);
      const okRaced = racedFilter === "All" ? true : racedFilter === "Raced" ? racedSet.has(p.id) : !racedSet.has(p.id);
      const okTested = testedFilter === "All" ? true : testedFilter === "Tested" ? testedSet.has(p.id) : !testedSet.has(p.id);
      return okCategory && okBrand && okName && okGroup && okRaced && okTested;
    });
  }, [archivedProducts, excludedCats, selectedBrand, nameSearch, groupFilter, racedFilter, testedFilter, racedSet, testedSet]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/archived"] });
      toast({ title: L("Produkt slettet", "Product deleted") });
      setDeletingProduct(undefined);
    },
    onError: (e) => {
      toast({ title: L("Feil", "Error"), description: e instanceof Error ? e.message : L("Ukjent feil", "Unknown error"), variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/products/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/archived"] });
      toast({ title: t("products.archived") });
    },
    onError: (e) => {
      toast({ title: L("Feil", "Error"), description: e instanceof Error ? e.message : L("Ukjent feil", "Unknown error"), variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/products/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/archived"] });
      toast({ title: t("products.restored") });
    },
    onError: (e) => {
      toast({ title: L("Feil", "Error"), description: e instanceof Error ? e.message : L("Ukjent feil", "Unknown error"), variant: "destructive" });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ ids, groupScope }: { ids: number[]; groupScope: string }) => {
      const res = await apiRequest("POST", "/api/products/bulk-assign-group", { ids, groupScope });
      return res.json();
    },
    onSuccess: (data: { updated: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedIds(new Set());
      setBulkGroup("");
      toast({ title: L(`Tilordnet ${data.updated} ${data.updated !== 1 ? "produkter" : "produkt"} til gruppe`, `Assigned ${data.updated} product${data.updated !== 1 ? "s" : ""} to group`) });
    },
    onError: (e) => {
      toast({ title: L("Feil", "Error"), description: e instanceof Error ? e.message : L("Ukjent feil", "Unknown error"), variant: "destructive" });
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => apiRequest("POST", `/api/products/${id}/archive`)));
    },
    onSuccess: (_d, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/archived"] });
      setSelectedIds(new Set());
      toast({ title: L(`Arkiverte ${ids.length} produkt${ids.length !== 1 ? "er" : ""}`, `Archived ${ids.length} product${ids.length !== 1 ? "s" : ""}`) });
    },
    onError: (e) => {
      toast({ title: L("Feil", "Error"), description: e instanceof Error ? e.message : L("Ukjent feil", "Unknown error"), variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => apiRequest("DELETE", `/api/products/${id}`)));
    },
    onSuccess: (_d, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/archived"] });
      setSelectedIds(new Set());
      toast({ title: L(`Slettet ${ids.length} produkt${ids.length !== 1 ? "er" : ""}`, `Deleted ${ids.length} product${ids.length !== 1 ? "s" : ""}`) });
    },
    onError: (e) => {
      toast({ title: L("Feil", "Error"), description: e instanceof Error ? e.message : L("Ukjent feil", "Unknown error"), variant: "destructive" });
    },
  });

  // ── Share selected products to other teams (TA on both sides) ────────────
  const [shareOpen, setShareOpen] = useState(false);
  // Per target team: checked or not + which of ITS groups the copies get.
  const [shareSel, setShareSel] = useState<Record<number, { on: boolean; groups: Set<string> }>>({});
  const { data: shareTargets } = useQuery<{ targets: { teamId: number; teamName: string; groups: string[] }[] }>({
    queryKey: ["/api/products/share-targets"],
    enabled: shareOpen,
  });
  const shareMutation = useMutation({
    mutationFn: async () => {
      const targets = Object.entries(shareSel)
        .filter(([, v]) => v.on)
        .map(([teamId, v]) => ({ teamId: parseInt(teamId), groups: Array.from(v.groups) }));
      const res = await apiRequest("POST", "/api/products/share-to-teams", {
        productIds: Array.from(selectedIds), targets,
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? "Failed");
      return res.json();
    },
    onSuccess: (data: { results: { teamId: number; created: number; skipped: number; mixesSkipped: number }[] }) => {
      const created = data.results.reduce((a, r) => a + r.created, 0);
      const skipped = data.results.reduce((a, r) => a + r.skipped, 0);
      const mixes = data.results.reduce((a, r) => a + r.mixesSkipped, 0);
      toast({
        title: L(`Delte ${created} produkt${created !== 1 ? "er" : ""}`, `Shared ${created} product${created !== 1 ? "s" : ""}`),
        description: [
          skipped > 0 ? L(`${skipped} fantes allerede`, `${skipped} already existed`) : null,
          mixes > 0 ? L(`${mixes} mixer hoppet over (oppskrifter er lagets egne)`, `${mixes} mixes skipped (recipes are team-local)`) : null,
        ].filter(Boolean).join(" · ") || undefined,
      });
      setShareOpen(false);
      setShareSel({});
      setSelectedIds(new Set());
    },
    onError: (e) => {
      toast({ title: L("Deling mislyktes", "Sharing failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    },
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => apiRequest("POST", `/api/products/${id}/restore`)));
    },
    onSuccess: (_d, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/archived"] });
      setSelectedIds(new Set());
      toast({ title: L(`Gjenopprettet ${ids.length} produkt${ids.length !== 1 ? "er" : ""}`, `Restored ${ids.length} product${ids.length !== 1 ? "s" : ""}`) });
    },
    onError: (e) => {
      toast({ title: L("Feil", "Error"), description: e instanceof Error ? e.message : L("Ukjent feil", "Unknown error"), variant: "destructive" });
    },
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        {/* Share to other teams: pick teams, then each team's groups. A copy —
            identical category/brand/name — statistics stay at home. */}
        <Dialog open={shareOpen} onOpenChange={(o) => { setShareOpen(o); if (!o) setShareSel({}); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{L(`Del ${selectedIds.size} produkt${selectedIds.size !== 1 ? "er" : ""} til andre lag`, `Share ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""} to other teams`)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {L("Produktene kopieres med identisk kategori og navn. Statistikk og testdata følger ikke med. Du kan bare dele til lag der du er lagadministrator.",
                   "Products are copied with identical category and name. Statistics and test data do not follow. You can only share to teams where you are a team admin.")}
              </p>
              {!shareTargets ? (
                <p className="text-sm text-muted-foreground">{L("Laster lag…", "Loading teams…")}</p>
              ) : shareTargets.targets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {L("Du er ikke lagadministrator på noen andre lag.", "You are not a team admin on any other team.")}
                </p>
              ) : (
                <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                  {shareTargets.targets.map((tt) => {
                    const sel = shareSel[tt.teamId] ?? { on: false, groups: new Set<string>() };
                    return (
                      <div key={tt.teamId} className={cn("rounded-lg border p-2.5", sel.on ? "border-primary/50 bg-primary/5" : "border-border")}>
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                          <input type="checkbox" checked={sel.on}
                            onChange={(e) => setShareSel((prev) => ({ ...prev, [tt.teamId]: { on: e.target.checked, groups: sel.groups } }))}
                            className="h-4 w-4 accent-green-600" data-testid={`share-team-${tt.teamId}`} />
                          {tt.teamName}
                        </label>
                        {sel.on && (
                          tt.groups.length === 0 ? (
                            <p className="mt-1.5 pl-6 text-[11px] text-muted-foreground">{L("Laget har ingen grupper — produktene blir synlige for alle.", "The team has no groups — the products will be visible to everyone.")}</p>
                          ) : (
                            <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
                              {tt.groups.map((g) => {
                                const on = sel.groups.has(g);
                                return (
                                  <button key={g} type="button"
                                    onClick={() => setShareSel((prev) => {
                                      const next = new Set(sel.groups);
                                      if (on) next.delete(g); else next.add(g);
                                      return { ...prev, [tt.teamId]: { on: true, groups: next } };
                                    })}
                                    className={cn("rounded-full px-2 py-0.5 text-[11px] ring-1 transition-colors",
                                      on ? "bg-green-500 text-white ring-green-500" : "bg-muted text-muted-foreground ring-border hover:bg-muted/70")}>
                                    {g}
                                  </button>
                                );
                              })}
                              <span className="self-center text-[10px] text-muted-foreground">{L("(ingen valgt = synlig for alle)", "(none picked = visible to everyone)")}</span>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShareOpen(false)}>{L("Avbryt", "Cancel")}</Button>
                <Button size="sm" className="bg-green-600 text-white hover:bg-green-700"
                  disabled={shareMutation.isPending || !Object.values(shareSel).some((v) => v.on)}
                  onClick={() => shareMutation.mutate()} data-testid="button-confirm-share-teams">
                  {shareMutation.isPending ? L("Deler…", "Sharing…") : L("Del produkter", "Share products")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{viewMode === "storage" ? t("products.stock") : viewMode === "archived" ? L("Arkiverte produkter", "Archived Products") : viewMode === "compare" ? L("Sammenlign produkter", "Compare Products") : t("products.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-products-subtitle">
              {viewMode === "archived" ? L(`${filteredArchived.length} arkivert`, `${filteredArchived.length} archived`) : viewMode === "compare" ? L("Sammenlign produktytelse", "Compare product performance") : t("products.subtitle", { count: filtered.length })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "storage" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(viewMode === "storage" ? "products" : "storage")}
              data-testid="button-toggle-storage"
            >
              <Warehouse className="mr-2 h-4 w-4" />
              {L("Lager", "Storage")}
            </Button>
            {isAdmin && (
              <Button
                variant={viewMode === "archived" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(viewMode === "archived" ? "products" : "archived")}
                data-testid="button-toggle-archived"
              >
                <Archive className="mr-2 h-4 w-4" />
                {L("Arkiv", "Archive")}
              </Button>
            )}
            {isAdmin && activeTeamId && <ProductSheetDialog teamId={activeTeamId} lang={language} />}
            <Button
              variant={viewMode === "compare" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(viewMode === "compare" ? "products" : "compare")}
              data-testid="button-toggle-compare"
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              {L("Sammenlign", "Compare")}
            </Button>
            {(viewMode === "products" || viewMode === "archived" || viewMode === "storage") && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 gap-1.5 px-2 text-xs", productLayout !== "table" && "bg-background shadow-sm")}
                    onClick={() => setProductLayout("grid")}
                    data-testid="button-layout-cards"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />{L("Kort", "Cards")}
                  </Button>
                  {viewMode !== "storage" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("h-7 gap-1.5 px-2 text-xs", productLayout === "table" && "bg-background shadow-sm")}
                      onClick={() => setProductLayout("table")}
                      data-testid="button-layout-table"
                    >
                      <Table2 className="h-3.5 w-3.5" />{L("Tabell", "Table")}
                    </Button>
                  )}
                </div>
                {(productLayout !== "table" || viewMode === "storage") && (
                  <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5" title={L("Kolonner", "Columns")}>
                    {([1, 2, 3] as const).map((n) => (
                      <Button
                        key={n}
                        variant="ghost"
                        size="sm"
                        className={cn("h-7 w-7 p-0 text-xs tabular-nums", prodCols === n && "bg-background shadow-sm")}
                        onClick={() => setProdCols(n)}
                        data-testid={`button-cols-${n}`}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {viewMode === "storage" && (
              <Select value={stockSort} onValueChange={(v) => setStockSort(v as "asc" | "desc" | "alpha")}>
                <SelectTrigger className="w-[150px] h-9 text-sm" data-testid="select-sort-stock">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">{L("Minst først ↑", "Least first ↑")}</SelectItem>
                  <SelectItem value="desc">{L("Mest først ↓", "Most first ↓")}</SelectItem>
                  <SelectItem value="alpha">{L("A–Å", "A–Z")}</SelectItem>
                </SelectContent>
              </Select>
            )}
            {viewMode === "products" && (
              <GlideMixDialog products={products} />
            )}
            {viewMode === "products" && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-product-prominent" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                    <PackagePlus className="mr-2 h-4 w-4" />
                    {t("products.addProduct")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>{t("products.addProduct")}</DialogTitle>
                  </DialogHeader>
                  <AddProductModal onSaved={() => setOpen(false)} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {(<Card className="fs-card rounded-2xl p-4">
          {/* Filter toggle — mobile only */}
          <div className="sm:hidden flex items-center gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen(v => !v)}
              className="gap-1.5"
            >
              <Filter className="h-4 w-4" />
              {L("Filtre", "Filters")}
              {activeFilterCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", filtersOpen && "rotate-180")} />
            </Button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                {L("Nullstill", "Clear")}
              </button>
            )}
          </div>

          {/* Filters — always visible on desktop, togglable on mobile */}
          <div className={cn("flex flex-wrap items-center gap-3", !filtersOpen && "hidden sm:flex")}>
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50">
                <Filter className="h-3.5 w-3.5 text-amber-600" />
              </div>
              {L("Filtre", "Filters")}
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="min-w-[220px]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal" data-testid="select-filter-category">
                      <span className="truncate">
                        {excludedCats.size === 0
                          ? t("products.filterCategory")
                          : L(`${FILTER_CATS.length - excludedCats.size} av ${FILTER_CATS.length} kategorier`, `${FILTER_CATS.length - excludedCats.size} of ${FILTER_CATS.length} categories`)}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {FILTER_CATS.map((cat) => (
                      <DropdownMenuCheckboxItem
                        key={cat}
                        checked={!excludedCats.has(cat)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(on) => setExcludedCats((prev) => {
                          const next = new Set(prev);
                          on ? next.delete(cat) : next.add(cat);
                          return next;
                        })}
                        data-testid={`filter-category-${cat}`}
                      >
                        {cat}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {uniqueGroups.length > 1 && (
                <div className="min-w-[180px]">
                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger data-testid="select-filter-group">
                      <SelectValue placeholder={L("Gruppe", "Group")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">{t("products.filterGroup")}</SelectItem>
                      {uniqueGroups.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {uniqueBrands.length > 1 && (
                <div className="min-w-[180px]">
                  <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                    <SelectTrigger data-testid="select-filter-brand">
                      <SelectValue placeholder={L("Alle merker", "All brands")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">{L("Alle merker", "All brands")}</SelectItem>
                      {uniqueBrands.map(([b, count]) => (
                        <SelectItem key={b} value={b}>{b} ({count})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="min-w-[220px]">
                <Input
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  placeholder={L("Navn inneholder…", "Name contains…")}
                  data-testid="input-filter-name"
                />
              </div>
              <div className="min-w-[160px]">
                <Select value={racedFilter} onValueChange={(v) => setRacedFilter(v as any)}>
                  <SelectTrigger data-testid="select-filter-raced">
                    <SelectValue placeholder={L("Racestatus", "Race status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">{L("Alle (racet + ikke)", "All (raced + not)")}</SelectItem>
                    <SelectItem value="Raced">{L("Racet", "Raced")}</SelectItem>
                    <SelectItem value="Not Raced">{L("Ikke racet", "Not Raced")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[160px]">
                <Select value={testedFilter} onValueChange={(v) => setTestedFilter(v as any)}>
                  <SelectTrigger data-testid="select-filter-tested">
                    <SelectValue placeholder={L("Teststatus", "Test status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">{L("Alle (testet + ikke)", "All (tested + not)")}</SelectItem>
                    <SelectItem value="Tested">{L("Testet", "Tested")}</SelectItem>
                    <SelectItem value="Not Tested">{L("Ikke testet", "Not Tested")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              variant="secondary"
              data-testid="button-clear-filters"
              onClick={clearFilters}
            >
              {L("Nullstill", "Clear")}
            </Button>
          </div>
        </Card>)}

        {viewMode === "compare" ? (
          <ProductCompare
            products={products}
            allEntries={compareEntriesAll}
            productsById={compareProductsById}
            testsById={compareTestsById}
            filteredTestIds={compareFilteredTestIds}
            weatherById={compareWeatherById}
          />
        ) : viewMode === "archived" ? (
          <div>
            {isAdmin && filteredArchived.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allSelected = filteredArchived.every((p) => selectedIds.has(p.id));
                    setSelectedIds(allSelected ? new Set() : new Set(filteredArchived.map((p) => p.id)));
                  }}
                >
                  {filteredArchived.every((p) => selectedIds.has(p.id))
                    ? <><CheckSquare className="mr-2 h-4 w-4" />{L("Fjern alle", "Deselect all")}</>
                    : <><Square className="mr-2 h-4 w-4" />{L("Velg alle", "Select all")}</>}
                </Button>
                {[...selectedIds].some((id) => filteredArchived.some((p) => p.id === id)) && (
                  <>
                    <span className="text-sm text-muted-foreground">{[...selectedIds].filter((id) => filteredArchived.some((p) => p.id === id)).length} {L("valgt", "selected")}</span>
                    <Button
                      size="sm"
                      disabled={bulkRestoreMutation.isPending}
                      onClick={() => bulkRestoreMutation.mutate([...selectedIds].filter((id) => filteredArchived.some((p) => p.id === id)))}
                      data-testid="button-bulk-restore"
                    >
                      <ArchiveRestore className="mr-2 h-4 w-4" />{L("Gjenopprett", "Restore")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={bulkDeleteMutation.isPending}
                      onClick={() => {
                        const ids = [...selectedIds].filter((id) => filteredArchived.some((p) => p.id === id));
                        if (window.confirm(L(`Slette ${ids.length} produkt${ids.length !== 1 ? "er" : ""} permanent? Dette kan ikke angres.`, `Permanently delete ${ids.length} product${ids.length !== 1 ? "s" : ""}? This cannot be undone.`))) {
                          bulkDeleteMutation.mutate(ids);
                        }
                      }}
                      data-testid="button-bulk-delete-archived"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />{L("Slett", "Delete")}
                    </Button>
                  </>
                )}
              </div>
            )}
            {filteredArchived.length === 0 ? (
              <Card className="fs-card rounded-2xl">
                <EmptyState icon={Archive} title={L("Ingen arkiverte produkter", "No archived products")} description={L("Arkiverte produkter vises her.", "Archived products will appear here.")} />
              </Card>
            ) : productLayout === "table" ? (
              <Card className="fs-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">{L("Produkt", "Product")}</th>
                        <th className="px-4 py-2.5 font-medium">{L("Arkivert", "Archived")}</th>
                        <th className="px-4 py-2.5 font-medium text-right">{L("Handlinger", "Actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArchived.map((p) => (
                        <tr key={p.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <AppLink href={`/products/${p.id}`} className="font-medium hover:text-amber-600 transition-colors">
                                {p.brand} {p.name}{p.category ? <span className="font-normal text-muted-foreground"> {p.category}</span> : null}
                              </AppLink>
                              {(p as any).serialNumber && (<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary font-mono" title="Mix">#{(p as any).serialNumber}</span>)}
                              {(p as any).sharedFromTeam && (<span className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">{(p as any).sharedFromTeam}</span>)}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {p.archivedAt ? new Date(p.archivedAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setHistoryProduct(p)}>
                                  <History className="mr-2 h-4 w-4" />{L("Historikk", "History")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => restoreMutation.mutate(p.id)} disabled={restoreMutation.isPending}>
                                  <ArchiveRestore className="mr-2 h-4 w-4" />{L("Gjenopprett", "Restore")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeletingProduct(p)} className="text-red-600 focus:text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />{L("Slett", "Delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <div className={cn("grid gap-3", colsClass)}>
                {filteredArchived.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 gap-3">
                    <AppLink href={`/products/${p.id}`} className="min-w-0 flex-1 group">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{p.category}</span>
                            {(p as any).sharedFromTeam && (<span className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">{(p as any).sharedFromTeam}</span>)}{(p as any).serialNumber && (<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary font-mono" title="Mix">#{(p as any).serialNumber}</span>)}
                        <span className="text-sm font-medium text-foreground group-hover:text-amber-600 transition-colors">{p.brand} {p.name}</span>
                      </div>
                      {p.archivedAt && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{L("Arkivert", "Archived")} {new Date(p.archivedAt).toLocaleDateString()}</p>
                      )}
                    </AppLink>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setHistoryProduct(p)}>
                          <History className="mr-2 h-4 w-4" />{L("Historikk", "History")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => restoreMutation.mutate(p.id)} disabled={restoreMutation.isPending}>
                          <ArchiveRestore className="mr-2 h-4 w-4" />{L("Gjenopprett", "Restore")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeletingProduct(p)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />{L("Slett", "Delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : viewMode === "storage" ? (
          <div className="space-y-4">
            {(() => {
              const orderList = products
                .filter((p) => ((p as any).orderQuantity ?? 0) > 0)
                .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
              if (orderList.length === 0) return null;
              const totalUnits = orderList.reduce((sum, p) => sum + ((p as any).orderQuantity ?? 0), 0);
              const byBrand = new Map<string, Product[]>();
              for (const p of orderList) {
                if (!byBrand.has(p.brand)) byBrand.set(p.brand, []);
                byBrand.get(p.brand)!.push(p);
              }
              const copyText = Array.from(byBrand.entries())
                .map(([brand, ps]) => `${brand}:\n` + ps.map((p) => `  ${p.brand} ${p.name} ${p.category} × ${(p as any).orderQuantity}`).join("\n"))
                .join("\n");
              const brandStatus = async (brand: string, action: "ordered" | "unordered" | "delivered") => {
                await apiRequest("POST", "/api/products/order/brand-status", { brand, action });
                queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                queryClient.invalidateQueries({ queryKey: ["/api/product-orders"] });
              };
              return (
                <Card className="fs-card rounded-2xl p-4 ring-1 ring-sky-200 dark:ring-sky-900" data-testid="card-order-list">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/40">
                        <PackagePlus className="h-3.5 w-3.5 text-sky-600" />
                      </div>
                      {L("Bestillingsliste", "Order list")}
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:ring-sky-800">
                        {totalUnits} {L("stk", "units")} · {orderList.length} {L("produkter", "products")}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs"
                      onClick={() => { navigator.clipboard.writeText(copyText).then(() => toast({ title: L("Bestillingsliste kopiert", "Order list copied") })); }}
                      data-testid="button-copy-order">
                      {L("Kopier liste", "Copy list")}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from(byBrand.entries()).map(([brand, ps]) => {
                      const placed = ps.every((p) => ((p as any).orderPlaced ?? 0) === 1);
                      const brandUnits = ps.reduce((sum, p) => sum + ((p as any).orderQuantity ?? 0), 0);
                      return (
                        <div key={brand} className={cn(
                          "rounded-xl border p-3",
                          placed ? "nation-keep border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-border bg-muted/20"
                        )} data-testid={`order-brand-${brand}`}>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <div className="text-sm font-bold uppercase tracking-wide">{brand}</div>
                            <span className="text-xs font-semibold tabular-nums text-muted-foreground">{brandUnits} {L("stk", "units")}</span>
                          </div>
                          {ps.map((p) => (
                            <div key={p.id} className="flex items-start justify-between gap-2 py-1 text-sm" data-testid={`order-line-${p.id}`}>
                              <span className="min-w-0 break-words">
                                {p.brand} {p.name}
                                <span className="ml-1 text-muted-foreground">{p.category}</span>
                              </span>
                              <span className="shrink-0 font-bold tabular-nums text-sky-700 dark:text-sky-400">× {(p as any).orderQuantity}</span>
                            </div>
                          ))}
                          <div className="mt-2 flex items-center gap-4 border-t border-border/60 pt-2">
                            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                              <Checkbox
                                checked={placed}
                                onCheckedChange={(v) => brandStatus(brand, v === true ? "ordered" : "unordered")}
                                data-testid={`checkbox-ordered-${brand}`}
                              />
                              {L("Bestilt", "Ordered")}
                            </label>
                            {placed && (
                              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer text-emerald-700 dark:text-emerald-400">
                                <Checkbox
                                  checked={false}
                                  onCheckedChange={(v) => {
                                    if (v !== true) return;
                                    if (!confirm(L(`Levert? ${brandUnits} stk fra ${brand} legges til lagerbeholdningen og bestillingen nullstilles.`, `Delivered? ${brandUnits} units from ${brand} are added to stock and the order is cleared.`))) return;
                                    brandStatus(brand, "delivered").then(() =>
                                      toast({ title: L("Levering registrert", "Delivery registered"), description: L(`${brand}: ${brandUnits} stk lagt til lagerbeholdningen.`, `${brand}: ${brandUnits} units added to stock.`) }));
                                  }}
                                  data-testid={`checkbox-delivered-${brand}`}
                                />
                                {L("Levert", "Delivered")}
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })()}
            {orderHistory.length > 0 && (
              <Card className="fs-card rounded-2xl p-4" data-testid="card-order-history">
                <button type="button" className="flex w-full items-center justify-between gap-2"
                  onClick={() => setOrderHistoryOpen((v) => !v)} data-testid="button-toggle-order-history">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <History className="h-4 w-4 text-muted-foreground" />
                    {L("Bestillingshistorikk", "Order history")}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{orderHistory.length}</span>
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", orderHistoryOpen && "rotate-180")} />
                </button>
                {orderHistoryOpen && (
                  <div className="mt-3 space-y-2">
                    {orderHistory.map((o: any) => (
                      <div key={o.id} className="rounded-xl border border-border p-3" data-testid={`order-history-${o.id}`}>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-bold uppercase tracking-wide">{o.brand}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            o.status === "delivered"
                              ? "nation-keep bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-400")}>
                            {o.status === "delivered" ? L("Levert", "Delivered") : L("Bestilt — venter", "Ordered — awaiting")}
                          </span>
                          <span className="ml-auto text-right text-[11px] text-muted-foreground">
                            {o.orderedAt && <>{L("Sendt", "Sent")} {new Date(o.orderedAt).toLocaleDateString()} · {o.orderedByName}</>}
                            {o.deliveredAt && <><br />{L("Mottatt", "Received")} {new Date(o.deliveredAt).toLocaleDateString()} · {o.deliveredByName}</>}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {(o.items ?? []).map((it: any, i: number) => (
                            <span key={i}>{it.label} <span className="font-semibold text-foreground">× {it.qty}</span></span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
            {uniqueGroups.length > 1 && (
              <Card className="fs-card rounded-2xl p-4" data-testid="card-storage-summary">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/40">
                    <Users className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  {L("Lager per gruppe", "Stock by group")}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {uniqueGroups.map((g) => {
                    const groupProducts = products.filter((p) => p.groupScope.split(",").map((s) => s.trim()).includes(g));
                    const totalStock = groupProducts.reduce((sum, p) => sum + (p.stockQuantity ?? 0), 0);
                    return (
                      <button
                        key={g}
                        onClick={() => setGroupFilter(groupFilter === g ? "All" : g)}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all",
                          groupFilter === g
                            ? "bg-green-50 ring-2 ring-green-400 dark:bg-green-950/40 dark:ring-green-600"
                            : "bg-muted/40 hover:bg-muted/70 ring-1 ring-border"
                        )}
                        data-testid={`button-group-summary-${g}`}
                      >
                        <div>
                          <div className="text-sm font-semibold">{g}</div>
                          <div className="text-xs text-muted-foreground">{groupProducts.length} {groupProducts.length !== 1 ? L("produkter", "products") : L("produkt", "product")}</div>
                        </div>
                        <div className={cn(
                          "rounded-xl px-3 py-1 text-lg font-bold tabular-nums",
                          totalStock === 0
                            ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                            : totalStock <= 5
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                              : "nation-keep bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                        )}>
                          {totalStock}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground" data-testid="storage-legend">
              <span className="font-medium">{L("Antall:", "Count:")}</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> {L("0 = tomt", "0 = empty")}</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> {L("1–2 = lavt", "1–2 = low")}</span>
              <span className="flex items-center gap-1"><span className="nation-keep inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> {L("3+ = OK", "3+ = OK")}</span>
              <span className="ml-2 font-medium">{L("Bestill:", "Order:")}</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" /> {L("antall i bestilling", "quantity on order")}</span>
            </div>
            <div className={cn("grid gap-2", colsClass)}>
              {sortedFiltered.length === 0 ? (
                <Card className="fs-card rounded-2xl col-span-full" data-testid="empty-products">
                  <EmptyState
                    icon={PackagePlus}
                    title={t("products.noProducts")}
                    description={L("Legg til ditt første produkt med knappen over.", "Add your first product using the button above.")}
                  />
                </Card>
              ) : (
                sortedFiltered.map((p) => (
                  <StockRow key={p.id} product={p} />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isAdmin && filtered.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedIds.size === filtered.length) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(filtered.map((p) => p.id)));
                    }
                  }}
                >
                  {selectedIds.size === filtered.length && filtered.length > 0
                    ? <><CheckSquare className="mr-2 h-4 w-4" />{L("Fjern alle", "Deselect all")}</>
                    : <><Square className="mr-2 h-4 w-4" />{L("Velg alle", "Select all")}</>}
                </Button>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">{selectedIds.size} {L("valgt", "selected")}</span>
                    {groupNames.length > 0 && (
                      <>
                        <Select value={bulkGroup} onValueChange={setBulkGroup}>
                          <SelectTrigger className="h-9 w-auto min-w-[160px] text-sm">
                            <SelectValue placeholder={L("Tilordne til gruppe…", "Assign to group…")} />
                          </SelectTrigger>
                          <SelectContent>
                            {groupNames.map((g) => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={!bulkGroup || bulkAssignMutation.isPending}
                          onClick={() => bulkAssignMutation.mutate({ ids: Array.from(selectedIds), groupScope: bulkGroup })}
                        >
                          {L("Tilordne til gruppe", "Assign to group")}
                        </Button>
                      </>
                    )}
                    {isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} data-testid="button-bulk-share-teams">
                        {L("Del til lag…", "Share to team…")}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bulkArchiveMutation.isPending}
                      onClick={() => bulkArchiveMutation.mutate(Array.from(selectedIds))}
                      data-testid="button-bulk-archive"
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      {L("Arkiver", "Archive")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={bulkDeleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(L(`Slette ${selectedIds.size} produkt${selectedIds.size !== 1 ? "er" : ""} permanent? Dette kan ikke angres.`, `Permanently delete ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`))) {
                          bulkDeleteMutation.mutate(Array.from(selectedIds));
                        }
                      }}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {L("Slett", "Delete")}
                    </Button>
                  </>
                )}
              </div>
            )}
            {filtered.length === 0 ? (
              <Card className="fs-card rounded-2xl" data-testid="empty-products">
                <EmptyState
                  icon={PackagePlus}
                  title={t("products.noProducts")}
                  description={L("Legg til ditt første produkt med knappen over.", "Add your first product using the button above.")}
                />
              </Card>
            ) : productLayout === "table" ? (
              <Card className="fs-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">{L("Produkt", "Product")}</th>
                        <th className="px-4 py-2.5 font-medium">{L("Grupper", "Groups")}</th>
                        <th className="px-4 py-2.5 font-medium">{L("Lagt til", "Added")}</th>
                        <th className="px-4 py-2.5 font-medium text-right">{L("Handlinger", "Actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => {
                        const groups = p.groupScope.split(",").map((s) => s.trim()).filter(Boolean);
                        return (
                          <tr key={p.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <AppLink href={`/products/${p.id}`} className="font-medium hover:text-amber-600 transition-colors">
                                  {p.brand} {p.name}{p.category ? <span className="font-normal text-muted-foreground"> {p.category}</span> : null}
                                </AppLink>
                                {(p as any).serialNumber && (<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary font-mono" title="Mix">#{(p as any).serialNumber}</span>)}
                                {(p as any).sharedFromTeam && (<span className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">{(p as any).sharedFromTeam}</span>)}
                              </div>
                              <div className="text-[11px] text-muted-foreground">{p.createdByName}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {groups.map((g) => (
                                  <span key={g} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800">
                                    {g}
                                  </span>
                                ))}
                                {groups.length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(p.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => setHistoryProduct(p)}>
                                    <History className="mr-2 h-4 w-4" />{L("Historikk", "History")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditingDetailsProduct(p)}>
                                    <Pencil className="mr-2 h-4 w-4" />{L("Rediger", "Edit")}
                                  </DropdownMenuItem>
                                  {isAdmin && (
                                    <>
                                      <DropdownMenuItem onClick={() => setEditingProduct(p)}>
                                        <Users className="mr-2 h-4 w-4" />{L("Grupper", "Groups")}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => archiveMutation.mutate(p.id)}>
                                        <Archive className="mr-2 h-4 w-4" />{L("Legg i arkiv", "Add to Archive")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setDeletingProduct(p)} className="text-red-600 focus:text-red-600">
                                        <Trash2 className="mr-2 h-4 w-4" />{L("Slett", "Delete")}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <div className={cn("grid gap-3", colsClass)}>
                {filtered.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    isAdmin={isAdmin}
                    selected={selectedIds.has(p.id)}
                    onToggleSelect={() => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                        return next;
                      });
                    }}
                    onEdit={() => setEditingDetailsProduct(p)}
                    onEditGroups={() => setEditingProduct(p)}
                    onDelete={() => setDeletingProduct(p)}
                    onArchive={() => archiveMutation.mutate(p.id)}
                    onViewHistory={() => setHistoryProduct(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <Dialog open={!!editingProduct} onOpenChange={(v) => { if (!v) setEditingProduct(undefined); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{L("Tilordne grupper", "Assign groups")}</DialogTitle></DialogHeader>
            {editingProduct && (
              <GroupAssignModal
                product={editingProduct}
                groupNames={groupNames.length > 0 ? groupNames : uniqueGroups}
                onDone={() => setEditingProduct(undefined)}
              />
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingDetailsProduct} onOpenChange={(v) => { if (!v) setEditingDetailsProduct(undefined); }}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader><DialogTitle>{t("products.editProduct")}</DialogTitle></DialogHeader>
            {editingDetailsProduct && (
              <EditProductModal
                product={editingDetailsProduct}
                onSaved={() => setEditingDetailsProduct(undefined)}
              />
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!deletingProduct} onOpenChange={(v) => { if (!v) setDeletingProduct(undefined); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>{t("common.delete")}</DialogTitle></DialogHeader>
            {deletingProduct && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("products.confirmDelete")}
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDeletingProduct(undefined)}>{t("common.cancel")}</Button>
                  <Button
                    variant="destructive"
                    data-testid="button-confirm-delete-product"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(deletingProduct.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ProductTestHistoryDialog
          product={historyProduct}
          open={historyProduct != null}
          onClose={() => setHistoryProduct(null)}
        />
      </div>
    </AppShell>
  );
}

type StockSort = "date-desc" | "date-asc" | "product-az" | "product-za" | "user-az" | "user-za";

function StockRow({ product: p }: { product: Product }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(p.stockQuantity));

  const deltaMutation = useMutation({
    mutationFn: async (delta: number) => {
      const res = await apiRequest("PATCH", `/api/products/${p.id}/stock`, { delta });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (e) => {
      toast({ title: L("Feil", "Error"), description: e instanceof Error ? e.message : L("Ukjent feil", "Unknown error"), variant: "destructive" });
    },
  });

  const setMutation = useMutation({
    mutationFn: async (quantity: number) => {
      const res = await apiRequest("PATCH", `/api/products/${p.id}/stock`, { quantity });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setEditing(false);
    },
    onError: (e) => {
      toast({ title: L("Feil", "Error"), description: e instanceof Error ? e.message : L("Ukjent feil", "Unknown error"), variant: "destructive" });
    },
  });

  const commitInput = () => {
    const num = parseInt(inputValue, 10);
    if (!isNaN(num) && num >= 0 && num !== p.stockQuantity) {
      setMutation.mutate(num);
    } else {
      setInputValue(String(p.stockQuantity));
      setEditing(false);
    }
  };

  // Order counter — how many to put on the next order (the ordering terminal).
  const orderQty = (p as any).orderQuantity ?? 0;
  const orderMutation = useMutation({
    mutationFn: async (delta: number) => {
      const res = await apiRequest("PATCH", `/api/products/${p.id}/order`, { delta });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/products"] }),
    onError: (e) => toast({ title: L("Feil", "Error"), description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  const isPending = deltaMutation.isPending || setMutation.isPending;

  return (
    <Card className="fs-card rounded-2xl px-4 py-3" data-testid={`stock-row-${p.id}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {p.brand} {p.name}
            <span className="ml-1.5 font-normal text-muted-foreground">{p.category}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {p.groupScope.split(",").map((g) => g.trim()).filter(Boolean).map((g) => (
              <span key={g} className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-green-200 dark:bg-green-950/30 dark:text-green-400 dark:ring-green-800">{g}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{L("Antall", "Count")}</span>
          <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            disabled={isPending || p.stockQuantity <= 0}
            onClick={() => deltaMutation.mutate(-1)}
            data-testid={`button-stock-minus-${p.id}`}
          >
            <Minus className="h-4 w-4" />
          </Button>
          {editing ? (
            <input
              type="number"
              min="0"
              autoFocus
              className={cn(
                "w-16 rounded-xl border px-2 py-1.5 text-center text-lg font-bold tabular-nums outline-none focus:ring-2 focus:ring-green-400",
                "bg-white dark:bg-zinc-900"
              )}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={commitInput}
              onKeyDown={(e) => { if (e.key === "Enter") commitInput(); if (e.key === "Escape") { setInputValue(String(p.stockQuantity)); setEditing(false); } }}
              data-testid={`input-stock-quantity-${p.id}`}
            />
          ) : (
            <button
              onClick={() => { setInputValue(String(p.stockQuantity)); setEditing(true); }}
              className={cn(
                "inline-flex min-w-12 items-center justify-center rounded-xl px-3 py-1.5 text-lg font-bold tabular-nums cursor-text hover:ring-2 hover:ring-green-300 transition-all",
                p.stockQuantity === 0
                  ? "bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800"
                  : p.stockQuantity <= 2
                    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800"
                    : "nation-keep bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800"
              )}
              data-testid={`text-stock-quantity-${p.id}`}
            >
              {p.stockQuantity}
            </button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            disabled={isPending}
            onClick={() => deltaMutation.mutate(1)}
            data-testid={`button-stock-plus-${p.id}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5 shrink-0 border-l border-border pl-3">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{L("Bestill", "Order")}</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={orderMutation.isPending || orderQty <= 0}
              onClick={() => orderMutation.mutate(-1)}
              data-testid={`button-order-minus-${p.id}`}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className={cn(
              "inline-flex min-w-9 items-center justify-center rounded-lg px-2 py-1 text-base font-bold tabular-nums",
              orderQty > 0
                ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:ring-sky-800"
                : "bg-muted/50 text-muted-foreground"
            )} data-testid={`text-order-quantity-${p.id}`}>
              {orderQty}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={orderMutation.isPending}
              onClick={() => orderMutation.mutate(1)}
              data-testid={`button-order-plus-${p.id}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

type ProductTest = {
  id: number;
  date: string;
  location: string;
  testName: string | null;
  testType: string;
  notes: string | null;
  distanceLabels: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  weather: {
    airTemperatureC: number; snowTemperatureC: number;
    airHumidityPct: number | null; snowHumidityPct: number | null;
    snowType: string | null; artificialSnow: string | null; naturalSnow: string | null;
    grainSize: string | null; snowHumidityType: string | null; trackHardness: string | null;
    testQuality: number | null; wind: string | null; clouds: number | null; precipitation: string | null;
  } | null;
  entries: {
    id: number; skiNumber: number;
    productId: number | null; additionalProductIds: string | null;
    productBrand: string | null; productName: string | null;
    additionalProducts: { id: number; brand: string; name: string }[];
    result0kmCmBehind: number | null; rank0km: number | null;
    resultXkmCmBehind: number | null; rankXkm: number | null;
    results: string | null; feelingRank: number | null;
    isSelectedProduct: boolean;
  }[];
};

function ProductTestHistoryDialog({ product, open, onClose }: { product: Product | null; open: boolean; onClose: () => void }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { data, isLoading } = useQuery<{ tests: ProductTest[] }>({
    queryKey: [`/api/products/${product?.id}/tests`],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/tests`, { credentials: "include" });
      if (!res.ok) throw new Error(L("Kunne ikke laste", "Failed to load"));
      return res.json();
    },
    enabled: open && product != null,
  });

  const tests = data?.tests ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-amber-600" />
            {L("Testhistorikk —", "Test History —")} {product?.brand} {product?.name}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{L("Laster testhistorikk…", "Loading test history…")}</div>
        ) : tests.length === 0 ? (
          <div className="py-8 text-center">
            <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">{L("Ingen tester funnet for dette produktet.", "No tests found for this product.")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">{tests.length} {tests.length !== 1 ? L("tester", "tests") : L("test", "test")} {L("funnet", "found")}</p>
            {tests.map((test) => {
              const distLabels: string[] = (() => {
                if (test.distanceLabels) { try { const p = JSON.parse(test.distanceLabels); if (Array.isArray(p) && p.length > 0) return p; } catch {} }
                const labels = [test.distanceLabel0km || "0 km"];
                if (test.distanceLabelXkm) labels.push(test.distanceLabelXkm);
                return labels;
              })();
              return (
              <Card key={test.id} className="fs-card rounded-xl p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/tests/${test.id}`}
                      className="font-semibold text-sm hover:text-amber-600 transition-colors"
                      data-testid={`link-product-test-${test.id}`}
                    >
                      {test.location}
                    </a>
                    <span className="text-xs text-muted-foreground">{fmtDate(test.date)}</span>
                    {test.testName && <span className="text-xs text-muted-foreground italic">"{test.testName}"</span>}
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {test.testType}
                    </span>
                  </div>
                </div>
                {/* Weather */}
                {test.weather && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200">
                      <Thermometer className="h-2.5 w-2.5" /> {L("Luft", "Air")} {fmtT(test.weather.airTemperatureC)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/10">
                      <Snowflake className="h-2.5 w-2.5" /> {L("Snø", "Snow")} {fmtT(test.weather.snowTemperatureC)}
                    </span>
                    {test.weather.airHumidityPct != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200">
                        <Droplets className="h-2.5 w-2.5" /> {test.weather.airHumidityPct}% RH
                      </span>
                    )}
                    {test.weather.artificialSnow && (
                      <span className="inline-flex rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-medium text-pink-700 ring-1 ring-pink-200">{L("Kunst:", "Art:")} {test.weather.artificialSnow}</span>
                    )}
                    {test.weather.naturalSnow && (
                      <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-200">{L("Natur:", "Nat:")} {test.weather.naturalSnow}</span>
                    )}
                    {test.weather.snowHumidityType && (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{test.weather.snowHumidityType}</span>
                    )}
                    {test.weather.trackHardness && (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{test.weather.trackHardness}</span>
                    )}
                    {test.weather.wind && (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{L("Vind:", "Wind:")} {test.weather.wind}</span>
                    )}
                  </div>
                )}
                {test.notes && <p className="mb-2 text-xs text-muted-foreground italic truncate">{test.notes}</p>}
                {test.entries.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="pb-1.5 pr-3">{L("Ski", "Ski")}</th>
                          <th className="pb-1.5 pr-3">{L("Produkt", "Product")}</th>
                          {distLabels.map((label, i) => (
                            <th key={i} className="pb-1.5 pr-3">{label} / {L("Rang", "Rank")}</th>
                          ))}
                          <th className="pb-1.5">{L("Følelse", "Feel")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {test.entries.map((e) => {
                          const rounds: { result: number | null; rank: number | null }[] = (() => {
                            if (e.results) { try { const p = JSON.parse(e.results); if (Array.isArray(p)) { while (p.length < distLabels.length) p.push({ result: null, rank: null }); return p.slice(0, distLabels.length); } } catch {} }
                            const r = [{ result: e.result0kmCmBehind, rank: e.rank0km }];
                            if (distLabels.length > 1) r.push({ result: e.resultXkmCmBehind ?? null, rank: e.rankXkm ?? null });
                            while (r.length < distLabels.length) r.push({ result: null, rank: null });
                            return r;
                          })();
                          return (
                          <tr key={e.id} className={cn("border-b border-border/20", e.isSelectedProduct && "bg-yellow-500/10")}>
                            <td className={cn("py-1.5 pr-3 font-bold text-xs", e.isSelectedProduct && "text-yellow-600")}>{e.skiNumber}</td>
                            <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                              {(() => {
                                // Build full list: primary product + all additional products
                                const all: { id: number | null; label: string }[] = [];
                                if (e.productId != null && e.productBrand) {
                                  all.push({ id: e.productId, label: `${e.productBrand} ${e.productName || ""}`.trim() });
                                }
                                for (const ap of (e.additionalProducts ?? [])) {
                                  all.push({ id: ap.id, label: `${ap.brand} ${ap.name}`.trim() });
                                }
                                if (all.length === 0) return <span>—</span>;
                                return (
                                  <span className="flex flex-wrap items-center gap-0.5">
                                    {all.map((p, i) => {
                                      const isViewed = p.id === product?.id;
                                      return (
                                        <Fragment key={i}>
                                          {i > 0 && <span className="text-muted-foreground/50 mx-0.5">+</span>}
                                          <span className={isViewed ? "font-semibold text-yellow-700" : ""}>{p.label}</span>
                                        </Fragment>
                                      );
                                    })}
                                  </span>
                                );
                              })()}
                            </td>
                            {rounds.map((r, i) => (
                              <td key={i} className="py-1.5 pr-3">
                                <div className="flex items-center gap-1">
                                  <span className="tabular-nums">{r.result ?? "—"}</span>
                                  {r.rank != null && (
                                    <span className={cn("inline-flex min-w-5 items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold",
                                      r.rank === 1 ? "bg-yellow-500/20 text-yellow-600 ring-1 ring-yellow-500/30" :
                                      r.rank === 2 ? "bg-slate-300/20 text-slate-500 ring-1 ring-slate-300/30" :
                                      r.rank === 3 ? "bg-amber-700/20 text-amber-600 ring-1 ring-amber-700/30" :
                                      "bg-muted/60 text-muted-foreground"
                                    )}>{r.rank}</span>
                                  )}
                                </div>
                              </td>
                            ))}
                            <td className="py-1.5 text-muted-foreground">{e.feelingRank ?? "—"}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductCard({
  product: p,
  isAdmin,
  selected,
  onToggleSelect,
  onEdit,
  onEditGroups,
  onDelete,
  onArchive,
  onViewHistory,
}: {
  product: Product;
  isAdmin: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onEdit: () => void;
  onEditGroups: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onViewHistory: () => void;
}) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const groups = p.groupScope.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <Card
      className={cn(
        "fs-card rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/5",
        selected && "ring-2 ring-green-500"
      )}
      data-testid={`card-product-${p.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2">
          {isAdmin && onToggleSelect && (
            <button
              onClick={onToggleSelect}
              className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-600 transition-colors"
              aria-label={selected ? L("Fjern valg", "Deselect") : L("Velg", "Select")}
            >
              {selected
                ? <CheckSquare className="h-4 w-4 text-green-600" />
                : <Square className="h-4 w-4" />}
            </button>
          )}
          <div className="min-w-0">
            {(p as any).serialNumber && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary font-mono" title="Mix">
                #{(p as any).serialNumber}
              </span>
            )}
            <AppLink href={`/products/${p.id}`} className="mt-1 block truncate text-base font-semibold hover:text-amber-600 transition-colors">
              {p.brand} {p.name}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">{p.category}</span>
            </AppLink>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {groups.map((g) => (
                <span key={g} className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                  {g}
                </span>
              ))}
              {groups.length === 0 && (
                <span className="text-[10px] text-muted-foreground">{L("Ingen gruppe tilordnet", "No group assigned")}</span>
              )}
              <span className="text-xs text-muted-foreground">
                <span className="text-foreground/70">{p.createdByName}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
            {new Date(p.createdAt).toLocaleDateString()}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                {L("Handlinger", "Actions")}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onViewHistory}>
                <History className="mr-2 h-4 w-4" />
                {L("Historikk", "History")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                {L("Rediger", "Edit")}
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuItem onClick={onEditGroups}>
                    <Users className="mr-2 h-4 w-4" />
                    {L("Grupper", "Groups")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    {L("Legg i arkiv", "Add to Archive")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {L("Slett", "Delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
