import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "data-testid"?: string;
  className?: string;
  /** Use search icon instead of MapPin, and plain styling (for search bars) */
  searchMode?: boolean;
  /** Extra classes forwarded to the inner <input> element */
  inputClassName?: string;
  /** Called when user commits a value (Enter or selection) */
  onCommit?: (value: string) => void;
};

/**
 * Location input with suggestions drawn from the team's test, weather and
 * race-prep history.  Keyboard-navigable; works as both a form field and a
 * search bar (searchMode=true).
 */
export function LocationAutocomplete({
  value,
  onChange,
  placeholder = "e.g., Park City",
  "data-testid": testId,
  className,
  searchMode = false,
  inputClassName,
  onCommit,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allLocations = [] } = useQuery<string[]>({
    queryKey: ["/api/locations/history"],
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = useCallback((): string[] => {
    if (!value || value.length < 1) return [];
    const q = value.toLowerCase();
    return allLocations
      .filter((loc) => loc.toLowerCase().includes(q) && loc.toLowerCase() !== q)
      .slice(0, 8);
  }, [value, allLocations])();

  useEffect(() => {
    setIsOpen(suggestions.length > 0);
    setActiveIndex(-1);
  }, [suggestions.length]);

  const handleSelect = (loc: string) => {
    onChange(loc);
    setIsOpen(false);
    setActiveIndex(-1);
    onCommit?.(loc);
    // Keep focus on the input after selection
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (!isOpen && suggestions.length > 0) { setIsOpen(true); return; }
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (isOpen && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      } else {
        onCommit?.(value);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const Icon = searchMode ? Search : MapPin;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          data-testid={testId}
          className={cn("pl-8", inputClassName)}
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full min-w-[180px] rounded-lg border border-border bg-popover shadow-lg overflow-hidden py-1"
          role="listbox"
        >
          {suggestions.map((loc, i) => (
            <li
              key={loc}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(loc); }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm select-none",
                i === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50 text-foreground"
              )}
            >
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate">{loc}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
