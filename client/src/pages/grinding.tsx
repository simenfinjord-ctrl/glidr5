import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2, Disc3, FileSpreadsheet, ExternalLink, Trophy, Filter, MapPin, Thermometer, CalendarDays, Copy, Search, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

type Test = {
  id: number;
  date: string;
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
};
type Weather = {
  id: number;
  date: string;
  location: string;
  airTemperatureC: number;
  snowTemperatureC: number;
};

type GrindingSheet = {
  id: number;
  name: string;
  url: string;
  createdAt: string;
  createdById: number;
  createdByName: string;
  groupScope: string;
};

type GrindProfile = {
  id: number;
  name: string;
  grindType: string;
  stone: string;
  pattern: string;
  extraParams: string | null;
  createdByName: string;
  teamId: number;
  createdAt: string;
};

type RoundResult = { result: number | null; rank: number | null };

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

// ─── Sheet form ────────────────────────────────────────────────────────────────

const sheetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
});

function toEmbedUrl(url: string): string {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) {
    const gidMatch = url.match(/gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:html&gid=${gid}`;
  }
  if (url.includes("docs.google.com")) {
    return url.replace(/\/edit.*$/, "/gviz/tq?tqx=out:html");
  }
  return url;
}

function SheetForm({ onDone, editSheet }: { onDone: () => void; editSheet?: GrindingSheet }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof sheetSchema>>({
    resolver: zodResolver(sheetSchema),
    defaultValues: editSheet ? { name: editSheet.name, url: editSheet.url } : { name: "", url: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof sheetSchema>) => {
      if (editSheet) {
        const res = await apiRequest("PUT", `/api/grinding-sheets/${editSheet.id}`, data);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/grinding-sheets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grinding-sheets"] });
      toast({ title: editSheet ? "Sheet updated" : "Sheet added" });
      onDone();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Sheet Name</FormLabel><FormControl><Input {...field} placeholder="e.g. Season 2025/2026 Grinds" data-testid="input-sheet-name" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="url" render={({ field }) => (
          <FormItem>
            <FormLabel>Google Sheets URL</FormLabel>
            <FormControl><Input {...field} placeholder="https://docs.google.com/spreadsheets/d/..." data-testid="input-sheet-url" /></FormControl>
            <p className="text-xs text-muted-foreground mt-1">Paste the full URL from Google Sheets. Make sure the sheet is shared (anyone with the link can view).</p>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex justify-end">
          <Button type="submit" data-testid="button-save-sheet" disabled={mutation.isPending}>
            {editSheet ? "Save" : "Add Sheet"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Grind Profile form ────────────────────────────────────────────────────────

type ExtraParam = { key: string; value: string };

const GRIND_TYPE_OPTIONS = ["B-skate", "Classic", "Double", "Universal", "Wet", "Dry", "Custom"];

type GrindProfileFormValues = {
  name: string;
  grindType: string;
  stone: string;
  pattern: string;
};

function GrindProfileForm({
  onDone,
  editProfile,
}: {
  onDone: () => void;
  editProfile?: GrindProfile;
}) {
  const { toast } = useToast();

  const initExtra = (): ExtraParam[] => {
    const parsed = parseExtraParams(editProfile?.extraParams ?? null);
    return Object.entries(parsed).map(([key, value]) => ({ key, value }));
  };

  const [extraParams, setExtraParams] = useState<ExtraParam[]>(initExtra);
  const [customGrindType, setCustomGrindType] = useState(
    editProfile && !GRIND_TYPE_OPTIONS.includes(editProfile.grindType) ? editProfile.grindType : ""
  );

  const grindProfileSchema = z.object({
    name: z.string().min(1, "Name is required"),
    grindType: z.string().min(1, "Grind type is required"),
    stone: z.string().min(1, "Stone is required"),
    pattern: z.string().min(1, "Pattern is required"),
  });

  const form = useForm<GrindProfileFormValues>({
    resolver: zodResolver(grindProfileSchema),
    defaultValues: {
      name: editProfile?.name ?? "",
      grindType: editProfile?.grindType ?? "",
      stone: editProfile?.stone ?? "",
      pattern: editProfile?.pattern ?? "",
    },
  });

  const selectedGrindType = form.watch("grindType");
  const isCustom = selectedGrindType === "Custom";

  // Extra params are valid when all rows have non-empty key and value
  const extraParamsValid = extraParams.every((p) => p.key.trim() !== "" && p.value.trim() !== "");

  const addExtraParam = () => setExtraParams((prev) => [...prev, { key: "", value: "" }]);
  const removeExtraParam = (idx: number) => setExtraParams((prev) => prev.filter((_, i) => i !== idx));
  const updateExtraParam = (idx: number, field: "key" | "value", val: string) => {
    setExtraParams((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  };

  const mutation = useMutation({
    mutationFn: async (data: GrindProfileFormValues) => {
      const grindType = isCustom ? customGrindType.trim() : data.grindType;
      const extraObj: Record<string, string> = {};
      for (const p of extraParams) {
        if (p.key.trim()) extraObj[p.key.trim()] = p.value.trim();
      }
      const payload = {
        name: data.name,
        grindType,
        stone: data.stone,
        pattern: data.pattern,
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

  const canSave =
    form.formState.isValid &&
    (!isCustom || customGrindType.trim() !== "") &&
    extraParamsValid &&
    !mutation.isPending;

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
                <Input {...field} placeholder="e.g. B-skate heavy, Classic warm" data-testid="input-grind-profile-name" />
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
              {isCustom && (
                <Input
                  className="mt-2"
                  value={customGrindType}
                  onChange={(e) => setCustomGrindType(e.target.value)}
                  placeholder="Enter custom grind type…"
                  data-testid="input-grind-profile-custom-type"
                />
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="stone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stone</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. #80 diamond, Ceramic fine" data-testid="input-grind-profile-stone" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pattern"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pattern</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Cross 45°, Rilling 0.5mm" data-testid="input-grind-profile-pattern" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Extra parameters */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Extra Parameters</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addExtraParam}
              data-testid="button-add-extra-param"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add parameter
            </Button>
          </div>
          {extraParams.length === 0 && (
            <p className="text-xs text-muted-foreground">No extra parameters. Click "Add parameter" to add custom fields.</p>
          )}
          {extraParams.map((param, idx) => (
            <div key={idx} className="flex items-center gap-2" data-testid={`extra-param-row-${idx}`}>
              <Input
                value={param.key}
                onChange={(e) => updateExtraParam(idx, "key", e.target.value)}
                placeholder="Key"
                className="flex-1"
                data-testid={`input-extra-param-key-${idx}`}
              />
              <Input
                value={param.value}
                onChange={(e) => updateExtraParam(idx, "value", e.target.value)}
                placeholder="Value"
                className="flex-1"
                data-testid={`input-extra-param-value-${idx}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeExtraParam(idx)}
                data-testid={`button-remove-extra-param-${idx}`}
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {extraParams.length > 0 && !extraParamsValid && (
            <p className="text-xs text-destructive">All extra parameter keys and values must be filled in.</p>
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

function GrindProfileCard({
  profile,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  profile: GrindProfile;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const extra = parseExtraParams(profile.extraParams);
  const extraEntries = Object.entries(extra);

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-5" data-testid={`card-grind-profile-${profile.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="text-base font-semibold text-foreground truncate" data-testid={`text-grind-profile-name-${profile.id}`}>
            {profile.name}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
              {profile.grindType}
            </span>
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {profile.stone}
            </span>
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {profile.pattern}
            </span>
            {extraEntries.map(([k, v]) => (
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

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Grinding() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"tests" | "sheets" | "grinds">("tests");
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false);
  const [editSheet, setEditSheet] = useState<GrindingSheet | undefined>();
  const [activeSheetId, setActiveSheetId] = useState<string>("");

  const [filterSeason, setFilterSeason] = useState<string>("All");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Grind profiles state
  const [grindSearch, setGrindSearch] = useState("");
  const [grindDialogOpen, setGrindDialogOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<GrindProfile | undefined>();

  const { data: allTests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: sheets = [] } = useQuery<GrindingSheet[]>({ queryKey: ["/api/grinding-sheets"] });
  const { data: grindProfiles = [] } = useQuery<GrindProfile[]>({ queryKey: ["/api/grind-profiles"] });

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

  useEffect(() => {
    if (sheets.length > 0 && !activeSheetId) {
      setActiveSheetId(String(sheets[0].id));
    }
    if (activeSheetId && !sheets.find((s) => String(s.id) === activeSheetId)) {
      setActiveSheetId(sheets.length > 0 ? String(sheets[0].id) : "");
    }
  }, [sheets, activeSheetId]);

  const deleteSheetMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/grinding-sheets/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/grinding-sheets"] });
      toast({ title: "Sheet removed" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
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
  const activeSheet = sheets.find((s) => String(s.id) === activeSheetId) || (sheets.length > 0 ? sheets[0] : null);

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
    return grindTests.filter((t) => {
      if (filterSeason !== "All" && getSeason(t.date) !== filterSeason) return false;
      if (filterLocation && !t.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
      if (filterDate && t.date !== filterDate) return false;
      return true;
    });
  }, [grindTests, filterSeason, filterLocation, filterDate]);

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

  const hasFilters = filterSeason !== "All" || filterLocation || filterDate;
  const isDayView = !!filterDate;

  function getTabSubtitle() {
    if (tab === "tests") return `${filtered.length} grind test${filtered.length !== 1 ? "s" : ""}${hasFilters ? " matching filters" : " total"}`;
    if (tab === "sheets") return "Embedded grinding spreadsheets";
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
            {tab === "sheets" && (
              <Dialog open={sheetDialogOpen} onOpenChange={setSheetDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-sheet" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Spreadsheet
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader><DialogTitle>Add Google Spreadsheet</DialogTitle></DialogHeader>
                  <SheetForm onDone={() => setSheetDialogOpen(false)} />
                </DialogContent>
              </Dialog>
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
            onClick={() => setTab("sheets")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "sheets" ? "border-emerald-600 text-emerald-600" : "border-transparent text-muted-foreground hover:text-foreground/80"}`}
            data-testid="tab-grinding-sheets"
          >
            <FileSpreadsheet className="inline-block mr-1.5 h-4 w-4" />
            Spreadsheets
            {sheets.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">{sheets.length}</span>
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
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {isDayView ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-semibold">Day view: {filterDate}</h2>
                  <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">{filtered.length} test{filtered.length !== 1 ? "s" : ""}</span>
                </div>
                {filtered.length === 0 ? (
                  <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-grind-day">
                    No grind tests on this date.
                  </Card>
                ) : (
                  filtered.map((t) => <GrindTestCard key={t.id} test={t} entries={allEntries.filter((e) => e.testId === t.id)} seriesById={seriesById} weatherById={weatherById} />)
                )}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="fs-card rounded-2xl p-8 text-center">
                <Disc3 className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <div className="text-sm text-muted-foreground">
                  {hasFilters ? "No grind tests match your filters." : "No grind tests yet. Create your first one above."}
                </div>
              </Card>
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
                            <span className="text-sm text-muted-foreground">{t.date}</span>
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

        {/* Sheets tab */}
        {tab === "sheets" && (
          <div className="flex flex-col gap-4">
            {sheets.length === 0 ? (
              <Card className="fs-card rounded-2xl p-8 text-center">
                <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <div className="text-sm text-muted-foreground">No spreadsheets added yet. Click "Add Spreadsheet" to link a Google Sheet.</div>
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[250px] flex-1 max-w-md">
                    <Select value={activeSheet ? String(activeSheet.id) : ""} onValueChange={setActiveSheetId}>
                      <SelectTrigger data-testid="select-active-sheet">
                        <SelectValue placeholder="Select spreadsheet..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sheets.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {activeSheet && (
                    <div className="flex items-center gap-1">
                      <a
                        href={activeSheet.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                        data-testid="link-open-sheet"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open in Google Sheets
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid="button-edit-active-sheet"
                        onClick={() => { setEditSheet(activeSheet); setSheetDialogOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid="button-delete-active-sheet"
                        onClick={() => {
                          if (confirm(`Remove "${activeSheet.name}" from this list?`)) {
                            deleteSheetMutation.mutate(activeSheet.id);
                            setActiveSheetId("");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                {activeSheet && (
                  <Card className="fs-card rounded-2xl overflow-hidden">
                    <iframe
                      src={toEmbedUrl(activeSheet.url)}
                      className="w-full border-0"
                      style={{ height: "70vh", minHeight: "500px" }}
                      title={activeSheet.name}
                      data-testid="iframe-sheet"
                      sandbox="allow-scripts allow-same-origin allow-popups"
                    />
                  </Card>
                )}

                <Card className="fs-card rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-foreground/80 mb-3">All Spreadsheets</h3>
                  <div className="space-y-2">
                    {sheets.map((s) => (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${String(s.id) === (activeSheet ? String(activeSheet.id) : "") ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-muted/50 hover:bg-muted"}`}
                        onClick={() => setActiveSheetId(String(s.id))}
                        data-testid={`sheet-item-${s.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className={`h-4 w-4 ${String(s.id) === (activeSheet ? String(activeSheet.id) : "") ? "text-emerald-600" : "text-muted-foreground"}`} />
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-muted-foreground">by {s.createdByName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditSheet(s); setSheetDialogOpen(true); }} data-testid={`button-edit-sheet-${s.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); if (confirm(`Remove "${s.name}"?`)) deleteSheetMutation.mutate(s.id); }} data-testid={`button-delete-sheet-${s.id}`}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Grinds tab */}
        {tab === "grinds" && (
          <div className="flex flex-col gap-4">
            {/* Search bar */}
            <div className="relative max-w-sm">
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
            ) : (
              <div className="flex flex-col gap-3">
                {filteredProfiles.map((profile) => (
                  <GrindProfileCard
                    key={profile.id}
                    profile={profile}
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

        {/* Sheet edit dialog */}
        <Dialog open={!!editSheet} onOpenChange={(v) => { if (!v) setEditSheet(undefined); }}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader><DialogTitle>{editSheet ? "Edit Spreadsheet" : "Add Google Spreadsheet"}</DialogTitle></DialogHeader>
            {editSheet && <SheetForm onDone={() => { setEditSheet(undefined); setSheetDialogOpen(false); }} editSheet={editSheet} />}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function GrindTestCard({ test, entries, seriesById, weatherById }: {
  test: Test;
  entries: TestEntry[];
  seriesById: Map<number, string>;
  weatherById: Map<number, Weather>;
}) {
  const distLabels = getDistanceLabels(test);
  const sortedEntries = [...entries].sort((a, b) => a.skiNumber - b.skiNumber);
  const w = test.weatherId ? weatherById.get(test.weatherId) : null;
  const gp = parseGrindParams(test.grindParameters);

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-5" data-testid={`card-grind-day-test-${test.id}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <AppLink href={`/tests/${test.id}`} testId={`link-grind-test-${test.id}`}>
            <span className="text-base font-semibold hover:text-indigo-600 transition-colors cursor-pointer">
              {test.location}
            </span>
          </AppLink>
          <span className="text-xs text-muted-foreground">{seriesById.get(test.seriesId) ?? ""}</span>
          {gp.grindType && (
            <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-indigo-200">
              {gp.grindType}
            </span>
          )}
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
        </div>
        <span className="text-xs text-muted-foreground">{sortedEntries.length} entries</span>
      </div>

      {sortedEntries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid={`table-grind-day-${test.id}`}>
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-3">Ski</th>
                {distLabels.map((label, i) => (
                  <th key={i} className="pb-2 pr-3">
                    {label} <span className="text-[9px]">(cm)</span> / Rank
                  </th>
                ))}
                <th className="pb-2 pr-3">Feel</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry) => {
                const rounds = getEntryRounds(entry, distLabels.length);
                return (
                  <tr key={entry.id} className="border-b border-border/20" data-testid={`row-grind-entry-${entry.id}`}>
                    <td className="py-1.5 pr-3 font-medium text-xs">{entry.skiNumber}</td>
                    {rounds.map((r, i) => (
                      <td key={i} className="py-1.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs tabular-nums">{r.result ?? "—"}</span>
                          <RankBadge rank={r.rank} />
                        </div>
                      </td>
                    ))}
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
