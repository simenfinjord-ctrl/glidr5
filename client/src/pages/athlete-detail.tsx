import React, { useState, useMemo, useEffect } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
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
  Archive,
  ArchiveRestore,
  Warehouse,
  Search,
  LayoutGrid,
  List,
  Filter,
  BarChart2,
  ChevronUp,
  Thermometer,
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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn, fmtDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

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
  customParams: string | null;
  archivedAt: string | null;
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
  weatherId: number | null;
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
  grindType: string | null;
  grindStone: string | null;
  grindPattern: string | null;
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
  [key: string]: any;
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
  clouds: number | null;
  visibility: string | null;
  wind: string | null;
  precipitation: string | null;
  artificialSnow: string | null;
  naturalSnow: string | null;
  grainSize: string | null;
  snowHumidityType: string | null;
  trackHardness: string | null;
  testQuality: number | null;
  snowType: string | null;
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
  const search = useSearch();
  const athleteId = params?.id ? parseInt(params.id) : null;
  const { user, can } = useAuth();
  const isAnalyticsView = new URLSearchParams(search).get("view") === "analytics";
  const { toast } = useToast();
  const { t } = useI18n();

  const [skiDialogOpen, setSkiDialogOpen] = useState(false);
  const [editingSki, setEditingSki] = useState<RaceSki | null>(null);
  const [regrindDialogOpen, setRegrindDialogOpen] = useState(false);
  const [regrindSkiId, setRegrindSkiId] = useState<number | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [editAthleteOpen, setEditAthleteOpen] = useState(false);
  const [expandedSkiId, setExpandedSkiId] = useState<number | null>(null);
  const [showArchivedSkis, setShowArchivedSkis] = useState(false);
  const [skiGarageOpen, setSkiGarageOpen] = useState(true);

  // Ski Garage view & filters
  const [garageViewMode, setGarageViewMode] = useState<"grid" | "list">(() => {
    try {
      const v = localStorage.getItem("glidr-garage-view-mode");
      if (v === "list" || v === "grid") return v;
    } catch {}
    return "grid";
  });
  const [garageDisciplineFilter, setGarageDisciplineFilter] = useState<string>("all");
  const [garageBrandFilter, setGarageBrandFilter] = useState<string>("all");
  const [garageYearFilter, setGarageYearFilter] = useState<string>("all");
  const [garageGrindFilter, setGarageGrindFilter] = useState<string>("");
  const [garageRaValueFilter, setGarageRaValueFilter] = useState<string>("");
  const [garageRaSort, setGarageRaSort] = useState<string>("none");
  const [showGarageFilters, setShowGarageFilters] = useState(false);

  // Analytics section (used by dedicated analytics view)
  const [compareSkiIds, setCompareSkiIds] = useState<Set<number>>(new Set());

  // Test result column chooser
  const defaultTestColumns = ["skiId", "brand", "grind", "result", "rank", "feeling", "methodology"];
  const [activeTestColumns, setActiveTestColumns] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("glidr-raceski-test-columns");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultTestColumns;
  });
  const [testColumnsDialogOpen, setTestColumnsDialogOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("glidr-raceski-test-columns", JSON.stringify(activeTestColumns)); } catch {}
  }, [activeTestColumns]);

  const [testsExpanded, setTestsExpanded] = useState(true);
  const [testViewMode, setTestViewMode] = useState<"card" | "list">("card");
  const [showTestForm, setShowTestForm] = useState(false);
  const [testForm, setTestForm] = useState({
    date: new Date().toISOString().split("T")[0],
    location: "",
    testType: "Classic" as "Classic" | "Skating" | "Double Poling",
    notes: "",
    weatherId: undefined as number | undefined,
  });
  const [selectedSkiIds, setSelectedSkiIds] = useState<Set<number>>(new Set());
  const [skiSearchQuery, setSkiSearchQuery] = useState("");
  const [testRows, setTestRows] = useState<RaceSkiTestRow[]>([]);
  const [distanceLabels, setDistanceLabels] = useState<string[]>([""]);

  const [customFieldDefs, setCustomFieldDefs] = useState<{ key: string; label: string }[]>(() => {
    try {
      const stored = localStorage.getItem("glidr-raceski-custom-fields");
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  useEffect(() => {
    localStorage.setItem("glidr-raceski-custom-fields", JSON.stringify(customFieldDefs));
  }, [customFieldDefs]);

  const builtInTestParams: { key: string; label: string }[] = [
    { key: "brand", label: "Brand" },
    { key: "base", label: "Base" },
    { key: "grind", label: "Grind" },
    { key: "heights", label: "Heights" },
    { key: "construction", label: "Construction" },
    { key: "mold", label: "Mold" },
    { key: "serialNumber", label: "Serial" },
    { key: "year", label: "Year" },
  ];
  const allSkiParams = [...builtInTestParams, ...customFieldDefs];

  const defaultParams: string[] = ["brand", "base", "grind", "heights"];
  const [activeParams, setActiveParams] = useState<string[]>(() => {
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
  const removeParam = (key: string) => {
    setActiveParams(activeParams.filter((k) => k !== key));
  };
  const addParam = (key: string) => {
    setActiveParams([...activeParams, key]);
  };

  const getParamLabel = (key: string) =>
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
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const builtInSkiFields: { key: string; label: string }[] = [
    { key: "serialNumber", label: "Serial Number" },
    { key: "brand", label: "Brand" },
    { key: "discipline", label: "Discipline" },
    { key: "construction", label: "Construction" },
    { key: "mold", label: "Mold" },
    { key: "base", label: "Base" },
    { key: "grind", label: "Grind" },
    { key: "heights", label: "Heights" },
    { key: "year", label: "Year" },
  ];
  const builtInKeys = builtInSkiFields.map((f) => f.key);

  const allSkiFormFields = [...builtInSkiFields, ...customFieldDefs];

  const defaultFormFields = ["serialNumber", "brand", "discipline", "construction", "mold", "base", "grind", "heights", "year"];
  const [activeFormFields, setActiveFormFields] = useState<string[]>(() => {
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
  const [newCustomFieldName, setNewCustomFieldName] = useState("");

  useEffect(() => {
    localStorage.setItem("glidr-raceski-form-fields", JSON.stringify(activeFormFields));
  }, [activeFormFields]);

  const inactiveFormFields = allSkiFormFields.filter((f) => !activeFormFields.includes(f.key));
  const getFormFieldLabel = (key: string) =>
    allSkiFormFields.find((f) => f.key === key)?.label ?? key;
  const isCustomField = (key: string) => !builtInKeys.includes(key);
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
  const removeFormField = (key: string) => {
    setActiveFormFields(activeFormFields.filter((k) => k !== key));
  };
  const addFormField = (key: string) => {
    setActiveFormFields([...activeFormFields, key]);
  };
  const addCustomField = () => {
    const label = newCustomFieldName.trim();
    if (!label) return;
    const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    if (allSkiFormFields.some((f) => f.key === key)) return;
    setCustomFieldDefs([...customFieldDefs, { key, label }]);
    setActiveFormFields([...activeFormFields, key]);
    setNewCustomFieldName("");
  };
  const deleteCustomField = (key: string) => {
    setCustomFieldDefs(customFieldDefs.filter((f) => f.key !== key));
    setActiveFormFields(activeFormFields.filter((k) => k !== key));
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

  const { data: archivedSkis = [] } = useQuery<RaceSki[]>({
    queryKey: [`/api/athletes/${athleteId}/skis/archived`],
    enabled: !!athleteId && showArchivedSkis,
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

  // Fixed set of test columns mirroring ski properties + result columns
  const allTestColumns: { key: string; label: string }[] = [
    { key: "skiId", label: "Ski ID" },
    { key: "serialNumber", label: "Serial Number" },
    { key: "brand", label: "Brand" },
    { key: "discipline", label: "Discipline" },
    { key: "construction", label: "Construction" },
    { key: "mold", label: "Mold" },
    { key: "base", label: "Base" },
    { key: "grind", label: "Grind" },
    { key: "heights", label: "Heights" },
    { key: "year", label: "Year" },
    { key: "result", label: "Result (cm)" },
    { key: "rank", label: "Rank" },
    { key: "feeling", label: "Feeling" },
    { key: "methodology", label: "Methodology" },
  ];

  const raceSkiTests = useMemo(() => {
    return allTests.filter((t) => t.testSkiSource === "raceskis" && t.athleteId === Number(athleteId));
  }, [allTests, athleteId]);

  // Derived filter options for Ski Garage
  const garageDisciplineOptions = useMemo(() => {
    const vals = [...new Set(skis.map((s) => s.discipline).filter(Boolean))].sort();
    return vals;
  }, [skis]);
  const garageBrandOptions = useMemo(() => {
    const vals = [...new Set(skis.map((s) => s.brand).filter(Boolean) as string[])].sort();
    return vals;
  }, [skis]);
  const garageYearOptions = useMemo(() => {
    const vals = [...new Set(skis.map((s) => s.year).filter(Boolean) as string[])].sort((a, b) => b.localeCompare(a));
    return vals;
  }, [skis]);

  const filteredGarageSkis = useMemo(() => {
    let list = skis;
    if (garageDisciplineFilter !== "all") list = list.filter((s) => s.discipline === garageDisciplineFilter);
    if (garageBrandFilter !== "all") list = list.filter((s) => s.brand === garageBrandFilter);
    if (garageYearFilter !== "all") list = list.filter((s) => s.year === garageYearFilter);
    if (garageGrindFilter.trim()) {
      const q = garageGrindFilter.trim().toLowerCase();
      list = list.filter((s) => s.grind?.toLowerCase().includes(q));
    }
    if (garageRaValueFilter.trim()) {
      const q = garageRaValueFilter.trim().toLowerCase();
      list = list.filter((s) => {
        try {
          const cp = s.customParams ? JSON.parse(s.customParams) : {};
          return String(cp.ra_value ?? "").toLowerCase().includes(q);
        } catch { return false; }
      });
    }
    if (garageRaSort === "ra-high") {
      list = [...list].sort((a, b) => {
        const getRa = (s: RaceSki) => { try { const cp = s.customParams ? JSON.parse(s.customParams) : {}; return parseFloat(cp.ra_value) || 0; } catch { return 0; } };
        return getRa(b) - getRa(a);
      });
    } else if (garageRaSort === "ra-low") {
      list = [...list].sort((a, b) => {
        const getRa = (s: RaceSki) => { try { const cp = s.customParams ? JSON.parse(s.customParams) : {}; return parseFloat(cp.ra_value) || 0; } catch { return 0; } };
        return getRa(a) - getRa(b);
      });
    }
    return list;
  }, [skis, garageDisciplineFilter, garageBrandFilter, garageYearFilter, garageGrindFilter, garageRaValueFilter, garageRaSort]);

  function setGarageView(mode: "grid" | "list") {
    setGarageViewMode(mode);
    try { localStorage.setItem("glidr-garage-view-mode", mode); } catch {}
  }

  const isOwnerOrAdmin =
    user?.isAdmin || (athlete && user?.id === athlete.createdById);
  const hasAthleteAccess = isOwnerOrAdmin || access.some((a) => a.userId === user?.id);

  const [testDateFilter, setTestDateFilter] = useState<string>("all");
  const [testTypeFilter, setTestTypeFilter] = useState<string>("all");
  const [testSortBy, setTestSortBy] = useState<string>("date-desc");

  const testDates = useMemo(() => {
    const dates = [...new Set(raceSkiTests.map((t) => t.date))].sort((a, b) => b.localeCompare(a));
    return dates;
  }, [raceSkiTests]);

  const filteredTests = useMemo(() => {
    let list = raceSkiTests;
    if (testDateFilter !== "all") list = list.filter((t) => t.date === testDateFilter);
    if (testTypeFilter !== "all") list = list.filter((t) => t.testType === testTypeFilter);
    list = [...list].sort((a, b) => {
      switch (testSortBy) {
        case "date-asc": return a.date.localeCompare(b.date);
        case "date-desc": return b.date.localeCompare(a.date);
        case "location-asc": return a.location.localeCompare(b.location);
        case "location-desc": return b.location.localeCompare(a.location);
        default: return b.date.localeCompare(a.date);
      }
    });
    return list;
  }, [raceSkiTests, testDateFilter, testTypeFilter, testSortBy]);

  function buildSkiBody(data: typeof skiForm) {
    const cp: Record<string, string> = {};
    for (const [k, v] of Object.entries(customFieldValues)) {
      if (v.trim()) cp[k] = v.trim();
    }
    return {
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
      customParams: Object.keys(cp).length > 0 ? JSON.stringify(cp) : null,
    };
  }

  const createSkiMutation = useMutation({
    mutationFn: async (data: typeof skiForm) => {
      const res = await apiRequest("POST", `/api/athletes/${athleteId}/skis`, buildSkiBody(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: "Ski added" });
      setSkiDialogOpen(false);
      resetSkiForm();
      setCustomFieldValues({});
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateSkiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof skiForm }) => {
      const res = await apiRequest("PUT", `/api/race-skis/${id}`, buildSkiBody(data));
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
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis/archived`] });
      toast({ title: "Ski permanently deleted" });
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const archiveSkiMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/race-skis/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis/archived`] });
      toast({ title: "Ski archived" });
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const restoreSkiMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/race-skis/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis/archived`] });
      toast({ title: "Ski restored" });
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
    try {
      const cp = ski.customParams ? JSON.parse(ski.customParams) : {};
      setCustomFieldValues(cp);
    } catch {
      setCustomFieldValues({});
    }
    setSkiDialogOpen(true);
  }

  function openAddSki() {
    setEditingSki(null);
    resetSkiForm();
    setCustomFieldValues({});
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
              ...(ski.customParams ? (() => { try { return JSON.parse(ski.customParams); } catch { return {}; } })() : {}),
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
    setSkiSearchQuery("");
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
              {t("athleteDetail.back")}
            </Button>
          </AppLink>
        </div>
      </AppShell>
    );
  }

  if (isAnalyticsView) {
    return (
      <AppShell>
        <div className="flex flex-col gap-5">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/raceskis/${athleteId}`)}
              data-testid="button-back-from-analytics"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("athleteDetail.back")}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl sm:text-3xl" data-testid="text-analytics-heading">
              {athlete.name} — Analytics
            </h1>
          </div>
          <AthleteAnalyticsView
            skis={skis}
            raceSkiTests={raceSkiTests}
            compareSkiIds={compareSkiIds}
            setCompareSkiIds={setCompareSkiIds}
          />
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
              {t("athleteDetail.back")}
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

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              data-testid="button-athlete-analytics"
              onClick={() => navigate(`/raceskis/${athleteId}?view=analytics`)}
            >
              <BarChart2 className="mr-1.5 h-3.5 w-3.5" />
              Analytics
            </Button>
            {isOwnerOrAdmin && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Access management */}
        {isOwnerOrAdmin && (
          <Card className="fs-card rounded-2xl p-4" data-testid="card-access-management">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Access</h2>
                <p className="mt-0.5 text-xs text-muted-foreground" data-testid="text-shared-with">
                  {t("raceskis.sharedWith")}: {access.length > 0
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
                {t("raceskis.manageAccess")}
              </Button>
            </div>
          </Card>
        )}

        {/* Ski Garage */}
        <Collapsible open={skiGarageOpen} onOpenChange={setSkiGarageOpen} data-testid="section-ski-garage">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 cursor-pointer select-none group" data-testid="toggle-ski-garage">
                <Warehouse className="h-4.5 w-4.5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">
                  Ski Garage ({skis.length})
                </h2>
                {skiGarageOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
                )}
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {/* Garage view toggle */}
              <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5" data-testid="garage-view-toggle">
                <button
                  onClick={() => setGarageView("grid")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                    garageViewMode === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid="button-garage-grid"
                >
                  <LayoutGrid className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setGarageView("list")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                    garageViewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid="button-garage-list"
                >
                  <List className="h-3 w-3" />
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-7 px-2 text-xs", showGarageFilters && "bg-muted")}
                onClick={() => setShowGarageFilters(!showGarageFilters)}
                data-testid="button-garage-filters"
              >
                <Filter className="h-3 w-3 mr-1" />
                Filter
              </Button>
              <Button
                data-testid="button-add-ski"
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
                size="sm"
                onClick={openAddSki}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("raceskis.addSki")}
              </Button>
            </div>
          </div>

          <CollapsibleContent>
            {/* Filter bar */}
            {showGarageFilters && (
              <div className="flex flex-wrap items-center gap-2 mt-3" data-testid="garage-filter-bar">
                <Select value={garageDisciplineFilter} onValueChange={setGarageDisciplineFilter}>
                  <SelectTrigger className="h-7 w-[130px] text-xs" data-testid="select-garage-discipline">
                    <SelectValue placeholder="All disciplines" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All disciplines</SelectItem>
                    {garageDisciplineOptions.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={garageBrandFilter} onValueChange={setGarageBrandFilter}>
                  <SelectTrigger className="h-7 w-[120px] text-xs" data-testid="select-garage-brand">
                    <SelectValue placeholder="All brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All brands</SelectItem>
                    {garageBrandOptions.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={garageYearFilter} onValueChange={setGarageYearFilter}>
                  <SelectTrigger className="h-7 w-[100px] text-xs" data-testid="select-garage-year">
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {garageYearOptions.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={garageGrindFilter}
                  onChange={(e) => setGarageGrindFilter(e.target.value)}
                  placeholder="Grind…"
                  className="h-7 w-[110px] text-xs"
                  data-testid="input-garage-grind-filter"
                />
                <Input
                  value={garageRaValueFilter}
                  onChange={(e) => setGarageRaValueFilter(e.target.value)}
                  placeholder="RA-value…"
                  className="h-7 w-[110px] text-xs"
                  data-testid="input-garage-ra-value-filter"
                />
                <Select value={garageRaSort} onValueChange={setGarageRaSort}>
                  <SelectTrigger className="h-7 w-[160px] text-xs" data-testid="select-garage-ra-sort">
                    <SelectValue placeholder="Sort by RA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No RA sort</SelectItem>
                    <SelectItem value="ra-high">RA-value High→Low</SelectItem>
                    <SelectItem value="ra-low">RA-value Low→High</SelectItem>
                  </SelectContent>
                </Select>
                {(garageDisciplineFilter !== "all" || garageBrandFilter !== "all" || garageYearFilter !== "all" || garageGrindFilter !== "" || garageRaValueFilter !== "" || garageRaSort !== "none") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => { setGarageDisciplineFilter("all"); setGarageBrandFilter("all"); setGarageYearFilter("all"); setGarageGrindFilter(""); setGarageRaValueFilter(""); setGarageRaSort("none"); }}
                    data-testid="button-garage-clear-filters"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            )}

            {skis.length === 0 ? (
              <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground mt-3" data-testid="empty-skis">
                No skis yet. Add the first ski for this athlete.
              </Card>
            ) : garageViewMode === "grid" ? (
              <div className="space-y-3 mt-3">
                {filteredGarageSkis.map((ski) => (
                  <SkiCard
                    key={ski.id}
                    ski={ski}
                    expanded={expandedSkiId === ski.id}
                    onToggle={() => setExpandedSkiId(expandedSkiId === ski.id ? null : ski.id)}
                    onEdit={() => openEditSki(ski)}
                    onArchive={() => {
                      if (confirm("Archive this ski? It can be restored later.")) archiveSkiMutation.mutate(ski.id);
                    }}
                    onRegrind={() => openRegrind(ski.id)}
                    onDeleteRegrind={(id) => {
                      if (confirm("Delete this regrind record?")) deleteRegrindMutation.mutate(id);
                    }}
                  />
                ))}
                {filteredGarageSkis.length === 0 && skis.length > 0 && (
                  <p className="text-sm text-muted-foreground">No skis match the current filters.</p>
                )}
              </div>
            ) : (
              /* List view for Ski Garage */
              <div className="mt-3">
                <Card className="fs-card rounded-2xl overflow-hidden" data-testid="ski-list-view">
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b">
                          <th className="px-4 py-2.5 font-medium">Ski ID</th>
                          <th className="px-3 py-2.5 font-medium">Serial</th>
                          <th className="px-3 py-2.5 font-medium">Brand</th>
                          <th className="px-3 py-2.5 font-medium">Discipline</th>
                          <th className="px-3 py-2.5 font-medium">Construction</th>
                          <th className="px-3 py-2.5 font-medium">Base</th>
                          <th className="px-3 py-2.5 font-medium">Grind</th>
                          <th className="px-3 py-2.5 font-medium">Year</th>
                          <th className="px-3 py-2.5 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGarageSkis.map((ski, idx) => (
                          <React.Fragment key={ski.id}>
                            <tr
                              className={cn(
                                "border-t border-border/30 cursor-pointer transition-colors",
                                idx % 2 === 0 ? "bg-background/30" : "bg-background/10",
                                expandedSkiId === ski.id && "bg-indigo-50/30 dark:bg-indigo-950/10",
                              )}
                              onClick={() => setExpandedSkiId(expandedSkiId === ski.id ? null : ski.id)}
                              data-testid={`row-ski-${ski.id}`}
                            >
                              <td className="px-4 py-2.5 font-semibold">{ski.skiId}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{ski.serialNumber || "—"}</td>
                              <td className="px-3 py-2.5">{ski.brand || "—"}</td>
                              <td className="px-3 py-2.5">
                                <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800">
                                  {ski.discipline}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">{ski.construction || "—"}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{ski.base || "—"}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{ski.grind || "—"}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{ski.year || "—"}</td>
                              <td className="px-3 py-2.5">
                                {expandedSkiId === ski.id
                                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                              </td>
                            </tr>
                            {expandedSkiId === ski.id && (
                              <tr className="border-t border-indigo-200/30 dark:border-indigo-800/30">
                                <td colSpan={9} className="px-4 py-3 bg-indigo-50/20 dark:bg-indigo-950/10">
                                  <SkiDetailPanel
                                    ski={ski}
                                    onEdit={() => openEditSki(ski)}
                                    onArchive={() => { if (confirm("Archive this ski? It can be restored later.")) archiveSkiMutation.mutate(ski.id); }}
                                    onRegrind={() => openRegrind(ski.id)}
                                    onDeleteRegrind={(id) => { if (confirm("Delete this regrind record?")) deleteRegrindMutation.mutate(id); }}
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                        {filteredGarageSkis.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-4 py-6 text-sm text-muted-foreground text-center">
                              No skis match the current filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchivedSkis(!showArchivedSkis)}
                className="text-xs text-muted-foreground hover:text-foreground"
                data-testid="toggle-archived-skis"
              >
                <Archive className="mr-1 h-3.5 w-3.5" />
                {showArchivedSkis ? "Hide archived" : "Show archived"}
                {showArchivedSkis && archivedSkis.length > 0 && ` (${archivedSkis.length})`}
              </Button>
            </div>

            {showArchivedSkis && archivedSkis.length > 0 && (
              <div className="space-y-3 opacity-70">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Archived Skis</p>
                {archivedSkis.map((ski) => (
                  <SkiCard
                    key={ski.id}
                    ski={ski}
                    expanded={expandedSkiId === ski.id}
                    onToggle={() => setExpandedSkiId(expandedSkiId === ski.id ? null : ski.id)}
                    isArchived
                    onRestore={() => restoreSkiMutation.mutate(ski.id)}
                    onDelete={() => {
                      if (confirm("Permanently delete this ski and all its regrind history? This cannot be undone.")) deleteSkiMutation.mutate(ski.id);
                    }}
                  />
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

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
            <div className="flex items-center gap-2">
              {/* Tests view toggle */}
              <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5" data-testid="tests-view-toggle">
                <button
                  onClick={() => setTestViewMode("card")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                    testViewMode === "card" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid="button-tests-card-view"
                >
                  <LayoutGrid className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setTestViewMode("list")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                    testViewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid="button-tests-list-view"
                >
                  <List className="h-3 w-3" />
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setTestColumnsDialogOpen(true)}
                data-testid="button-test-columns"
              >
                <Settings2 className="h-3 w-3 mr-1" />
                Columns
              </Button>
              {(can("tests", "edit") || hasAthleteAccess) && (
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
          </div>

          {testsExpanded && (
            <div className="mt-3 space-y-3">
              {raceSkiTests.length > 0 && !showTestForm && (
                <div className="flex flex-wrap items-center gap-2" data-testid="test-filters">
                  <Select value={testDateFilter} onValueChange={setTestDateFilter}>
                    <SelectTrigger className="h-8 w-[140px] text-xs" data-testid="select-test-date-filter">
                      <SelectValue placeholder="All dates" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All dates</SelectItem>
                      {testDates.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={testTypeFilter} onValueChange={setTestTypeFilter}>
                    <SelectTrigger className="h-8 w-[120px] text-xs" data-testid="select-test-type-filter">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="Classic">Classic</SelectItem>
                      <SelectItem value="Skating">Skating</SelectItem>
                      <SelectItem value="Double Poling">Double Poling</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={testSortBy} onValueChange={setTestSortBy}>
                    <SelectTrigger className="h-8 w-[130px] text-xs" data-testid="select-test-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Date ↓</SelectItem>
                      <SelectItem value="date-asc">Date ↑</SelectItem>
                      <SelectItem value="location-asc">Location A-Z</SelectItem>
                      <SelectItem value="location-desc">Location Z-A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Column chooser bar */}
              {!showTestForm && raceSkiTests.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-2.5" data-testid="test-column-chooser">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">Columns:</span>
                    {allTestColumns.map((col) => (
                      <label key={col.key} className="flex items-center gap-1.5 cursor-pointer select-none" data-testid={`col-toggle-${col.key}`}>
                        <Checkbox
                          checked={activeTestColumns.includes(col.key)}
                          onCheckedChange={(checked) => {
                            setActiveTestColumns((prev) =>
                              checked ? [...prev, col.key] : prev.filter((k) => k !== col.key)
                            );
                          }}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-xs">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
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
                        onValueChange={(v) => setTestForm((f) => ({ ...f, testType: v as "Classic" | "Skating" | "Double Poling" }))}
                      >
                        <SelectTrigger data-testid="select-test-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Classic">Classic</SelectItem>
                          <SelectItem value="Skating">Skating</SelectItem>
                          <SelectItem value="Double Poling">Double Poling</SelectItem>
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
                              {fmtDate(w.date)} · {w.location} · {w.time} · Air {w.airTemperatureC}°C
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
                      const raceTestTypes = ["Classic", "Skating", "Double Poling"];
                      const disciplineFiltered = raceTestTypes.includes(testForm.testType)
                        ? skis.filter((s) => s.discipline === testForm.testType)
                        : skis;
                      const q = skiSearchQuery.toLowerCase().trim();
                      const filteredSkis = q
                        ? disciplineFiltered.filter((s) =>
                            [s.skiId, s.serialNumber, s.brand, s.grind, s.discipline]
                              .filter(Boolean)
                              .some((field) => field!.toLowerCase().includes(q))
                          )
                        : disciplineFiltered;
                      return disciplineFiltered.length === 0 ? (
                      <p className="text-sm text-muted-foreground" data-testid="text-no-skis-for-test">
                        No {raceTestTypes.includes(testForm.testType) ? `${testForm.testType} ` : ""}skis available. {skis.length > 0 ? "Try a different test type or add skis with the right discipline." : "Add skis to this athlete first."}
                      </p>
                    ) : (
                      <>
                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            value={skiSearchQuery}
                            onChange={(e) => setSkiSearchQuery(e.target.value)}
                            placeholder="Search serial number, ski ID, brand, grind…"
                            className="h-8 pl-8 text-sm"
                            data-testid="input-ski-search"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {filteredSkis.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No skis matching "{skiSearchQuery}"</p>
                          ) : (
                            filteredSkis.map((ski) => (
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
                                  selectedSkiIds.has(ski.id) ? "bg-indigo-500 border-indigo-500" : "border-border",
                                )}>
                                  {selectedSkiIds.has(ski.id) && (
                                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <span className="font-semibold">{ski.skiId}</span>
                                {ski.serialNumber && <span className="text-xs text-muted-foreground">#{ski.serialNumber}</span>}
                                {ski.brand && <span className="text-xs text-muted-foreground">{ski.brand}</span>}
                                {ski.grind && <span className="text-xs text-muted-foreground">· {ski.grind}</span>}
                              </button>
                            ))
                          )}
                        </div>
                      </>
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
                                  <span className="text-sm flex-1">{getParamLabel(key)}{!builtInTestParams.some(p => p.key === key) && <span className="ml-1 text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 px-1 rounded">custom</span>}</span>
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
                                      <span className="text-sm text-muted-foreground flex-1">{p.label}{!builtInTestParams.some(bp => bp.key === p.key) && <span className="ml-1 text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 px-1 rounded">custom</span>}</span>
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
              ) : testViewMode === "list" ? (
                <TestListView tests={filteredTests} skiIds={skiIds} allSkis={skis} activeTestColumns={activeTestColumns} weather={weather} />
              ) : (
                filteredTests.map((test) => (
                  <RaceSkiTestCard key={test.id} test={test} skiIds={skiIds} allSkis={skis} activeTestColumns={activeTestColumns} weather={weather} />
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
            <DialogTitle>{editingSki ? t("common.edit") : t("raceskis.addSki")}</DialogTitle>
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
              const custom = isCustomField(fieldKey);
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
                        <SelectItem value="Double Poling">Double Poling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return (
                <div key={fieldKey}>
                  <label className="mb-1 block text-sm font-medium">{getFormFieldLabel(fieldKey)}</label>
                  <Input
                    value={custom ? (customFieldValues[fieldKey] ?? "") : ((skiForm as any)[fieldKey] ?? "")}
                    onChange={(e) => {
                      if (custom) {
                        setCustomFieldValues((prev) => ({ ...prev, [fieldKey]: e.target.value }));
                      } else {
                        setSkiForm((f) => ({ ...f, [fieldKey]: e.target.value }));
                      }
                    }}
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
                      {isCustomField(key) && (
                        <span className="text-[10px] text-muted-foreground/60 bg-muted/50 rounded px-1">custom</span>
                      )}
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
                        className={cn("p-0.5", isCustomField(key) ? "text-red-400 hover:text-red-300" : "text-red-400 hover:text-red-300")}
                        onClick={() => isCustomField(key) ? deleteCustomField(key) : removeFormField(key)}
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

                <div className="border-t pt-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Add custom parameter</div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newCustomFieldName}
                      onChange={(e) => setNewCustomFieldName(e.target.value)}
                      placeholder="Parameter name..."
                      className="h-8 text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomField(); } }}
                      data-testid="input-new-custom-field"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 shrink-0"
                      onClick={addCustomField}
                      disabled={!newCustomFieldName.trim()}
                      data-testid="button-add-custom-field"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
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
            <DialogTitle>{t("raceskis.addRegrind")}</DialogTitle>
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
              <label className="mb-1 block text-sm font-medium">{t("raceskis.grindType")} *</label>
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
            <DialogTitle>{t("raceskis.manageAccess")}</DialogTitle>
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

      {/* Test Columns Chooser Dialog */}
      <Dialog open={testColumnsDialogOpen} onOpenChange={setTestColumnsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Test Result Columns</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">Choose which columns to show in test results.</div>
            <div className="space-y-2">
              {allTestColumns.map((col) => {
                const isActive = activeTestColumns.includes(col.key);
                return (
                  <label
                    key={col.key}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer"
                    data-testid={`checkbox-test-col-${col.key}`}
                  >
                    <Checkbox
                      checked={isActive}
                      onCheckedChange={(checked) => {
                        setActiveTestColumns((prev) =>
                          checked ? [...prev, col.key] : prev.filter((k) => k !== col.key)
                        );
                      }}
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SkiDetailPanel({
  ski,
  onEdit,
  onArchive,
  onRegrind,
  onDeleteRegrind,
}: {
  ski: RaceSki;
  onEdit?: () => void;
  onArchive?: () => void;
  onRegrind?: () => void;
  onDeleteRegrind?: (id: number) => void;
}) {
  const { data: regrinds = [] } = useQuery<RaceSkiRegrind[]>({
    queryKey: [`/api/race-skis/${ski.id}/regrinds`],
  });

  let customParams: Record<string, string> = {};
  try { customParams = ski.customParams ? JSON.parse(ski.customParams) : {}; } catch {}

  const paramRows: { label: string; value: string | null }[] = [
    { label: "Serial Number", value: ski.serialNumber },
    { label: "Brand", value: ski.brand },
    { label: "Discipline", value: ski.discipline },
    { label: "Construction", value: ski.construction },
    { label: "Mold", value: ski.mold },
    { label: "Base", value: ski.base },
    { label: "Grind", value: ski.grind },
    ...(ski.discipline === "Classic" ? [{ label: "Heights", value: ski.heights }] : []),
    { label: "Year", value: ski.year },
    ...Object.entries(customParams).map(([k, v]) => ({
      label: k.replace(/^custom_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: v || null,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {onRegrind && (
          <Button variant="outline" size="sm" onClick={onRegrind} className="h-7 text-xs">
            <RefreshCw className="mr-1 h-3 w-3" />
            Regrind
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit} className="h-7 text-xs">
            <Edit2 className="mr-1 h-3 w-3" />
            Edit
          </Button>
        )}
        {onArchive && (
          <Button variant="outline" size="sm" onClick={onArchive} className="h-7 text-xs text-amber-600 hover:text-amber-700">
            <Archive className="mr-1 h-3 w-3" />
            Archive
          </Button>
        )}
      </div>

      {/* All parameters */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Parameters</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
          {paramRows.map((row) => (
            <div key={row.label} className="text-xs">
              <span className="text-muted-foreground">{row.label}: </span>
              <span className="font-medium">{row.value || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Regrind history */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Regrind History</div>
        {regrinds.length === 0 ? (
          <p className="text-xs text-muted-foreground">No regrind history</p>
        ) : (
          <div className="space-y-1.5">
            {regrinds.map((rg) => (
              <div
                key={rg.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-1.5"
                data-testid={`row-regrind-panel-${rg.id}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  <span className="font-medium">{fmtDate(rg.date)}</span>
                  <span className="font-semibold text-foreground">{rg.grindType}</span>
                  {rg.stone && <span className="text-muted-foreground">Stone: {rg.stone}</span>}
                  {rg.pattern && <span className="text-muted-foreground">Pattern: {rg.pattern}</span>}
                  {rg.notes && <span className="text-muted-foreground italic">{rg.notes}</span>}
                </div>
                {onDeleteRegrind && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteRegrind(rg.id)}
                    className="h-6 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkiAnalyticsSection({
  skis,
  raceSkiTests,
  compareSkiIds,
  setCompareSkiIds,
}: {
  skis: RaceSki[];
  raceSkiTests: RaceSkiTest[];
  compareSkiIds: Set<number>;
  setCompareSkiIds: React.Dispatch<React.SetStateAction<Set<number>>>;
}) {
  const testIds = useMemo(() => raceSkiTests.map((t) => t.id), [raceSkiTests]);

  // Fetch entries for all race ski tests
  const { data: allEntries = [] } = useQuery<(TestEntry & { testId: number })[]>({
    queryKey: [`/api/athletes/analytics/entries`, testIds.join(",")],
    enabled: testIds.length > 0,
    queryFn: async () => {
      // Fetch entries for each test in parallel
      const results = await Promise.all(
        testIds.map(async (tid) => {
          const res = await fetch(`/api/tests/${tid}/entries`, { credentials: "include" });
          if (!res.ok) return [];
          const data = await res.json();
          return (data as TestEntry[]).map((e) => ({ ...e, testId: tid }));
        })
      );
      return results.flat();
    },
  });

  const skiStats = useMemo(() => {
    return skis.map((ski) => {
      const entries = allEntries.filter((e) => e.raceSkiId === ski.id);
      const testCount = new Set(entries.map((e) => e.testId)).size;
      const ranks = entries.map((e) => e.rank0km).filter((r): r is number => r !== null);
      const feelings = entries.map((e) => e.feelingRank).filter((r): r is number => r !== null);
      const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
      const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;
      const wins = ranks.filter((r) => r === 1).length;
      const winRate = ranks.length > 0 ? (wins / ranks.length) * 100 : null;
      const avgFeeling = feelings.length > 0 ? feelings.reduce((a, b) => a + b, 0) / feelings.length : null;
      return { ski, testCount, avgRank, bestRank, winRate, avgFeeling, entryCount: entries.length };
    }).filter((s) => s.entryCount > 0);
  }, [skis, allEntries]);

  const compareList = useMemo(() => skiStats.filter((s) => compareSkiIds.has(s.ski.id)), [skiStats, compareSkiIds]);

  function toggleCompare(skiId: number) {
    setCompareSkiIds((prev) => {
      const next = new Set(prev);
      if (next.has(skiId)) next.delete(skiId);
      else next.add(skiId);
      return next;
    });
  }

  if (skiStats.length === 0) {
    return (
      <div className="mt-3">
        <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-analytics">
          No test data yet for this athlete's skis.
        </Card>
      </div>
    );
  }

  const rankBadge = (rank: number | null) =>
    rank === null ? "—" : (
      <span className={cn(
        "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        rank === 1 ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" :
        rank === 2 ? "bg-slate-300/15 text-slate-500 dark:text-slate-300" :
        rank === 3 ? "bg-amber-700/15 text-amber-700 dark:text-amber-600" :
        "bg-muted/70 text-foreground"
      )}>
        #{rank}
      </span>
    );

  return (
    <div className="mt-3 space-y-4" data-testid="analytics-section">
      {/* Summary table */}
      <Card className="fs-card rounded-2xl overflow-hidden" data-testid="analytics-summary-table">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="px-4 py-2.5 font-medium">Ski</th>
                <th className="px-3 py-2.5 font-medium">Tests</th>
                <th className="px-3 py-2.5 font-medium">Entries</th>
                <th className="px-3 py-2.5 font-medium">Avg Rank</th>
                <th className="px-3 py-2.5 font-medium">Best Rank</th>
                <th className="px-3 py-2.5 font-medium">Win Rate</th>
                <th className="px-3 py-2.5 font-medium">Avg Feeling</th>
                <th className="px-3 py-2.5 font-medium">Compare</th>
              </tr>
            </thead>
            <tbody>
              {skiStats.map(({ ski, testCount, avgRank, bestRank, winRate, avgFeeling, entryCount }, idx) => (
                <tr
                  key={ski.id}
                  className={cn("border-t border-border/30", idx % 2 === 0 ? "bg-background/30" : "bg-background/10")}
                  data-testid={`analytics-row-${ski.id}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-sm">{ski.skiId}</div>
                    {ski.brand && <div className="text-xs text-muted-foreground">{ski.brand}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{testCount}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{entryCount}</td>
                  <td className="px-3 py-2.5">{avgRank !== null ? avgRank.toFixed(1) : "—"}</td>
                  <td className="px-3 py-2.5">{rankBadge(bestRank)}</td>
                  <td className="px-3 py-2.5">{winRate !== null ? `${winRate.toFixed(0)}%` : "—"}</td>
                  <td className="px-3 py-2.5">{avgFeeling !== null ? avgFeeling.toFixed(1) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={compareSkiIds.has(ski.id)}
                      onCheckedChange={() => toggleCompare(ski.id)}
                      data-testid={`checkbox-compare-${ski.id}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Comparison panel */}
      {compareList.length >= 2 && (
        <Card className="fs-card rounded-2xl p-4" data-testid="analytics-comparison">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Ski Pair Comparison</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setCompareSkiIds(new Set())}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Metric</th>
                  {compareList.map(({ ski }) => (
                    <th key={ski.id} className="px-3 py-2 font-medium">{ski.skiId}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-xs">
                {[
                  { label: "Tests", key: "testCount" as const, fmt: (v: number | null) => v ?? "—" },
                  { label: "Entries", key: "entryCount" as const, fmt: (v: number | null) => v ?? "—" },
                  { label: "Avg Rank", key: "avgRank" as const, fmt: (v: number | null) => v !== null ? v.toFixed(1) : "—" },
                  { label: "Best Rank", key: "bestRank" as const, fmt: (v: number | null) => v !== null ? `#${v}` : "—" },
                  { label: "Win Rate", key: "winRate" as const, fmt: (v: number | null) => v !== null ? `${v.toFixed(0)}%` : "—" },
                  { label: "Avg Feeling", key: "avgFeeling" as const, fmt: (v: number | null) => v !== null ? v.toFixed(1) : "—" },
                ].map((metric, mIdx) => {
                  const values = compareList.map((s) => (s as any)[metric.key] as number | null);
                  // Highlight best (lowest for rank, highest for win rate)
                  const isRankMetric = ["avgRank", "bestRank"].includes(metric.key);
                  const validVals = values.filter((v): v is number => v !== null);
                  const bestVal = validVals.length > 0
                    ? isRankMetric ? Math.min(...validVals) : Math.max(...validVals)
                    : null;
                  return (
                    <tr key={metric.key} className={cn("border-t border-border/20", mIdx % 2 === 0 ? "bg-background/20" : "")}>
                      <td className="px-2 py-2 text-muted-foreground font-medium">{metric.label}</td>
                      {values.map((val, ci) => (
                        <td
                          key={ci}
                          className={cn(
                            "px-3 py-2",
                            val !== null && val === bestVal && validVals.length > 1 && "text-emerald-600 dark:text-emerald-400 font-semibold",
                          )}
                        >
                          {metric.fmt(val)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {compareList.length === 1 && (
        <p className="text-xs text-muted-foreground mt-1">Select at least 2 ski pairs to compare.</p>
      )}
    </div>
  );
}

function SkiCard({
  ski,
  expanded,
  onToggle,
  onEdit,
  onArchive,
  onRegrind,
  onDeleteRegrind,
  isArchived,
  onRestore,
  onDelete,
}: {
  ski: RaceSki;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onRegrind?: () => void;
  onDeleteRegrind?: (id: number) => void;
  isArchived?: boolean;
  onRestore?: () => void;
  onDelete?: () => void;
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
              {(() => {
                try {
                  const cp = ski.customParams ? JSON.parse(ski.customParams) : {};
                  return Object.entries(cp).map(([k, v]) => (
                    v ? <span key={k}>{k.replace(/^custom_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}: {String(v)}</span> : null
                  ));
                } catch { return null; }
              })()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isArchived && onRegrind && (
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
          )}
          {!isArchived && onEdit && (
            <Button variant="ghost" size="sm" data-testid={`button-edit-ski-${ski.id}`} onClick={onEdit}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {!isArchived && onArchive && (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`button-archive-ski-${ski.id}`}
              onClick={onArchive}
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
              title="Archive ski"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          )}
          {isArchived && onRestore && (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`button-restore-ski-${ski.id}`}
              onClick={onRestore}
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            >
              <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
              Restore
            </Button>
          )}
          {isArchived && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`button-delete-ski-${ski.id}`}
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-border/40 pt-3 space-y-4" data-testid={`section-regrinds-${ski.id}`}>
          {/* All parameters */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parameters</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
              {[
                { label: "Serial Number", value: ski.serialNumber },
                { label: "Brand", value: ski.brand },
                { label: "Discipline", value: ski.discipline },
                { label: "Construction", value: ski.construction },
                { label: "Mold", value: ski.mold },
                { label: "Base", value: ski.base },
                { label: "Grind", value: ski.grind },
                ...(ski.discipline === "Classic" ? [{ label: "Heights", value: ski.heights }] : []),
                { label: "Year", value: ski.year },
                ...(() => {
                  try {
                    const cp = ski.customParams ? JSON.parse(ski.customParams) : {};
                    return Object.entries(cp).map(([k, v]) => ({
                      label: k.replace(/^custom_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                      value: v ? String(v) : null,
                    }));
                  } catch { return []; }
                })(),
              ].map((row) => (
                <div key={row.label} className="text-xs">
                  <span className="text-muted-foreground">{row.label}: </span>
                  <span className="font-medium">{row.value || "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Regrind history */}
          <div>
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
                      <span className="font-medium">{fmtDate(rg.date)}</span>
                      <span className="font-semibold text-foreground">{rg.grindType}</span>
                      {rg.stone && <span className="text-muted-foreground">Stone: {rg.stone}</span>}
                      {rg.pattern && <span className="text-muted-foreground">Pattern: {rg.pattern}</span>}
                      {rg.notes && <span className="text-muted-foreground italic">{rg.notes}</span>}
                    </div>
                    {onDeleteRegrind && (
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-delete-regrind-${rg.id}`}
                        onClick={() => onDeleteRegrind(rg.id)}
                        className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function TestListView({ tests, skiIds, allSkis, activeTestColumns, weather = [] }: { tests: RaceSkiTest[]; skiIds: Set<number>; allSkis: RaceSki[]; activeTestColumns: string[]; weather?: WeatherItem[] }) {
  const testIds = useMemo(() => tests.map((t) => t.id), [tests]);
  const [, navigate] = useLocation();

  const { data: allEntries = [], isLoading } = useQuery<(TestEntry & { testId: number })[]>({
    queryKey: [`/api/test-list-view/entries`, testIds.join(",")],
    enabled: testIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        testIds.map(async (tid) => {
          const res = await fetch(`/api/tests/${tid}/entries`, { credentials: "include" });
          if (!res.ok) return [];
          const data = await res.json();
          return (data as TestEntry[]).map((e) => ({ ...e, testId: tid }));
        })
      );
      return results.flat();
    },
  });

  const raceSkiById = useMemo(() => new Map(allSkis.map((s) => [s.id, s])), [allSkis]);
  const weatherById = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);

  // One row per test: count of skis tested + top ski (rank 1)
  const testRows = useMemo(() => {
    return tests.map((test) => {
      const entries = allEntries.filter((e) => e.testId === test.id && e.raceSkiId && skiIds.has(e.raceSkiId));
      const skiCount = entries.length;
      const topEntry = entries.find((e) => e.rank0km === 1) ?? entries.reduce<(typeof entries)[0] | null>((best, e) => {
        if (!best) return e;
        const bRank = best.rank0km ?? Infinity;
        const eRank = e.rank0km ?? Infinity;
        return eRank < bRank ? e : best;
      }, null);
      const topSki = topEntry?.raceSkiId ? raceSkiById.get(topEntry.raceSkiId) : undefined;
      return { test, skiCount, topSki, topEntry };
    });
  }, [tests, allEntries, skiIds, raceSkiById]);

  if (tests.length === 0) return null;

  return (
    <Card className="fs-card rounded-2xl overflow-hidden" data-testid="tests-list-view">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Location</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Weather</th>
              <th className="px-3 py-2.5 font-medium"># Skis</th>
              <th className="px-3 py-2.5 font-medium">Top Ski</th>
              <th className="px-3 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && testIds.length > 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td>
              </tr>
            ) : (
              testRows.map(({ test, skiCount, topSki, topEntry }, idx) => (
                <tr
                  key={test.id}
                  className={cn("border-t border-border/30", idx % 2 === 0 ? "bg-background/30" : "bg-background/10")}
                  data-testid={`list-row-test-${test.id}`}
                >
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{fmtDate(test.date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{test.location}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800">
                      {test.testType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[10px]">
                    {test.weatherId != null && weatherById.get(test.weatherId) ? (
                      (() => {
                        const w = weatherById.get(test.weatherId!)!;
                        const parts: string[] = [];
                        if (w.snowTemperatureC != null) parts.push(`Snow ${w.snowTemperatureC}°`);
                        if (w.airTemperatureC != null) parts.push(`Air ${w.airTemperatureC}°`);
                        if (w.snowHumidityPct != null) parts.push(`SRH ${w.snowHumidityPct}%`);
                        if (w.airHumidityPct != null) parts.push(`ARH ${w.airHumidityPct}%`);
                        if (w.wind) parts.push(w.wind);
                        if (w.snowType) parts.push(w.snowType);
                        if (w.trackHardness) parts.push(w.trackHardness);
                        if (w.grainSize) parts.push(w.grainSize);
                        if (w.precipitation) parts.push(w.precipitation);
                        if (w.testQuality != null) parts.push(`Q${w.testQuality}/5`);
                        return parts.length > 0
                          ? <span className="text-muted-foreground">{parts.join(" · ")}</span>
                          : <span className="opacity-50">—</span>;
                      })()
                    ) : <span className="opacity-50 text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {skiCount > 0 ? skiCount : <span className="opacity-50">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {topSki ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400">#1</span>
                        <span className="font-medium">{topSki.skiId}</span>
                      </span>
                    ) : <span className="text-muted-foreground opacity-50">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                      onClick={() => navigate(`/tests/${test.id}`)}
                      data-testid={`list-open-test-${test.id}`}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RaceSkiTestCard({ test, skiIds, allSkis, activeTestColumns, weather = [] }: { test: RaceSkiTest; skiIds: Set<number>; allSkis: RaceSki[]; activeTestColumns: string[]; weather?: WeatherItem[] }) {
  const weatherMap = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);
  const [expanded, setExpanded] = useState(false);
  const [, navigate] = useLocation();

  const { data: entries = [] } = useQuery<TestEntry[]>({
    queryKey: [`/api/tests/${test.id}/entries`],
    enabled: expanded,
  });

  const relevantEntries = useMemo(() => {
    if (entries.length === 0) return [];
    return entries.filter((e) => e.raceSkiId && skiIds.has(e.raceSkiId));
  }, [entries, skiIds]);

  const raceSkiById = useMemo(() => new Map(allSkis.map((s) => [s.id, s])), [allSkis]);
  const getSkiLabel = (entry: TestEntry) => {
    if (entry.raceSkiId) {
      const rs = raceSkiById.get(entry.raceSkiId);
      if (rs) return rs.serialNumber || rs.skiId;
    }
    return String(entry.skiNumber);
  };

  if (expanded && entries.length > 0 && relevantEntries.length === 0) {
    return null;
  }

  return (
    <Card className="fs-card rounded-2xl p-4" data-testid={`card-test-${test.id}`}>
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1"
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
              {fmtDate(test.date)}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-test-location-${test.id}`}>
              <MapPin className="h-3 w-3" />
              {test.location}
            </span>
            <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800" data-testid={`text-test-type-${test.id}`}>
              {test.testType}
            </span>
            {test.weatherId != null && weatherMap.get(test.weatherId) && (() => {
              const w = weatherMap.get(test.weatherId!)!;
              const badges: { label: string; value: string; color: string }[] = [];
              if (w.snowTemperatureC != null) badges.push({ label: "Snow", value: `${w.snowTemperatureC}°C`, color: "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800" });
              if (w.airTemperatureC != null) badges.push({ label: "Air", value: `${w.airTemperatureC}°C`, color: "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 ring-orange-200 dark:ring-orange-800" });
              if (w.snowHumidityPct != null) badges.push({ label: "Snow RH", value: `${w.snowHumidityPct}%`, color: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 ring-cyan-200 dark:ring-cyan-800" });
              if (w.airHumidityPct != null) badges.push({ label: "Air RH", value: `${w.airHumidityPct}%`, color: "bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700" });
              if (w.wind) badges.push({ label: "Wind", value: w.wind, color: "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 ring-teal-200 dark:ring-teal-800" });
              if (w.snowType) badges.push({ label: "Snow", value: w.snowType, color: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-800" });
              if (w.trackHardness) badges.push({ label: "Track", value: w.trackHardness, color: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800" });
              if (w.grainSize) badges.push({ label: "Grain", value: w.grainSize, color: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-800" });
              if (w.precipitation) badges.push({ label: "Precip", value: w.precipitation, color: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-800" });
              if (w.clouds != null) badges.push({ label: "Clouds", value: `${w.clouds}/8`, color: "bg-muted text-muted-foreground ring-border" });
              if (w.visibility) badges.push({ label: "Visibility", value: w.visibility, color: "bg-muted text-muted-foreground ring-border" });
              if (w.naturalSnow) badges.push({ label: "Natural", value: w.naturalSnow, color: "bg-muted text-muted-foreground ring-border" });
              if (w.artificialSnow) badges.push({ label: "Artificial", value: w.artificialSnow, color: "bg-muted text-muted-foreground ring-border" });
              if (w.testQuality != null) badges.push({ label: "Quality", value: `${w.testQuality}/5`, color: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800" });
              return badges.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {badges.map((b, i) => (
                    <span key={i} className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${b.color}`}>
                      <span className="opacity-60">{b.label}</span>
                      <span className="font-semibold">{b.value}</span>
                    </span>
                  ))}
                </div>
              ) : null;
            })()}
            <span className="text-xs text-muted-foreground">{test.createdByName}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate(`/tests/${test.id}`)}
          data-testid={`button-view-test-${test.id}`}
        >
          Open
        </Button>
      </div>

      {expanded && relevantEntries.length > 0 && (
        <div className="mt-3 border-t border-border/40 pt-3" data-testid={`section-test-entries-${test.id}`}>
          <div className="overflow-x-auto rounded-xl border bg-card/50">
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  {activeTestColumns.includes("skiId") && <th className="px-3 py-2">Ski ID</th>}
                  {!activeTestColumns.includes("skiId") && <th className="px-3 py-2">Ski</th>}
                  {activeTestColumns.includes("serialNumber") && <th className="px-3 py-2">Serial</th>}
                  {activeTestColumns.includes("brand") && <th className="px-3 py-2">Brand</th>}
                  {activeTestColumns.includes("discipline") && <th className="px-3 py-2">Discipline</th>}
                  {activeTestColumns.includes("construction") && <th className="px-3 py-2">Construction</th>}
                  {activeTestColumns.includes("mold") && <th className="px-3 py-2">Mold</th>}
                  {activeTestColumns.includes("base") && <th className="px-3 py-2">Base</th>}
                  {activeTestColumns.includes("grind") && <th className="px-3 py-2">Grind</th>}
                  {activeTestColumns.includes("heights") && <th className="px-3 py-2">Heights</th>}
                  {activeTestColumns.includes("year") && <th className="px-3 py-2">Year</th>}
                  {activeTestColumns.includes("result") && <th className="px-3 py-2">Result</th>}
                  {activeTestColumns.includes("rank") && <th className="px-3 py-2">Rank</th>}
                  {activeTestColumns.includes("feeling") && <th className="px-3 py-2">Feeling</th>}
                  {activeTestColumns.includes("methodology") && <th className="px-3 py-2">Methodology</th>}
                </tr>
              </thead>
              <tbody>
                {relevantEntries.map((entry) => {
                  const linkedSki = entry.raceSkiId ? raceSkiById.get(entry.raceSkiId) : undefined;
                  return (
                  <tr key={entry.id} className="border-t" data-testid={`row-test-result-${entry.id}`}>
                    {activeTestColumns.includes("skiId") ? (
                      <td className="px-3 py-1.5 font-medium">{linkedSki?.skiId ?? getSkiLabel(entry)}</td>
                    ) : (
                      <td className="px-3 py-1.5 font-medium">{getSkiLabel(entry)}</td>
                    )}
                    {activeTestColumns.includes("serialNumber") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.serialNumber ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("brand") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.brand ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("discipline") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.discipline ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("construction") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.construction ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("mold") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.mold ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("base") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.base ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("grind") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.grind ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("heights") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.heights ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("year") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{linkedSki?.year ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("result") && (
                      <td className="px-3 py-1.5">{entry.result0kmCmBehind ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("rank") && (
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
                    )}
                    {activeTestColumns.includes("feeling") && (
                      <td className="px-3 py-1.5">{entry.feelingRank ?? "—"}</td>
                    )}
                    {activeTestColumns.includes("methodology") && (
                      <td className="px-3 py-1.5 text-muted-foreground">{entry.methodology || "—"}</td>
                    )}
                  </tr>
                  );
                })}
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

// ─── Full-page analytics view (shown when ?view=analytics) ───────────────────

function AthleteAnalyticsView({
  skis,
  raceSkiTests,
  compareSkiIds,
  setCompareSkiIds,
}: {
  skis: RaceSki[];
  raceSkiTests: RaceSkiTest[];
  compareSkiIds: Set<number>;
  setCompareSkiIds: React.Dispatch<React.SetStateAction<Set<number>>>;
}) {
  const testIds = useMemo(() => raceSkiTests.map((t) => t.id), [raceSkiTests]);

  const { data: allEntries = [] } = useQuery<(TestEntry & { testId: number })[]>({
    queryKey: [`/api/athletes/analytics/entries`, testIds.join(",")],
    enabled: testIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        testIds.map(async (tid) => {
          const res = await fetch(`/api/tests/${tid}/entries`, { credentials: "include" });
          if (!res.ok) return [];
          const data = await res.json();
          return (data as TestEntry[]).map((e) => ({ ...e, testId: tid }));
        })
      );
      return results.flat();
    },
  });

  // Weather data for conditions analysis
  const { data: weather = [] } = useQuery<WeatherItem[]>({
    queryKey: ["/api/weather"],
  });

  const weatherById = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);

  const skiStats = useMemo(() => {
    return skis.map((ski) => {
      const entries = allEntries.filter((e) => e.raceSkiId === ski.id);
      const testCount = new Set(entries.map((e) => e.testId)).size;
      const ranks = entries.map((e) => e.rank0km).filter((r): r is number => r !== null);
      const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
      const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;
      const wins = ranks.filter((r) => r === 1).length;
      const winRate = ranks.length > 0 ? (wins / ranks.length) * 100 : null;
      return { ski, testCount, avgRank, bestRank, winRate, entryCount: entries.length };
    }).filter((s) => s.entryCount > 0).sort((a, b) => (a.avgRank ?? 999) - (b.avgRank ?? 999));
  }, [skis, allEntries]);

  // Snow temp brackets
  const tempBrackets = [
    { label: "< -10°C", test: (t: number) => t < -10 },
    { label: "-10 to -5°C", test: (t: number) => t >= -10 && t < -5 },
    { label: "-5 to 0°C", test: (t: number) => t >= -5 && t < 0 },
    { label: "0°C+", test: (t: number) => t >= 0 },
  ];

  // Avg rank by snow temp bracket for top 5 skis
  const top5Skis = skiStats.slice(0, 5);
  const conditionsChartData = useMemo(() => {
    return tempBrackets.map(({ label, test: inBracket }) => {
      const row: Record<string, string | number> = { bracket: label };
      for (const { ski } of top5Skis) {
        const entries = allEntries.filter((e) => e.raceSkiId === ski.id);
        const bracketEntries = entries.filter((e) => {
          const testObj = raceSkiTests.find((t) => t.id === e.testId);
          if (!testObj?.weatherId) return false;
          const w = weatherById.get(testObj.weatherId);
          if (!w || w.snowTemperatureC === null) return false;
          return inBracket(w.snowTemperatureC);
        });
        const ranks = bracketEntries.map((e) => e.rank0km).filter((r): r is number => r !== null);
        row[ski.skiId] = ranks.length > 0 ? parseFloat((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1)) : 0;
      }
      return row;
    });
  }, [allEntries, raceSkiTests, weatherById, top5Skis]);

  // Best conditions per ski: show snow temp range where ski ranked #1 or top 3
  const bestConditionsPerSki = useMemo(() => {
    return skiStats.map(({ ski }) => {
      const entries = allEntries.filter((e) => e.raceSkiId === ski.id);
      const top1Conditions: string[] = [];
      const top3Conditions: string[] = [];
      for (const { label, test: inBracket } of tempBrackets) {
        const bracketEntries = entries.filter((e) => {
          const testObj = raceSkiTests.find((t) => t.id === e.testId);
          if (!testObj?.weatherId) return false;
          const w = weatherById.get(testObj.weatherId);
          if (!w || w.snowTemperatureC === null) return false;
          return inBracket(w.snowTemperatureC);
        });
        const hasWin = bracketEntries.some((e) => e.rank0km === 1);
        const hasTop3 = bracketEntries.some((e) => e.rank0km !== null && e.rank0km <= 3);
        if (hasWin) top1Conditions.push(label);
        else if (hasTop3) top3Conditions.push(label);
      }
      return { ski, top1Conditions, top3Conditions };
    });
  }, [skiStats, allEntries, raceSkiTests, weatherById]);

  const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

  if (skiStats.length === 0) {
    return (
      <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-analytics-view">
        No test data yet. Add race ski tests to see analytics.
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="full-analytics-view">
      {/* Per-ski performance summary */}
      <Card className="fs-card rounded-2xl overflow-hidden" data-testid="analytics-perf-table">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold">Per-Ski Performance Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="px-4 py-2.5 font-medium">Ski ID</th>
                <th className="px-3 py-2.5 font-medium"># Tests</th>
                <th className="px-3 py-2.5 font-medium">Avg Rank</th>
                <th className="px-3 py-2.5 font-medium">Best Rank</th>
                <th className="px-3 py-2.5 font-medium">Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {skiStats.map(({ ski, testCount, avgRank, bestRank, winRate }, idx) => (
                <tr
                  key={ski.id}
                  className={cn("border-t border-border/30", idx % 2 === 0 ? "bg-background/30" : "bg-background/10")}
                  data-testid={`analytics-perf-row-${ski.id}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{ski.skiId}</div>
                    {ski.brand && <div className="text-xs text-muted-foreground">{ski.brand}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{testCount}</td>
                  <td className="px-3 py-2.5">{avgRank !== null ? avgRank.toFixed(1) : "—"}</td>
                  <td className="px-3 py-2.5">
                    {bestRank !== null ? (
                      <span className={cn(
                        "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        bestRank === 1 ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" :
                        bestRank === 2 ? "bg-slate-300/15 text-slate-500 dark:text-slate-300" :
                        bestRank === 3 ? "bg-amber-700/15 text-amber-700 dark:text-amber-600" :
                        "bg-muted/70 text-foreground"
                      )}>#{bestRank}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5">{winRate !== null ? `${winRate.toFixed(0)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top skis per condition bracket — bar chart */}
      {top5Skis.length > 0 && conditionsChartData.some((d) => top5Skis.some(({ ski }) => (d[ski.skiId] as number) > 0)) && (
        <Card className="fs-card rounded-2xl p-4" data-testid="analytics-conditions-chart">
          <h2 className="text-base font-semibold mb-4">Avg Rank by Snow Temperature (Top 5 Skis)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={conditionsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="bracket" tick={{ fontSize: 11 }} />
              <YAxis reversed tick={{ fontSize: 11 }} label={{ value: "Avg Rank", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value: number) => [value === 0 ? "No data" : value.toFixed(1), ""]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {top5Skis.map(({ ski }, i) => (
                <Bar key={ski.id} dataKey={ski.skiId} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-muted-foreground">Lower rank = better. 0 = no data in that bracket.</p>
        </Card>
      )}

      {/* Best conditions per ski */}
      <Card className="fs-card rounded-2xl overflow-hidden" data-testid="analytics-best-conditions">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold">Best Conditions Per Ski</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Snow temperature ranges where each ski ranked #1 or top 3</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="px-4 py-2.5 font-medium">Ski ID</th>
                <th className="px-3 py-2.5 font-medium">Won in conditions</th>
                <th className="px-3 py-2.5 font-medium">Top 3 in conditions</th>
              </tr>
            </thead>
            <tbody>
              {bestConditionsPerSki.map(({ ski, top1Conditions, top3Conditions }, idx) => (
                <tr
                  key={ski.id}
                  className={cn("border-t border-border/30", idx % 2 === 0 ? "bg-background/30" : "bg-background/10")}
                  data-testid={`analytics-conditions-row-${ski.id}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{ski.skiId}</div>
                    {ski.brand && <div className="text-xs text-muted-foreground">{ski.brand}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    {top1Conditions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {top1Conditions.map((c) => (
                          <span key={c} className="inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {top3Conditions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {top3Conditions.map((c) => (
                          <span key={c} className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Existing ski comparison section */}
      <SkiAnalyticsSection
        skis={skis}
        raceSkiTests={raceSkiTests}
        compareSkiIds={compareSkiIds}
        setCompareSkiIds={setCompareSkiIds}
      />
    </div>
  );
}
