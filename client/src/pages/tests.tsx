import { useMemo, useState } from "react";
import { Plus, Trophy, Filter, MapPin, Thermometer, Droplets } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Test = {
  id: number;
  date: string;
  location: string;
  weatherId: number | null;
  testType: string;
  seriesId: number;
  notes: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
};

type Series = { id: number; name: string };
type Product = { id: number; category: string; brand: string; name: string };
type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  resultXkmCmBehind: number | null;
  rankXkm: number | null;
};
type Weather = {
  id: number;
  date: string;
  location: string;
  airTemperatureC: number;
  airHumidityPct: number;
  snowTemperatureC: number;
  snowHumidityPct: number;
  snowType: string | null;
  artificialSnow: string | null;
  naturalSnow: string | null;
  grainSize: string | null;
  snowHumidityType: string | null;
  trackHardness: string | null;
  testQuality: number | null;
};

export default function Tests() {
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });

  const allTestIds = tests.map((t) => t.id);
  const { data: allEntries = [] } = useQuery<TestEntry[]>({
    queryKey: ["/api/tests/entries/all", allTestIds],
    queryFn: async () => {
      if (allTestIds.length === 0) return [];
      const results = await Promise.all(
        allTestIds.map((id) =>
          fetch(`/api/tests/${id}/entries`, { credentials: "include" }).then((r) => r.json())
        )
      );
      return results.flat();
    },
    enabled: allTestIds.length > 0,
  });

  const [filterType, setFilterType] = useState<string>("All");
  const [filterProduct, setFilterProduct] = useState<string>("All");
  const [filterSnowType, setFilterSnowType] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterAirTempMin, setFilterAirTempMin] = useState("");
  const [filterAirTempMax, setFilterAirTempMax] = useState("");
  const [filterSnowTempMin, setFilterSnowTempMin] = useState("");
  const [filterSnowTempMax, setFilterSnowTempMax] = useState("");
  const [filterAirHumMin, setFilterAirHumMin] = useState("");
  const [filterAirHumMax, setFilterAirHumMax] = useState("");
  const [filterSnowHumMin, setFilterSnowHumMin] = useState("");
  const [filterSnowHumMax, setFilterSnowHumMax] = useState("");

  const seriesById = new Map(series.map((s) => [s.id, s.name] as const));
  const productsById = new Map(products.map((p) => [p.id, p] as const));
  const weatherById = new Map(weather.map((w) => [w.id, w] as const));

  const winnersByTest = useMemo(() => {
    const map = new Map<number, { productName: string; skiNumber: number } | null>();
    for (const t of tests) {
      const entries = allEntries.filter((e) => e.testId === t.id);
      const winner = entries.find((e) => e.rank0km === 1);
      if (winner) {
        const prod = winner.productId ? productsById.get(winner.productId) : null;
        map.set(t.id, {
          productName: prod ? `${prod.brand} ${prod.name}` : `Ski #${winner.skiNumber}`,
          skiNumber: winner.skiNumber,
        });
      } else {
        map.set(t.id, null);
      }
    }
    return map;
  }, [tests, allEntries, productsById]);

  const filtered = useMemo(() => {
    return tests.filter((t) => {
      if (filterType !== "All" && t.testType !== filterType) return false;
      if (filterLocation && !t.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;

      if (filterProduct !== "All") {
        const entries = allEntries.filter((e) => e.testId === t.id);
        const pid = parseInt(filterProduct);
        if (!entries.some((e) => e.productId === pid)) return false;
      }

      const w = t.weatherId ? weatherById.get(t.weatherId) : null;

      if (filterSnowType) {
        const snowLabel = [w?.artificialSnow, w?.naturalSnow, w?.snowType].filter(Boolean).join(" ").toLowerCase();
        if (!w || !snowLabel.includes(filterSnowType.toLowerCase())) return false;
      }

      if (filterAirTempMin && (!w || w.airTemperatureC < parseFloat(filterAirTempMin))) return false;
      if (filterAirTempMax && (!w || w.airTemperatureC > parseFloat(filterAirTempMax))) return false;
      if (filterSnowTempMin && (!w || w.snowTemperatureC < parseFloat(filterSnowTempMin))) return false;
      if (filterSnowTempMax && (!w || w.snowTemperatureC > parseFloat(filterSnowTempMax))) return false;
      if (filterAirHumMin && (!w || w.airHumidityPct < parseFloat(filterAirHumMin))) return false;
      if (filterAirHumMax && (!w || w.airHumidityPct > parseFloat(filterAirHumMax))) return false;
      if (filterSnowHumMin && (!w || w.snowHumidityPct < parseFloat(filterSnowHumMin))) return false;
      if (filterSnowHumMax && (!w || w.snowHumidityPct > parseFloat(filterSnowHumMax))) return false;

      return true;
    });
  }, [tests, filterType, filterProduct, filterSnowType, filterLocation, filterAirTempMin, filterAirTempMax, filterSnowTempMin, filterSnowTempMax, filterAirHumMin, filterAirHumMax, filterSnowHumMin, filterSnowHumMax, allEntries, weatherById]);

  const hasFilters = filterType !== "All" || filterProduct !== "All" || filterSnowType || filterLocation || filterAirTempMin || filterAirTempMax || filterSnowTempMin || filterSnowTempMax || filterAirHumMin || filterAirHumMax || filterSnowHumMin || filterSnowHumMax;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">Tests</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-tests-subtitle">
              {filtered.length} test{filtered.length !== 1 ? "s" : ""}{hasFilters ? " matching filters" : " total"}
            </p>
          </div>
          <AppLink href="/tests/new">
            <Button data-testid="button-new-test" className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90">
              <Plus className="mr-2 h-4 w-4" />
              New test
            </Button>
          </AppLink>
        </div>

        <Card className="fs-card rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
                <Filter className="h-3.5 w-3.5 text-primary" />
              </div>
              Filters
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="min-w-[140px]">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger data-testid="select-filter-test-type">
                    <SelectValue placeholder="Test type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All types</SelectItem>
                    <SelectItem value="Glide">Glide</SelectItem>
                    <SelectItem value="Structure">Structure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px]">
                <Select value={filterProduct} onValueChange={setFilterProduct}>
                  <SelectTrigger data-testid="select-filter-product">
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All products</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.brand} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[160px]">
                <Input
                  value={filterSnowType}
                  onChange={(e) => setFilterSnowType(e.target.value)}
                  placeholder="Snow type…"
                  data-testid="input-filter-snow-type"
                />
              </div>
              <div className="min-w-[160px]">
                <Input
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  placeholder="Location…"
                  data-testid="input-filter-location"
                />
              </div>
            </div>
            {hasFilters && (
              <Button
                variant="secondary"
                data-testid="button-clear-test-filters"
                onClick={() => {
                  setFilterType("All");
                  setFilterProduct("All");
                  setFilterSnowType("");
                  setFilterLocation("");
                  setFilterAirTempMin("");
                  setFilterAirTempMax("");
                  setFilterSnowTempMin("");
                  setFilterSnowTempMax("");
                  setFilterAirHumMin("");
                  setFilterAirHumMax("");
                  setFilterSnowHumMin("");
                  setFilterSnowHumMax("");
                }}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="mt-3 border-t border-border/40 pt-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Thermometer className="h-3 w-3" />
              Weather conditions
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
                  Air temp (°C)
                </label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" value={filterAirTempMin} onChange={(e) => setFilterAirTempMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-air-temp-min" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="number" value={filterAirTempMax} onChange={(e) => setFilterAirTempMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-air-temp-max" />
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Snow temp (°C)
                </label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" value={filterSnowTempMin} onChange={(e) => setFilterSnowTempMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-snow-temp-min" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="number" value={filterSnowTempMax} onChange={(e) => setFilterSnowTempMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-snow-temp-max" />
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400" />
                  Air humidity (%)
                </label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" value={filterAirHumMin} onChange={(e) => setFilterAirHumMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-air-hum-min" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="number" value={filterAirHumMax} onChange={(e) => setFilterAirHumMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-air-hum-max" />
                </div>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Snow humidity (%)
                </label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" value={filterSnowHumMin} onChange={(e) => setFilterSnowHumMin(e.target.value)} placeholder="Min" className="h-8 text-xs" data-testid="input-filter-snow-hum-min" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input type="number" value={filterSnowHumMax} onChange={(e) => setFilterSnowHumMax(e.target.value)} placeholder="Max" className="h-8 text-xs" data-testid="input-filter-snow-hum-max" />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3">
          {filtered.length === 0 ? (
            <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-tests">
              {hasFilters ? "No tests match your filters." : "No tests yet."}
            </Card>
          ) : (
            filtered.map((t) => {
              const winner = winnersByTest.get(t.id);
              const w = t.weatherId ? weatherById.get(t.weatherId) : null;
              return (
                <AppLink key={t.id} href={`/tests/${t.id}`} testId={`link-test-${t.id}`}>
                  <Card className="fs-card rounded-2xl p-4 transition-all duration-200 hover:bg-card/90 hover:shadow-lg hover:shadow-primary/5 cursor-pointer" data-testid={`card-test-${t.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", t.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure")}>
                            {t.testType}
                          </span>
                          <span className="text-base font-semibold">{t.location}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{t.date}</span>
                          <span className="text-border">·</span>
                          <span>{seriesById.get(t.seriesId) ?? "Series"}</span>
                        </div>
                        {w && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full fs-gradient-blue px-2 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-sky-500/10">
                              <Thermometer className="h-2.5 w-2.5" /> Air {w.airTemperatureC}°C
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full fs-gradient-emerald px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/10">
                              <Thermometer className="h-2.5 w-2.5" /> Snow {w.snowTemperatureC}°C
                            </span>
                            {w.artificialSnow && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-medium text-pink-300 ring-1 ring-pink-500/10">
                                Art: {w.artificialSnow}
                              </span>
                            )}
                            {w.naturalSnow && (
                              <span className="inline-flex items-center gap-1 rounded-full fs-gradient-violet px-2 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/10">
                                Nat: {w.naturalSnow}
                              </span>
                            )}
                            {w.snowHumidityType && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300 ring-1 ring-indigo-500/10">
                                <Droplets className="h-2.5 w-2.5" /> {w.snowHumidityType}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="text-foreground/70">{t.createdByName}</span>
                          <span className="text-border"> · </span>
                          <span>{t.groupScope}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="inline-flex rounded-full border border-border/40 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </div>
                        {winner && (
                          <div
                            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500/15 to-emerald-400/5 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20"
                            data-testid={`badge-winner-${t.id}`}
                          >
                            <Trophy className="h-3 w-3" />
                            {winner.productName}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </AppLink>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
