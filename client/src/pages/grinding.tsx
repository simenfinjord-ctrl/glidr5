import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2, Disc3, Trophy, Filter, MapPin, Thermometer, CalendarDays, Copy, Search, X, ChevronUp, ChevronDown, Wind, Snowflake, BarChart2, LayoutGrid, LayoutList, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn, fmtDate } from "@/lib/utils";

type Test = {
  id: number;
  date: string;
  startTime: string | null;
  location: string;
  weatherId: number | null;
  testType: string;
  seriesId: number;
  notes: string | null;
  grindParameters: string | null;
  distanceLabels: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
};

type Series = { id: number; name: string; type: string; groupScope: string };
type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  results: string | null;
  feelingRank: number | null;
  kickRank: number | null;
  grindType: string | null;
  grindStone: string | null;
  grindPattern: string | null;
  grindExtraParams: string | null;
  grindProfileId?: number | null;
};
type Weather = {
  id: number;
  date: string;
  location: string;
  airTemperatureC: number;
  snowTemperatureC: number;
};


type GrindProfile = {
  id: number;
  name: string;
  grindType: string;
  stone: string;
  pattern: string;
  extraParams: string | null;
  grindId?: string | null;
  createdByName: string;
  teamId: number;
  createdAt: string;
};

type RoundResult = { result: number | null; rank: number | null };

type ProfileTestEntry = {
  id: number; testId: number; skiNumber: number;
  productId: number | null; raceSkiId: number | null;
  skiModel: string | null; skiBrand: string | null;
  methodology: string;
  result0kmCmBehind: number | null; rank0km: number | null;
  resultXkmCmBehind: number | null; rankXkm: number | null;
  results: string | null; feelingRank: number | null; kickRank: number | null;
  grindType: string | null; grindStone: string | null;
  grindPattern: string | null; grindExtraParams: string | null;
};
type ProfileTest = {
  id: number; date: string; location: string; testName: string | null;
  weatherId: number | null; testType: string; notes: string | null;
  distanceLabels: string | null; distanceLabel0km: string | null; distanceLabelXkm: string | null;
  seriesId: number | null; createdByName: string; createdAt: string; groupScope: string;
  weather: { airTemperatureC: number; snowTemperatureC: number; humidity: number | null; weatherType: string | null } | null;
  entries: ProfileTestEntry[];
};
type ProfileTestsResponse = { profile: GrindProfile; tests: ProfileTest[] };

function getDistanceLabels(test: Test): string[] {
  if (test.distanceLabels) {
    try {
      const parsed = JSON.parse(test.distanceLabels);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  const labels: string[] = [test.distanceLabel0km || "0 km"];
  if (test.distanceLabelXkm) labels.push(test.distanceLabelXkm);
  return labels;
}

function getEntryRounds(entry: TestEntry & { resultXkmCmBehind?: number | null; rankXkm?: number | null }, numRounds: number): RoundResult[] {
  if (entry.results) {
    try {
      const parsed = JSON.parse(entry.results);
      if (Array.isArray(parsed)) {
        while (parsed.length < numRounds) parsed.push({ result: null, rank: null });
        return parsed.slice(0, numRounds);
      }
    } catch {}
  }
  const results: RoundResult[] = [{ result: entry.result0kmCmBehind, rank: entry.rank0km }];
  if (numRounds > 1) results.push({ result: entry.resultXkmCmBehind ?? null, rank: entry.rankXkm ?? null });
  while (results.length < numRounds) results.push({ result: null, rank: null });
  return results;
}

function RankBadge({ rank }: { rank: number | null }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-7 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold",
        rank === 1 && "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30",
        rank === 2 && "bg-slate-300/20 text-slate-300 ring-1 ring-slate-300/30",
        rank === 3 && "bg-amber-700/20 text-amber-600 ring-1 ring-amber-700/30",
        rank !== null && rank > 3 && "bg-muted/60 text-muted-foreground",
        rank === null && "text-muted-foreground",
      )}
    >
      {rank ?? "—"}
    </span>
  );
}

