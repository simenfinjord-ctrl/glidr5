import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2, Disc3, Trophy, Filter, MapPin, Thermometer, CalendarDays, Copy, Search, X, ChevronUp, ChevronDown, Wind, Snowflake, BarChart2, LayoutGrid, LayoutList, ExternalLink, Check, TrendingUp, Archive, RotateCcw, Link2, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { SkeletonCards } from "@/components/skeleton-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn, fmtDate, fmtDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

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
  airHumidityPct?: number | null;
  snowHumidityPct?: number | null;
  snowType?: string | null;
  trackHardness?: string | null;
  artificialSnow?: string | null;
  naturalSnow?: string | null;
  snowHumidityType?: string | null;
  grainSize?: string | null;
  precipitation?: string | null;
  wind?: string | null;
  visibility?: string | null;
  clouds?: number | null;
};


type GrindProfile = {
  id: number;
  name: string;
  grindType: string;
  stone: string;
  pattern: string;
  extraParams: string | null;
  grindId?: string | null;
  notes: string | null;
  createdByName: string;
  teamId: number;
  createdAt: string;
  archived?: number;
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
  isSelectedGrind?: boolean;
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

// ─── Grind Profile form ────────────────────────────────────────────────────────

// All params are equal: editable name, editable value, reorderable, removable
type ParamRow = { key: string; value: string };

const GRIND_TYPE_OPTIONS = ["Classic", "Skate", "Universal"];

type GrindProfileFormValues = {
  name: string;
  grindType: string;
};

function GrindProfileForm({
  onDone,
  editProfile,
  allProfileParamKeys = [],
  lastProfile,
}: {
  onDone: () => void;
  editProfile?: GrindProfile;
  allProfileParamKeys?: string[];
  lastProfile?: GrindProfile;
}) {
  const { t } = useI18n();
  const { toast } = useToast();

  // Build initial param rows from stored order; all params are equal
  const initParams = (): ParamRow[] => {
    if (editProfile) {
      // Read from extraParams in stored order (preserves user-defined order)
      const parsed = parseExtraParams(editProfile.extraParams ?? null);
      const result: ParamRow[] = Object.entries(parsed).map(([key, value]) => ({ key, value }));
      const existingKeys = new Set(result.map((p) => p.key));
      // Backward compat: if stone/pattern only in DB columns (pre-extraParams profiles)
      if (!existingKeys.has("stone") && editProfile.stone) {
        result.unshift({ key: "stone", value: editProfile.stone });
        existingKeys.add("stone");
      }
      if (!existingKeys.has("pattern") && editProfile.pattern) {
        const si = result.findIndex((p) => p.key === "stone");
        result.splice(si >= 0 ? si + 1 : 0, 0, { key: "pattern", value: editProfile.pattern });
        existingKeys.add("pattern");
      }
      // Append any missing team-wide custom keys (empty — user fills if relevant)
      for (const k of allProfileParamKeys) {
        if (!existingKeys.has(k)) result.push({ key: k, value: "" });
      }
      return result;
    }
    // New profile: suggest params from the most recent profile (keys + values as starting point)
    if (lastProfile) {
      const parsed = parseExtraParams(lastProfile.extraParams ?? null);
      const result: ParamRow[] = Object.entries(parsed).map(([key, value]) => ({ key, value }));
      const existingKeys = new Set(result.map((p) => p.key));
      // Backward compat: include stone/pattern from legacy columns if not in extraParams
      if (!existingKeys.has("stone") && lastProfile.stone) {
        result.unshift({ key: "stone", value: lastProfile.stone });
        existingKeys.add("stone");
      }
      if (!existingKeys.has("pattern") && lastProfile.pattern) {
        const si = result.findIndex((p) => p.key === "stone");
        result.splice(si >= 0 ? si + 1 : 0, 0, { key: "pattern", value: lastProfile.pattern });
      }
      return result;
    }
    return [];
  };

  const [params, setParams] = useState<ParamRow[]>(initParams);
  const [notesField, setNotesField] = useState(editProfile?.notes ?? "");

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

  // A row is invalid only if it has one field filled but not the other; fully empty rows are skipped on save
  const allParamsValid = params.every((p) => {
    const hasKey = p.key.trim() !== "";
    const hasValue = p.value.trim() !== "";
    return (hasKey && hasValue) || (!hasKey && !hasValue);
  });

  const addParam = () => setParams((prev) => [...prev, { key: "", value: "" }]);
  const removeParam = (idx: number) => {
    setParams((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateParam = (idx: number, field: "key" | "value", val: string) => {
    setParams((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  };
  const moveParam = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= params.length) return;
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
        notes: notesField.trim() || null,
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
              <FormLabel>{t("grinding.profileName")}</FormLabel>
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
              <FormLabel>{t("grinding.grindType")}</FormLabel>
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

        {/* Parameters — all equal: editable name + value, reorderable, removable */}
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
            <div key={idx} className="flex items-center gap-2" data-testid={`param-row-${idx}`}>
              <Input
                value={param.key}
                onChange={(e) => updateParam(idx, "key", e.target.value)}
                placeholder="Name"
                className="flex-1"
                data-testid={`input-param-key-${idx}`}
              />
              <Input
                value={param.value}
                onChange={(e) => updateParam(idx, "value", e.target.value)}
                placeholder="Value"
                className="flex-1"
                data-testid={`input-param-value-${idx}`}
              />
              <button
                type="button"
                onClick={() => moveParam(idx, -1)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
                disabled={idx === 0}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveParam(idx, 1)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
                disabled={idx === params.length - 1}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeParam(idx)}
                className="p-1 rounded text-muted-foreground hover:text-red-600"
                data-testid={`button-remove-param-${idx}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!allParamsValid && (
            <p className="text-xs text-destructive">Each parameter needs both a name and a value.</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Notes</label>
          <Textarea
            value={notesField}
            onChange={(e) => setNotesField(e.target.value)}
            placeholder="Add notes about this grind profile…"
            className="min-h-[72px] text-sm"
            data-testid="input-grind-profile-notes"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={!canSave} data-testid="button-save-grind-profile">
            {editProfile ? t("common.save") : t("grinding.addGrind")}
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
  onArchive,
}: {
  profiles: GrindProfile[];
  onViewResults: (p: GrindProfile) => void;
  onEdit: (p: GrindProfile) => void;
  onDuplicate: (p: GrindProfile) => void;
  onDelete: (p: GrindProfile) => void;
  onArchive?: (p: GrindProfile) => void;
}) {
  const { t } = useI18n();

  return (
    <Card className="fs-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="table-grind-profiles">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/30">
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">ID</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Notes</th>
              <th className="px-3 py-2.5">{t("grinding.addedBy")}</th>
              <th className="px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
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
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px]">
                    {profile.notes ? (
                      <span className="italic">{profile.notes}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{profile.createdByName}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(profile.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="sm" onClick={() => onViewResults(profile)} title="View test results" data-testid={`button-view-results-grind-profile-list-${profile.id}`}>
                        <BarChart2 className="h-3.5 w-3.5 text-violet-600" />
                      </Button>
                      {profile.archived ? (
                        <Button variant="ghost" size="sm" onClick={() => onArchive?.(profile)} title="Restore from archive" data-testid={`button-unarchive-grind-profile-list-${profile.id}`}>
                          <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => onDuplicate(profile)} title="Duplicate" data-testid={`button-duplicate-grind-profile-list-${profile.id}`}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onEdit(profile)} title="Edit" data-testid={`button-edit-grind-profile-list-${profile.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onArchive?.(profile)} title="Archive" data-testid={`button-archive-grind-profile-list-${profile.id}`}>
                            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onDelete(profile)} title="Delete" data-testid={`button-delete-grind-profile-list-${profile.id}`}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
            ))}
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
  onArchive,
}: {
  profile: GrindProfile;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onViewResults: () => void;
  onArchive?: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  // Build ordered param list from extraParams (user-defined order), with legacy fallback
  const extra = parseExtraParams(profile.extraParams);
  const extraKeys = new Set(Object.keys(extra));
  const legacyParams: [string, string][] = [];
  if (!extraKeys.has("stone") && profile.stone) legacyParams.push(["stone", profile.stone]);
  if (!extraKeys.has("pattern") && profile.pattern) legacyParams.push(["pattern", profile.pattern]);
  const allParamEntries = [...legacyParams, ...Object.entries(extra).filter(([, v]) => v)];

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState(profile.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);

  async function saveProfileNotes() {
    setNotesSaving(true);
    try {
      await apiRequest("PUT", `/api/grind-profiles/${profile.id}`, {
        name: profile.name,
        grindType: profile.grindType,
        stone: profile.stone,
        pattern: profile.pattern,
        extraParams: profile.extraParams ? JSON.parse(profile.extraParams) : null,
        notes: notesVal.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/grind-profiles"] });
      setEditingNotes(false);
    } catch {
      toast({ title: "Error", description: "Could not save notes", variant: "destructive" });
    } finally {
      setNotesSaving(false);
    }
  }

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
            {allParamEntries.map(([k, v]) => (
              <span key={k} className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {k}: {v}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{t("grinding.addedBy")} {profile.createdByName}</span>
            <span>·</span>
            <span>{formatDate(profile.createdAt)}</span>
          </div>
          {/* Notes — always visible, inline editable */}
          <div className="mt-1.5 group/notes">
            {editingNotes ? (
              <div className="flex flex-col gap-1.5">
                <Textarea
                  value={notesVal}
                  onChange={(e) => setNotesVal(e.target.value)}
                  className="min-h-[60px] text-xs"
                  placeholder="Add notes about this grind profile…"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-6 px-2 text-xs" onClick={saveProfileNotes} disabled={notesSaving}>
                    <Check className="h-3 w-3 mr-1" />Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setEditingNotes(false); setNotesVal(profile.notes ?? ""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1.5">
                {profile.notes ? (
                  <p className="text-xs text-muted-foreground italic flex-1">{profile.notes}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/40 italic flex-1">No notes</p>
                )}
                <button
                  type="button"
                  onClick={() => setEditingNotes(true)}
                  className="opacity-0 group-hover/notes:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  title="Edit notes"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onViewResults} data-testid={`button-view-results-grind-profile-${profile.id}`} title="View test results">
            <BarChart2 className="h-4 w-4 text-violet-600" />
          </Button>
          {profile.archived ? (
            <Button variant="ghost" size="sm" onClick={onArchive} data-testid={`button-unarchive-grind-profile-${profile.id}`} title="Restore from archive">
              <RotateCcw className="h-4 w-4 text-emerald-600" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onDuplicate} data-testid={`button-duplicate-grind-profile-${profile.id}`} title="Duplicate profile">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-grind-profile-${profile.id}`} title="Edit profile">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onArchive} data-testid={`button-archive-grind-profile-${profile.id}`} title="Archive profile">
                <Archive className="h-4 w-4 text-muted-foreground" />
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
            </>
          )}
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

  // All toggleable column keys: only include stone/pattern if the profile actually has them
  const allCols = useMemo((): GrindCol[] => {
    const cols: GrindCol[] = ["name"];
    if (!profile) return cols;
    if (profile.stone) cols.push("stone");
    if (profile.pattern) cols.push("pattern");
    const extra = parseExtraParams(profile.extraParams);
    for (const [k, v] of Object.entries(extra)) {
      if (v && k !== "stone" && k !== "pattern") cols.push(k);
    }
    return cols;
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
    if (col === "ra_value") return "RA-Value";
    // User-defined keys: show exactly as stored
    return col;
  }

  function getColValue(entry: ProfileTestEntry, col: GrindCol): string {
    if (col === "name") return entry.grindType ?? "—";
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

        {/* Profile params summary — shown in user-defined order */}
        {profile && (
          <div className="flex flex-wrap gap-1.5 mb-1">
            <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
              {profile.grindType}
            </span>
            {(() => {
              const extra = parseExtraParams(profile.extraParams);
              const extraKeys = new Set(Object.keys(extra));
              const legacy: [string, string][] = [];
              if (!extraKeys.has("stone") && profile.stone) legacy.push(["stone", profile.stone]);
              if (!extraKeys.has("pattern") && profile.pattern) legacy.push(["pattern", profile.pattern]);
              return [...legacy, ...Object.entries(extra).filter(([, v]) => v)].map(([k, v]) => (
                <span key={k} className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {k}: {v}
                </span>
              ));
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
                          <span className="inline-flex items-center gap-1 rounded-full fs-gradient-emerald px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/10">
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
                            const isSelected = entry.isSelectedGrind === true;
                            const hasGrind = !!entry.grindType;
                            return (
                              <tr
                                key={entry.id}
                                className={cn(
                                  "border-b border-border/20",
                                  isSelected && "bg-yellow-400/15",
                                  !hasGrind && "opacity-40",
                                )}
                              >
                                <td className="py-1.5 pr-3 font-medium text-xs">{entry.skiNumber}</td>
                                {hasSkiInfo && (
                                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                                    {[entry.skiBrand, entry.skiModel].filter(Boolean).join(" ") || "—"}
                                  </td>
                                )}
                                {activeCols.map((col) => (
                                  <td
                                    key={col}
                                    className={cn(
                                      "py-1.5 pr-3 text-xs",
                                      col === "name" && isSelected
                                        ? "font-semibold text-yellow-700 dark:text-yellow-400"
                                        : "text-muted-foreground",
                                    )}
                                  >
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

        {/* ── Change history ─────────────────────────────────── */}
        <GrindProfileHistory profileId={profile?.id ?? null} open={open} />

      </DialogContent>
    </Dialog>
  );
}

function GrindProfileHistory({ profileId, open }: { profileId: number | null; open: boolean }) {
  const { data: changes = [], isLoading } = useQuery<{
    id: number; userName: string; action: string; details: string; createdAt: string;
  }[]>({
    queryKey: [`/api/grind-profiles/${profileId}/changes`],
    queryFn: async () => {
      const res = await fetch(`/api/grind-profiles/${profileId}/changes`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open && profileId != null,
    staleTime: 10000,
  });

  if (isLoading || changes.length === 0) return null;

  const ACTION_LABEL: Record<string, string> = {
    created: "Created",
    updated: "Updated",
    deleted: "Deleted",
    archived: "Archived",
    restored: "Restored",
    duplicated: "Duplicated",
  };
  const ACTION_COLOR: Record<string, string> = {
    created: "text-emerald-600",
    updated: "text-blue-600",
    deleted: "text-destructive",
    archived: "text-amber-600",
    restored: "text-indigo-600",
    duplicated: "text-violet-600",
  };

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Change history</div>
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
        {changes.map((c) => {
          let diffSummary: string | null = null;
          if (c.action === "updated" && c.details) {
            try {
              const { changes: diffs } = JSON.parse(c.details);
              if (Array.isArray(diffs) && diffs.length > 0) {
                diffSummary = diffs.map((d: any) => `${d.field}: "${d.from}" → "${d.to}"`).join(", ");
              }
            } catch {}
          }
          const dt = new Date(c.createdAt);
          const label = dt.toLocaleDateString("no-NO", { year: "numeric", month: "short", day: "numeric" })
            + " " + dt.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={c.id} className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-xs">
              <span className={cn("mt-0.5 font-semibold shrink-0", ACTION_COLOR[c.action] ?? "text-foreground")}>
                {ACTION_LABEL[c.action] ?? c.action}
              </span>
              <div className="min-w-0 flex-1 text-muted-foreground">
                {diffSummary && <span className="block truncate">{diffSummary}</span>}
              </div>
              <span className="shrink-0 text-muted-foreground/70">{c.userName} · {label}</span>
            </div>
          );
        })}
      </div>
    </div>
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

const TRACK_HARDNESS_OPTIONS = ["Very soft", "Soft", "Medium hard", "Hard", "Very hard", "Ice"] as const;
const SNOW_HUMIDITY_TYPE_OPTIONS = ["Dry", "Moist", "Wet", "Very wet", "Slush"] as const;
const GRAIN_SIZE_OPTIONS = ["Extra fine", "Very fine", "Fine", "Average", "Coarse", "Very coarse"] as const;
const SNOW_STAGE_OPTIONS = ["Falling new", "New", "Irreg. dir. new", "Irreg. dir. transf.", "Transformed"] as const;

// ─── Grind Links (quick-access URL buttons) ────────────────────────────────────

type GrindLink = { id: string; name: string; url: string };
const LINKS_KEY = "glidr-grind-links";

function loadGrindLinks(): GrindLink[] {
  try { return JSON.parse(localStorage.getItem(LINKS_KEY) ?? "[]"); } catch { return []; }
}
function saveGrindLinks(links: GrindLink[]) {
  try { localStorage.setItem(LINKS_KEY, JSON.stringify(links)); } catch {}
}

// ─── Main page ─────────────────────────────────────────────────────────────────

// ── Data from the spreadsheet image ─────────────────────────────────────────
const PRESET_GRIND_DATA = `Brand\tGrind\tRa\tRa/Rq\tRq\tRsk\tRku\tRsm\tRk\tNotes
Atomic\tAM8W\t2.7
Atomic\tAM8\t2.7
Atomic\tAW9\t4
Atomic\tAW7\t2.3
Fischer\tC3-1\t2.1
Fischer\tC8-1\t2.6
Fischer\tP11-2\t5.7\t1.19\t6.7\t-0.35\t2.3\t436\t19\t372
Fischer\tP11-1\t3.7
Fischer\tP5-1\t4.4\t1.24\t5.49\t-1.1\t3.32\t533\t7.5\t275
Madshus\tAW9\t4.54\t1.21\t5.5\t-0.31\t2.63
Madshus\tM62\t3.73\t1.22\t4.56\t-0.3\t2.64
Madshus\tM61 Blue\t3.73\t1.2\t4.48\t-0.29\t2.54\t442\t13.38
Rossignol\tRC5\t2
Rossignol\tA6B\t3.3
Rossignol\tRU2\t2.8
Rossignol\tRUW10\t4\t1.23\t4.9\t-0.37\t2.75\t433\t12.6\tLower in other tests
Rossignol\tA11\t4.25\t1.19\t2.92\t-0.46\t2.17\t\t\tw/ hand structure
Rossignol\tRW10\t4\t1.19\t4.74\t-0.31\t2.26\t408\t14.65
Rossignol\tA30\t7.68\t1.18\t9.05\t-0.14\t2.16
Rossignol\tA36\t4.24\t1.18\t5.03\t-0.03\t2.15
Rossignol\tRW692\t7.7\t1.21\t9.35\t-0.65\t2.73\t807\t23.4
Salomon\tSL27\t2.2
Salomon\tSL22\t2.4
Salomon\tSL21\t4
Salomon\tSL34\t6.79\t1.24\t8.44\t-1.07\t3.32\t460\t9.1
Salomon\tSL31\t4.66\t1.17\t5.46\t-0.23\t2.1\t340\t9.8
Salomon\tT11\t4.12\t1.2\t4.93\t-0.23\t2.35\t299\t13.22
USA\tOlos Uni\t3.2
USA\t12/9\t2.91
USA\tGio2\t2.3\t1.27\t2.92\t-0.46\t3.3\t\t\tHas testing higher
USA\tOly9 B\t6.15\t1.12\t6.91\t-0.2\t1.78\t553\t16.6\tBrown stone
USA\tOly9 W\t4.35\t1.18\t5.12\t-0.13\t2.15\t502\t14.12\tWhite stone`;

type ParsedGrindRow = {
  name: string;
  grindType: string;
  extraParams: Record<string, string>;
  notes: string;
};

function parseGrindTSV(raw: string): ParsedGrindRow[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];

  // Detect header row: if first row contains "brand" or "name" (case-insensitive)
  const firstCells = lines[0].split("\t").map((c) => c.trim().toLowerCase());
  const isHeader = firstCells.some((c) => ["brand", "name", "grind", "ra"].includes(c));
  const headers = isHeader ? lines[0].split("\t").map((c) => c.trim()) : ["Brand", "Grind", "Ra", "Ra/Rq", "Rq", "Rsk", "Rku", "Rsm", "Rk", "Notes"];
  const dataLines = isHeader ? lines.slice(1) : lines;

  const brandIdx = headers.findIndex((h) => h.toLowerCase() === "brand");
  const grindIdx = headers.findIndex((h) => h.toLowerCase() === "grind");
  const nameIdx = headers.findIndex((h) => h.toLowerCase() === "name");
  const notesIdx = headers.findIndex((h) => h.toLowerCase() === "notes");
  const paramHeaders = headers
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => i !== brandIdx && i !== grindIdx && i !== nameIdx && i !== notesIdx);

  const rows: ParsedGrindRow[] = [];
  for (const line of dataLines) {
    const cells = line.split("\t");
    let name = "";
    if (brandIdx >= 0 && grindIdx >= 0) {
      const brand = (cells[brandIdx] ?? "").trim();
      const grind = (cells[grindIdx] ?? "").trim();
      name = [brand, grind].filter(Boolean).join(" ");
    } else if (nameIdx >= 0) {
      name = (cells[nameIdx] ?? "").trim();
    }
    if (!name) continue;

    const extraParams: Record<string, string> = {};
    for (const { h, i } of paramHeaders) {
      const val = (cells[i] ?? "").trim();
      if (val) extraParams[h] = val;
    }
    const notes = notesIdx >= 0 ? (cells[notesIdx] ?? "").trim() : "";
    rows.push({ name, grindType: "Universal", extraParams, notes });
  }
  return rows;
}

function GrindBulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const [raw, setRaw] = useState(PRESET_GRIND_DATA);
  const [importing, setImporting] = useState(false);

  const preview = useMemo(() => parseGrindTSV(raw), [raw]);

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    try {
      const res = await apiRequest("POST", "/api/grind-profiles/bulk", { profiles: preview });
      const data = await res.json();
      toast({ title: `${data.created} profiler importert`, variant: "default" });
      onImported();
      onOpenChange(false);
    } catch {
      toast({ title: "Import feilet", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer slipeprofiler</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Lim inn data fra et regneark (Tab-separert). Kolonnene <strong>Brand</strong> og <strong>Grind</strong> brukes som profilnavn. Alle numeriske kolonner lagres som parametre. Grind type settes til <strong>Universal</strong> med mindre du endrer i forhåndsvisningen.
        </p>
        <Textarea
          className="font-mono text-xs min-h-[140px]"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"Brand\tGrind\tRa\tNotes\nAtomic\tAM8W\t2.7"}
        />
        {preview.length > 0 && (
          <div className="overflow-auto max-h-64 border rounded-lg text-xs">
            <table className="w-full">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left">Navn</th>
                  <th className="px-2 py-1.5 text-left">Type</th>
                  <th className="px-2 py-1.5 text-left">Parametre</th>
                  <th className="px-2 py-1.5 text-left">Notater</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="px-2 py-1 font-medium">{r.name}</td>
                    <td className="px-2 py-1 text-muted-foreground">{r.grindType}</td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {Object.entries(r.extraParams).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">{preview.length} profiler klar til import</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handleImport}
              disabled={!preview.length || importing}
            >
              {importing ? "Importerer…" : `Importer ${preview.length}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Grinding() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [tab, setTab] = useState<"tests" | "grinds" | "analytics">("tests");

  const [filterSeason, setFilterSeason] = useState<string>("All");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterGrinds, setFilterGrinds] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [wfAirTempMin, setWfAirTempMin] = useState("");
  const [wfAirTempMax, setWfAirTempMax] = useState("");
  const [wfSnowTempMin, setWfSnowTempMin] = useState("");
  const [wfSnowTempMax, setWfSnowTempMax] = useState("");
  const [wfAirHumMin, setWfAirHumMin] = useState("");
  const [wfAirHumMax, setWfAirHumMax] = useState("");
  const [wfSnowHumMin, setWfSnowHumMin] = useState("");
  const [wfSnowHumMax, setWfSnowHumMax] = useState("");
  const [wfSnowType, setWfSnowType] = useState("");
  const [wfTrackHardness, setWfTrackHardness] = useState("");
  const [wfArtSnow, setWfArtSnow] = useState("");
  const [wfNatSnow, setWfNatSnow] = useState("");
  const [wfSnowHumidityType, setWfSnowHumidityType] = useState("");
  const [wfGrainSize, setWfGrainSize] = useState("");
  const [wfPrecipitation, setWfPrecipitation] = useState("");
  const [wfWind, setWfWind] = useState("");
  const [wfVisibility, setWfVisibility] = useState("");
  const [wfCloudMin, setWfCloudMin] = useState("");
  const [wfCloudMax, setWfCloudMax] = useState("");
  const [wfWeatherOpen, setWfWeatherOpen] = useState(false);

  // Grind profiles state
  const [grindSearch, setGrindSearch] = useState("");
  const [grindDialogOpen, setGrindDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<GrindProfile | undefined>();
  const [detailProfile, setDetailProfile] = useState<GrindProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [grindViewMode, setGrindViewMode] = useState<"grid" | "list">(() => {
    try { return (localStorage.getItem("glidr-grinds-view-mode") as "grid" | "list") || "grid"; } catch { return "grid"; }
  });
  const [grindSubTab, setGrindSubTab] = useState<"active" | "archived">("active");

  // ── Quick-access links ──────────────────────────────────────────────────────
  const [grindLinks, setGrindLinks] = useState<GrindLink[]>(() => loadGrindLinks());
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [editLink, setEditLink] = useState<GrindLink | null>(null);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkEditMode, setLinkEditMode] = useState(false);

  function openNewLinkDialog() {
    setEditLink(null);
    setLinkName("");
    setLinkUrl("");
    setLinkDialogOpen(true);
  }
  function openEditLinkDialog(link: GrindLink) {
    setEditLink(link);
    setLinkName(link.name);
    setLinkUrl(link.url);
    setLinkDialogOpen(true);
  }
  function saveLinkDialog() {
    const name = linkName.trim();
    const url = linkUrl.trim();
    if (!name || !url) return;
    const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    let next: GrindLink[];
    if (editLink) {
      next = grindLinks.map((l) => l.id === editLink.id ? { ...l, name, url: safeUrl } : l);
    } else {
      next = [...grindLinks, { id: `${Date.now()}`, name, url: safeUrl }];
    }
    setGrindLinks(next);
    saveGrindLinks(next);
    setLinkDialogOpen(false);
  }
  function deleteLink(id: string) {
    const next = grindLinks.filter((l) => l.id !== id);
    setGrindLinks(next);
    saveGrindLinks(next);
  }

  const { data: allTests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather/for-filtering"] });
  const { data: grindProfiles = [], isLoading: grindProfilesLoading } = useQuery<GrindProfile[]>({ queryKey: ["/api/grind-profiles"] });
  const { data: archivedProfiles = [] } = useQuery<GrindProfile[]>({
    queryKey: ["/api/grind-profiles", "archived"],
    queryFn: () => fetch("/api/grind-profiles?archived=true", { credentials: "include" }).then(r => r.json()),
    enabled: grindSubTab === "archived",
  });

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

  // Most recently created active profile — used as parameter suggestions for new profiles
  const lastGrindProfile = useMemo(() => {
    if (!grindProfiles.length) return undefined;
    return [...grindProfiles].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
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
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    },
  });

  const duplicateProfileMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/grind-profiles/${id}/duplicate`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grind-profiles"] });
      toast({ title: t("grinding.duplicated") });
    },
    onError: (e: Error) => {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    },
  });

  const archiveProfileMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: number; archived: boolean }) => {
      const res = await apiRequest("PATCH", `/api/grind-profiles/${id}/archive`, { archived });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/grind-profiles"] });
      toast({ title: vars.archived ? "Profile archived" : "Profile restored" });
    },
    onError: (e: Error) => {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    },
  });

  const seriesById = new Map(series.map((s) => [s.id, s.name] as const));
  const weatherById = new Map(weather.map((w) => [w.id, w] as const));

  function getSeason(dateStr: string): string {
    const d = new Date(dateStr);
    const month = d.getMonth();
    const year = d.getFullYear();
    return month >= 4 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  }

  const availableSeasons = useMemo(() => {
    const seasons = Array.from(new Set(grindTests.map((t) => getSeason(t.date))));
    return seasons.sort().reverse();
  }, [grindTests]);

  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(grindTests.map((t) => t.date)));
    return dates.sort().reverse();
  }, [grindTests]);

  const dateLabelMap = useMemo(() => {
    const locale = language === "no" ? "nb-NO" : "en-US";
    const map = new Map<string, string>();
    for (const d of availableDates) {
      const weekday = new Date(d + "T12:00:00").toLocaleDateString(locale, { weekday: "long" });
      const locs = [...new Set((grindTests as any[]).filter((test) => test.date === d).map((test) => test.location as string))];
      const loc = locs.length > 0 ? locs[0] : "";
      map.set(d, [fmtDate(d), weekday, loc].filter(Boolean).join("  "));
    }
    return map;
  }, [availableDates, language, grindTests]);

  // Weather filter derived values — must be declared BEFORE the filtered useMemo
  const hasWeatherFiltersGrind = !!(wfAirTempMin || wfAirTempMax || wfSnowTempMin || wfSnowTempMax || wfAirHumMin || wfAirHumMax || wfSnowHumMin || wfSnowHumMax || wfSnowType || wfTrackHardness || wfArtSnow || wfNatSnow || wfSnowHumidityType || wfGrainSize || wfPrecipitation || wfWind || wfVisibility || wfCloudMin || wfCloudMax);

  const filtered = useMemo(() => {
    const result = grindTests.filter((t) => {
      if (filterSeason !== "All" && getSeason(t.date) !== filterSeason) return false;
      if (filterLocation && !t.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
      if (filterDate && t.date !== filterDate) return false;
      if (!filterDate && filterDateFrom && t.date < filterDateFrom) return false;
      if (!filterDate && filterDateTo && t.date > filterDateTo) return false;
      if (filterGrinds.length > 0) {
        const testEntries = allEntries.filter((e) => e.testId === t.id);
        const testGrindNames = new Set(testEntries.map((e) => e.grindType).filter(Boolean) as string[]);
        if (compareMode) {
          if (!filterGrinds.every((g) => testGrindNames.has(g))) return false;
        } else {
          if (!filterGrinds.some((g) => testGrindNames.has(g))) return false;
        }
      }
      // Weather filters — tests without linked weather are excluded when weather filters are active
      if (hasWeatherFiltersGrind) {
        const w = t.weatherId ? weatherById.get(t.weatherId) : null;
        if (!w) return false;
        const airMin = wfAirTempMin !== "" ? parseFloat(wfAirTempMin) : null;
        const airMax = wfAirTempMax !== "" ? parseFloat(wfAirTempMax) : null;
        const snowMin = wfSnowTempMin !== "" ? parseFloat(wfSnowTempMin) : null;
        const snowMax = wfSnowTempMax !== "" ? parseFloat(wfSnowTempMax) : null;
        const airHumMin = wfAirHumMin !== "" ? parseFloat(wfAirHumMin) : null;
        const airHumMax = wfAirHumMax !== "" ? parseFloat(wfAirHumMax) : null;
        const snowHumMin = wfSnowHumMin !== "" ? parseFloat(wfSnowHumMin) : null;
        const snowHumMax = wfSnowHumMax !== "" ? parseFloat(wfSnowHumMax) : null;
        const cloudMin = wfCloudMin !== "" ? parseFloat(wfCloudMin) : null;
        const cloudMax = wfCloudMax !== "" ? parseFloat(wfCloudMax) : null;
        // For each range: auto-swap if user enters min > max (handles negative temp confusion)
        const [effAirMin, effAirMax] = airMin != null && airMax != null && airMin > airMax ? [airMax, airMin] : [airMin, airMax];
        const [effSnowMin, effSnowMax] = snowMin != null && snowMax != null && snowMin > snowMax ? [snowMax, snowMin] : [snowMin, snowMax];
        const air = w.airTemperatureC ?? null;
        const snow = w.snowTemperatureC ?? null;
        if (effAirMin != null && (air == null || air < effAirMin)) return false;
        if (effAirMax != null && (air == null || air > effAirMax)) return false;
        if (effSnowMin != null && (snow == null || snow < effSnowMin)) return false;
        if (effSnowMax != null && (snow == null || snow > effSnowMax)) return false;
        if (airHumMin != null && (w.airHumidityPct == null || w.airHumidityPct < airHumMin)) return false;
        if (airHumMax != null && (w.airHumidityPct == null || w.airHumidityPct > airHumMax)) return false;
        if (snowHumMin != null && (w.snowHumidityPct == null || w.snowHumidityPct < snowHumMin)) return false;
        if (snowHumMax != null && (w.snowHumidityPct == null || w.snowHumidityPct > snowHumMax)) return false;
        if (wfSnowType && !(w.snowType ?? "").toLowerCase().includes(wfSnowType.toLowerCase())) return false;
        if (wfTrackHardness && !(w.trackHardness ?? "").toLowerCase().includes(wfTrackHardness.toLowerCase())) return false;
        if (wfArtSnow && !(w.artificialSnow ?? "").toLowerCase().includes(wfArtSnow.toLowerCase())) return false;
        if (wfNatSnow && !(w.naturalSnow ?? "").toLowerCase().includes(wfNatSnow.toLowerCase())) return false;
        if (wfSnowHumidityType && !(w.snowHumidityType ?? "").toLowerCase().includes(wfSnowHumidityType.toLowerCase())) return false;
        if (wfGrainSize && !(w.grainSize ?? "").toLowerCase().includes(wfGrainSize.toLowerCase())) return false;
        if (wfPrecipitation && !(w.precipitation ?? "").toLowerCase().includes(wfPrecipitation.toLowerCase())) return false;
        if (wfWind && !(w.wind ?? "").toLowerCase().includes(wfWind.toLowerCase())) return false;
        if (wfVisibility && !(w.visibility ?? "").toLowerCase().includes(wfVisibility.toLowerCase())) return false;
        if (cloudMin != null && (w.clouds == null || w.clouds < cloudMin)) return false;
        if (cloudMax != null && (w.clouds == null || w.clouds > cloudMax)) return false;
      }
      return true;
    });
    if (filterDate) {
      result.sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"));
    }
    return result;
  }, [grindTests, filterSeason, filterLocation, filterDate, filterGrinds, compareMode, allEntries, hasWeatherFiltersGrind, wfAirTempMin, wfAirTempMax, wfSnowTempMin, wfSnowTempMax, wfAirHumMin, wfAirHumMax, wfSnowHumMin, wfSnowHumMax, wfSnowType, wfTrackHardness, wfArtSnow, wfNatSnow, wfSnowHumidityType, wfGrainSize, wfPrecipitation, wfWind, wfVisibility, wfCloudMin, wfCloudMax, weatherById]);

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

  const filteredArchivedProfiles = useMemo(() => {
    if (!grindSearch.trim()) return archivedProfiles;
    const q = grindSearch.toLowerCase();
    return archivedProfiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.grindType.toLowerCase().includes(q) ||
        p.stone.toLowerCase().includes(q) ||
        p.pattern.toLowerCase().includes(q)
    );
  }, [archivedProfiles, grindSearch]);

  const grindHighlight = useMemo(() => {
    const map = new Map<string, typeof GRIND_COMPARE_COLORS[number]>();
    filterGrinds.forEach((name, i) => {
      if (i < GRIND_COMPARE_COLORS.length) map.set(name, GRIND_COMPARE_COLORS[i]);
    });
    return map;
  }, [filterGrinds]);

  const isGrindFilterActive = filterGrinds.length > 0;
  const hasFilters = filterSeason !== "All" || filterLocation || filterDate || filterDateFrom || filterDateTo || isGrindFilterActive || hasWeatherFiltersGrind;
  const isDayView = !!filterDate;

  function getTabSubtitle() {
    if (tab === "tests") return `${filtered.length} grind test${filtered.length !== 1 ? "s" : ""}${hasFilters ? " matching filters" : " total"}`;
    if (tab === "analytics") return `Analytics — ${grindProfiles.length} profiles, ${grindTests.length} tests`;
    if (grindSubTab === "archived") return `${filteredArchivedProfiles.length} archived profile${filteredArchivedProfiles.length !== 1 ? "s" : ""}${grindSearch ? " matching search" : ""}`;
    return `${filteredProfiles.length} grind profile${filteredProfiles.length !== 1 ? "s" : ""}${grindSearch ? " matching search" : " total"}`;
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-grinding-title">
              <Disc3 className="inline-block mr-2 h-7 w-7 text-indigo-600" />
              {t("grinding.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{getTabSubtitle()}</p>
          </div>

          <div className="flex items-center gap-2">
            {tab === "tests" && (
              <AppLink href="/tests/new?type=Grind&returnTo=/grinding">
                <Button data-testid="button-new-grind-test" className="shadow-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Grind Test
                </Button>
              </AppLink>
            )}
            {tab === "grinds" && (
              <>
              <Button
                variant="outline"
                className="text-violet-700 border-violet-300 hover:bg-violet-50"
                onClick={() => setBulkImportOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Importer
              </Button>
              <Dialog open={grindDialogOpen} onOpenChange={(v) => { setGrindDialogOpen(v); if (!v) setEditProfile(undefined); }}>
                <DialogTrigger asChild>
                  <Button
                    data-testid="button-add-grind-profile"
                    className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                    onClick={() => { setEditProfile(undefined); setGrindDialogOpen(true); }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t("grinding.addGrind")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editProfile ? t("grinding.editProfile") : t("grinding.newProfile")}</DialogTitle>
                  </DialogHeader>
                  <GrindProfileForm
                    key={editProfile ? `edit-${editProfile.id}` : "create"}
                    editProfile={editProfile}
                    allProfileParamKeys={allProfileParamKeys}
                    lastProfile={editProfile ? undefined : lastGrindProfile}
                    onDone={() => { setGrindDialogOpen(false); setEditProfile(undefined); }}
                  />
                </DialogContent>
              </Dialog>
              </>
            )}
          </div>
        </div>

        {/* ── Quick-access link bar ─────────────────────────────────────── */}
        {(grindLinks.length > 0 || linkEditMode) && (
          <div className="flex flex-wrap items-center gap-2">
            {grindLinks.map((link) => (
              <div key={link.id} className="relative group/linkbtn flex items-center">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-primary",
                    linkEditMode && "pr-14"
                  )}
                >
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  {link.name}
                </a>
                {linkEditMode && (
                  <span className="absolute right-1 flex items-center gap-0.5">
                    <button
                      onClick={() => openEditLinkDialog(link)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteLink(link.id)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            ))}
            <button
              onClick={openNewLinkDialog}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              Add link
            </button>
            <button
              onClick={() => setLinkEditMode((v) => !v)}
              className={cn(
                "rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
                linkEditMode
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {linkEditMode ? "Done" : <Pencil className="h-3 w-3" />}
            </button>
          </div>
        )}
        {grindLinks.length === 0 && !linkEditMode && (
          <button
            onClick={openNewLinkDialog}
            className="self-start inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
          >
            <Link2 className="h-3 w-3" />
            Add spreadsheet link
          </button>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setTab("tests")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "tests" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground/80"}`}
            data-testid="tab-grinding-tests"
          >
            <Disc3 className="inline-block mr-1.5 h-4 w-4" />
            {t("grinding.testsTab")}
            {grindTests.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{grindTests.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("grinds")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "grinds" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground/80"}`}
            data-testid="tab-grinding-grinds"
          >
            <Trophy className="inline-block mr-1.5 h-4 w-4" />
            {t("grinding.grindsTab")}
            {grindProfiles.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{grindProfiles.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("analytics")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "analytics" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground/80"}`}
            data-testid="tab-grinding-analytics"
          >
            <TrendingUp className="inline-block mr-1.5 h-4 w-4" />
            Analytics
          </button>
        </div>

        {/* Tests tab */}
        {tab === "tests" && (
          <>
            <Card className="fs-card rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 text-sm font-semibold">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Filters
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  {/* 1. Season */}
                  <div className="min-w-[140px]">
                    <Select value={filterSeason} onValueChange={setFilterSeason}>
                      <SelectTrigger data-testid="select-grind-filter-season">
                        <SelectValue placeholder="All seasons" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All seasons</SelectItem>
                        {availableSeasons.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* 2. All dates */}
                  <div className="min-w-[180px]">
                    <Select
                      value={filterDate || "__all__"}
                      onValueChange={(v) => setFilterDate(v === "__all__" ? "" : v)}
                      data-testid="select-grind-filter-date"
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="All dates" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All dates</SelectItem>
                        {availableDates.map((d) => (
                          <SelectItem key={d} value={d}>{dateLabelMap.get(d) ?? fmtDate(d)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* 3. Date range */}
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground px-1">Date from:</span>
                      <div className="relative h-9 w-[130px]">
                        <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                          className="h-full w-full cursor-pointer rounded-md border border-input bg-background px-3 text-xs [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-inner-spin-button]:hidden"
                          data-testid="input-grind-filter-date-from" />
                        <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-xs">
                          {filterDateFrom ? fmtDate(filterDateFrom) : <span className="text-muted-foreground text-xs">—</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-muted-foreground text-xs shrink-0 mt-4">–</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground px-1">Date to:</span>
                      <div className="relative h-9 w-[130px]">
                        <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                          className="h-full w-full cursor-pointer rounded-md border border-input bg-background px-3 text-xs [&::-webkit-datetime-edit]:opacity-0 [&::-webkit-inner-spin-button]:hidden"
                          data-testid="input-grind-filter-date-to" />
                        <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-xs">
                          {filterDateTo ? fmtDate(filterDateTo) : <span className="text-muted-foreground text-xs">—</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* 5. Location */}
                  <div className="min-w-[160px]">
                    <Input
                      value={filterLocation}
                      onChange={(e) => setFilterLocation(e.target.value)}
                      placeholder={`${t("common.location")}…`}
                      data-testid="input-grind-filter-location"
                    />
                  </div>
                </div>
                <Button
                  variant={wfWeatherOpen || hasWeatherFiltersGrind ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={() => setWfWeatherOpen(v => !v)}
                >
                  <Snowflake className="h-3.5 w-3.5" />
                  {t("weather.title") || "Weather"}
                  {hasWeatherFiltersGrind && <span className="ml-1 text-[10px]">✓</span>}
                </Button>
                {hasFilters && (
                  <Button
                    variant="secondary"
                    size="sm"
                    data-testid="button-clear-grind-filters"
                    onClick={() => {
                      setFilterSeason("All");
                      setFilterLocation("");
                      setFilterDate("");
                      setFilterDateFrom(""); setFilterDateTo("");
                      setFilterGrinds([]);
                      setCompareMode(false);
                      setWfAirTempMin(""); setWfAirTempMax("");
                      setWfSnowTempMin(""); setWfSnowTempMax("");
                      setWfAirHumMin(""); setWfAirHumMax("");
                      setWfSnowHumMin(""); setWfSnowHumMax("");
                      setWfSnowType(""); setWfTrackHardness("");
                      setWfArtSnow(""); setWfNatSnow("");
                      setWfSnowHumidityType(""); setWfGrainSize("");
                      setWfPrecipitation(""); setWfWind(""); setWfVisibility("");
                      setWfCloudMin(""); setWfCloudMax("");
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Weather conditions filter panel */}
              {wfWeatherOpen && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Snowflake className="h-3 w-3" />
                    Weather Conditions
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Temperature & Humidity</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                            <span className="text-xs text-muted-foreground">Air temp (°C)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-8 text-xs" placeholder="Min" value={wfAirTempMin} onChange={e => setWfAirTempMin(e.target.value)} />
                            <span className="text-xs text-muted-foreground">–</span>
                            <Input type="number" className="h-8 text-xs" placeholder="Max" value={wfAirTempMax} onChange={e => setWfAirTempMax(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-xs text-muted-foreground">Snow temp (°C)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-8 text-xs" placeholder="Min" value={wfSnowTempMin} onChange={e => setWfSnowTempMin(e.target.value)} />
                            <span className="text-xs text-muted-foreground">–</span>
                            <Input type="number" className="h-8 text-xs" placeholder="Max" value={wfSnowTempMax} onChange={e => setWfSnowTempMax(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
                            <span className="text-xs text-muted-foreground">Air humidity (%rH)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-8 text-xs" placeholder="Min" value={wfAirHumMin} onChange={e => setWfAirHumMin(e.target.value)} />
                            <span className="text-xs text-muted-foreground">–</span>
                            <Input type="number" className="h-8 text-xs" placeholder="Max" value={wfAirHumMax} onChange={e => setWfAirHumMax(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                            <span className="text-xs text-muted-foreground">Snow humidity (%)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-8 text-xs" placeholder="Min" value={wfSnowHumMin} onChange={e => setWfSnowHumMin(e.target.value)} />
                            <span className="text-xs text-muted-foreground">–</span>
                            <Input type="number" className="h-8 text-xs" placeholder="Max" value={wfSnowHumMax} onChange={e => setWfSnowHumMax(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
                            <span className="text-xs text-muted-foreground">Cloud cover (%)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input type="number" className="h-8 text-xs" placeholder="Min" value={wfCloudMin} onChange={e => setWfCloudMin(e.target.value)} />
                            <span className="text-xs text-muted-foreground">–</span>
                            <Input type="number" className="h-8 text-xs" placeholder="Max" value={wfCloudMax} onChange={e => setWfCloudMax(e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Snow Type</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
                            <span className="text-xs text-muted-foreground">Artificial snow</span>
                          </div>
                          <Select value={wfArtSnow || "__any__"} onValueChange={v => setWfArtSnow(v === "__any__" ? "" : v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__any__">— Any —</SelectItem>
                              {SNOW_STAGE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-teal-500" />
                            <span className="text-xs text-muted-foreground">Natural snow</span>
                          </div>
                          <Select value={wfNatSnow || "__any__"} onValueChange={v => setWfNatSnow(v === "__any__" ? "" : v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__any__">— Any —</SelectItem>
                              {SNOW_STAGE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-cyan-500" />
                            <span className="text-xs text-muted-foreground">Snow humidity type</span>
                          </div>
                          <Select value={wfSnowHumidityType || "__any__"} onValueChange={v => setWfSnowHumidityType(v === "__any__" ? "" : v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__any__">— Any —</SelectItem>
                              {SNOW_HUMIDITY_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-lime-500" />
                            <span className="text-xs text-muted-foreground">Grain size</span>
                          </div>
                          <Select value={wfGrainSize || "__any__"} onValueChange={v => setWfGrainSize(v === "__any__" ? "" : v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__any__">— Any —</SelectItem>
                              {GRAIN_SIZE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Snow & Track</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
                            <span className="text-xs text-muted-foreground">Track hardness</span>
                          </div>
                          <Select value={wfTrackHardness || "__any__"} onValueChange={v => setWfTrackHardness(v === "__any__" ? "" : v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__any__">— Any —</SelectItem>
                              {TRACK_HARDNESS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                            <span className="text-xs text-muted-foreground">Precipitation</span>
                          </div>
                          <Input className="h-8 text-xs" placeholder="e.g. Snow" value={wfPrecipitation} onChange={e => setWfPrecipitation(e.target.value)} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                            <span className="text-xs text-muted-foreground">Wind</span>
                          </div>
                          <Input className="h-8 text-xs" placeholder="e.g. NW 3m/s" value={wfWind} onChange={e => setWfWind(e.target.value)} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
                            <span className="text-xs text-muted-foreground">Visibility</span>
                          </div>
                          <Input className="h-8 text-xs" placeholder="e.g. Good" value={wfVisibility} onChange={e => setWfVisibility(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {availableDates.length > 0 && !filterDate && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <CalendarDays className="h-3 w-3" />
                    Quick day select
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {availableDates.slice(0, 10).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setFilterDate(d)}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                        data-testid={`button-grind-date-${d}`}
                      >
                        {fmtDate(d)}
                      </button>
                    ))}
                    {availableDates.length > 10 && (
                      <Select
                        value="__none__"
                        onValueChange={(v) => { if (v !== "__none__") setFilterDate(v); }}
                      >
                        <SelectTrigger className="h-8 min-w-[160px] text-xs">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {availableDates.slice(10).map((d) => (
                            <SelectItem key={d} value={d}>{dateLabelMap.get(d) ?? fmtDate(d)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
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
                    {t("grinding.noGrindTests")}
                  </Card>
                ) : (
                  filtered.map((t) => <GrindTestCard key={t.id} test={t} entries={allEntries.filter((e) => e.testId === t.id)} seriesById={seriesById} weatherById={weatherById} grindProfiles={grindProfiles} grindHighlight={grindHighlight} />)
                )}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="fs-card rounded-2xl p-8 text-center">
                <Disc3 className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <div className="text-sm text-muted-foreground">
                  {hasFilters ? "No grind tests match your filters." : t("grinding.noProfiles")}
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
                              <span className="inline-flex items-center gap-1 rounded-full fs-gradient-emerald px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/10">
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
            {/* Sub-tabs: Active / Archived */}
            <div className="flex gap-1 border-b border-border">
              <button
                onClick={() => setGrindSubTab("active")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${grindSubTab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground/80"}`}
              >
                <Trophy className="h-4 w-4" />
                Active
                {grindProfiles.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{grindProfiles.length}</span>
                )}
              </button>
              <button
                onClick={() => setGrindSubTab("archived")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${grindSubTab === "archived" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground/80"}`}
              >
                <Archive className="h-4 w-4" />
                Archived
              </button>
            </div>

            {/* Search bar + view toggle */}
            <div className="flex items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={grindSearch}
                  onChange={(e) => setGrindSearch(e.target.value)}
                  placeholder={t("grinding.searchGrinds")}
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

            {/* Active profiles */}
            {grindSubTab === "active" && grindProfilesLoading && <SkeletonCards count={4} />}
            {grindSubTab === "active" && !grindProfilesLoading && (
              grindProfiles.length === 0 ? (
                <Card className="fs-card rounded-2xl p-8 text-center">
                  <Trophy className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                  <div className="text-sm text-muted-foreground">{t("grinding.noProfiles")}</div>
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
                  onDuplicate={async (profile) => { if (await confirm({ title: `Duplicate "${profile.name}"?`, confirmLabel: "Duplicate" })) duplicateProfileMutation.mutate(profile.id); }}
                  onDelete={async (profile) => { if (await confirm({ title: `Delete "${profile.name}"?`, description: "This cannot be undone.", confirmLabel: "Delete", variant: "destructive" })) deleteProfileMutation.mutate(profile.id); }}
                  onArchive={async (profile) => { if (await confirm({ title: `Archive "${profile.name}"?`, description: "It will be moved to the archive and can be restored later.", confirmLabel: "Archive" })) archiveProfileMutation.mutate({ id: profile.id, archived: true }); }}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredProfiles.map((profile) => (
                    <GrindProfileCard
                      key={profile.id}
                      profile={profile}
                      onViewResults={() => { setDetailProfile(profile); setDetailOpen(true); }}
                      onEdit={() => { setEditProfile(profile); setGrindDialogOpen(true); }}
                      onDuplicate={async () => { if (await confirm({ title: `Duplicate "${profile.name}"?`, confirmLabel: "Duplicate" })) duplicateProfileMutation.mutate(profile.id); }}
                      onDelete={async () => { if (await confirm({ title: `Delete "${profile.name}"?`, description: "This cannot be undone.", confirmLabel: "Delete", variant: "destructive" })) deleteProfileMutation.mutate(profile.id); }}
                      onArchive={async () => { if (await confirm({ title: `Archive "${profile.name}"?`, description: "It will be moved to the archive and can be restored later.", confirmLabel: "Archive" })) archiveProfileMutation.mutate({ id: profile.id, archived: true }); }}
                    />
                  ))}
                </div>
              )
            )}

            {/* Archived profiles */}
            {grindSubTab === "archived" && (
              archivedProfiles.length === 0 ? (
                <Card className="fs-card rounded-2xl p-8 text-center">
                  <Archive className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                  <div className="text-sm text-muted-foreground">No archived grind profiles.</div>
                </Card>
              ) : filteredArchivedProfiles.length === 0 ? (
                <Card className="fs-card rounded-2xl p-6 text-center">
                  <div className="text-sm text-muted-foreground">No archived profiles match your search.</div>
                </Card>
              ) : grindViewMode === "list" ? (
                <GrindProfilesTable
                  profiles={filteredArchivedProfiles}
                  onViewResults={(profile) => { setDetailProfile(profile); setDetailOpen(true); }}
                  onEdit={(profile) => { setEditProfile(profile); setGrindDialogOpen(true); }}
                  onDuplicate={async (profile) => { if (await confirm({ title: `Duplicate "${profile.name}"?`, confirmLabel: "Duplicate" })) duplicateProfileMutation.mutate(profile.id); }}
                  onDelete={async (profile) => { if (await confirm({ title: `Delete "${profile.name}"?`, description: "This cannot be undone.", confirmLabel: "Delete", variant: "destructive" })) deleteProfileMutation.mutate(profile.id); }}
                  onArchive={(profile) => archiveProfileMutation.mutate({ id: profile.id, archived: false })}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredArchivedProfiles.map((profile) => (
                    <GrindProfileCard
                      key={profile.id}
                      profile={profile}
                      onViewResults={() => { setDetailProfile(profile); setDetailOpen(true); }}
                      onEdit={() => { setEditProfile(profile); setGrindDialogOpen(true); }}
                      onDuplicate={async () => { if (await confirm({ title: `Duplicate "${profile.name}"?`, confirmLabel: "Duplicate" })) duplicateProfileMutation.mutate(profile.id); }}
                      onDelete={async () => { if (await confirm({ title: `Delete "${profile.name}"?`, description: "This cannot be undone.", confirmLabel: "Delete", variant: "destructive" })) deleteProfileMutation.mutate(profile.id); }}
                      onArchive={() => archiveProfileMutation.mutate({ id: profile.id, archived: false })}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Analytics tab */}
        {tab === "analytics" && (
          <GrindingAnalytics
            grindTests={grindTests}
            allEntries={allEntries}
            grindProfiles={grindProfiles}
            weatherById={weatherById}
          />
        )}

      </div>

      {/* Grind profile detail dialog */}
      <GrindProfileDetailDialog
        profile={detailProfile}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
      {ConfirmDialog}

      {/* Add / Edit link dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={(v) => { setLinkDialogOpen(v); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              {editLink ? "Edit link" : "Add link"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Button name</label>
              <Input
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="e.g. Grind Log 2025"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && saveLinkDialog()}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">URL</label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/…"
                onKeyDown={(e) => e.key === "Enter" && saveLinkDialog()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={saveLinkDialog} disabled={!linkName.trim() || !linkUrl.trim()}>
                {editLink ? "Save" : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <GrindBulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["/api/grind-profiles"] })}
      />
    </AppShell>
  );
}

// ─── Grinding Analytics ────────────────────────────────────────────────────────

type AnalyticsView = "overview" | "compare" | "conditions";

// Temperature bucket helper
function tempBucket(t: number | null | undefined): string {
  if (t === null || t === undefined) return "Unknown";
  if (t <= -15) return "≤ −15°C";
  if (t <= -10) return "−15 to −10°C";
  if (t <= -5) return "−10 to −5°C";
  if (t <= 0) return "−5 to 0°C";
  return "> 0°C";
}

const TEMP_BUCKET_ORDER = ["≤ −15°C", "−15 to −10°C", "−10 to −5°C", "−5 to 0°C", "> 0°C", "Unknown"];

function GrindingAnalytics({
  grindTests,
  allEntries,
  grindProfiles,
  weatherById,
}: {
  grindTests: Test[];
  allEntries: TestEntry[];
  grindProfiles: GrindProfile[];
  weatherById: Map<number, Weather>;
}) {
  const [view, setView] = useState<AnalyticsView>("overview");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Keep legacy single-select for overview click-through
  const [focusId, setFocusId] = useState<number | null>(null);

  // ── Per-profile stats ─────────────────────────────────────────────────────
  const profileStats = useMemo(() => {
    return grindProfiles.map((profile) => {
      const entries = allEntries.filter((e) => e.grindProfileId === profile.id);
      const testIds = new Set(entries.map((e) => e.testId));
      const testsForProfile = grindTests.filter((t) => testIds.has(t.id));
      const ranks: number[] = entries.map((e) => e.rank0km).filter((r): r is number => r !== null);
      const results: number[] = entries.map((e) => e.result0kmCmBehind).filter((r): r is number => r !== null);
      const wins = ranks.filter((r) => r === 1).length;
      const top3 = ranks.filter((r) => r <= 3).length;
      const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
      const avgResult = results.length > 0 ? results.reduce((a, b) => a + b, 0) / results.length : null;
      const feelingRanks = entries.map((e) => e.feelingRank).filter((r): r is number => r !== null);
      const avgFeeling = feelingRanks.length > 0 ? feelingRanks.reduce((a, b) => a + b, 0) / feelingRanks.length : null;
      const weatherSamples = testsForProfile.map((t) => t.weatherId ? weatherById.get(t.weatherId) : null).filter((w): w is Weather => w != null);
      const avgAirTemp = weatherSamples.length > 0 ? weatherSamples.reduce((a, w) => a + (w.airTemperatureC ?? 0), 0) / weatherSamples.length : null;
      const avgSnowTemp = weatherSamples.length > 0 ? weatherSamples.reduce((a, w) => a + (w.snowTemperatureC ?? 0), 0) / weatherSamples.length : null;
      return {
        profile, testCount: testsForProfile.length, entryCount: entries.length,
        wins, top3, avgRank, avgResult, avgFeeling, avgAirTemp, avgSnowTemp,
        winRate: ranks.length > 0 ? (wins / ranks.length) * 100 : null,
        top3Rate: ranks.length > 0 ? (top3 / ranks.length) * 100 : null,
      };
    }).sort((a, b) => {
      if (b.winRate !== null && a.winRate !== null) return b.winRate - a.winRate;
      if (b.winRate !== null) return 1;
      if (a.winRate !== null) return -1;
      return b.testCount - a.testCount;
    });
  }, [grindProfiles, allEntries, grindTests, weatherById]);

  // ── Condition breakdown per profile ──────────────────────────────────────
  const conditionStats = useMemo(() => {
    const result = new Map<number, {
      bySnowType: Map<string, number[]>;
      bySnowTemp: Map<string, number[]>;
      byTrack: Map<string, number[]>;
    }>();
    for (const profile of grindProfiles) {
      const bySnowType = new Map<string, number[]>();
      const bySnowTemp = new Map<string, number[]>();
      const byTrack = new Map<string, number[]>();
      for (const e of allEntries) {
        if (e.grindProfileId !== profile.id || e.rank0km === null) continue;
        const test = grindTests.find((t) => t.id === e.testId);
        if (!test) continue;
        const w = test.weatherId ? weatherById.get(test.weatherId) : null;
        const rank = e.rank0km as number;
        const st = w?.snowType || "Unknown";
        if (!bySnowType.has(st)) bySnowType.set(st, []);
        bySnowType.get(st)!.push(rank);
        const stb = tempBucket(w?.snowTemperatureC);
        if (!bySnowTemp.has(stb)) bySnowTemp.set(stb, []);
        bySnowTemp.get(stb)!.push(rank);
        const tr = w?.trackHardness || "Unknown";
        if (!byTrack.has(tr)) byTrack.set(tr, []);
        byTrack.get(tr)!.push(rank);
      }
      result.set(profile.id, { bySnowType, bySnowTemp, byTrack });
    }
    return result;
  }, [grindProfiles, allEntries, grindTests, weatherById]);

  // ── Head-to-head between selected profiles ────────────────────────────────
  const headToHead = useMemo(() => {
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return null;
    const pairs: Array<{
      idA: number; idB: number;
      sharedTests: number; aWins: number; bWins: number; tied: number;
      aAvgRank: number | null; bAvgRank: number | null;
      matchups: Array<{ testId: number; date: string; location: string; aRank: number; bRank: number }>;
    }> = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i], idB = ids[j];
        const entriesA = allEntries.filter((e) => e.grindProfileId === idA && e.rank0km !== null);
        const entriesB = allEntries.filter((e) => e.grindProfileId === idB && e.rank0km !== null);
        const testIdsA = new Set(entriesA.map((e) => e.testId));
        const shared = [...new Set(entriesB.map((e) => e.testId))].filter((tid) => testIdsA.has(tid));
        let aWins = 0, bWins = 0, tied = 0;
        const aRanks: number[] = [], bRanks: number[] = [];
        const matchups: typeof pairs[number]["matchups"] = [];
        for (const testId of shared) {
          const aRank = Math.min(...entriesA.filter((e) => e.testId === testId).map((e) => e.rank0km as number));
          const bRank = Math.min(...entriesB.filter((e) => e.testId === testId).map((e) => e.rank0km as number));
          aRanks.push(aRank); bRanks.push(bRank);
          if (aRank < bRank) aWins++;
          else if (bRank < aRank) bWins++;
          else tied++;
          const test = grindTests.find((t) => t.id === testId);
          if (test) matchups.push({ testId, date: test.date, location: test.location, aRank, bRank });
        }
        matchups.sort((a, b) => b.date.localeCompare(a.date));
        pairs.push({
          idA, idB, sharedTests: shared.length, aWins, bWins, tied,
          aAvgRank: aRanks.length > 0 ? aRanks.reduce((a, b) => a + b, 0) / aRanks.length : null,
          bAvgRank: bRanks.length > 0 ? bRanks.reduce((a, b) => a + b, 0) / bRanks.length : null,
          matchups,
        });
      }
    }
    return pairs;
  }, [selectedIds, allEntries, grindTests]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const grindTypes = useMemo(() => Array.from(new Set(grindProfiles.map((p) => p.grindType))).sort(), [grindProfiles]);

  const filteredStats = useMemo(() => {
    let result = profileStats;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.profile.name.toLowerCase().includes(q) || s.profile.grindType.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") result = result.filter((s) => s.profile.grindType === typeFilter);
    return result;
  }, [profileStats, search, typeFilter]);

  const focusStat = useMemo(() => focusId != null ? profileStats.find((s) => s.profile.id === focusId) ?? null : null, [profileStats, focusId]);
  const focusEntries = useMemo(() => focusId != null ? allEntries.filter((e) => e.grindProfileId === focusId) : [], [allEntries, focusId]);
  const focusTests = useMemo(() => {
    if (!focusId) return [];
    const tids = new Set(focusEntries.map((e) => e.testId));
    return grindTests.filter((t) => tids.has(t.id)).sort((a, b) => b.date.localeCompare(a.date));
  }, [focusId, focusEntries, grindTests]);

  const selectedStats = useMemo(() =>
    Array.from(selectedIds).map((id) => profileStats.find((s) => s.profile.id === id)).filter((s): s is NonNullable<typeof s> => s != null),
    [selectedIds, profileStats]
  );

  const COMPARE_COLORS = [
    { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/40", dot: "bg-blue-500" },
    { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/40", dot: "bg-orange-500" },
    { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/40", dot: "bg-emerald-500" },
    { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/40", dot: "bg-purple-500" },
  ];
  const colorByProfileId = useMemo(() => {
    const m = new Map<number, typeof COMPARE_COLORS[number]>();
    Array.from(selectedIds).forEach((id, i) => m.set(id, COMPARE_COLORS[i % COMPARE_COLORS.length]));
    return m;
  }, [selectedIds]);

  function fmt1(v: number | null) { return v === null ? "—" : v.toFixed(1); }
  function fmtPct(v: number | null) { return v === null ? "—" : `${v.toFixed(0)}%`; }

  const totalTests = grindTests.length;
  const totalEntries = allEntries.length;
  const profilesWithData = profileStats.filter((s) => s.entryCount > 0).length;

  // Helper: avg of number array
  function avg(arr: number[]) { return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Tester", value: totalTests },
          { label: "Entries", value: totalEntries },
          { label: "Profiler", value: grindProfiles.length },
          { label: "Med data", value: profilesWithData },
        ].map((c) => (
          <Card key={c.label} className="fs-card rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-primary">{c.value}</p>
          </Card>
        ))}
      </div>

      {/* ── Search + type filter ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Søk slipeprofil…" className="pl-9 h-8 text-sm" />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setTypeFilter("all")}
            className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors", typeFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            Alle
          </button>
          {grindTypes.map((t) => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
              className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors", typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Selected profiles chips ── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">Valgt:</span>
          {selectedStats.map((s) => {
            const color = colorByProfileId.get(s.profile.id)!;
            return (
              <span key={s.profile.id} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", color.bg, color.text, color.border)}>
                <span className={cn("w-2 h-2 rounded-full shrink-0", color.dot)} />
                {s.profile.name}
                <button type="button" onClick={() => setSelectedIds((prev) => { const n = new Set(prev); n.delete(s.profile.id!); return n; })} className="ml-0.5 opacity-60 hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {selectedIds.size >= 2 && (
            <button type="button" onClick={() => setView("compare")} className="ml-1 text-xs text-primary hover:underline underline-offset-2">
              Sammenlign →
            </button>
          )}
          <button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Fjern alle
          </button>
        </div>
      )}

      {/* ── View tabs ── */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit">
        {(["overview", "compare", "conditions"] as AnalyticsView[]).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", view === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {v === "overview" ? "Oversikt" : v === "compare" ? "Sammenlign" : "Betingelser"}
          </button>
        ))}
      </div>

      {/* ═══════════ OVERSIKT TAB ═══════════ */}
      {view === "overview" && (
        <Card className="fs-card rounded-2xl p-4">
          <h2 className="font-semibold text-base flex items-center gap-2 mb-3">
            <BarChart2 className="h-4 w-4 text-primary" />
            Alle slipeprofiler
            <span className="text-xs font-normal text-muted-foreground ml-1">— klikk en rad for detaljer · ☑ for å sammenligne</span>
          </h2>
          {filteredStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Ingen profiler funnet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="w-6 py-2 pr-2" />
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground text-xs">Profil</th>
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground text-xs">Type</th>
                    <th className="text-right py-2 pr-3 font-medium text-muted-foreground text-xs">Tester</th>
                    <th className="text-right py-2 pr-3 font-medium text-muted-foreground text-xs">Entries</th>
                    <th className="text-right py-2 pr-3 font-medium text-muted-foreground text-xs">Seiere</th>
                    <th className="text-right py-2 pr-3 font-medium text-muted-foreground text-xs">Vinn%</th>
                    <th className="text-right py-2 pr-3 font-medium text-muted-foreground text-xs">Top3%</th>
                    <th className="text-right py-2 pr-3 font-medium text-muted-foreground text-xs">Avg rank</th>
                    <th className="text-right py-2 font-medium text-muted-foreground text-xs">Avg snø°C</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map((s) => {
                    const isSelected = selectedIds.has(s.profile.id!);
                    const isFocused = focusId === s.profile.id;
                    const color = isSelected ? colorByProfileId.get(s.profile.id!) : undefined;
                    return (
                      <React.Fragment key={s.profile.id}>
                        <tr
                          className={cn(
                            "border-b border-border/50 cursor-pointer transition-colors",
                            isFocused ? "bg-muted/60" : isSelected ? cn(color?.bg) : "hover:bg-muted/30"
                          )}
                          onClick={() => setFocusId(focusId === s.profile.id ? null : s.profile.id!)}
                        >
                          <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedIds((prev) => {
                                const n = new Set(prev);
                                if (n.has(s.profile.id!)) n.delete(s.profile.id!);
                                else if (n.size < 4) n.add(s.profile.id!);
                                return n;
                              })}
                              className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                                isSelected ? cn("border-transparent", color?.dot) : "border-border hover:border-primary"
                              )}
                            >
                              {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                            </button>
                          </td>
                          <td className="py-2 pr-3">
                            <span className={cn("font-medium", isSelected ? color?.text : "")}>{s.profile.name}</span>
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground text-xs">{s.profile.grindType}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{s.testCount || <span className="text-muted-foreground">0</span>}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{s.entryCount || <span className="text-muted-foreground">0</span>}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {s.wins > 0 ? <span className="text-yellow-500 font-bold">{s.wins}</span> : <span className="text-muted-foreground">0</span>}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {s.winRate !== null ? (
                              <span className={cn("font-medium", s.winRate >= 30 ? "text-emerald-500" : s.winRate >= 10 ? "text-amber-500" : "text-muted-foreground")}>
                                {fmtPct(s.winRate)}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{fmtPct(s.top3Rate)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {s.avgRank !== null
                              ? <span className={cn(s.avgRank <= 2 ? "text-emerald-500 font-medium" : "")}>{fmt1(s.avgRank)}</span>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt1(s.avgSnowTemp)}</td>
                        </tr>
                        {/* Inline expanded detail row */}
                        {isFocused && (
                          <tr key={`${s.profile.id}-detail`} className="bg-muted/20">
                            <td colSpan={10} className="px-2 pb-3 pt-1">
                              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-3">
                                {[
                                  { label: "Tester", value: focusStat?.testCount ?? 0 },
                                  { label: "Entries", value: focusStat?.entryCount ?? 0 },
                                  { label: "Seiere", value: focusStat?.wins ?? 0, hi: (focusStat?.wins ?? 0) > 0 },
                                  { label: "Vinn%", value: fmtPct(focusStat?.winRate ?? null), hi: (focusStat?.winRate ?? 0) >= 20 },
                                  { label: "Top3%", value: fmtPct(focusStat?.top3Rate ?? null) },
                                  { label: "Avg rank", value: fmt1(focusStat?.avgRank ?? null), hi: (focusStat?.avgRank ?? 99) <= 2 },
                                  { label: "Avg resultat", value: fmt1(focusStat?.avgResult ?? null) },
                                  { label: "Avg feeling", value: fmt1(focusStat?.avgFeeling ?? null) },
                                  { label: "Avg luft°C", value: fmt1(focusStat?.avgAirTemp ?? null) },
                                  { label: "Avg snø°C", value: fmt1(focusStat?.avgSnowTemp ?? null) },
                                ].map((item) => (
                                  <div key={item.label} className="rounded-lg bg-background/60 px-2.5 py-2">
                                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                                    <p className={cn("text-base font-bold", item.hi ? "text-primary" : "")}>{String(item.value)}</p>
                                  </div>
                                ))}
                              </div>
                              {/* Recent tests */}
                              {focusTests.length > 0 && (
                                <div className="flex flex-col gap-1">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Siste tester</p>
                                  {focusTests.slice(0, 5).map((test) => {
                                    const ents = focusEntries.filter((e) => e.testId === test.id);
                                    const rs = ents.map((e) => e.rank0km).filter((r): r is number => r !== null);
                                    const w = test.weatherId ? weatherById.get(test.weatherId) : null;
                                    const wins2 = rs.filter((r) => r === 1).length;
                                    const avgR2 = avg(rs);
                                    return (
                                      <div key={test.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-background/50 px-2.5 py-1.5 text-xs">
                                        <span className="font-medium tabular-nums">{test.date.slice(0, 10)}</span>
                                        <span className="text-muted-foreground truncate max-w-[120px]">{test.location}</span>
                                        {w && <span className="text-muted-foreground">{w.snowTemperatureC.toFixed(1)}°C snø</span>}
                                        {w?.snowType && <span className="text-muted-foreground">{w.snowType}</span>}
                                        {wins2 > 0 && <span className="text-yellow-500 font-bold">🥇{wins2 > 1 ? `×${wins2}` : ""}</span>}
                                        {avgR2 !== null && <span className="text-muted-foreground">rank {avgR2.toFixed(1)}</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ═══════════ SAMMENLIGN TAB ═══════════ */}
      {view === "compare" && (
        <div className="flex flex-col gap-4">
          {selectedIds.size < 2 ? (
            <Card className="fs-card rounded-2xl p-8 text-center">
              <BarChart2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">Velg 2–4 profiler for å sammenligne</p>
              <p className="text-sm text-muted-foreground">Hak av profilene i Oversikt-fanen og kom tilbake hit</p>
              <button type="button" onClick={() => setView("overview")} className="mt-3 text-sm text-primary hover:underline">Gå til Oversikt →</button>
            </Card>
          ) : (
            <>
              {/* Side-by-side stats */}
              <Card className="fs-card rounded-2xl p-4">
                <h2 className="font-semibold text-base flex items-center gap-2 mb-4">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  Statistikk side-om-side
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs w-32">Metrikk</th>
                        {selectedStats.map((s) => {
                          const color = colorByProfileId.get(s.profile.id!);
                          return (
                            <th key={s.profile.id} className={cn("text-right py-2 px-3 font-semibold text-xs rounded-t-lg", color?.bg, color?.text)}>
                              <div className="flex items-center justify-end gap-1.5">
                                <span className={cn("w-2 h-2 rounded-full shrink-0", color?.dot)} />
                                {s.profile.name}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Tester", fn: (s: typeof selectedStats[number]) => String(s.testCount) },
                        { label: "Entries", fn: (s: typeof selectedStats[number]) => String(s.entryCount) },
                        { label: "Seiere", fn: (s: typeof selectedStats[number]) => String(s.wins) },
                        { label: "Vinn%", fn: (s: typeof selectedStats[number]) => fmtPct(s.winRate) },
                        { label: "Top3%", fn: (s: typeof selectedStats[number]) => fmtPct(s.top3Rate) },
                        { label: "Avg rank", fn: (s: typeof selectedStats[number]) => fmt1(s.avgRank), lowerBetter: true },
                        { label: "Avg resultat (cm)", fn: (s: typeof selectedStats[number]) => fmt1(s.avgResult), lowerBetter: true },
                        { label: "Avg feeling", fn: (s: typeof selectedStats[number]) => fmt1(s.avgFeeling), lowerBetter: true },
                        { label: "Avg luft°C", fn: (s: typeof selectedStats[number]) => fmt1(s.avgAirTemp) },
                        { label: "Avg snø°C", fn: (s: typeof selectedStats[number]) => fmt1(s.avgSnowTemp) },
                      ].map((row) => {
                        // Find best numeric value
                        const values = selectedStats.map((s) => {
                          const v = parseFloat(row.fn(s));
                          return isNaN(v) ? null : v;
                        });
                        const bestVal = values.some((v) => v !== null)
                          ? (row.lowerBetter
                            ? Math.min(...values.filter((v): v is number => v !== null))
                            : Math.max(...values.filter((v): v is number => v !== null)))
                          : null;
                        return (
                          <tr key={row.label} className="border-b border-border/40">
                            <td className="py-2 pr-4 text-xs text-muted-foreground">{row.label}</td>
                            {selectedStats.map((s) => {
                              const color = colorByProfileId.get(s.profile.id!);
                              const rawVal = parseFloat(row.fn(s));
                              const isBest = !isNaN(rawVal) && rawVal === bestVal && selectedStats.length > 1;
                              return (
                                <td key={s.profile.id} className={cn("py-2 px-3 text-right tabular-nums text-sm", isBest ? cn("font-bold", color?.text) : "")}>
                                  {row.fn(s)}
                                  {isBest && <span className="ml-1 text-[10px]">★</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Head-to-head matchups */}
              {headToHead && headToHead.map((h2h) => {
                const nameA = profileStats.find((s) => s.profile.id === h2h.idA)?.profile.name ?? `#${h2h.idA}`;
                const nameB = profileStats.find((s) => s.profile.id === h2h.idB)?.profile.name ?? `#${h2h.idB}`;
                const colorA = colorByProfileId.get(h2h.idA);
                const colorB = colorByProfileId.get(h2h.idB);
                const total = h2h.aWins + h2h.bWins + h2h.tied;
                return (
                  <Card key={`${h2h.idA}-${h2h.idB}`} className="fs-card rounded-2xl p-4">
                    <h2 className="font-semibold text-base flex items-center gap-2 mb-4">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Head-to-head
                      <span className={cn("font-semibold ml-1", colorA?.text)}>{nameA}</span>
                      <span className="text-muted-foreground text-sm">vs</span>
                      <span className={cn("font-semibold", colorB?.text)}>{nameB}</span>
                    </h2>
                    {h2h.sharedTests === 0 ? (
                      <p className="text-sm text-muted-foreground">Disse profilene har ikke vært i samme test ennå.</p>
                    ) : (
                      <>
                        {/* Score bar */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1 text-center">
                            <p className={cn("text-3xl font-bold", colorA?.text)}>{h2h.aWins}</p>
                            <p className="text-xs text-muted-foreground">{nameA}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-muted-foreground">{h2h.tied}</p>
                            <p className="text-xs text-muted-foreground">Likt</p>
                          </div>
                          <div className="flex-1 text-center">
                            <p className={cn("text-3xl font-bold", colorB?.text)}>{h2h.bWins}</p>
                            <p className="text-xs text-muted-foreground">{nameB}</p>
                          </div>
                        </div>
                        {total > 0 && (
                          <div className="flex rounded-full overflow-hidden h-2 mb-4">
                            {h2h.aWins > 0 && <div className={cn("h-full transition-all", colorA?.dot)} style={{ width: `${(h2h.aWins / total) * 100}%` }} />}
                            {h2h.tied > 0 && <div className="h-full bg-muted-foreground/30" style={{ width: `${(h2h.tied / total) * 100}%` }} />}
                            {h2h.bWins > 0 && <div className={cn("h-full transition-all", colorB?.dot)} style={{ width: `${(h2h.bWins / total) * 100}%` }} />}
                          </div>
                        )}
                        <div className="flex gap-4 text-xs text-muted-foreground mb-4">
                          <span>{h2h.sharedTests} felles {h2h.sharedTests === 1 ? "test" : "tester"}</span>
                          <span>Avg rank {nameA}: <strong className={colorA?.text}>{fmt1(h2h.aAvgRank)}</strong></span>
                          <span>Avg rank {nameB}: <strong className={colorB?.text}>{fmt1(h2h.bAvgRank)}</strong></span>
                        </div>
                        {/* Matchup list */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Dato</th>
                                <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Sted</th>
                                <th className={cn("text-right py-1.5 pr-3 font-medium", colorA?.text)}>{nameA}</th>
                                <th className={cn("text-right py-1.5 font-medium", colorB?.text)}>{nameB}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {h2h.matchups.map((m) => {
                                const aWon = m.aRank < m.bRank;
                                const bWon = m.bRank < m.aRank;
                                return (
                                  <tr key={m.testId} className="border-b border-border/30">
                                    <td className="py-1.5 pr-3 tabular-nums">{m.date.slice(0, 10)}</td>
                                    <td className="py-1.5 pr-3 text-muted-foreground">{m.location}</td>
                                    <td className={cn("py-1.5 pr-3 text-right tabular-nums font-medium", aWon ? colorA?.text : "text-muted-foreground")}>
                                      {aWon ? "★ " : ""}{m.aRank}
                                    </td>
                                    <td className={cn("py-1.5 text-right tabular-nums font-medium", bWon ? colorB?.text : "text-muted-foreground")}>
                                      {bWon ? "★ " : ""}{m.bRank}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </Card>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ═══════════ BETINGELSER TAB ═══════════ */}
      {view === "conditions" && (() => {
        const analysisStats = selectedIds.size > 0
          ? selectedStats
          : profileStats.filter((s) => s.entryCount >= 3);
        if (analysisStats.length === 0) {
          return (
            <Card className="fs-card rounded-2xl p-8 text-center">
              <Snowflake className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">Ingen data ennå</p>
              <p className="text-sm text-muted-foreground">Profiler trenger minst 3 entries med rankdata for betingelsesanalyse</p>
            </Card>
          );
        }
        return (
          <div className="flex flex-col gap-4">
            {analysisStats.map((s) => {
              const cond = conditionStats.get(s.profile.id!);
              if (!cond) return null;
              const color = colorByProfileId.get(s.profile.id!) ?? { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30", dot: "bg-primary" };

              function renderCondGroup(title: string, icon: React.ReactNode, dataMap: Map<string, number[]>, order?: string[]) {
                if (dataMap.size === 0) return null;
                const entries2 = order
                  ? order.filter((k) => dataMap.has(k)).map((k) => [k, dataMap.get(k)!] as [string, number[]])
                  : [...dataMap.entries()].sort((a, b) => (avg(a[1]) ?? 99) - (avg(b[1]) ?? 99));
                if (entries2.length === 0) return null;
                const bestAvg = Math.min(...entries2.map(([, rs]) => avg(rs) ?? 99));
                return (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1.5">{icon}{title}</p>
                    <div className="flex flex-col gap-1">
                      {entries2.map(([label, ranks]) => {
                        const a = avg(ranks);
                        const isBest = a !== null && Math.abs(a - bestAvg) < 0.01;
                        return (
                          <div key={label} className="flex items-center gap-2 text-xs">
                            <span className="w-28 shrink-0 text-muted-foreground truncate">{label}</span>
                            <div className="flex-1 h-4 bg-muted/40 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", isBest ? color.dot : "bg-muted-foreground/30")}
                                style={{ width: a !== null ? `${Math.max(5, 100 - (a - 1) * 12)}%` : "0%" }}
                              />
                            </div>
                            <span className={cn("w-12 text-right tabular-nums font-medium shrink-0", isBest ? color.text : "text-muted-foreground")}>
                              {a !== null ? `${a.toFixed(1)}` : "—"}
                            </span>
                            <span className="text-muted-foreground shrink-0">({ranks.length})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <Card key={s.profile.id} className="fs-card rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={cn("w-3 h-3 rounded-full shrink-0", color.dot)} />
                    <h2 className={cn("font-semibold text-base", color.text)}>{s.profile.name}</h2>
                    <span className="text-xs text-muted-foreground">{s.profile.grindType} · {s.entryCount} entries · avg rank {fmt1(s.avgRank)}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {renderCondGroup("Snøtype", <Snowflake className="h-3 w-3" />, cond.bySnowType)}
                    {renderCondGroup("Snøtemperatur", <Thermometer className="h-3 w-3" />, cond.bySnowTemp, TEMP_BUCKET_ORDER)}
                    {renderCondGroup("Sporhardhet", <Wind className="h-3 w-3" />, cond.byTrack)}
                  </div>
                  {cond.bySnowType.size === 0 && cond.bySnowTemp.size === 0 && cond.byTrack.size === 0 && (
                    <p className="text-sm text-muted-foreground">Ikke nok rankdata med værdata knyttet til testene.</p>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}
    </div>
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

  // Available columns: only include stone/pattern if at least one entry has a value
  const hasGrindProfileIds = sortedEntries.some((e) => e.grindProfileId != null);
  const hasStone = sortedEntries.some((e) => e.grindStone);
  const hasPattern = sortedEntries.some((e) => e.grindPattern);
  const allGrindCols = useMemo(
    () => [
      "name",
      ...(hasGrindProfileIds ? ["grindProfileId"] : []),
      ...(hasStone ? ["grindStone"] : []),
      ...(hasPattern ? ["grindPattern"] : []),
      ...extraParamKeys,
    ],
    [extraParamKeys, hasGrindProfileIds, hasStone, hasPattern]
  );

  const colLabels: Record<string, string> = {
    name: "Grind name",
    grindProfileId: "Grind-ID",
    grindStone: "Stone",
    grindPattern: "Pattern",
    ra_value: "RA-Value",
  };

  // For column labels: use colLabels for known internal keys, otherwise show key exactly as stored
  function grindColLabel(col: string): string {
    return colLabels[col] ?? col;
  }

  const [visibleGrindCols, setVisibleGrindCols] = useState<string[]>(["name"]);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState(test.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const { toast } = useToast();

  async function saveNotes() {
    setNotesSaving(true);
    try {
      // PUT /api/tests/:id requires all core fields — send them from the existing test object
      await apiRequest("PUT", `/api/tests/${test.id}`, {
        date: test.date,
        location: test.location,
        testType: test.testType,
        seriesId: test.seriesId,
        weatherId: test.weatherId ?? null,
        grindParameters: test.grindParameters ?? null,
        startTime: test.startTime ?? null,
        notes: notesVal.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      setEditingNotes(false);
    } catch {
      toast({ title: "Error", description: "Could not save notes", variant: "destructive" });
    } finally {
      setNotesSaving(false);
    }
  }

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
            <span className="inline-flex items-center gap-1 rounded-full fs-gradient-emerald px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/10">
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
      {/* Notes — always visible, editable */}
      <div className="mt-3 border-t border-border/30 pt-3">
        {editingNotes ? (
          <div className="space-y-1.5">
            <Textarea
              value={notesVal}
              onChange={e => setNotesVal(e.target.value)}
              placeholder="Add notes for this grind test..."
              rows={2}
              className="text-xs resize-none"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              <Button size="sm" className="h-6 px-2 text-xs" onClick={saveNotes} disabled={notesSaving}>
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setEditingNotes(false); setNotesVal(test.notes ?? ""); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 group">
            <div className="flex-1">
              {test.notes ? (
                <p className="text-xs text-muted-foreground italic">{test.notes}</p>
              ) : (
                <p className="text-xs text-muted-foreground/50 italic">No notes</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditingNotes(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              title="Edit notes"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
