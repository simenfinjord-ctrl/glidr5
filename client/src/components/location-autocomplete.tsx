import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "data-testid"?: string;
  className?: string;
};

/**
 * Location input that suggests previously used locations from the team's test history.
 * Filters matches as the user types — no external API needed.
 */
export function LocationAutocomplete({
  value,
  onChange,
  placeholder = "e.g., Park City",
  "data-testid": testId,
  className,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all unique locations from the team's test history
  const { data: allLocations = [] } = useQuery<string[]>({
    queryKey: ["/api/locations/history"],
    staleTime: 5 * 60 * 1000,
  });

  // Filter suggestions based on current input
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
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
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

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          data-testid={testId}
          className="pl-8"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-md overflow-hidden py-1"
          role="listbox"
        >
          {suggestions.map((loc, i) => (
            <li
              key={loc}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(loc)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 cursor-pointer text-sm",
                i === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {loc}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