function parseGrindParams(json: string | null): { grindType?: string; stone?: string; pattern?: string } {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

function parseExtraParams(json: string | null): Record<string, string> {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

/** Format a param key for display: underscores → spaces, capitalize first letter. */
function formatParamKey(k: string): string {
  if (k === "ra_value") return "RA-value";
  return k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

// ─── Grind Profile form ────────────────────────────────────────────────────────

// A "param" row: fixed params (stone, pattern, RA-value) plus user-defined ones
type ParamRow = { key: string; value: string; fixed?: boolean };

const GRIND_TYPE_OPTIONS = ["Classic", "Skate", "Universal"];

type GrindProfileFormValues = {
  name: string;
  grindType: string;
};

function GrindProfileForm({
  onDone,
  editProfile,
  allProfileParamKeys = [],
}: {
  onDone: () => void;
  editProfile?: GrindProfile;
  allProfileParamKeys?: string[];
}) {
  const { toast } = useToast();

  // Build initial param rows: fixed (stone, pattern, RA-value) + custom from extraParams + missing team-wide keys
  const initParams = (): ParamRow[] => {
    const parsed = parseExtraParams(editProfile?.extraParams ?? null);
    const custom = Object.entries(parsed)
      .filter(([k]) => !["stone", "pattern", "ra_value"].includes(k))
      .map(([key, value]) => ({ key, value }));
    const existingKeys = new Set(custom.map((p) => p.key));
    const missingKeys = allProfileParamKeys
      .filter((k) => !existingKeys.has(k))
      .map((key) => ({ key, value: "" }));
    return [
      { key: "stone", value: editProfile?.stone ?? "", fixed: true },
      { key: "pattern", value: editProfile?.pattern ?? "", fixed: true },
      { key: "ra_value", value: parsed["ra_value"] ?? "", fixed: true },
      ...custom,
      ...missingKeys,
    ];
  };

  const [params, setParams] = useState<ParamRow[]>(initParams);

  const grindProfileSchema = z.object({
    name: z.string().min(1, "Name is required"),
    grindType: z.string().min(1, "Grind type is required"),
  });

  const form = useForm<GrindProfileFormValues>({
    resolver: zodResolver(grindProfileSchema),
    defaultValues: {
      name: editProfile?.name ?? "",
      grindType: editProfile?.grindType ?? "",
    },
  });

  const allParamsValid = params.every((p) => p.key.trim() !== "" && p.value.trim() !== "");

  const addParam = () => setParams((prev) => [...prev, { key: "", value: "" }]);
  const removeParam = (idx: number) => {
    if (params[idx].fixed) return; // can't remove fixed params
    setParams((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateParam = (idx: number, field: "key" | "value", val: string) => {
    setParams((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  };
  const moveParam = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= params.length) return;
    // Don't allow moving past/over fixed params
    if (params[next].fixed || params[idx].fixed) return;
    setParams((prev) => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const mutation = useMutation({
    mutationFn: async (data: GrindProfileFormValues) => {
      const stone = params.find((p) => p.key === "stone")?.value ?? "";
      const pattern = params.find((p) => p.key === "pattern")?.value ?? "";
      const extraObj: Record<string, string> = {};
      for (const p of params) {
        if (p.key.trim() && p.value.trim()) {
          extraObj[p.key.trim()] = p.value.trim();
        }
      }
      const payload = {
        name: data.name,
        grindType: data.grindType,
        stone,
        pattern,
        extraParams: Object.keys(extraObj).length > 0 ? extraObj : null,
      };
      if (editProfile) {
        const res = await apiRequest("PUT", `/api/grind-profiles/${editProfile.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/grind-profiles", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grind-profiles"] });
      toast({ title: editProfile ? "Grind profile updated" : "Grind profile added" });
      onDone();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const canSave = form.formState.isValid && allParamsValid && !mutation.isPending;

  const FIXED_LABELS: Record<string, string> = {
    stone: "Stone",
    pattern: "Pattern",
    ra_value: "RA-value",
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Profile Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Classic warm, Skate heavy" data-testid="input-grind-profile-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="grindType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Grind Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid="select-grind-profile-type">
                    <SelectValue placeholder="Select grind type…" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {GRIND_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Parameters list — fixed + custom, reorderable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Parameters</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addParam}
              data-testid="button-add-param"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add parameter
            </Button>
          </div>
          {params.map((param, idx) => (
            <div key={idx} className={cn("flex items-center gap-2", param.fixed && "bg-muted/30 rounded-lg px-2 py-1")} data-testid={`param-row-${idx}`}>
              {param.fixed ? (
                <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">{FIXED_LABELS[param.key] ?? param.key}</span>
              ) : (
                <Input
                  value={param.key}
                  onChange={(e) => updateParam(idx, "key", e.target.value)}
                  placeholder="Parameter name"
                  className="flex-1"
                  data-testid={`input-param-key-${idx}`}
                />
              )}
              <Input
                value={param.value}
                onChange={(e) => updateParam(idx, "value", e.target.value)}
                placeholder={param.fixed ? `Enter ${FIXED_LABELS[param.key] ?? param.key}` : "Value"}
                className="flex-1"
                data-testid={`input-param-value-${idx}`}
              />
              {!param.fixed && (
                <>
                  <button type="button" onClick={() => moveParam(idx, -1)} className="p-1 rounded text-muted-foreground hover:text-foreground" disabled={idx === 0 || params[idx - 1]?.fixed}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => moveParam(idx, 1)} className="p-1 rounded text-muted-foreground hover:text-foreground" disabled={idx === params.length - 1}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeParam(idx)} className="p-1 rounded text-muted-foreground hover:text-red-600" data-testid={`button-remove-param-${idx}`}>
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
          {!allParamsValid && (
            <p className="text-xs text-destructive">All parameter names and values must be filled in.</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={!canSave} data-testid="button-save-grind-profile">
            {editProfile ? "Save" : "Add Grind"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Grind Profile Card ────────────────────────────────────────────────────────

function GrindProfilesTable({
  profiles,
  onViewResults,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  profiles: GrindProfile[];
  onViewResults: (p: GrindProfile) => void;
  onEdit: (p: GrindProfile) => void;
  onDuplicate: (p: GrindProfile) => void;
  onDelete: (p: GrindProfile) => void;
}) {
  // Discover all extra param keys across all profiles (excluding stone/pattern already shown)
  const allExtraKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of profiles) {
      const extra = parseExtraParams(p.extraParams);
      for (const k of Object.keys(extra)) {
        if (!["stone", "pattern"].includes(k)) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [profiles]);

  return (
    <Card className="fs-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="table-grind-profiles">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/30">
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">ID</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Stone</th>
              <th className="px-3 py-2.5">Pattern</th>
              {allExtraKeys.map((k) => (
                <th key={k} className="px-3 py-2.5">{k === "ra_value" ? "RA-value" : k}</th>
              ))}
              <th className="px-3 py-2.5">Added by</th>
              <th className="px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => {
              const extra = parseExtraParams(profile.extraParams);
              return (
                <tr key={profile.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors" data-testid={`row-grind-profile-${profile.id}`}>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onViewResults(profile)}
                      className="font-medium text-foreground hover:text-violet-600 transition-colors text-left"
                      data-testid={`text-grind-profile-name-list-${profile.id}`}
                    >
                      {profile.name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                    {profile.grindId ? `#${profile.grindId}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
                      {profile.grindType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{profile.stone || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{profile.pattern || "—"}</td>
                  {allExtraKeys.map((k) => (
                    <td key={k} className="px-3 py-2 text-muted-foreground text-xs">{extra[k] ?? "—"}</td>
                  ))}
                  <td className="px-3 py-2 text-xs text-muted-foreground">{profile.createdByName}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(profile.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="sm" onClick={() => onViewResults(profile)} title="View test results" data-testid={`button-view-results-grind-profile-list-${profile.id}`}>
                        <BarChart2 className="h-3.5 w-3.5 text-violet-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDuplicate(profile)} title="Duplicate" data-testid={`button-duplicate-grind-profile-list-${profile.id}`}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(profile)} title="Edit" data-testid={`button-edit-grind-profile-list-${profile.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(profile)} title="Delete" data-testid={`button-delete-grind-profile-list-${profile.id}`}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function GrindProfileCard({
  profile,
  onEdit,
  onDuplicate,
  onDelete,
  onViewResults,
}: {
  profile: GrindProfile;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onViewResults: () => void;
}) {
  const extra = parseExtraParams(profile.extraParams);
  const raValue = extra["ra_value"];
  const otherEntries = Object.entries(extra).filter(([k]) => !["stone", "pattern", "ra_value"].includes(k));

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-5" data-testid={`card-grind-profile-${profile.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <button
            type="button"
            onClick={onViewResults}
            className="text-left text-base font-semibold text-foreground hover:text-violet-600 transition-colors truncate"
            data-testid={`text-grind-profile-name-${profile.id}`}
          >
            {profile.name}
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
              {profile.grindType}
            </span>
            {profile.grindId && (
              <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200 font-mono">
                #{profile.grindId}
              </span>
            )}
            {profile.stone && (
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Stone: {profile.stone}
              </span>
            )}
            {profile.pattern && (
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Pattern: {profile.pattern}
              </span>
            )}
            {raValue && (
              <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200">
                RA-value: {raValue}
              </span>
            )}
            {otherEntries.map(([k, v]) => (
              <span key={k} className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                {k}: {v}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>Added by {profile.createdByName}</span>
            <span>·</span>
            <span>{formatDate(profile.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onViewResults} data-testid={`button-view-results-grind-profile-${profile.id}`} title="View test results">
            <BarChart2 className="h-4 w-4 text-violet-600" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDuplicate} data-testid={`button-duplicate-grind-profile-${profile.id}`} title="Duplicate profile">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-grind-profile-${profile.id}`} title="Edit profile">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            data-testid={`button-delete-grind-profile-${profile.id}`}
            title="Delete profile"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Grind column helpers ─────────────────────────────────────────────────────

/** Find a profile name by matching grindType + stone + pattern */
function matchProfileName(
  grindType: string | null, stone: string | null, pattern: string | null,
  profiles: GrindProfile[]
): string | null {
  if (!grindType && !stone && !pattern) return null;
  const match = profiles.find(
    (p) => p.grindType === grindType && p.stone === stone && p.pattern === pattern
  );
  return match?.name ?? null;
}

/** All column keys that can be toggled for grind entry tables */
type GrindCol = "name" | "stone" | "pattern" | string; // string = dynamic extra param keys

/** Small pill toggle for column visibility */
function ColToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 transition-colors",
        active
          ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 ring-violet-300 dark:ring-violet-700"
          : "bg-muted text-muted-foreground ring-border hover:text-foreground"
      )}
    >
      {active ? "✓ " : ""}{label}
    </button>
  );
}

// ─── Grind Profile Detail Dialog ──────────────────────────────────────────────

function GrindProfileDetailDialog({
  profile,
  open,
  onClose,
}: {
  profile: GrindProfile | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<ProfileTestsResponse>({
    queryKey: [`/api/grind-profiles/${profile?.id}/tests`],
    queryFn: async () => {
      const res = await fetch(`/api/grind-profiles/${profile!.id}/tests`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: open && profile != null,
  });

  const tests = data?.tests ?? [];

  // All toggleable column keys: "name" + "stone" + "pattern" + dynamic extra param keys from profile
  const allCols = useMemo((): GrindCol[] => {
    const base: GrindCol[] = ["name", "stone", "pattern"];
    if (!profile) return base;
    const extra = parseExtraParams(profile.extraParams);
    const extraKeys = Object.keys(extra).filter((k) => k !== "stone" && k !== "pattern");
    return [...base, ...extraKeys];
  }, [profile]);

  // "name" on by default; all others off
  const [visibleCols, setVisibleCols] = useState<Set<GrindCol>>(new Set(["name"]));
  const lastProfileId = useMemo(() => profile?.id, [profile]);
  if (open && profile && profile.id !== lastProfileId) setVisibleCols(new Set(["name"]));

  function toggleCol(col: GrindCol) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      return next;
    });
  }

  function colLabel(col: GrindCol): string {
    if (col === "name") return "Grind name";
    if (col === "stone") return "Stone";
    if (col === "pattern") return "Pattern";
    if (col === "ra_value") return "RA-value";
    // User-defined keys: show exactly as stored
    return col;
  }

  function getColValue(entry: ProfileTestEntry, col: GrindCol): string {
    if (col === "name") return profile?.name ?? "—";
    if (col === "stone") return entry.grindStone ?? "—";
    if (col === "pattern") return entry.grindPattern ?? "—";
    const extras = parseExtraParams(entry.grindExtraParams);
    return extras[col] ?? "—";
  }

  function getDistLabels(test: ProfileTest): string[] {
    if (test.distanceLabels) {
      try {
        const p = JSON.parse(test.distanceLabels);
        if (Array.isArray(p) && p.length > 0) return p;
      } catch {}
    }
    const labels = [test.distanceLabel0km || "0 km"];
    if (test.distanceLabelXkm) labels.push(test.distanceLabelXkm);
    return labels;
  }

  function getEntryResults(entry: ProfileTestEntry, numRounds: number): RoundResult[] {
    if (entry.results) {
      try {
        const p = JSON.parse(entry.results);
        if (Array.isArray(p)) {
          while (p.length < numRounds) p.push({ result: null, rank: null });
          return p.slice(0, numRounds);
        }
      } catch {}
    }
    const results: RoundResult[] = [{ result: entry.result0kmCmBehind, rank: entry.rank0km }];
    if (numRounds > 1) results.push({ result: entry.resultXkmCmBehind ?? null, rank: entry.rankXkm ?? null });
    while (results.length < numRounds) results.push({ result: null, rank: null });
    return results;
  }

  const activeCols = allCols.filter((c) => visibleCols.has(c));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-violet-600" />
            {profile?.name}
            {profile?.grindId && (
              <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200 font-mono">
                #{profile.grindId}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Profile params summary */}
        {profile && (
          <div className="flex flex-wrap gap-1.5 mb-1">
            <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
              {profile.grindType}
            </span>
            {profile.stone && (
              <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Stone: {profile.stone}
              </span>
            )}
            {profile.pattern && (
              <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Pattern: {profile.pattern}
              </span>
            )}
            {(() => {
              const extra = parseExtraParams(profile.extraParams);
              const ra = extra["ra_value"];
              const others = Object.entries(extra).filter(([k]) => !["stone", "pattern", "ra_value"].includes(k));
              return (
                <>
                  {ra && (
                    <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                      RA-value: {ra}
                    </span>
                  )}
                  {others.map(([k, v]) => (
                    <span key={k} className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                      {k}: {v}
                    </span>
                  ))}
                </>
              );
            })()}
          </div>
        )}

        {/* Column visibility toggles */}
        {!isLoading && tests.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 py-2 border-b border-border mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold shrink-0">Show columns:</span>
            {allCols.map((col) => (
              <ColToggle key={col} label={colLabel(col)} active={visibleCols.has(col)} onClick={() => toggleCol(col)} />
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading test results…</div>
        ) : tests.length === 0 ? (
          <div className="py-8 text-center">
            <Disc3 className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No tests found for this grind profile.</p>
            <p className="text-xs text-muted-foreground mt-1">Tests using the same type, stone and pattern will appear here.</p>
            {profile && (
              <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-left text-[11px] text-muted-foreground inline-block">
                <span className="font-semibold">Searched for:</span>{" "}
                Name: <span className="text-foreground">{profile.name || "—"}</span>{" · "}
                Type: <span className="text-foreground">{profile.grindType || "—"}</span>{" · "}
                Stone: <span className="text-foreground">{profile.stone || "—"}</span>{" · "}
                Pattern: <span className="text-foreground">{profile.pattern || "—"}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BarChart2 className="h-3.5 w-3.5" />
              <span>{tests.length} test{tests.length !== 1 ? "s" : ""} with this grind</span>
            </div>
            {tests.map((test) => {
              const distLabels = getDistLabels(test);
              const hasSkiInfo = test.entries.some((e) => e.skiBrand || e.skiModel);
              return (
                <Card key={test.id} className="fs-card rounded-xl p-3 sm:p-4" data-testid={`card-grind-detail-test-${test.id}`}>
                  {/* Test header */}
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <AppLink href={`/tests/${test.id}`} testId={`link-grind-detail-test-${test.id}`}>
                        <span className="font-semibold text-sm hover:text-violet-600 transition-colors cursor-pointer">
                          {test.location}
                        </span>
                      </AppLink>
                      <span className="text-xs text-muted-foreground">{fmtDate(test.date)}</span>
                      {test.testName && (
                        <span className="text-xs text-muted-foreground italic">"{test.testName}"</span>
                      )}
                    </div>
                    {/* Weather + Open button */}
                    <div className="flex items-center gap-2">
                      {test.weather && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200">
                            <Wind className="h-2.5 w-2.5" /> Air {test.weather.airTemperatureC}°C
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full fs-gradient-emerald px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/10">
                            <Snowflake className="h-2.5 w-2.5" /> Snow {test.weather.snowTemperatureC}°C
                          </span>
                          {test.weather.humidity != null && (
                            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {test.weather.humidity}% RH
                            </span>
                          )}
                        </div>
                      )}
                      <AppLink href={`/tests/${test.id}`} testId={`link-open-detail-test-${test.id}`}>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </Button>
                      </AppLink>
                    </div>
                  </div>
                  {test.notes && (
                    <p className="mb-2 text-xs text-muted-foreground italic truncate">{test.notes}</p>
                  )}

                  {/* Entries table */}
                  {test.entries.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="pb-1.5 pr-3">Ski</th>
                            {hasSkiInfo && <th className="pb-1.5 pr-3">Model</th>}
                            {activeCols.map((col) => (
                              <th key={col} className="pb-1.5 pr-3">{colLabel(col)}</th>
                            ))}
                            {distLabels.map((label, i) => (
                              <th key={i} className="pb-1.5 pr-3">{label} / Rank</th>
                            ))}
                            <th className="pb-1.5">Feel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {test.entries.map((entry) => {
                            const rounds = getEntryResults(entry, distLabels.length);
                            return (
                              <tr key={entry.id} className="border-b border-border/20">
                                <td className="py-1.5 pr-3 font-medium text-xs">{entry.skiNumber}</td>
                                {hasSkiInfo && (
                                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                                    {[entry.skiBrand, entry.skiModel].filter(Boolean).join(" ") || "—"}
                                  </td>
                                )}
                                {activeCols.map((col) => (
                                  <td key={col} className="py-1.5 pr-3 text-xs text-muted-foreground">
                                    {getColValue(entry, col)}
                                  </td>
                                ))}
                                {rounds.map((r, i) => (
                                  <td key={i} className="py-1.5 pr-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs tabular-nums">{r.result ?? "—"}</span>
                                      <RankBadge rank={r.rank} />
                                    </div>
                                  </td>
                                ))}
                                <td className="py-1.5">
                                  {entry.feelingRank ? <RankBadge rank={entry.feelingRank} /> : <span className="text-xs text-muted-foreground">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Predefined colors for compare mode (Tailwind static classes)
const GRIND_COMPARE_COLORS = [
  { row: "bg-yellow-400/15", nameBg: "bg-yellow-400/20 text-yellow-700 ring-1 ring-yellow-400/50", dot: "bg-yellow-400" },
  { row: "bg-blue-400/15",   nameBg: "bg-blue-400/20 text-blue-700 ring-1 ring-blue-400/50",   dot: "bg-blue-400" },
  { row: "bg-green-400/15",  nameBg: "bg-green-400/20 text-green-700 ring-1 ring-green-400/50",  dot: "bg-green-400" },
  { row: "bg-purple-400/15", nameBg: "bg-purple-400/20 text-purple-700 ring-1 ring-purple-400/50", dot: "bg-purple-400" },
  { row: "bg-orange-400/15", nameBg: "bg-orange-400/20 text-orange-700 ring-1 ring-orange-400/50", dot: "bg-orange-400" },
  { row: "bg-pink-400/15",   nameBg: "bg-pink-400/20 text-pink-700 ring-1 ring-pink-400/50",   dot: "bg-pink-400" },
] as const;

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Grinding() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"tests" | "grinds">("tests");

  const [filterSeason, setFilterSeason] = useState<string>("All");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterGrinds, setFilterGrinds] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  // Grind profiles state
  const [grindSearch, setGrindSearch] = useState("");
  const [grindDialogOpen, setGrindDialogOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<GrindProfile | undefined>();
  const [detailProfile, setDetailProfile] = useState<GrindProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [grindViewMode, setGrindViewMode] = useState<"grid" | "list">(() => {
    try { return (localStorage.getItem("glidr-grinds-view-mode") as "grid" | "list") || "grid"; } catch { return "grid"; }
  });

  const { data: allTests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: grindProfiles = [] } = useQuery<GrindProfile[]>({ queryKey: ["/api/grind-profiles"] });

  const allProfileParamKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of grindProfiles) {
      if (!p.extraParams) continue;
      try {
        const parsed = JSON.parse(p.extraParams);
        for (const k of Object.keys(parsed)) {
          if (!["stone", "pattern", "ra_value"].includes(k)) keys.add(k);
        }
      } catch {}
    }
    return Array.from(keys);
  }, [grindProfiles]);

  const grindTests = useMemo(() => allTests.filter((t) => t.testType === "Grind"), [allTests]);

  const grindTestIds = grindTests.map((t) => t.id);
  const { data: allEntries = [] } = useQuery<TestEntry[]>({
    queryKey: ["/api/tests/entries/grind", grindTestIds],
    queryFn: async () => {
      if (grindTestIds.length === 0) return [];
      const results = await Promise.all(
        grindTestIds.map((id) =>
          fetch(`/api/tests/${id}/entries`, { credentials: "include" }).then((r) => r.json())
        )
      );
      return results.flat();
    },
    enabled: grindTestIds.length > 0,
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/grind-profiles/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grind-profiles"] });
      toast({ title: "Grind profile deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const duplicateProfileMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/grind-profiles/${id}/duplicate`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grind-profiles"] });
      toast({ title: "Grind profile duplicated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const seriesById = new Map(series.map((s) => [s.id, s.name] as const));
  const weatherById = new Map(weather.map((w) => [w.id, w] as const));

  function getSeason(dateStr: string): string {
    const d = new Date(dateStr);
    const month = d.getMonth();
    const year = d.getFullYear();
    return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  }

  const availableSeasons = useMemo(() => {
    const seasons = Array.from(new Set(grindTests.map((t) => getSeason(t.date))));
    return seasons.sort().reverse();
  }, [grindTests]);

  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(grindTests.map((t) => t.date)));
    return dates.sort().reverse();
  }, [grindTests]);

  const filtered = useMemo(() => {
    const result = grindTests.filter((t) => {
      if (filterSeason !== "All" && getSeason(t.date) !== filterSeason) return false;
      if (filterLocation && !t.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
      if (filterDate && t.date !== filterDate) return false;
      if (filterGrinds.length > 0) {
        const testEntries = allEntries.filter((e) => e.testId === t.id);
        const testGrindNames = new Set(testEntries.map((e) => e.grindType).filter(Boolean) as string[]);
        if (compareMode) {
          if (!filterGrinds.every((g) => testGrindNames.has(g))) return false;
        } else {
          if (!filterGrinds.some((g) => testGrindNames.has(g))) return false;
        }
      }
      return true;
    });
    if (filterDate) {
      result.sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"));
    }
    return result;
  }, [grindTests, filterSeason, filterLocation, filterDate, filterGrinds, compareMode, allEntries]);

  const filteredProfiles = useMemo(() => {
    if (!grindSearch.trim()) return grindProfiles;
    const q = grindSearch.toLowerCase();
    return grindProfiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.grindType.toLowerCase().includes(q) ||
        p.stone.toLowerCase().includes(q) ||
        p.pattern.toLowerCase().includes(q)
    );
  }, [grindProfiles, grindSearch]);

  const grindHighlight = useMemo(() => {
    const map = new Map<string, typeof GRIND_COMPARE_COLORS[number]>();
    filterGrinds.forEach((name, i) => {
      if (i < GRIND_COMPARE_COLORS.length) map.set(name, GRIND_COMPARE_COLORS[i]);
    });
    return map;
  }, [filterGrinds]);

  const isGrindFilterActive = filterGrinds.length > 0;
  const hasFilters = filterSeason !== "All" || filterLocation || filterDate || isGrindFilterActive;
  const isDayView = !!filterDate;

  function getTabSubtitle() {
    if (tab === "tests") return `${filtered.length} grind test${filtered.length !== 1 ? "s" : ""}${hasFilters ? " matching filters" : " total"}`;
    return `${filteredProfiles.length} grind profile${filteredProfiles.length !== 1 ? "s" : ""}${grindSearch ? " matching search" : " total"}`;
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-grinding-title">
              <Disc3 className="inline-block mr-2 h-7 w-7 text-indigo-600" />
              Grinding
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{getTabSubtitle()}</p>
          </div>

          <div className="flex items-center gap-2">
            {tab === "tests" && (
              <AppLink href="/tests/new?type=Grind&returnTo=/grinding">
                <Button data-testid="button-new-grind-test" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Grind Test
                </Button>
              </AppLink>
            )}
            {tab === "grinds" && (
              <Dialog open={grindDialogOpen} onOpenChange={(v) => { setGrindDialogOpen(v); if (!v) setEditProfile(undefined); }}>
                <DialogTrigger asChild>
                  <Button
                    data-testid="button-add-grind-profile"
                    className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                    onClick={() => { setEditProfile(undefined); setGrindDialogOpen(true); }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Grind
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editProfile ? "Edit Grind Profile" : "Add Grind Profile"}</DialogTitle>
                  </DialogHeader>
                  <GrindProfileForm
                    key={editProfile ? `edit-${editProfile.id}` : "create"}
                    editProfile={editProfile}
                    allProfileParamKeys={allProfileParamKeys}
                    onDone={() => { setGrindDialogOpen(false); setEditProfile(undefined); }}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setTab("tests")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "tests" ? "border-indigo-600 text-indigo-600" : "border-transparent text-muted-foreground hover:text-foreground/80"}`}
            data-testid="tab-grinding-tests"
          >
            <Disc3 className="inline-block mr-1.5 h-4 w-4" />
            Tests
            {grindTests.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">{grindTests.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("grinds")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "grinds" ? "border-violet-600 text-violet-600" : "border-transparent text-muted-foreground hover:text-foreground/80"}`}
            data-testid="tab-grinding-grinds"
          >
            <Trophy className="inline-block mr-1.5 h-4 w-4" />
            Grinds
            {grindProfiles.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700">{grindProfiles.length}</span>
            )}
          </button>
        </div>

        {/* Tests tab */}
        {tab === "tests" && (
          <>
            <Card className="fs-card rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 text-sm font-semibold">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10">
                    <Filter className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  Filters
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <div className="min-w-[140px]">
                    <Select value={filterSeason} onValueChange={setFilterSeason}>
                      <SelectTrigger data-testid="select-grind-filter-season">
                        <SelectValue placeholder="Season" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All seasons</SelectItem>
                        {availableSeasons.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[150px]">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-indigo-500/70" />
                      <Input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="h-9"
                        data-testid="input-grind-filter-date"
                      />
                    </div>
                  </div>
                  <div className="min-w-[160px]">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-indigo-500/70" />
                      <Input
                        value={filterLocation}
                        onChange={(e) => setFilterLocation(e.target.value)}
                        placeholder="Location…"
                        data-testid="input-grind-filter-location"
                      />
                    </div>
                  </div>
                </div>
                {hasFilters && (
                  <Button
                    variant="secondary"
                    data-testid="button-clear-grind-filters"
                    onClick={() => {
                      setFilterSeason("All");
                      setFilterLocation("");
                      setFilterDate("");
                      setFilterGrinds([]);
                      setCompareMode(false);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>

              {availableDates.length > 0 && !filterDate && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <CalendarDays className="h-3 w-3" />
                    Quick day select
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableDates.slice(0, 10).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setFilterDate(d)}
                        className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-500/20 transition-colors"
                        data-testid={`button-grind-date-${d}`}
                      >
                        {fmtDate(d)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {grindProfiles.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                      <Disc3 className="h-3 w-3" />
                      Grind
                    </div>
                    {!compareMode ? (
                      <Select
                        value={filterGrinds[0] ?? "all"}
                        onValueChange={(v) => setFilterGrinds(v === "all" ? [] : [v])}
                      >
                        <SelectTrigger className="h-8 text-xs min-w-[160px] max-w-xs">
                          <SelectValue placeholder="All grinds" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All grinds</SelectItem>
                          {grindProfiles.map((p) => (
                            <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {grindProfiles.map((p) => {
                          const idx = filterGrinds.indexOf(p.name);
                          const isSelected = idx !== -1;
                          const color = isSelected ? GRIND_COMPARE_COLORS[idx] : null;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() =>
                                setFilterGrinds((prev) =>
                                  prev.includes(p.name)
                                    ? prev.filter((g) => g !== p.name)
                                    : prev.length < GRIND_COMPARE_COLORS.length
                                      ? [...prev, p.name]
                                      : prev
                                )
                              }
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                                isSelected && color
                                  ? color.nameBg
                                  : "bg-muted text-muted-foreground hover:bg-muted/70"
                              )}
                            >
                              {isSelected && color && (
                                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", color.dot)} />
                              )}
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <Button
                      variant={compareMode ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs shrink-0"
                      onClick={() => {
                        if (compareMode) setFilterGrinds((prev) => prev.slice(0, 1));
                        setCompareMode((m) => !m);
                      }}
                    >
                      Compare
                    </Button>
                    {filterGrinds.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setFilterGrinds([])}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {isDayView ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold">Day view: {fmtDate(filterDate)}</h2>
                  <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">{filtered.length} test{filtered.length !== 1 ? "s" : ""}</span>
                </div>
                {filtered.length === 0 ? (
                  <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-grind-day">
                    No grind tests on this date.
                  </Card>
                ) : (
                  filtered.map((t) => <GrindTestCard key={t.id} test={t} entries={allEntries.filter((e) => e.testId === t.id)} seriesById={seriesById} weatherById={weatherById} grindProfiles={grindProfiles} grindHighlight={grindHighlight} />)
                )}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="fs-card rounded-2xl p-8 text-center">
                <Disc3 className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <div className="text-sm text-muted-foreground">
                  {hasFilters ? "No grind tests match your filters." : "No grind tests yet. Create your first one above."}
                </div>
              </Card>
            ) : isGrindFilterActive ? (
              <div className="flex flex-col gap-4">
                {filtered.map((t) => (
                  <GrindTestCard
                    key={t.id}
                    test={t}
                    entries={allEntries.filter((e) => e.testId === t.id)}
                    seriesById={seriesById}
                    weatherById={weatherById}
                    grindProfiles={grindProfiles}
                    grindHighlight={grindHighlight}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((t) => {
                  const gp = parseGrindParams(t.grindParameters);
                  const w = t.weatherId ? weatherById.get(t.weatherId) : null;
                  return (
                    <AppLink key={t.id} href={`/tests/${t.id}`} testId={`link-grind-test-${t.id}`}>
                      <Card className="fs-card rounded-2xl p-4 sm:p-5 hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-grind-test-${t.id}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold text-foreground">{t.location}</span>
                            <span className="text-sm text-muted-foreground">{fmtDate(t.date)}</span>
                            <span className="text-xs text-muted-foreground">{seriesById.get(t.seriesId) ?? ""}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {gp.grindType && (
                              <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
                                {gp.grindType}
                              </span>
                            )}
                            {gp.stone && (
                              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {gp.stone}
                              </span>
                            )}
                            {gp.pattern && (
                              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {gp.pattern}
                              </span>
                            )}
                            {w && (
                              <span className="inline-flex items-center gap-1 rounded-full fs-gradient-emerald px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/10">
                                <Thermometer className="h-2.5 w-2.5" /> Snow {w.snowTemperatureC}°C
                              </span>
                            )}
                          </div>
                        </div>
                        {t.notes && (
                          <p className="mt-1 text-xs text-muted-foreground truncate max-w-lg">{t.notes}</p>
                        )}
                      </Card>
                    </AppLink>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Grinds tab */}
        {tab === "grinds" && (
          <div className="flex flex-col gap-4">
            {/* Search bar + view toggle */}
            <div className="flex items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={grindSearch}
                  onChange={(e) => setGrindSearch(e.target.value)}
                  placeholder="Search grinds…"
                  className="pl-9"
                  data-testid="input-grind-profile-search"
                />
                {grindSearch && (
                  <button
                    type="button"
                    onClick={() => setGrindSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-clear-grind-search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => { setGrindViewMode("grid"); try { localStorage.setItem("glidr-grinds-view-mode", "grid"); } catch {} }}
                  className={cn("px-2.5 py-1.5 transition-colors", grindViewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                  data-testid="button-grinds-view-grid"
                  title="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setGrindViewMode("list"); try { localStorage.setItem("glidr-grinds-view-mode", "list"); } catch {} }}
                  className={cn("px-2.5 py-1.5 transition-colors", grindViewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                  data-testid="button-grinds-view-list"
                  title="List view"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Profile list */}
            {grindProfiles.length === 0 ? (
              <Card className="fs-card rounded-2xl p-8 text-center">
                <Trophy className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <div className="text-sm text-muted-foreground">No grind profiles yet. Click "Add Grind" to create your first profile.</div>
              </Card>
            ) : filteredProfiles.length === 0 ? (
              <Card className="fs-card rounded-2xl p-6 text-center">
                <div className="text-sm text-muted-foreground">No grind profiles match your search.</div>
              </Card>
            ) : grindViewMode === "list" ? (
              <GrindProfilesTable
                profiles={filteredProfiles}
                onViewResults={(profile) => { setDetailProfile(profile); setDetailOpen(true); }}
                onEdit={(profile) => { setEditProfile(profile); setGrindDialogOpen(true); }}
                onDuplicate={(profile) => { if (confirm(`Duplicate "${profile.name}"?`)) duplicateProfileMutation.mutate(profile.id); }}
                onDelete={(profile) => { if (confirm(`Delete "${profile.name}"? This cannot be undone.`)) deleteProfileMutation.mutate(profile.id); }}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {filteredProfiles.map((profile) => (
                  <GrindProfileCard
                    key={profile.id}
                    profile={profile}
                    onViewResults={() => {
                      setDetailProfile(profile);
                      setDetailOpen(true);
                    }}
                    onEdit={() => {
                      setEditProfile(profile);
                      setGrindDialogOpen(true);
                    }}
                    onDuplicate={() => {
                      if (confirm(`Duplicate "${profile.name}"?`)) {
                        duplicateProfileMutation.mutate(profile.id);
                      }
                    }}
                    onDelete={() => {
                      if (confirm(`Delete "${profile.name}"? This cannot be undone.`)) {
                        deleteProfileMutation.mutate(profile.id);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Grind profile detail dialog */}
      <GrindProfileDetailDialog
        profile={detailProfile}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </AppShell>
  );
}

function GrindTestCard({ test, entries, seriesById, weatherById, grindProfiles = [], grindHighlight = new Map() }: {
  test: Test;
  entries: TestEntry[];
  seriesById: Map<number, string>;
  weatherById: Map<number, Weather>;
  grindProfiles?: GrindProfile[];
  // maps profile name → color config (from GRIND_COMPARE_COLORS)
  grindHighlight?: Map<string, typeof GRIND_COMPARE_COLORS[number]>;
}) {
  const distLabels = getDistanceLabels(test);
  const sortedEntries = [...entries].sort((a, b) => a.skiNumber - b.skiNumber);
  const w = test.weatherId ? weatherById.get(test.weatherId) : null;
  const gp = parseGrindParams(test.grindParameters);

  // Discover all extra param keys present in entries
  const extraParamKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const e of sortedEntries) {
      const ep = parseExtraParams(e.grindExtraParams ?? null);
      for (const k of Object.keys(ep)) {
        // Skip stone/pattern — already covered by grindStone/grindPattern columns
        if (k !== "stone" && k !== "pattern") keys.add(k);
      }
    }
    return Array.from(keys);
  }, [sortedEntries]);

  // Available columns: "name" first (default on), then stone, pattern, extras — no "grindType" (it IS the name)
  // Also show grindProfileId as "Grind-ID" if any entries have it
  const hasGrindProfileIds = sortedEntries.some((e) => e.grindProfileId != null);
  const allGrindCols = useMemo(
    () => [
      "name",
      ...(hasGrindProfileIds ? ["grindProfileId"] : []),
      "grindStone",
      "grindPattern",
      ...extraParamKeys,
    ],
    [extraParamKeys, hasGrindProfileIds]
  );

  const colLabels: Record<string, string> = {
    name: "Grind name",
    grindProfileId: "Grind-ID",
    grindStone: "Stone",
    grindPattern: "Pattern",
    ra_value: "RA-value",
  };

  // For column labels: use colLabels for known internal keys, otherwise show key exactly as stored
  function grindColLabel(col: string): string {
    return colLabels[col] ?? col;
  }

  const [visibleGrindCols, setVisibleGrindCols] = useState<string[]>(["name"]);

  function toggleGrindCol(col: string) {
    setVisibleGrindCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  function getEntryGrindValue(entry: TestEntry, col: string): string | null {
    if (col === "name") return entry.grindType || matchProfileName(entry.grindType, entry.grindStone, entry.grindPattern, grindProfiles) || null;
    if (col === "grindProfileId") {
      const profile = grindProfiles.find((p) => p.id === entry.grindProfileId);
      return profile?.grindId ? `#${profile.grindId}` : null;
    }
    if (col === "grindStone") return entry.grindStone || null;
    if (col === "grindPattern") return entry.grindPattern || null;
    const ep = parseExtraParams(entry.grindExtraParams ?? null);
    return ep[col] ?? null;
  }

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-5" data-testid={`card-grind-day-test-${test.id}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <AppLink href={`/tests/${test.id}`} testId={`link-grind-test-${test.id}`}>
            <span className="text-base font-semibold hover:text-indigo-600 transition-colors cursor-pointer">
              {test.location}
            </span>
          </AppLink>
          <span className="text-xs text-muted-foreground">{fmtDate(test.date)}</span>
          {test.startTime && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{test.startTime}</span>
          )}
          <span className="text-xs text-muted-foreground">{seriesById.get(test.seriesId) ?? ""}</span>
          {gp.stone && (
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{gp.stone}</span>
          )}
          {gp.pattern && (
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{gp.pattern}</span>
          )}
          {w && (
            <span className="inline-flex items-center gap-1 rounded-full fs-gradient-emerald px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/10">
              <Thermometer className="h-2.5 w-2.5" /> Snow {w.snowTemperatureC}°C
            </span>
          )}
          {/* Highlighted grind name badges */}
          {grindHighlight.size > 0 && (
            <div className="flex flex-wrap gap-1">
              {Array.from(grindHighlight.entries()).map(([name, color]) => (
                <span key={name} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", color.nameBg)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{sortedEntries.length} entries</span>
          <AppLink href={`/tests/${test.id}`} testId={`link-open-grind-test-${test.id}`}>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
              <ExternalLink className="h-3 w-3" />
              Open
            </Button>
          </AppLink>
        </div>
      </div>

      {/* Grind column chooser */}
      {allGrindCols.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mr-1">Show per ski:</span>
          {allGrindCols.map((col) => (
            <ColToggle
              key={col}
              label={grindColLabel(col)}
              active={visibleGrindCols.includes(col)}
              onClick={() => toggleGrindCol(col)}
            />
          ))}
        </div>
      )}

      {sortedEntries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid={`table-grind-day-${test.id}`}>
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4">Ski #</th>
                {visibleGrindCols.map((col) => (
                  <th key={col} className="pb-2 pr-4">{grindColLabel(col)}</th>
                ))}
                {distLabels.map((label, i) => (
                  <th key={i} className="pb-2 pr-6">
                    {label} <span className="text-[9px]">(cm)</span>
                  </th>
                ))}
                <th className="pb-2 pr-4">Rank</th>
                <th className="pb-2 pr-3">Feel</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry) => {
                const rounds = getEntryRounds(entry, distLabels.length);
                const entryName = entry.grindType || null;
                const color = entryName ? grindHighlight.get(entryName) : undefined;
                return (
                  <tr
                    key={entry.id}
                    className={cn("border-b border-border/20 transition-colors", color?.row)}
                    data-testid={`row-grind-entry-${entry.id}`}
                  >
                    <td className="py-1.5 pr-4 font-medium text-xs">{entry.skiNumber}</td>
                    {visibleGrindCols.map((col) => (
                      <td key={col} className="py-1.5 pr-4">
                        <span className={cn("text-xs", color ? "font-medium" : "text-muted-foreground")}>
                          {getEntryGrindValue(entry, col) ?? <span className="opacity-40">—</span>}
                        </span>
                      </td>
                    ))}
                    {rounds.map((r, i) => (
                      <td key={i} className="py-1.5 pr-6 font-mono text-sm tabular-nums">
                        {r.result ?? "—"}
                      </td>
                    ))}
                    <td className="py-1.5 pr-4">
                      <RankBadge rank={rounds[0]?.rank ?? null} />
                    </td>
                    <td className="py-1.5 pr-3">
                      {entry.feelingRank ? <RankBadge rank={entry.feelingRank} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
