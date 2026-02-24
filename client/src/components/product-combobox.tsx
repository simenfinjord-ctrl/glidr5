import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

type TestType = "Glide" | "Structure" | "Classic" | "Skating";
type ProductCategory = "Glide product" | "Topping product" | "Structure tool";

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
};

function categoriesFor(testType: TestType): ProductCategory[] {
  if (testType === "Glide" || testType === "Classic" || testType === "Skating")
    return ["Glide product", "Topping product"];
  return ["Structure tool"];
}

export function ProductCombobox({
  testType,
  products,
  value,
  onChange,
  testId,
}: {
  testType: TestType;
  products: Product[];
  value: number | undefined;
  onChange: (productId: number) => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);

  const allowed = useMemo(() => {
    const cats = new Set<string>(categoriesFor(testType));
    return products.filter((p) => cats.has(p.category));
  }, [products, testType]);

  const selected = useMemo(() => allowed.find((p) => p.id === value), [allowed, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-between bg-background/70"
          data-testid={testId}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? `${selected.brand} ${selected.name}` : "Select product"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(380px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput data-testid={`${testId}-search`} placeholder="Search products…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup heading="Products">
              {allowed.map((p) => {
                const isSelected = p.id === value;
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.brand} ${p.name}`}
                    onSelect={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    data-testid={`option-product-${p.id}`}
                  >
                    <span className="truncate">{p.brand} {p.name}</span>
                    <Check className={cn("ml-auto h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
