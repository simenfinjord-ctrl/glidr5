import { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Filter, PackagePlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/mock-auth";
import { createProduct, listProducts, type Product, type ProductCategory } from "@/lib/mock-db";

const schema = z.object({
  category: z.enum(["Glide product", "Topping product", "Structure tool"]),
  brand: z.string().min(1, "Brand is required"),
  name: z.string().min(1, "Name is required"),
});

function AddProductModal({ onSaved }: { onSaved: () => void }) {
  const user = getCurrentUser()!;
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "Glide product",
      brand: "",
      name: "",
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          try {
            createProduct(
              {
                category: values.category,
                brand: values.brand,
                name: values.name,
              },
              user,
            );
            toast({ title: "Product added" });
            onSaved();
          } catch (e) {
            toast({
              title: "Could not add product",
              description: e instanceof Error ? e.message : "Unknown error",
              variant: "destructive",
            });
          }
        })}
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

export default function Products() {
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ProductCategory | "All">("All");
  const [brand, setBrand] = useState("");

  const products = useMemo(() => (user ? listProducts(user) : []), [user, open]);

  const filtered = useMemo(() => {
    const b = brand.trim().toLowerCase();
    return products.filter((p) => {
      const okCategory = category === "All" ? true : p.category === category;
      const okBrand = b ? p.brand.toLowerCase().includes(b) : true;
      return okCategory && okBrand;
    });
  }, [products, category, brand]);

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">Products</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-products-subtitle">
              Filter by category or brand. Products are scoped to your group.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-product-prominent">
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
              <Filter className="h-4 w-4 text-muted-foreground" />
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
            </div>

            <Button
              variant="secondary"
              data-testid="button-clear-filters"
              onClick={() => {
                setCategory("All");
                setBrand("");
              }}
            >
              Clear
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3">
          {filtered.length === 0 ? (
            <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-products">
              No products match your filters.
            </Card>
          ) : (
            filtered.map((p) => (
              <Card
                key={p.id}
                className="fs-card rounded-2xl p-4"
                data-testid={`card-product-${p.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{p.brand} — {p.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{p.category}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Created by <span className="text-foreground">{p.createdBy.name}</span>
                      {` · Group ${p.groupScope}`}
                    </div>
                  </div>
                  <div className="inline-flex rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
