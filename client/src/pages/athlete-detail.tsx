import React, { useState, useMemo, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Users,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  X,
  MapPin,
  Calendar,
  Settings2,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Athlete = {
  id: number;
  name: string;
  team: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
};

type RaceSki = {
  id: number;
  athleteId: number;
  serialNumber: string | null;
  skiId: string;
  brand: string | null;
  discipline: string;
  construction: string | null;
  mold: string | null;
  base: string | null;
  grind: string | null;
  heights: string | null;
  year: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
};

type RaceSkiRegrind = {
  id: number;
  raceSkiId: number;
  date: string;
  grindType: string;
  stone: string | null;
  pattern: string | null;
  notes: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
};

type RaceSkiTest = {
  id: number;
  date: string;
  location: string;
  testType: string;
  testSkiSource: string;
  seriesId: number | null;
  athleteId: number | null;
  notes: string | null;
  distanceLabels: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
};

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
  raceSkiId: number | null;
  createdAt: string;
};

type RaceSkiTestRow = {
  id: string;
  raceSkiId: number;
  skiId: string;
  brand: string | null;
  base: string | null;
  construction: string | null;
  mold: string | null;
  grind: string | null;
  heights: string | null;
  serialNumber: string | null;
  year: string | null;
  roundResults: { result: number | null; rank: number | null }[];
  feelingRank: number | null;
  kickRank: number | null;
};

type WeatherItem = {
  id: number;
  date: string;
  time: string;
  location: string;
  snowTemperatureC: number | null;
  airTemperatureC: number | null;
  snowHumidityPct: number | null;
  airHumidityPct: number | null;
  groupScope: string;
};

type AthleteAccess = {
  id: number;
  athleteId: number;
  userId: number;
};

type UserItem = {
  id: number;
  name: string;
  email: string;
};

