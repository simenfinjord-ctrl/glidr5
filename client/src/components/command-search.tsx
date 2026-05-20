import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, ListChecks, Package, Snowflake } from "lucide-react";
import {
  CommandDialog, Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

type SearchResult = {
  type: "test" | "product" | "series";
  id: number;
  title: string;
  subtitle: string;
  href: string;
};

const TYPE_ICON = {
  test: ListChecks,
  product: Package,
  series: Snowflake,
};
const TYPE_LABEL = { test: "Tests", product: "Products", series: "Test Skis" };

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const { data: results = [] } = useQuery<SearchResult[]>({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      if (query.trim().length < 2) return [];
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: query.trim().length >= 2,
    staleTime: 5000,
  });

  const grouped = (["test", "product", "series"] as const).map((type) => ({
    type,
    items: results.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0);

  function select(href: string) {
    setOpen(false);
    setQuery("");
    navigate(href);
  }

  return (
    <>
      {/* Trigger button shown in header */}
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        data-testid="button-global-search"
      >
        <Search className="h-3.5 w-3.5" />
        Search…
        <kbd className="ml-1 rounded bg-background px-1.5 py-0.5 text-[10px] font-mono border border-border">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search tests, products, skis…"
            value={query}
            onValueChange={setQuery}
            data-testid="input-global-search"
          />
          <CommandList>
            {query.length >= 2 && results.length === 0 && (
              <CommandEmpty>No results for "{query}"</CommandEmpty>
            )}
            {query.length < 2 && (
              <CommandEmpty>Type at least 2 characters…</CommandEmpty>
            )}
            {grouped.map(({ type, items }) => {
              const Icon = TYPE_ICON[type];
              return (
                <CommandGroup key={type} heading={TYPE_LABEL[type]}>
                  {items.map((item) => (
                    <CommandItem
                      key={`${type}-${item.id}`}
                      value={`${type}-${item.id}`}
                      onSelect={() => select(item.href)}
                      data-testid={`search-result-${type}-${item.id}`}
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{item.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
