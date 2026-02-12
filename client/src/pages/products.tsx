import { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Filter, PackagePlus, ArrowRightLeft, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
      const res = await apiRequest("POST", "/api/products", data);
      return res.json();
    },
    onSuccess: () => {
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

function MoveProductModal({
  product,
  groupNames,
  onDone,
}: {
  product: Product;
  groupNames: string[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [targetGroup, setTargetGroup] = useState(product.groupScope);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/products/${product.id}`, {
        groupScope: targetGroup,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product moved", description: `${product.brand} ${product.name} moved to ${targetGroup}` });
      onDone();
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/40 bg-background/30 p-3">
        <div className="text-sm font-medium">{product.brand} {product.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Currently in: <span className="font-medium text-foreground">{product.groupScope}</span>
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Move to group</label>
        <Select value={targetGroup} onValueChange={setTargetGroup}>
          <SelectTrigger data-testid="select-move-group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groupNames.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          data-testid="button-move-product"
          disabled={targetGroup === product.groupScope || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Move
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
  const [groupFilter, setGroupFilter] = useState<string>("All");
  const [movingProduct, setMovingProduct] = useState<Product | undefined>();

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: apiGroups = [] } = useQuery<ApiGroup[]>({
    queryKey: ["/api/groups"],
    enabled: isAdmin,
  });
  const groupNames = apiGroups.map((g) => g.name);

  const uniqueGroups = useMemo(() => {
    const set = new Set(products.map((p) => p.groupScope));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const b = brand.trim().toLowerCase();
    return products.filter((p) => {
      const okCategory = category === "All" ? true : p.category === category;
      const okBrand = b ? p.brand.toLowerCase().includes(b) : true;
      const okGroup = groupFilter === "All" ? true : p.groupScope === groupFilter;
      return okCategory && okBrand && okGroup;
    });
  }, [products, category, brand, groupFilter]);

  const groupedProducts = useMemo(() => {
    if (!isAdmin || groupFilter !== "All") return null;
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const existing = map.get(p.groupScope) || [];
      existing.push(p);
      map.set(p.groupScope, existing);
    }
    return map;
  }, [filtered, isAdmin, groupFilter]);

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">Products</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-products-subtitle">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
              {isAdmin && groupFilter === "All" && uniqueGroups.length > 1 ? ` across ${uniqueGroups.length} groups` : ""}
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
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10">
                <Filter className="h-3.5 w-3.5 text-amber-400" />
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
              {isAdmin && uniqueGroups.length > 1 && (
                <div className="min-w-[200px]">
                  <Select value={groupFilter} onValueChange={setGroupFilter}>
                    <SelectTrigger data-testid="select-filter-group">
                      <SelectValue placeholder="Group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All groups</SelectItem>
                      {uniqueGroups.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              data-testid="button-clear-filters"
              onClick={() => {
                setCategory("All");
                setBrand("");
                setGroupFilter("All");
              }}
            >
              Clear
            </Button>
          </div>
        </Card>

        {groupedProducts && groupedProducts.size > 1 ? (
          Array.from(groupedProducts.entries()).map(([group, prods]) => (
            <div key={group} className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary/60" />
                <h2 className="text-sm font-semibold">{group}</h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {prods.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {prods.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    isAdmin={isAdmin}
                    onMove={() => setMovingProduct(p)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
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
                  onMove={() => setMovingProduct(p)}
                />
              ))
            )}
          </div>
        )}

        <Dialog open={!!movingProduct} onOpenChange={(v) => { if (!v) setMovingProduct(undefined); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Move product to another group</DialogTitle></DialogHeader>
            {movingProduct && (
              <MoveProductModal
                product={movingProduct}
                groupNames={groupNames.length > 0 ? groupNames : uniqueGroups}
                onDone={() => setMovingProduct(undefined)}
              />
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
  onMove,
}: {
  product: Product;
  isAdmin: boolean;
  onMove: () => void;
}) {
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
            <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/20">
              {p.groupScope}
            </span>
            <span className="text-xs text-muted-foreground">
              <span className="text-foreground/70">{p.createdByName}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex rounded-full border border-border/40 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
            {new Date(p.createdAt).toLocaleDateString()}
          </div>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              data-testid={`button-move-product-${p.id}`}
              onClick={onMove}
            >
              <ArrowRightLeft className="mr-1 h-3 w-3" />
              Move
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
