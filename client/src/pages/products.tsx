// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { Fragment, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Filter, PackagePlus, Pencil, Trash2, Users, Minus, Plus, Warehouse, History, ArrowUp, ArrowDown, CheckSquare, Square, FlaskConical, MapPin, Thermometer, Droplets, Snowflake, ChevronDown, Archive, ArchiveRestore, MoreHorizontal, LayoutGrid, LayoutList, Table2 } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient, OfflineError } from "@/lib/queryClient";
import { useOffline } from "@/lib/offline-context";
import { cn, fmtDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

function productCategoryKey(v: string) {
  const map: Record<string, string> = { "Glide product": "products.glide", "Topping product": "products.topping", "Structure tool": "products.structure" };
  return map[v] ?? v;
}

type ProductCategory = "Glide product" | "Topping product" | "Structure tool";

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
  archivedAt: string | null;
};

type ApiGroup = { id: number; name: string };

type StockChange = {
  id: number;
  userId: number;
  userName: string;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
  groupScope: string | null;
  teamId: number;
};

const schema = z.object({
  category: z.enum(["Glide product", "Topping product", "Structure tool"]),
  brand: z.string().min(1, "Brand is required"),
  name: z.string().min(1, "Name is required"),
});

function categoryBadgeClass(cat: string) {
  if (cat === "Glide product") return "fs-badge-glide";
  if (cat === "Topping product") return "fs-badge-topping";
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
      category: "Glide product",
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
                  <SelectItem value="Glide product">{t("products.glide")}</SelectItem>
                  <SelectItem value="Topping product">{t("products.topping")}</SelectItem>
                  <SelectItem value="Structure tool">{t("products.structure")}</SelectItem>
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
                  <SelectItem value="Glide product">{t("products.glide")}</SelectItem>
                  <SelectItem value="Topping product">{t("products.topping")}</SelectItem>
                  <SelectItem value="Structure tool">{t("products.structure")}</SelectItem>
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
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  onDone: () => void;
}) {
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

export default function Products() {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin || !!user?.isTeamAdmin;
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"products" | "storage" | "stock-changes" | "archived" | "compare">("products");
  const [productLayout, setProductLayout] = useState<"grid" | "list" | "table">("grid");
  const [stockChangeGroupFilter, setStockChangeGroupFilter] = useState("All");
  const [stockSort, setStockSort] = useState<"asc" | "desc" | "alpha">("asc");
  const [category, setCategory] = useState<ProductCategory | "All">("All");
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
  const { data: archivedProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products/archived"],
    enabled: viewMode === "archived" && isAdmin,
  });
  const { data: usageStats } = useQuery<{ racedIds: number[]; testedIds: number[] }>({
    queryKey: ["/api/products/usage-stats"],
  });
  const racedSet = useMemo(() => new Set(usageStats?.racedIds ?? []), [usageStats]);
  const testedSet = useMemo(() => new Set(usageStats?.testedIds ?? []), [usageStats]);
  const { data: stockChanges = [] } = useQuery<StockChange[]>({
    queryKey: ["/api/stock-changes"],
    enabled: viewMode === "stock-changes",
  });
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
    queryFn: async () => {
      const results = await Promise.all(
        compareTestIds.map((id: number) =>
          fetch(`/api/tests/${id}/entries`, { credentials: "include" }).then((r) => r.ok ? r.json() : [])
        )
      );
      return results.flat();
    },
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
        if (trimmed) set.add(trimmed);
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
      const okCategory = category === "All" ? true : p.category === category;
      const okBrand = selectedBrand === "All" ? true : p.brand === selectedBrand;
      const okName = n ? p.name.toLowerCase().includes(n) : true;
      const okGroup = groupFilter === "All" ? true : p.groupScope.split(",").map((g) => g.trim()).includes(groupFilter);
      const okRaced = racedFilter === "All" ? true : racedFilter === "Raced" ? racedSet.has(p.id) : !racedSet.has(p.id);
      const okTested = testedFilter === "All" ? true : testedFilter === "Tested" ? testedSet.has(p.id) : !testedSet.has(p.id);
      return okCategory && okBrand && okName && okGroup && okRaced && okTested;
    });
  }, [products, category, selectedBrand, nameSearch, groupFilter, racedFilter, testedFilter, racedSet, testedSet]);

  const activeFilterCount = [
    category !== "All",
    groupFilter !== "All",
    selectedBrand !== "All",
    !!nameSearch.trim(),
    racedFilter !== "All",
    testedFilter !== "All",
  ].filter(Boolean).length;

  function clearFilters() {
    setCategory("All");
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
      const okCategory = category === "All" ? true : p.category === category;
      const okBrand = selectedBrand === "All" ? true : p.brand === selectedBrand;
      const okName = n ? p.name.toLowerCase().includes(n) : true;
      const okGroup = groupFilter === "All" ? true : p.groupScope.split(",").map((g) => g.trim()).includes(groupFilter);
      const okRaced = racedFilter === "All" ? true : racedFilter === "Raced" ? racedSet.has(p.id) : !racedSet.has(p.id);
      const okTested = testedFilter === "All" ? true : testedFilter === "Tested" ? testedSet.has(p.id) : !testedSet.has(p.id);
      return okCategory && okBrand && okName && okGroup && okRaced && okTested;
    });
  }, [archivedProducts, category, selectedBrand, nameSearch, groupFilter, racedFilter, testedFilter, racedSet, testedSet]);

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

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{viewMode === "stock-changes" ? t("products.stockHistory") : viewMode === "storage" ? t("products.stock") : viewMode === "archived" ? L("Arkiverte produkter", "Archived Products") : viewMode === "compare" ? L("Sammenlign produkter", "Compare Products") : t("products.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-products-subtitle">
              {viewMode === "stock-changes" ? L(`${stockChanges.length} loggføringer`, `${stockChanges.length} log entries`) : viewMode === "archived" ? L(`${filteredArchived.length} arkivert`, `${filteredArchived.length} archived`) : viewMode === "compare" ? L("Sammenlign produktytelse", "Compare product performance") : t("products.subtitle", { count: filtered.length })}
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
            <Button
              variant={viewMode === "stock-changes" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(viewMode === "stock-changes" ? "products" : "stock-changes")}
              data-testid="button-toggle-stock-changes"
            >
              <History className="mr-2 h-4 w-4" />
              {L("Lagerendringer", "Stock Changes")}
            </Button>
            <Button
              variant={viewMode === "compare" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(viewMode === "compare" ? "products" : "compare")}
              data-testid="button-toggle-compare"
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              {L("Sammenlign", "Compare")}
            </Button>
            {(viewMode === "products" || viewMode === "archived") && (
              <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 w-7 p-0", productLayout === "grid" && "bg-background shadow-sm")}
                  onClick={() => setProductLayout("grid")}
                  title={L("Rutenett", "Grid view")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 w-7 p-0", productLayout === "list" && "bg-background shadow-sm")}
                  onClick={() => setProductLayout("list")}
                  title={L("Liste", "List view")}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 w-7 p-0", productLayout === "table" && "bg-background shadow-sm")}
                  onClick={() => setProductLayout("table")}
                  title={L("Tabell", "Table view")}
                >
                  <Table2 className="h-3.5 w-3.5" />
                </Button>
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

        {viewMode !== "stock-changes" && (<Card className="fs-card rounded-2xl p-4">
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
                <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                  <SelectTrigger data-testid="select-filter-category">
                    <SelectValue placeholder={L("Kategori", "Category")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">{t("products.filterCategory")}</SelectItem>
                    <SelectItem value="Glide product">{t("products.glide")}</SelectItem>
                    <SelectItem value="Topping product">{t("products.topping")}</SelectItem>
                    <SelectItem value="Structure tool">{t("products.structure")}</SelectItem>
                  </SelectContent>
                </Select>
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
                        <th className="px-4 py-2.5 font-medium">{L("Kategori", "Category")}</th>
                        <th className="px-4 py-2.5 font-medium">{L("Produkt", "Product")}</th>
                        <th className="px-4 py-2.5 font-medium">{L("Arkivert", "Archived")}</th>
                        <th className="px-4 py-2.5 font-medium text-right">{L("Handlinger", "Actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArchived.map((p) => (
                        <tr key={p.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold opacity-60", categoryBadgeClass(p.category))}>
                              {p.category}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <AppLink href={`/products/${p.id}`} className="font-medium hover:text-amber-600 transition-colors">
                              {p.brand} {p.name}
                            </AppLink>
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
              <div className={cn("grid gap-3", productLayout === "grid" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
                {filteredArchived.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 gap-3">
                    <AppLink href={`/products/${p.id}`} className="min-w-0 flex-1 group">
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold opacity-60", categoryBadgeClass(p.category))}>{p.category}</span>
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
        ) : viewMode === "stock-changes" ? (
          <StockChangesView
            stockChanges={stockChanges}
            uniqueGroups={uniqueGroups}
            groupFilter={stockChangeGroupFilter}
            setGroupFilter={setStockChangeGroupFilter}
          />
        ) : viewMode === "storage" ? (
          <div className="space-y-4">
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
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                        )}>
                          {totalStock}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
            <div className="space-y-2">
              {sortedFiltered.length === 0 ? (
                <Card className="fs-card rounded-2xl" data-testid="empty-products">
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
                {selectedIds.size > 0 && groupNames.length > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">{selectedIds.size} {L("valgt", "selected")}</span>
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
                        <th className="px-4 py-2.5 font-medium">{L("Kategori", "Category")}</th>
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
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", categoryBadgeClass(p.category))}>
                                {p.category}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <AppLink href={`/products/${p.id}`} className="font-medium hover:text-amber-600 transition-colors">
                                {p.brand} {p.name}
                              </AppLink>
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
              <div className={cn("grid gap-3", productLayout === "grid" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
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

function StockChangesView({
  stockChanges,
  uniqueGroups,
  groupFilter,
  setGroupFilter,
}: {
  stockChanges: StockChange[];
  uniqueGroups: string[];
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  groupFilter: string;
  setGroupFilter: (v: string) => void;
}) {
  const [sort, setSort] = useState<StockSort>("date-desc");

  const filtered = useMemo(() => {
    if (groupFilter === "All") return stockChanges;
    return stockChanges.filter((sc) =>
      sc.groupScope?.split(",").map((g) => g.trim()).includes(groupFilter)
    );
  }, [stockChanges, groupFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "date-desc":
        return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      case "date-asc":
        return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      case "product-az": {
        const getName = (sc: StockChange) => (sc.details?.split(":")[0] ?? "").trim();
        return arr.sort((a, b) => getName(a).localeCompare(getName(b)));
      }
      case "product-za": {
        const getName = (sc: StockChange) => (sc.details?.split(":")[0] ?? "").trim();
        return arr.sort((a, b) => getName(b).localeCompare(getName(a)));
      }
      case "user-az":
        return arr.sort((a, b) => a.userName.localeCompare(b.userName));
      case "user-za":
        return arr.sort((a, b) => b.userName.localeCompare(a.userName));
    }
  }, [filtered, sort]);

  return (
    <div className="space-y-3">
      <Card className="fs-card rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40">
              <History className="h-3.5 w-3.5 text-violet-600" />
            </div>
            {L("Filtre", "Filters")}
          </div>
          {uniqueGroups.length > 1 && (
            <div className="min-w-[180px]">
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger data-testid="select-stock-change-group">
                  <SelectValue placeholder={L("Gruppe", "Group")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{L("Alle grupper", "All groups")}</SelectItem>
                  {uniqueGroups.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="min-w-[170px]">
            <Select value={sort} onValueChange={(v) => setSort(v as StockSort)}>
              <SelectTrigger data-testid="select-sort-stock-changes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">{L("Nyeste først", "Newest first")}</SelectItem>
                <SelectItem value="date-asc">{L("Eldste først", "Oldest first")}</SelectItem>
                <SelectItem value="product-az">{L("Produkt A–Å", "Product A–Z")}</SelectItem>
                <SelectItem value="product-za">{L("Produkt Å–A", "Product Z–A")}</SelectItem>
                <SelectItem value="user-az">{L("Bruker A–Å", "User A–Z")}</SelectItem>
                <SelectItem value="user-za">{L("Bruker Å–A", "User Z–A")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{sorted.length} {L("føringer", "entries")}</span>
        </div>
      </Card>

      {sorted.length === 0 ? (
        <Card className="fs-card rounded-2xl p-6 text-center text-sm text-muted-foreground" data-testid="empty-stock-changes">
          {L("Ingen lagerendringer registrert ennå.", "No stock changes recorded yet.")}
        </Card>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((sc) => {
            const productName = sc.details?.split(":")[0]?.trim() ?? L("Ukjent", "Unknown");
            const changeInfo = sc.details?.split(":").slice(1).join(":").trim() ?? "";
            const isAdd = sc.action === "stock_added";
            const isRemove = sc.action === "stock_removed";
            const d = new Date(sc.createdAt);
            const dateStr = d.toLocaleDateString("nb-NO", { day: "2-digit", month: "short", year: "numeric" });
            const timeStr = d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
            const groups = sc.groupScope?.split(",").map((g) => g.trim()).filter(Boolean) ?? [];

            return (
              <Card key={sc.id} className="fs-card rounded-2xl px-4 py-3" data-testid={`stock-change-${sc.id}`}>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    isAdd
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : isRemove
                        ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                        : "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400"
                  )}>
                    {isAdd ? <ArrowUp className="h-3.5 w-3.5" /> : isRemove ? <ArrowDown className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{productName}</span>
                      {groups.map((g) => (
                        <span key={g} className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-green-200 dark:bg-green-950/30 dark:text-green-400 dark:ring-green-800">{g}</span>
                      ))}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      <span className={cn(
                        "font-semibold",
                        isAdd ? "text-emerald-600 dark:text-emerald-400" : isRemove ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                      )}>
                        {changeInfo}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{sc.userName}</span>
                      <span>{dateStr} {timeStr}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

  const isPending = deltaMutation.isPending || setMutation.isPending;

  return (
    <Card className="fs-card rounded-2xl px-4 py-3" data-testid={`stock-row-${p.id}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", categoryBadgeClass(p.category))}>
              {p.category}
            </span>
          </div>
          <div className="mt-1 truncate text-sm font-semibold">{p.brand} {p.name}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {p.groupScope.split(",").map((g) => g.trim()).filter(Boolean).map((g) => (
              <span key={g} className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-green-200 dark:bg-green-950/30 dark:text-green-400 dark:ring-green-800">{g}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800"
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
                      <Thermometer className="h-2.5 w-2.5" /> {L("Luft", "Air")} {test.weather.airTemperatureC}°C
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/10">
                      <Snowflake className="h-2.5 w-2.5" /> {L("Snø", "Snow")} {test.weather.snowTemperatureC}°C
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
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", categoryBadgeClass(p.category))}>
                {p.category}
              </span>
            </div>
            <AppLink href={`/products/${p.id}`} className="mt-2 block truncate text-base font-semibold hover:text-amber-600 transition-colors">{p.brand} {p.name}</AppLink>
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
