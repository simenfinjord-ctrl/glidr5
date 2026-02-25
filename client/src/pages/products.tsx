import { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Filter, PackagePlus, Pencil, Trash2, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient, OfflineError } from "@/lib/queryClient";
import { useOffline } from "@/lib/offline-context";
import { cn } from "@/lib/utils";

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
};

type ApiGroup = { id: number; name: string };

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
        toast({ title: "Saved offline", description: "Will sync when you reconnect." });
        onSaved();
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product added" });
      onSaved();
    },
    onError: (e) => {
      toast({
        title: "Could not add product",
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
              <FormLabel>Category</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid="select-product-category">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Glide product">Glide product</SelectItem>
                  <SelectItem value="Topping product">Topping product</SelectItem>
                  <SelectItem value="Structure tool">Structure tool</SelectItem>
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
                <FormLabel>Brand</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-product-brand" placeholder="e.g., Swix" />
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
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-product-name" placeholder="e.g., HS10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end">
          <Button type="submit" data-testid="button-save-product">
            Add product
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
      toast({ title: "Product updated" });
      onSaved();
    },
    onError: (e) => {
      toast({
        title: "Could not update product",
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
              <FormLabel>Category</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid="select-edit-product-category">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Glide product">Glide product</SelectItem>
                  <SelectItem value="Topping product">Topping product</SelectItem>
                  <SelectItem value="Structure tool">Structure tool</SelectItem>
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
                <FormLabel>Brand</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-edit-product-brand" placeholder="e.g., Swix" />
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
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-edit-product-name" placeholder="e.g., HS10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end">
          <Button type="submit" data-testid="button-update-product" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
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
      toast({ title: "Groups updated", description: `${product.brand} ${product.name} assigned to ${selected.join(", ")}` });
      onDone();
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
        <div className="text-sm font-medium">{product.brand} {product.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Currently in: <span className="font-medium text-foreground">{product.groupScope}</span>
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Assign to groups</label>
        <div className="space-y-2">
          {groupNames.map((g) => (
            <label
              key={g}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                selected.includes(g)
                  ? "border-primary/40 bg-primary/5"
                  : "border-gray-100 bg-gray-50/50 hover:bg-background/50"
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
          Save
        </Button>
      </div>
    </div>
  );
}

export default function Products() {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ProductCategory | "All">("All");
  const [brand, setBrand] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [editingDetailsProduct, setEditingDetailsProduct] = useState<Product | undefined>();
  const [deletingProduct, setDeletingProduct] = useState<Product | undefined>();
  const { toast } = useToast();

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: apiGroups = [] } = useQuery<ApiGroup[]>({
    queryKey: ["/api/groups"],
    enabled: isAdmin,
  });
  const groupNames = apiGroups.map((g) => g.name);

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

  const filtered = useMemo(() => {
    const b = brand.trim().toLowerCase();
    const n = nameSearch.trim().toLowerCase();
    return products.filter((p) => {
      const okCategory = category === "All" ? true : p.category === category;
      const okBrand = b ? p.brand.toLowerCase().includes(b) : true;
      const okName = n ? p.name.toLowerCase().includes(n) : true;
      return okCategory && okBrand && okName;
    });
  }, [products, category, brand, nameSearch]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product deleted" });
      setDeletingProduct(undefined);
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
            <h1 className="text-2xl sm:text-3xl">Products</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-products-subtitle">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-product-prominent" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                <PackagePlus className="mr-2 h-4 w-4" />
                Add product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Add product</DialogTitle>
              </DialogHeader>
              <AddProductModal onSaved={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <Card className="fs-card rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50">
                <Filter className="h-3.5 w-3.5 text-amber-600" />
              </div>
              Filters
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="min-w-[220px]">
                <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                  <SelectTrigger data-testid="select-filter-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All categories</SelectItem>
                    <SelectItem value="Glide product">Glide product</SelectItem>
                    <SelectItem value="Topping product">Topping product</SelectItem>
                    <SelectItem value="Structure tool">Structure tool</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[220px]">
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Brand contains…"
                  data-testid="input-filter-brand"
                />
              </div>
              <div className="min-w-[220px]">
                <Input
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  placeholder="Name contains…"
                  data-testid="input-filter-name"
                />
              </div>
            </div>

            <Button
              variant="secondary"
              data-testid="button-clear-filters"
              onClick={() => {
                setCategory("All");
                setBrand("");
                setNameSearch("");
              }}
            >
              Clear
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.length === 0 ? (
            <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground sm:col-span-2" data-testid="empty-products">
              No products match your filters.
            </Card>
          ) : (
            filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                isAdmin={isAdmin}
                onEdit={() => setEditingDetailsProduct(p)}
                onEditGroups={() => setEditingProduct(p)}
                onDelete={() => setDeletingProduct(p)}
              />
            ))
          )}
        </div>

        <Dialog open={!!editingProduct} onOpenChange={(v) => { if (!v) setEditingProduct(undefined); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Assign groups</DialogTitle></DialogHeader>
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
            <DialogHeader><DialogTitle>Edit product</DialogTitle></DialogHeader>
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
            <DialogHeader><DialogTitle>Delete product</DialogTitle></DialogHeader>
            {deletingProduct && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete <span className="font-medium text-foreground">{deletingProduct.brand} {deletingProduct.name}</span>?
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDeletingProduct(undefined)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    data-testid="button-confirm-delete-product"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(deletingProduct.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
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

function ProductCard({
  product: p,
  isAdmin,
  onEdit,
  onEditGroups,
  onDelete,
}: {
  product: Product;
  isAdmin: boolean;
  onEdit: () => void;
  onEditGroups: () => void;
  onDelete: () => void;
}) {
  const groups = p.groupScope.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <Card
      className="fs-card rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/5"
      data-testid={`card-product-${p.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", categoryBadgeClass(p.category))}>
              {p.category}
            </span>
          </div>
          <div className="mt-2 truncate text-base font-semibold">{p.brand} {p.name}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {groups.map((g) => (
              <span key={g} className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                {g}
              </span>
            ))}
            {groups.length === 0 && (
              <span className="text-[10px] text-muted-foreground">No group assigned</span>
            )}
            <span className="text-xs text-muted-foreground">
              <span className="text-foreground/70">{p.createdByName}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex rounded-full border border-gray-100 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
            {new Date(p.createdAt).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              data-testid={`button-edit-product-${p.id}`}
              onClick={onEdit}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  data-testid={`button-edit-groups-${p.id}`}
                  onClick={onEditGroups}
                >
                  <Users className="mr-1 h-3 w-3" />
                  Groups
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                  data-testid={`button-delete-product-${p.id}`}
                  onClick={onDelete}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
