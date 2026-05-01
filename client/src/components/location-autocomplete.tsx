import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Suggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "data-testid"?: string;
  className?: string;
};

/**
 * Location input with Google Places autocomplete.
 * Falls back to plain Input if the server-side proxy is unavailable or
 * the GOOGLE_MAPS_API_KEY env var is not set.
 */
export function LocationAutocomplete({
  value,
  onChange,
  placeholder = "e.g., Park City",
  "data-testid": testId,
  className,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasApiSupport, setHasApiSupport] = useState<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch suggestions from server proxy
  const fetchSuggestions = useCallback(async (input: string) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
      if (!res.ok) {
        if (res.status === 501) {
          setHasApiSupport(false);
        }
        setSuggestions([]);
        setIsOpen(false);
        return;
      }
      setHasApiSupport(true);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setIsOpen((data.suggestions ?? []).length > 0);
    } catch {
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.description);
    setSuggestions([]);
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

  // If API not supported, render plain input
  if (hasApiSupport === false) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className={className}
      />
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          data-testid={testId}
          className="pl-8 pr-8"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-md overflow-hidden py-1"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(s)}
              className={cn(
                "flex items-start gap-2 px-3 py-2 cursor-pointer text-sm",
                i === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">{s.mainText}</span>
                {s.secondaryText && (
                  <span className="text-muted-foreground text-xs ml-1">{s.secondaryText}</span>
                )}
              </span>
            </li>
          ))}
          <li className="px-3 py-1 text-[10px] text-muted-foreground/60 border-t border-border mt-1 flex items-center gap-1">
            <svg viewBox="0 0 20 20" className="h-3 w-3 fill-current opacity-60"><path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-1 14H7V7h2v7zm4 0h-2V7h2v7z"/></svg>
            Powered by Google
          </li>
        </ul>
      )}
    </div>
  );
}
