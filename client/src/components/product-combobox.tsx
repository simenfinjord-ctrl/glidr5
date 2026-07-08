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
import { useI18n } from "@/lib/i18n";

type TestType = "Glide" | "Structure" | "Classic" | "Skating" | "Double Poling";
// Products are categorised as Paraffin / Liquid / Block / Structure Tool.
type ProductCategory = "Paraffin" | "Liquid" | "Block" | "Structure Tool";

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
};

// Robust to naming/casing and legacy category values.
function isStructureTool(category: string): boolean {
  return /structure|struktur|\btool\b|verkt|rille/i.test(category || "");
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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const allowed = useMemo(() => {
    const structure = testType === "Structure";
    return products.filter((p) => structure ? isStructureTool(p.category) : !isStructureTool(p.category));
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
          <CommandInput data-testid={`${testId}-search`} placeholder={t("products.searchPlaceholder")} />
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
