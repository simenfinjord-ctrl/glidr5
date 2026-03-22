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

type RaceSkiOption = {
  id: number;
  skiId: string;
  serialNumber: string | null;
  brand: string | null;
  discipline: string;
  athleteName: string;
  grind: string | null;
};

function skiLabel(ski: RaceSkiOption): string {
  const parts: string[] = [];
  parts.push(ski.athleteName);
  parts.push("—");
  if (ski.brand) parts.push(ski.brand);
  parts.push(ski.skiId);
  if (ski.serialNumber) parts.push(`(#${ski.serialNumber})`);
  if (ski.grind) parts.push(`[${ski.grind}]`);
  return parts.join(" ");
}

function searchValue(ski: RaceSkiOption): string {
  return [
    ski.athleteName,
    ski.brand,
    ski.skiId,
    ski.serialNumber,
    ski.grind,
    ski.discipline,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function RaceSkiCombobox({
  raceSkis,
  value,
  onChange,
  testId,
}: {
  raceSkis: RaceSkiOption[];
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => raceSkis.find((s) => s.id === value),
    [raceSkis, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full min-w-[180px] justify-between bg-background/70"
          data-testid={testId}
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected ? skiLabel(selected) : "Select race ski…"}
          </span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput
            data-testid={`${testId}-search`}
            placeholder="Search serial number, ski ID, athlete…"
          />
          <CommandList>
            <CommandEmpty>No matching skis.</CommandEmpty>
            <CommandGroup heading="Race Skis">
              {raceSkis.map((ski) => {
                const isSelected = ski.id === value;
                return (
                  <CommandItem
                    key={ski.id}
                    value={searchValue(ski)}
                    onSelect={() => {
                      onChange(ski.id);
                      setOpen(false);
                    }}
                    data-testid={`option-raceski-${ski.id}`}
                  >
                    <div className="flex flex-col">
                      <span className="truncate text-sm">
                        {ski.athleteName} — {ski.brand ? `${ski.brand} ` : ""}{ski.skiId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ski.serialNumber ? `#${ski.serialNumber}` : "No serial"}
                        {ski.grind ? ` · ${ski.grind}` : ""}
                        {` · ${ski.discipline}`}
                      </span>
                    </div>
                    <Check className={cn("ml-auto h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
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
