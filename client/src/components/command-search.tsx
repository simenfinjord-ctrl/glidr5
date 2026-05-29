// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, ListChecks, Package, Snowflake } from "lucide-react";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  // Cmd+K / Ctrl+K shortcut + external open event
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const eventHandler = () => setOpen(true);
    document.addEventListener("keydown", keyHandler);
    window.addEventListener("glidr-open-search", eventHandler);
    return () => {
      document.removeEventListener("keydown", keyHandler);
      window.removeEventListener("glidr-open-search", eventHandler);
    };
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
      <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("search.placeholder")}
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
                      className="group"
                    >
                      <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground group-data-[selected=true]:text-accent-foreground/70" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{item.title}</div>
                        <div className="text-xs truncate text-muted-foreground group-data-[selected=true]:text-accent-foreground/70">
                          {item.subtitle}
                        </div>
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