export default function AthleteDetail() {
  const [, params] = useRoute("/raceskis/:id");
  const [, navigate] = useLocation();
  const athleteId = params?.id ? parseInt(params.id) : null;
  const { user, can } = useAuth();
  const { toast } = useToast();

  const [skiDialogOpen, setSkiDialogOpen] = useState(false);
  const [editingSki, setEditingSki] = useState<RaceSki | null>(null);
  const [regrindDialogOpen, setRegrindDialogOpen] = useState(false);
  const [regrindSkiId, setRegrindSkiId] = useState<number | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [editAthleteOpen, setEditAthleteOpen] = useState(false);
  const [expandedSkiId, setExpandedSkiId] = useState<number | null>(null);

  const [testsExpanded, setTestsExpanded] = useState(true);
  const [showTestForm, setShowTestForm] = useState(false);
  const [testForm, setTestForm] = useState({
    date: new Date().toISOString().split("T")[0],
    location: "",
    testType: "Classic" as "Classic" | "Skating",
    notes: "",
    weatherId: undefined as number | undefined,
  });
  const [selectedSkiIds, setSelectedSkiIds] = useState<Set<number>>(new Set());
  const [testRows, setTestRows] = useState<RaceSkiTestRow[]>([]);
  const [distanceLabels, setDistanceLabels] = useState<string[]>([""]);

  const allSkiParams = [
    { key: "brand", label: "Brand" },
    { key: "base", label: "Base" },
    { key: "grind", label: "Grind" },
    { key: "heights", label: "Heights" },
    { key: "construction", label: "Construction" },
    { key: "mold", label: "Mold" },
    { key: "serialNumber", label: "Serial" },
    { key: "year", label: "Year" },
  ] as const;
  type SkiParamKey = typeof allSkiParams[number]["key"];
  const defaultParams: SkiParamKey[] = ["brand", "base", "grind", "heights"];
  const [activeParams, setActiveParams] = useState<SkiParamKey[]>(() => {
    try {
      const stored = localStorage.getItem("glidr-raceski-params");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultParams;
  });
  const [editParamsOpen, setEditParamsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("glidr-raceski-params", JSON.stringify(activeParams));
  }, [activeParams]);

  const inactiveParams = allSkiParams.filter((p) => !activeParams.includes(p.key));

  const moveParamUp = (idx: number) => {
    if (idx <= 0) return;
    const next = [...activeParams];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setActiveParams(next);
  };
  const moveParamDown = (idx: number) => {
    if (idx >= activeParams.length - 1) return;
    const next = [...activeParams];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setActiveParams(next);
  };
  const removeParam = (key: SkiParamKey) => {
    setActiveParams(activeParams.filter((k) => k !== key));
  };
  const addParam = (key: SkiParamKey) => {
    setActiveParams([...activeParams, key]);
  };

  const getParamLabel = (key: SkiParamKey) =>
    allSkiParams.find((p) => p.key === key)?.label ?? key;

  const [skiForm, setSkiForm] = useState({
    skiId: "",
    serialNumber: "",
    brand: "",
    discipline: "Classic",
    construction: "",
    mold: "",
    base: "",
    grind: "",
    heights: "",
    year: "",
  });

  const allSkiFormFields = [
    { key: "serialNumber", label: "Serial Number" },
    { key: "brand", label: "Brand" },
    { key: "discipline", label: "Discipline" },
    { key: "construction", label: "Construction" },
    { key: "mold", label: "Mold" },
    { key: "base", label: "Base" },
    { key: "grind", label: "Grind" },
    { key: "heights", label: "Heights" },
    { key: "year", label: "Year" },
  ] as const;
  type SkiFormFieldKey = typeof allSkiFormFields[number]["key"];
  const defaultFormFields: SkiFormFieldKey[] = ["serialNumber", "brand", "discipline", "construction", "mold", "base", "grind", "heights", "year"];
  const [activeFormFields, setActiveFormFields] = useState<SkiFormFieldKey[]>(() => {
    try {
      const stored = localStorage.getItem("glidr-raceski-form-fields");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultFormFields;
  });
  const [editFormFieldsOpen, setEditFormFieldsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("glidr-raceski-form-fields", JSON.stringify(activeFormFields));
  }, [activeFormFields]);

  const inactiveFormFields = allSkiFormFields.filter((f) => !activeFormFields.includes(f.key));
  const getFormFieldLabel = (key: SkiFormFieldKey) =>
    allSkiFormFields.find((f) => f.key === key)?.label ?? key;
  const moveFormFieldUp = (idx: number) => {
    if (idx <= 0) return;
    const next = [...activeFormFields];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setActiveFormFields(next);
  };
  const moveFormFieldDown = (idx: number) => {
    if (idx >= activeFormFields.length - 1) return;
    const next = [...activeFormFields];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setActiveFormFields(next);
  };
  const removeFormField = (key: SkiFormFieldKey) => {
    setActiveFormFields(activeFormFields.filter((k) => k !== key));
  };
  const addFormField = (key: SkiFormFieldKey) => {
    setActiveFormFields([...activeFormFields, key]);
  };

  const [regrindForm, setRegrindForm] = useState({
    date: new Date().toISOString().split("T")[0],
    grindType: "",
    stone: "",
    pattern: "",
    notes: "",
  });

  const [athleteForm, setAthleteForm] = useState({ name: "", team: "" });
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ["/api/athletes"],
  });
  const athlete = athletes.find((a) => a.id === athleteId);

  const { data: skis = [] } = useQuery<RaceSki[]>({
    queryKey: [`/api/athletes/${athleteId}/skis`],
    enabled: !!athleteId,
  });

  const { data: access = [] } = useQuery<AthleteAccess[]>({
    queryKey: [`/api/athletes/${athleteId}/access`],
    enabled: !!athleteId,
  });

  const { data: users = [] } = useQuery<UserItem[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  const { data: weather = [] } = useQuery<WeatherItem[]>({
    queryKey: ["/api/weather"],
  });

  const { data: allTests = [] } = useQuery<RaceSkiTest[]>({
    queryKey: ["/api/tests"],
    enabled: !!athleteId,
  });

  const skiIds = useMemo(() => new Set(skis.map((s) => s.id)), [skis]);

  const raceSkiTests = useMemo(() => {
    return allTests.filter((t) => t.testSkiSource === "raceskis" && t.athleteId === Number(athleteId));
  }, [allTests, athleteId]);

  const isOwnerOrAdmin =
    user?.isAdmin || (athlete && user?.id === athlete.createdById);

  const createSkiMutation = useMutation({
    mutationFn: async (data: typeof skiForm) => {
      const body = {
        skiId: data.skiId,
        serialNumber: data.serialNumber.trim() || null,
        brand: data.brand.trim() || null,
        discipline: data.discipline,
        construction: data.construction.trim() || null,
        mold: data.mold.trim() || null,
        base: data.base.trim() || null,
        grind: data.grind.trim() || null,
        heights: data.discipline === "Classic" ? data.heights.trim() || null : null,
        year: data.year.trim() || null,
      };
      const res = await apiRequest("POST", `/api/athletes/${athleteId}/skis`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: "Ski added" });
      setSkiDialogOpen(false);
      resetSkiForm();
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateSkiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof skiForm }) => {
      const body = {
        skiId: data.skiId,
        serialNumber: data.serialNumber.trim() || null,
        brand: data.brand.trim() || null,
        discipline: data.discipline,
        construction: data.construction.trim() || null,
        mold: data.mold.trim() || null,
        base: data.base.trim() || null,
        grind: data.grind.trim() || null,
        heights: data.discipline === "Classic" ? data.heights.trim() || null : null,
        year: data.year.trim() || null,
      };
      const res = await apiRequest("PUT", `/api/race-skis/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: "Ski updated" });
      setSkiDialogOpen(false);
      setEditingSki(null);
      resetSkiForm();
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteSkiMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/race-skis/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: "Ski deleted" });
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const createRegrindMutation = useMutation({
    mutationFn: async ({ skiId, data }: { skiId: number; data: typeof regrindForm }) => {
      const body = {
        date: data.date,
        grindType: data.grindType,
        stone: data.stone.trim() || null,
        pattern: data.pattern.trim() || null,
        notes: data.notes.trim() || null,
      };
      const res = await apiRequest("POST", `/api/race-skis/${skiId}/regrinds`, body);
      return res.json();
    },
    onSuccess: () => {
      if (regrindSkiId) {
        queryClient.invalidateQueries({ queryKey: [`/api/race-skis/${regrindSkiId}/regrinds`] });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: "Regrind added" });
      setRegrindDialogOpen(false);
      resetRegrindForm();
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteRegrindMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/race-ski-regrinds/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/race-skis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      if (expandedSkiId) {
        queryClient.invalidateQueries({ queryKey: [`/api/race-skis/${expandedSkiId}/regrinds`] });
      }
      toast({ title: "Regrind deleted" });
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateAccessMutation = useMutation({
    mutationFn: async (userIds: number[]) => {
      const res = await apiRequest("PUT", `/api/athletes/${athleteId}/access`, { userIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/access`] });
      toast({ title: "Access updated" });
      setAccessDialogOpen(false);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateAthleteMutation = useMutation({
    mutationFn: async (data: { name: string; team: string }) => {
      const res = await apiRequest("PUT", `/api/athletes/${athleteId}`, {
        name: data.name,
        team: data.team.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/athletes"] });
      toast({ title: "Athlete updated" });
      setEditAthleteOpen(false);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteAthleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/athletes/${athleteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/athletes"] });
      toast({ title: "Athlete deleted" });
      navigate("/raceskis");
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const createTestMutation = useMutation({
    mutationFn: async () => {
      const entries = testRows.map((row, idx) => ({
        skiNumber: idx + 1,
        raceSkiId: row.raceSkiId,
        productId: null,
        methodology: "",
        result0kmCmBehind: row.roundResults[0]?.result ?? null,
        rank0km: row.roundResults[0]?.rank ?? null,
        results: JSON.stringify(row.roundResults),
        feelingRank: row.feelingRank ?? null,
        kickRank: row.kickRank ?? null,
      }));
      const groupScope = user?.groupScope?.split(",")[0]?.trim() || "";
      const payload = {
        date: testForm.date,
        location: testForm.location.trim(),
        testType: testForm.testType,
        testSkiSource: "raceskis",
        seriesId: null,
        athleteId: Number(athleteId),
        weatherId: resolvedWeatherId || null,
        notes: testForm.notes.trim() || null,
        distanceLabels: JSON.stringify(distanceLabels),
        groupScope,
        entries,
      };
      const res = await apiRequest("POST", "/api/tests", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      toast({ title: "Test saved" });
      setShowTestForm(false);
      setTestForm({ date: new Date().toISOString().split("T")[0], location: "", testType: "Classic" as any, notes: "", weatherId: undefined });
      setSelectedSkiIds(new Set());
      setDistanceLabels([""]);
      setTestRows([]);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  function resetSkiForm() {
    setSkiForm({ skiId: "", serialNumber: "", brand: "", discipline: "Classic", construction: "", mold: "", base: "", grind: "", heights: "", year: "" });
  }

  function resetRegrindForm() {
    setRegrindForm({ date: new Date().toISOString().split("T")[0], grindType: "", stone: "", pattern: "", notes: "" });
  }

  function openEditSki(ski: RaceSki) {
    setEditingSki(ski);
    setSkiForm({
      skiId: ski.skiId,
      serialNumber: ski.serialNumber || "",
      brand: ski.brand || "",
      discipline: ski.discipline,
      construction: ski.construction || "",
      mold: ski.mold || "",
      base: ski.base || "",
      grind: ski.grind || "",
      heights: ski.heights || "",
      year: ski.year || "",
    });
    setSkiDialogOpen(true);
  }

  function openAddSki() {
    setEditingSki(null);
    resetSkiForm();
    setSkiDialogOpen(true);
  }

  function openRegrind(skiId: number) {
    setRegrindSkiId(skiId);
    resetRegrindForm();
    setRegrindDialogOpen(true);
  }

  function openAccessDialog() {
    setSelectedUserIds(access.map((a) => a.userId));
    setAccessDialogOpen(true);
  }

  function openEditAthlete() {
    if (athlete) {
      setAthleteForm({ name: athlete.name, team: athlete.team || "" });
      setEditAthleteOpen(true);
    }
  }

  const roundRanks = useMemo(() => {
    return distanceLabels.map((_, roundIdx) => {
      const vals = testRows
        .filter((r) => r.roundResults[roundIdx]?.result != null)
        .map((r) => ({ rowId: r.id, v: r.roundResults[roundIdx]!.result as number }));
      const sorted = [...vals].sort((a, b) => a.v - b.v);
      const ranks = new Map<string, number>();
      let prev: number | null = null;
      let currentRank = 1;
      for (let i = 0; i < sorted.length; i++) {
        if (prev !== null && sorted[i].v !== prev) currentRank = i + 1;
        ranks.set(sorted[i].rowId, currentRank);
        prev = sorted[i].v;
      }
      return ranks;
    });
  }, [testRows, distanceLabels.length]);

  useEffect(() => {
    let changed = false;
    const next = testRows.map((r) => {
      const newRoundResults = r.roundResults.map((rr, roundIdx) => {
        const newRank = rr.result === null ? null : (roundRanks[roundIdx]?.get(r.id) ?? null);
        if (newRank !== rr.rank) changed = true;
        return { ...rr, rank: newRank };
      });
      return { ...r, roundResults: newRoundResults };
    });
    if (changed) setTestRows(next);
  }, [roundRanks]);

  const autoWeather = useMemo(() => {
    if (!testForm.date || !testForm.location) return undefined;
    return weather.find(
      (w) =>
        w.date === testForm.date &&
        w.location.toLowerCase() === testForm.location.trim().toLowerCase(),
    );
  }, [weather, testForm.date, testForm.location]);

  const resolvedWeatherId = testForm.weatherId ?? autoWeather?.id ?? undefined;

  function toggleSkiSelection(skiId: number) {
    setSelectedSkiIds((prev) => {
      const next = new Set(prev);
      if (next.has(skiId)) {
        next.delete(skiId);
        setTestRows((rows) => rows.filter((r) => r.raceSkiId !== skiId));
      } else {
        next.add(skiId);
        const ski = skis.find((s) => s.id === skiId);
        if (ski) {
          setTestRows((rows) => [
            ...rows,
            {
              id: `rsk_${ski.id}_${Math.random().toString(16).slice(2)}`,
              raceSkiId: ski.id,
              skiId: ski.skiId,
              brand: ski.brand,
              base: ski.base,
              construction: ski.construction,
              mold: ski.mold,
              grind: ski.grind,
              heights: ski.heights,
              serialNumber: ski.serialNumber,
              year: ski.year,
              roundResults: distanceLabels.map(() => ({ result: null, rank: null })),
              feelingRank: null,
              kickRank: null,
            },
          ]);
        }
      }
      return next;
    });
  }

  function openNewTest() {
    setTestForm({ date: new Date().toISOString().split("T")[0], location: "", testType: "Classic", notes: "", weatherId: undefined });
    setDistanceLabels([""]);
    setSelectedSkiIds(new Set());
    setTestRows([]);
    setShowTestForm(true);
  }

  function handleSkiSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!skiForm.skiId.trim()) return;
    if (editingSki) {
      updateSkiMutation.mutate({ id: editingSki.id, data: skiForm });
    } else {
      createSkiMutation.mutate(skiForm);
    }
  }

  function handleRegrindSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!regrindForm.grindType.trim() || !regrindSkiId) return;
    createRegrindMutation.mutate({ skiId: regrindSkiId, data: regrindForm });
  }

  function handleAthleteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!athleteForm.name.trim()) return;
    updateAthleteMutation.mutate(athleteForm);
  }

  if (!athlete) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-20" data-testid="not-found-athlete">
          <p className="text-muted-foreground">Athlete not found.</p>
          <AppLink href="/raceskis">
            <Button variant="secondary" data-testid="button-back-raceskis">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </AppLink>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        {/* Back button */}
        <div>
          <AppLink href="/raceskis" testId="link-back-raceskis">
            <Button variant="ghost" size="sm" data-testid="button-back-raceskis">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </AppLink>
        </div>

        {/* Athlete header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl" data-testid="text-athlete-name">
              {athlete.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {athlete.team && (
                <span
                  className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800"
                  data-testid="text-athlete-team"
                >
                  <Users className="mr-1 h-3 w-3" />
                  {athlete.team}
                </span>
              )}
              <span className="text-xs text-muted-foreground" data-testid="text-athlete-created-by">
                {athlete.createdByName}
              </span>
            </div>
          </div>

          {isOwnerOrAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="button-edit-athlete"
                onClick={openEditAthlete}
              >
                <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-delete-athlete"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => {
                  if (confirm("Delete this athlete and all their skis?")) {
                    deleteAthleteMutation.mutate();
                  }
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          )}
        </div>

        {/* Access management */}
        {isOwnerOrAdmin && (
          <Card className="fs-card rounded-2xl p-4" data-testid="card-access-management">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Access</h2>
                <p className="mt-0.5 text-xs text-muted-foreground" data-testid="text-shared-with">
                  Shared with: {access.length > 0
                    ? access.map((a) => {
                        const u = users.find((u) => u.id === a.userId);
                        return u?.name || `User #${a.userId}`;
                      }).join(", ")
                    : "—"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-manage-access"
                onClick={openAccessDialog}
              >
                <Users className="mr-1.5 h-3.5 w-3.5" />
                Manage Access
              </Button>
            </div>
          </Card>
        )}

        {/* Race Skis */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold" data-testid="text-skis-heading">
            Skis ({skis.length})
          </h2>
          <Button
            data-testid="button-add-ski"
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
            size="sm"
            onClick={openAddSki}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Ski
          </Button>
        </div>

        {skis.length === 0 ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-skis">
            No skis yet. Add the first ski for this athlete.
          </Card>
        ) : (
          <div className="space-y-3">
            {skis.map((ski) => (
              <SkiCard
                key={ski.id}
                ski={ski}
                expanded={expandedSkiId === ski.id}
                onToggle={() => setExpandedSkiId(expandedSkiId === ski.id ? null : ski.id)}
                onEdit={() => openEditSki(ski)}
                onDelete={() => {
                  if (confirm("Delete this ski?")) deleteSkiMutation.mutate(ski.id);
                }}
                onRegrind={() => openRegrind(ski.id)}
                onDeleteRegrind={(id) => {
                  if (confirm("Delete this regrind record?")) deleteRegrindMutation.mutate(id);
                }}
              />
            ))}
          </div>
        )}

        {/* Race Ski Tests Section */}
        <div className="border-t border-border/40 pt-4" data-testid="section-race-ski-tests">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => setTestsExpanded(!testsExpanded)}
              data-testid="toggle-tests-section"
            >
              {testsExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <h2 className="text-lg font-semibold" data-testid="text-tests-heading">
                Tests
              </h2>
            </div>
            {can("tests", "edit") && (
              <Button
                data-testid="button-new-test"
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
                size="sm"
                onClick={openNewTest}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Test
              </Button>
            )}
          </div>

          {testsExpanded && (
            <div className="mt-3 space-y-3">
              {/* Inline Test Form */}
              {showTestForm && (
                <Card className="fs-card rounded-2xl p-4" data-testid="card-new-test-form">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">New Raceski Test</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTestForm(false)}
                      data-testid="button-cancel-test"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Date *</label>
                      <Input
                        type="date"
                        value={testForm.date}
                        onChange={(e) => setTestForm((f) => ({ ...f, date: e.target.value }))}
                        required
                        data-testid="input-test-date"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Location *</label>
                      <Input
                        value={testForm.location}
                        onChange={(e) => setTestForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="e.g., Davos"
                        data-testid="input-test-location"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Test Type</label>
                      <Select
                        value={testForm.testType}
                        onValueChange={(v) => setTestForm((f) => ({ ...f, testType: v as "Classic" | "Skating" }))}
                      >
                        <SelectTrigger data-testid="select-test-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Classic">Classic</SelectItem>
                          <SelectItem value="Skating">Skating</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Weather</label>
                      <Select
                        value={testForm.weatherId != null ? String(testForm.weatherId) : "__auto__"}
                        onValueChange={(v) => setTestForm((f) => ({ ...f, weatherId: v === "__auto__" ? undefined : Number(v) }))}
                      >
                        <SelectTrigger data-testid="select-test-weather">
                          <SelectValue
                            placeholder={
                              autoWeather
                                ? `Auto: ${autoWeather.location} ${autoWeather.time}`
                                : "Select weather"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__auto__" data-testid="option-weather-auto">
                            {autoWeather ? `Auto: ${autoWeather.location} ${autoWeather.time}` : "Auto (match by date + location)"}
                          </SelectItem>
                          {weather.map((w) => (
                            <SelectItem key={w.id} value={String(w.id)} data-testid={`option-weather-${w.id}`}>
                              {w.date} · {w.location} · {w.time} · Air {w.airTemperatureC}°C
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
                    <div className="lg:col-span-3">
                      <label className="mb-1 block text-sm font-medium">Notes</label>
                      <Textarea
                        value={testForm.notes}
                        onChange={(e) => setTestForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Optional notes..."
                        className="h-9 min-h-[36px] resize-none"
                        data-testid="input-test-notes"
                      />
                    </div>
                  </div>

                  {/* Ski Selection */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium">Select skis for this test</label>
                    {(() => {
                      const filteredSkis = (testForm.testType === "Classic" || testForm.testType === "Skating")
                        ? skis.filter((s) => s.discipline === testForm.testType)
                        : skis;
                      return filteredSkis.length === 0 ? (
                      <p className="text-sm text-muted-foreground" data-testid="text-no-skis-for-test">
                        No {testForm.testType === "Classic" || testForm.testType === "Skating" ? `${testForm.testType} ` : ""}skis available. {skis.length > 0 ? "Try a different test type or add skis with the right discipline." : "Add skis to this athlete first."}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {filteredSkis.map((ski) => (
                          <button
                            key={ski.id}
                            type="button"
                            onClick={() => toggleSkiSelection(ski.id)}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all",
                              selectedSkiIds.has(ski.id)
                                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800"
                                : "border-border bg-background/50 text-muted-foreground hover:border-indigo-300 hover:bg-indigo-50/50",
                            )}
                            data-testid={`button-select-ski-${ski.id}`}
                          >
                            <div className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                              selectedSkiIds.has(ski.id) ? "bg-indigo-500 border-indigo-500" : "border-gray-300",
                            )}>
                              {selectedSkiIds.has(ski.id) && (
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="font-semibold">{ski.skiId}</span>
                            {ski.brand && <span className="text-xs text-muted-foreground">{ski.brand}</span>}
                            {ski.grind && <span className="text-xs text-muted-foreground">· {ski.grind}</span>}
                          </button>
                        ))}
                      </div>
                    );
                    })()}
                  </div>

                  {/* Test Entry Table */}
                  {testRows.length > 0 && (
                    <div className="overflow-x-auto rounded-2xl border bg-card/50">
                      <div className="flex items-center justify-end px-3 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setEditParamsOpen(true)}
                          data-testid="button-edit-parameters"
                        >
                          <Settings2 className="h-3.5 w-3.5 mr-1" />
                          Edit parameters
                        </Button>
                      </div>

                      <Dialog open={editParamsOpen} onOpenChange={setEditParamsOpen}>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Edit Parameters</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active columns</div>
                            {activeParams.length === 0 && (
                              <p className="text-sm text-muted-foreground">No parameters selected</p>
                            )}
                            <div className="space-y-1">
                              {activeParams.map((key, idx) => (
                                <div
                                  key={key}
                                  className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5"
                                  data-testid={`param-active-${key}`}
                                >
                                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                                  <span className="text-sm flex-1">{getParamLabel(key)}</span>
                                  <button
                                    type="button"
                                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                    onClick={() => moveParamUp(idx)}
                                    disabled={idx === 0}
                                    data-testid={`button-param-up-${key}`}
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                    onClick={() => moveParamDown(idx)}
                                    disabled={idx === activeParams.length - 1}
                                    data-testid={`button-param-down-${key}`}
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="p-0.5 text-red-400 hover:text-red-300"
                                    onClick={() => removeParam(key)}
                                    data-testid={`button-param-remove-${key}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {inactiveParams.length > 0 && (
                              <>
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">Available</div>
                                <div className="space-y-1">
                                  {inactiveParams.map((p) => (
                                    <div
                                      key={p.key}
                                      className="flex items-center gap-1.5 rounded-lg border border-dashed bg-background/50 px-2 py-1.5"
                                      data-testid={`param-inactive-${p.key}`}
                                    >
                                      <span className="text-sm text-muted-foreground flex-1">{p.label}</span>
                                      <button
                                        type="button"
                                        className="p-0.5 text-emerald-400 hover:text-emerald-300"
                                        onClick={() => addParam(p.key)}
                                        data-testid={`button-param-add-${p.key}`}
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      <table className="w-full border-separate border-spacing-0" style={{ minWidth: `${400 + distanceLabels.length * 200}px` }}>
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="sticky left-0 z-10 bg-card/80 px-3 py-3">Ski ID</th>
                            {activeParams.map((key) => (
                              <th key={key} className="px-2 py-3">{getParamLabel(key)}</th>
                            ))}
                            {distanceLabels.map((label, roundIdx) => (
                              <th key={roundIdx} className="px-3 py-3" colSpan={2}>
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={label}
                                    onChange={(e) => {
                                      const next = [...distanceLabels];
                                      next[roundIdx] = e.target.value;
                                      setDistanceLabels(next);
                                    }}
                                    className="h-7 w-24 text-xs bg-background/70"
                                    placeholder={`Round ${roundIdx + 1}`}
                                    data-testid={`input-test-distance-label-${roundIdx}`}
                                  />
                                  {distanceLabels.length > 1 && (
                                    <button
                                      type="button"
                                      className="text-red-400 hover:text-red-300 transition-colors"
                                      onClick={() => {
                                        setDistanceLabels(distanceLabels.filter((_, i) => i !== roundIdx));
                                        setTestRows(testRows.map((r) => ({
                                          ...r,
                                          roundResults: r.roundResults.filter((_, i) => i !== roundIdx),
                                        })));
                                      }}
                                      data-testid={`button-remove-test-round-${roundIdx}`}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </th>
                            ))}
                            <th className="px-3 py-3">Feeling</th>
                            <th className="px-1 py-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                onClick={() => {
                                  setDistanceLabels([...distanceLabels, ""]);
                                  setTestRows(testRows.map((r) => ({
                                    ...r,
                                    roundResults: [...r.roundResults, { result: null, rank: null }],
                                  })));
                                }}
                                data-testid="button-add-test-round"
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Round
                              </Button>
                            </th>
                          </tr>
                          <tr className="text-left text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                            <th className="sticky left-0 z-10 bg-card/80"></th>
                            {activeParams.map((key) => (
                              <th key={key}></th>
                            ))}
                            {distanceLabels.map((_, roundIdx) => (
                              <React.Fragment key={roundIdx}>
                                <th className="px-3 pb-1">Result (cm)</th>
                                <th className="px-3 pb-1">Rank</th>
                              </React.Fragment>
                            ))}
                            <th></th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {testRows.map((row, idx) => {
                            const rankBadge = (rank: number | null) => (
                              <div
                                className={cn(
                                  "inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold",
                                  rank === 1
                                    ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                                    : rank === 2
                                      ? "bg-slate-300/15 text-slate-500 dark:text-slate-300"
                                      : rank === 3
                                        ? "bg-amber-700/15 text-amber-700 dark:text-amber-600"
                                        : "bg-muted/70 text-foreground",
                                )}
                              >
                                {rank ?? "—"}
                              </div>
                            );

                            return (
                              <tr
                                key={row.id}
                                className={cn(
                                  "border-t",
                                  idx % 2 === 0 ? "bg-background/30" : "bg-background/10",
                                )}
                                data-testid={`row-test-entry-${row.raceSkiId}`}
                              >
                                <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                                  <div
                                    className="inline-flex h-9 items-center justify-center rounded-xl border bg-background/70 px-2 text-sm font-semibold"
                                    data-testid={`text-test-ski-id-${row.raceSkiId}`}
                                  >
                                    {row.skiId}
                                  </div>
                                </td>
                                {activeParams.map((key) => (
                                  <td key={key} className="px-2 py-2 text-xs text-muted-foreground" data-testid={`text-test-${key}-${row.raceSkiId}`}>
                                    {(row as any)[key] || "—"}
                                  </td>
                                ))}
                                {row.roundResults.map((rr, roundIdx) => (
                                  <React.Fragment key={roundIdx}>
                                    <td className="px-3 py-2">
                                      <Input
                                        inputMode="decimal"
                                        type="number"
                                        value={rr.result ?? ""}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          const num = v === "" ? null : Number(v);
                                          setTestRows(testRows.map((r) => {
                                            if (r.id !== row.id) return r;
                                            const newRounds = [...r.roundResults];
                                            newRounds[roundIdx] = { ...newRounds[roundIdx], result: Number.isNaN(num) ? null : num };
                                            return { ...r, roundResults: newRounds };
                                          }));
                                        }}
                                        className="h-9 w-20 bg-background/70"
                                        placeholder="0"
                                        data-testid={`input-test-result-${roundIdx}-${row.raceSkiId}`}
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      {rankBadge(rr.rank)}
                                    </td>
                                  </React.Fragment>
                                ))}
                                <td className="px-3 py-2">
                                  <Input
                                    inputMode="numeric"
                                    type="number"
                                    min={1}
                                    value={row.feelingRank ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      const num = v === "" ? null : Number(v);
                                      setTestRows(testRows.map((r) => r.id === row.id ? { ...r, feelingRank: Number.isNaN(num) ? null : num } : r));
                                    }}
                                    className="h-9 w-16 bg-background/70"
                                    placeholder="—"
                                    data-testid={`input-test-feeling-${row.raceSkiId}`}
                                  />
                                </td>
                                <td></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTestForm(false)}
                      data-testid="button-cancel-test-form"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => createTestMutation.mutate()}
                      disabled={createTestMutation.isPending || !testForm.date || !testForm.location.trim()}
                      data-testid="button-save-test"
                    >
                      {createTestMutation.isPending ? "Saving…" : "Save Test"}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Existing Race Ski Tests */}
              {raceSkiTests.length === 0 && !showTestForm ? (
                <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-tests">
                  No race ski tests yet.
                </Card>
              ) : (
                raceSkiTests.map((test) => (
                  <RaceSkiTestCard key={test.id} test={test} skiIds={skiIds} />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Ski Dialog */}
      <Dialog
        open={skiDialogOpen}
        onOpenChange={(v) => {
          setSkiDialogOpen(v);
          if (!v) { setEditingSki(null); resetSkiForm(); }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSki ? "Edit" : "Add Ski"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSkiSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Ski ID *</label>
              <Input
                value={skiForm.skiId}
                onChange={(e) => setSkiForm((f) => ({ ...f, skiId: e.target.value }))}
                required
                data-testid="input-ski-id"
              />
            </div>

            {activeFormFields.map((fieldKey) => {
              if (fieldKey === "heights" && skiForm.discipline !== "Classic") return null;
              if (fieldKey === "discipline") {
                return (
                  <div key={fieldKey}>
                    <label className="mb-1 block text-sm font-medium">{getFormFieldLabel(fieldKey)}</label>
                    <Select
                      value={skiForm.discipline}
                      onValueChange={(v) => setSkiForm((f) => ({ ...f, discipline: v }))}
                    >
                      <SelectTrigger data-testid="select-ski-discipline">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Classic">Classic</SelectItem>
                        <SelectItem value="Skating">Skating</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return (
                <div key={fieldKey}>
                  <label className="mb-1 block text-sm font-medium">{getFormFieldLabel(fieldKey)}</label>
                  <Input
                    value={(skiForm as any)[fieldKey] ?? ""}
                    onChange={(e) => setSkiForm((f) => ({ ...f, [fieldKey]: e.target.value }))}
                    data-testid={`input-ski-${fieldKey}`}
                  />
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setEditFormFieldsOpen(true)}
                data-testid="button-edit-ski-form-fields"
              >
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                Edit parameters
              </Button>
              <Button
                type="submit"
                data-testid="button-save-ski"
                disabled={createSkiMutation.isPending || updateSkiMutation.isPending || !skiForm.skiId.trim()}
              >
                {(createSkiMutation.isPending || updateSkiMutation.isPending) ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>

          <Dialog open={editFormFieldsOpen} onOpenChange={setEditFormFieldsOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Edit Parameters</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active fields</div>
                {activeFormFields.length === 0 && (
                  <p className="text-sm text-muted-foreground">No fields selected</p>
                )}
                <div className="space-y-1">
                  {activeFormFields.map((key, idx) => (
                    <div
                      key={key}
                      className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5"
                      data-testid={`form-field-active-${key}`}
                    >
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      <span className="text-sm flex-1">{getFormFieldLabel(key)}</span>
                      <button
                        type="button"
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => moveFormFieldUp(idx)}
                        disabled={idx === 0}
                        data-testid={`button-form-field-up-${key}`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => moveFormFieldDown(idx)}
                        disabled={idx === activeFormFields.length - 1}
                        data-testid={`button-form-field-down-${key}`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-0.5 text-red-400 hover:text-red-300"
                        onClick={() => removeFormField(key)}
                        data-testid={`button-form-field-remove-${key}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {inactiveFormFields.length > 0 && (
                  <>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">Available</div>
                    <div className="space-y-1">
                      {inactiveFormFields.map((f) => (
                        <div
                          key={f.key}
                          className="flex items-center gap-1.5 rounded-lg border border-dashed bg-background/50 px-2 py-1.5"
                          data-testid={`form-field-inactive-${f.key}`}
                        >
                          <span className="text-sm text-muted-foreground flex-1">{f.label}</span>
                          <button
                            type="button"
                            className="p-0.5 text-emerald-400 hover:text-emerald-300"
                            onClick={() => addFormField(f.key)}
                            data-testid={`button-form-field-add-${f.key}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      {/* Regrind Dialog */}
      <Dialog
        open={regrindDialogOpen}
        onOpenChange={(v) => {
          setRegrindDialogOpen(v);
          if (!v) { setRegrindSkiId(null); resetRegrindForm(); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Regrind</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegrindSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Date *</label>
              <Input
                type="date"
                value={regrindForm.date}
                onChange={(e) => setRegrindForm((f) => ({ ...f, date: e.target.value }))}
                required
                data-testid="input-regrind-date"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Grind Type *</label>
              <Input
                value={regrindForm.grindType}
                onChange={(e) => setRegrindForm((f) => ({ ...f, grindType: e.target.value }))}
                required
                data-testid="input-regrind-type"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Stone</label>
              <Input
                value={regrindForm.stone}
                onChange={(e) => setRegrindForm((f) => ({ ...f, stone: e.target.value }))}
                data-testid="input-regrind-stone"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Pattern</label>
              <Input
                value={regrindForm.pattern}
                onChange={(e) => setRegrindForm((f) => ({ ...f, pattern: e.target.value }))}
                data-testid="input-regrind-pattern"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <Input
                value={regrindForm.notes}
                onChange={(e) => setRegrindForm((f) => ({ ...f, notes: e.target.value }))}
                data-testid="input-regrind-notes"
              />
            </div>
            <div className="flex items-center justify-end pt-2">
              <Button
                type="submit"
                data-testid="button-save-regrind"
                disabled={createRegrindMutation.isPending || !regrindForm.grindType.trim()}
              >
                {createRegrindMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Access Dialog */}
      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users available.</p>
            ) : (
              users
                .filter((u) => u.id !== athlete?.createdById)
                .map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer"
                    data-testid={`checkbox-access-user-${u.id}`}
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(u.id)}
                      onCheckedChange={(checked) => {
                        setSelectedUserIds((prev) =>
                          checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                        );
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </label>
                ))
            )}
          </div>
          <div className="flex items-center justify-end pt-2">
            <Button
              data-testid="button-save-access"
              onClick={() => updateAccessMutation.mutate(selectedUserIds)}
              disabled={updateAccessMutation.isPending}
            >
              {updateAccessMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Athlete Dialog */}
      <Dialog open={editAthleteOpen} onOpenChange={setEditAthleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAthleteSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Name *</label>
              <Input
                value={athleteForm.name}
                onChange={(e) => setAthleteForm((f) => ({ ...f, name: e.target.value }))}
                required
                data-testid="input-edit-athlete-name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Team</label>
              <Input
                value={athleteForm.team}
                onChange={(e) => setAthleteForm((f) => ({ ...f, team: e.target.value }))}
                data-testid="input-edit-athlete-team"
              />
            </div>
            <div className="flex items-center justify-end pt-2">
              <Button
                type="submit"
                data-testid="button-save-edit-athlete"
                disabled={updateAthleteMutation.isPending || !athleteForm.name.trim()}
              >
                {updateAthleteMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SkiCard({
  ski,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onRegrind,
  onDeleteRegrind,
}: {
  ski: RaceSki;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRegrind: () => void;
  onDeleteRegrind: (id: number) => void;
}) {
  const { data: regrinds = [] } = useQuery<RaceSkiRegrind[]>({
    queryKey: [`/api/race-skis/${ski.id}/regrinds`],
    enabled: expanded,
  });

  return (
    <Card className="fs-card rounded-2xl p-4" data-testid={`card-ski-${ski.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div
          className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1"
          onClick={onToggle}
          data-testid={`toggle-ski-${ski.id}`}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm" data-testid={`text-ski-id-${ski.id}`}>
                {ski.skiId}
              </span>
              {ski.brand && (
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800">
                  {ski.brand}
                </span>
              )}
              <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800">
                {ski.discipline}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {ski.grind && (
                <span data-testid={`text-ski-grind-${ski.id}`}>
                  <strong className="text-foreground">Current Grind:</strong> {ski.grind}
                </span>
              )}
              {ski.construction && <span>Construction: {ski.construction}</span>}
              {ski.mold && <span>Mold: {ski.mold}</span>}
              {ski.base && <span>Base: {ski.base}</span>}
              {ski.discipline === "Classic" && ski.heights && (
                <span>Heights: {ski.heights}</span>
              )}
              {ski.year && <span>Year: {ski.year}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            data-testid={`button-regrind-ski-${ski.id}`}
            onClick={onRegrind}
            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Regrind
          </Button>
          <Button variant="ghost" size="sm" data-testid={`button-edit-ski-${ski.id}`} onClick={onEdit}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid={`button-delete-ski-${ski.id}`}
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-border/40 pt-3" data-testid={`section-regrinds-${ski.id}`}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Regrind History
          </h3>
          {regrinds.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid={`text-no-regrinds-${ski.id}`}>
              No regrind history
            </p>
          ) : (
            <div className="space-y-2">
              {regrinds.map((rg) => (
                <div
                  key={rg.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2"
                  data-testid={`row-regrind-${rg.id}`}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                    <span className="font-medium">{rg.date}</span>
                    <span className="font-semibold text-foreground">{rg.grindType}</span>
                    {rg.stone && <span className="text-muted-foreground">Stone: {rg.stone}</span>}
                    {rg.pattern && <span className="text-muted-foreground">Pattern: {rg.pattern}</span>}
                    {rg.notes && <span className="text-muted-foreground italic">{rg.notes}</span>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`button-delete-regrind-${rg.id}`}
                    onClick={() => onDeleteRegrind(rg.id)}
                    className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function RaceSkiTestCard({ test, skiIds }: { test: RaceSkiTest; skiIds: Set<number> }) {
  const [expanded, setExpanded] = useState(false);

  const { data: entries = [] } = useQuery<TestEntry[]>({
    queryKey: [`/api/tests/${test.id}/entries`],
    enabled: expanded,
  });

  const relevantEntries = useMemo(() => {
    if (entries.length === 0) return [];
    return entries.filter((e) => e.raceSkiId && skiIds.has(e.raceSkiId));
  }, [entries, skiIds]);

  if (expanded && entries.length > 0 && relevantEntries.length === 0) {
    return null;
  }

  return (
    <Card className="fs-card rounded-2xl p-4" data-testid={`card-test-${test.id}`}>
      <div
        className="flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
        data-testid={`toggle-test-${test.id}`}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-medium" data-testid={`text-test-date-${test.id}`}>
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            {test.date}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-test-location-${test.id}`}>
            <MapPin className="h-3 w-3" />
            {test.location}
          </span>
          <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800" data-testid={`text-test-type-${test.id}`}>
            {test.testType}
          </span>
          <span className="text-xs text-muted-foreground">{test.createdByName}</span>
        </div>
      </div>

      {expanded && relevantEntries.length > 0 && (
        <div className="mt-3 border-t border-border/40 pt-3" data-testid={`section-test-entries-${test.id}`}>
          <div className="overflow-x-auto rounded-xl border bg-card/50">
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-2">Ski #</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Feeling</th>
                  {test.testType === "Classic" && <th className="px-3 py-2">Kick</th>}
                </tr>
              </thead>
              <tbody>
                {relevantEntries.map((entry) => (
                  <tr key={entry.id} className="border-t" data-testid={`row-test-result-${entry.id}`}>
                    <td className="px-3 py-1.5 font-medium">{entry.skiNumber}</td>
                    <td className="px-3 py-1.5">{entry.result0kmCmBehind ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      <span className={cn(
                        "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        entry.rank0km === 1 ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" :
                        entry.rank0km === 2 ? "bg-slate-300/15 text-slate-500 dark:text-slate-300" :
                        entry.rank0km === 3 ? "bg-amber-700/15 text-amber-700 dark:text-amber-600" :
                        "bg-muted/70 text-foreground"
                      )}>
                        {entry.rank0km ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{entry.feelingRank ?? "—"}</td>
                    {test.testType === "Classic" && <td className="px-3 py-1.5">{entry.kickRank ?? "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {test.notes && (
            <p className="mt-2 text-xs text-muted-foreground italic" data-testid={`text-test-notes-${test.id}`}>
              {test.notes}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
