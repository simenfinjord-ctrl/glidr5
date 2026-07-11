import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Plus, Pencil, DollarSign, Trash2, KeyRound, Check, X, Clock, Download, Upload, EyeOff,
  Users, FlaskConical, Package, Layers, CloudSun, Disc3, LogIn, Activity, BarChart3,
  Shield, LogOut, ToggleLeft, ToggleRight, Database, AlertTriangle, Sparkles,
  HardDrive, UserX, Eraser, RefreshCw, Building2, Settings2, Watch, ChevronDown, LockKeyhole, Hash, RotateCcw,
  MessageSquare, UserPlus, FileText, ExternalLink, LayoutDashboard, CreditCard, Mail, MoreVertical, Search,
} from "lucide-react";
import {
  PERMISSION_AREAS, DEFAULT_PERMISSIONS, ROLE_PRESETS,
  TEAM_FEATURES, FEATURE_LABELS, FEATURE_CATEGORIES, PLAN_FEATURE_PRESETS,
} from "@shared/schema";
import type { UserPermissions, PermissionLevel } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateFeatureGuidePDF } from "@/lib/featureGuidePdf";
import { generateStrategyPDF } from "@/lib/strategyPdf";
import { generateLetterOfIntentPDF } from "@/lib/letterOfIntentPdf";
import { generateSalesPDF } from "@/lib/pdf-sales";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ApiUser = {
  id: number;
  email: string;
  name: string;
  username?: string;
  groupScope: string;
  isAdmin: number;
  isTeamAdmin: number;
  isBlindTester: number;
  teamId: number;
  permissions: string;
  isActive: number;
  garminWatch: number;
  loginLocked: number;
  failedAttempts: number;
  createdAt?: string;
  isAthleteAccess?: number;
  linkedAthleteId?: number | null;
  canViewAllTeams?: number;
  fromOtherTeam?: boolean;
  homeTeamId?: number;
};

type ApiTeam = {
  id: number;
  name: string;
  createdAt: string;
  isDefault: number;
  enabledAreas: string | null;
  backupSheetUrl: string | null;
  lastBackupAt: string | null;
  lastBackupError?: string | null;
  lastBackupErrorAt?: string | null;
  isPaused?: number;
  // Billing fields (camelCase from Drizzle)
  planName?: string;
  subscriptionStatus?: string;
  customPrice?: number | null;
  billingPeriod?: string | null;
  nextBillingDate?: string | null;
  maxUsers?: number | null;
  maxGroups?: number | null;
  maxTests?: number | null;
  maxProducts?: number | null;
  // Also snake_case for raw queries
  plan_name?: string;
  custom_price?: number | null;
  billing_period?: string | null;
  next_billing_date?: string | null;
  max_users?: number | null;
  max_groups?: number | null;
  max_tests?: number | null;
  max_products?: number | null;
  notes?: string | null;
  teamLogo?: string | null;
};

function parsePermissions(permStr: string): UserPermissions {
  try {
    const parsed = JSON.parse(permStr);
    for (const key of Object.keys(parsed)) {
      if (parsed[key] === "view") parsed[key] = "edit";
    }
    return parsed;
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

function PermissionsMatrix({
  value,
  onChange,
  testIdPrefix,
  onPresetApplied,
  disabledAreas,
}: {
  value: UserPermissions;
  onChange: (perms: UserPermissions) => void;
  testIdPrefix: string;
  onPresetApplied?: (blindTester: boolean) => void;
  disabledAreas?: string[];
}) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const areaLabels: Record<string, string> = {
    dashboard: t("nav.dashboard"),
    tests: t("nav.tests"),
    testskis: t("nav.testskis"),
    products: t("nav.products"),
    weather: t("nav.weather"),
    analytics: t("nav.analytics"),
    grinding: t("nav.grinding"),
    raceskis: t("nav.raceskis"),
    kick: "Kick",
    raceprep: t("nav.raceprep"),
    raceprepGlide: t("nav.raceprepGlide"),
    suggestions: t("nav.suggestions"),
    liverunsheets: t("nav.liveRunsheets"),
  };
  const levels: PermissionLevel[] = ["none", "edit"];
  const levelStyles: Record<PermissionLevel, { active: string; inactive: string }> = {
    none: { active: "bg-gray-500 text-white", inactive: "text-muted-foreground hover:bg-muted" },
    view: { active: "bg-green-500 text-white", inactive: "text-green-600 hover:bg-green-50" },
    edit: { active: "bg-green-500 text-white", inactive: "text-green-600 hover:bg-green-50" },
  };

  const setAll = (level: PermissionLevel) => {
    const next = { ...value };
    for (const area of PERMISSION_AREAS) {
      if (disabledAreas?.includes(area)) {
        next[area] = "none";
      } else {
        next[area] = level;
      }
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-medium">{t("admin.permissions")}</span>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground mr-1">{t("admin.presets")}</span>
          {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              className="rounded-full px-2 py-0.5 text-[10px] font-medium border border-teal-300 text-teal-600 hover:bg-teal-50 transition-colors"
              onClick={() => { onChange({ ...preset.permissions }); onPresetApplied?.(!!preset.blindTester); }}
              data-testid={`${testIdPrefix}-preset-${key}`}
            >
              {preset.label}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground ml-1 mr-1">{t("admin.setAll")}</span>
          {levels.map((l) => (
            <button
              key={l}
              type="button"
              className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors", levelStyles[l].inactive, "border-border")}
              onClick={() => setAll(l)}
              data-testid={`${testIdPrefix}-setall-${l}`}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border divide-y divide-border">
        {PERMISSION_AREAS.map((area) => {
          const isDisabled = disabledAreas?.includes(area);
          return (
          <div key={area} className={cn("flex items-center justify-between px-3 h-8", isDisabled && "opacity-40")}>
            <span className="text-xs text-foreground/80">{areaLabels[area] || area}{isDisabled ? " (not available)" : ""}</span>
            <div className="flex items-center gap-0.5">
              {levels.map((l) => {
                const selected = isDisabled ? l === "none" : (value[area] || "none") === l;
                return (
                  <button
                    key={l}
                    type="button"
                    disabled={isDisabled}
                    data-testid={`${testIdPrefix}-${area}${selected ? "" : `-opt-${l}`}`}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors",
                      selected ? levelStyles[l].active : levelStyles[l].inactive,
                      isDisabled && "cursor-not-allowed"
                    )}
                    onClick={() => !isDisabled && onChange({ ...value, [area]: l })}
                  >
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

type ApiGroup = { id: number; name: string; teamId: number };

type LoginLog = {
  id: number;
  userId: number;
  email: string;
  name: string;
  loginAt: string;
  ipAddress: string | null;
  action: string;
  details: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
};

type AdminStats = {
  userCount: number;
  testCount: number;
  productCount: number;
  seriesCount: number;
  weatherCount: number;
  grindingCount: number;
  loginCount: number;
  activityCount: number;
};

type ActivityEntry = {
  id: number;
  userId: number;
  userName: string;
  action: string;
  entityType: string;
  entityId: number;
  details: string;
  snapshot?: string | null;
  createdAt: string;
  groupScope: string;
};

type TabId = "overview" | "users" | "groups" | "teams" | "security" | "backup" | "activity" | "logins" | "data" | "danger" | "registrations" | "accounting" | "guide" | "watch";

function parseGroups(groupScope: string): string[] {
  return groupScope.split(",").map((s) => s.trim()).filter(Boolean);
}

function GroupCheckboxes({
  groupNames,
  selected,
  onChange,
  testIdPrefix,
}: {
  groupNames: string[];
  selected: string[];
  onChange: (groups: string[]) => void;
  testIdPrefix: string;
}) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  return (
    <div className="flex flex-wrap gap-2">
      {groupNames.map((g) => {
        const checked = selected.includes(g);
        return (
          <label
            key={g}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all",
              checked
                ? "border-primary/50 bg-primary/10 text-primary ring-1 ring-primary/20"
                : "border-border bg-muted/30 text-muted-foreground hover:bg-background/50"
            )}
            data-testid={`${testIdPrefix}-${g}`}
          >
            <input
              type="checkbox"
              checked={checked}
              className="sr-only"
              onChange={() => {
                if (checked) {
                  onChange(selected.filter((s) => s !== g));
                } else {
                  onChange([...selected, g]);
                }
              }}
            />
            <span className={cn(
              "flex h-4 w-4 items-center justify-center rounded border transition-colors",
              checked ? "border-primary bg-primary text-white" : "border-muted-foreground/40"
            )}>
              {checked && <Check className="h-3 w-3" />}
            </span>
            {g}
          </label>
        );
      })}
    </div>
  );
}

const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  username: z.string().optional(),
  password: z.string().min(1, "Password is required"),
  groupScope: z.string().min(1, "At least one group is required"),
  isAdmin: z.boolean(),
  isTeamAdmin: z.boolean(),
  isBlindTester: z.boolean(),
  permissions: z.string(),
  isActive: z.boolean(),
  teamId: z.number().optional(),
  language: z.string().default("no"),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  username: z.string().optional(),
  groupScope: z.string().min(1, "At least one group is required"),
  isAdmin: z.boolean(),
  isTeamAdmin: z.boolean(),
  isBlindTester: z.boolean(),
  permissions: z.string(),
  isActive: z.boolean(),
  teamId: z.number().optional(),
});

const resetSchema = z.object({
  password: z.string()
    .min(7, "Password must be at least 7 characters")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

function getTeamDisabledAreas(teams: ApiTeam[], teamId: number, isSuperAdmin: boolean): string[] {
  if (isSuperAdmin) return [];
  const team = teams.find((t) => t.id === teamId);
  if (!team || !team.enabledAreas) return [];
  try {
    const enabled: string[] = JSON.parse(team.enabledAreas);
    // raceprepGlide is a sub-permission of raceprep — available whenever raceprep is.
    return PERMISSION_AREAS.filter((a) => {
      const enablingArea = a === "raceprepGlide" ? "raceprep" : a;
      return !enabled.includes(enablingArea);
    });
  } catch {
    return [];
  }
}

const ATHLETE_ACCESS_PERMISSIONS: UserPermissions = {
  dashboard: "view", tests: "view", testskis: "view", products: "none",
  weather: "none", analytics: "view", grinding: "none",
  raceskis: "view", suggestions: "view",
} as UserPermissions;

// Small uppercase section label with a hairline — shared by the redesigned
// user/team dialogs so long forms read as clear sections instead of one scroll.
function FormSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// Generate a readable, strong password (no ambiguous chars).
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[arr[i] % chars.length];
  return p + "!2";
}

function CreateUserForm({ onDone, allGroups, defaultTeamId, teams }: { onDone: () => void; allGroups: ApiGroup[]; defaultTeamId: number; teams: ApiTeam[] }) {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [perms, setPerms] = useState<UserPermissions>({ ...DEFAULT_PERMISSIONS });
  const [doSendWelcomeEmail, setDoSendWelcomeEmail] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId);
  const [isAthleteAccess, setIsAthleteAccess] = useState(false);
  const [linkedAthleteId, setLinkedAthleteId] = useState<number | null>(null);
  // The role choice sets sensible permissions; the full matrix stays collapsed
  // behind "Tilpass" for the rare case where they need adjusting.
  const [showPermMatrix, setShowPermMatrix] = useState(false);
  const teamChanged = selectedTeamId !== defaultTeamId;
  const { data: teamGroups } = useQuery<ApiGroup[]>({
    queryKey: [`/api/groups?teamScope=${selectedTeamId}`],
    enabled: teamChanged && isSuperAdmin,
  });
  const { data: athletes = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/athletes"],
    enabled: true,
  });
  const effectiveGroups = teamChanged && teamGroups ? teamGroups : allGroups;
  const groupNames = effectiveGroups.filter((g) => g.teamId === selectedTeamId).map((g) => g.name);
  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", username: "", password: "Password123!", groupScope: groupNames[0] || "", isAdmin: false, isTeamAdmin: false, isBlindTester: false, permissions: JSON.stringify(DEFAULT_PERMISSIONS), isActive: true, teamId: defaultTeamId, language: "no" },
  });

  const selectedGroups = parseGroups(form.watch("groupScope"));

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema>) => {
      const res = await apiRequest("POST", "/api/users", { ...data, sendWelcomeEmail: doSendWelcomeEmail, isAthleteAccess, linkedAthleteId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: L("Bruker opprettet", "User created") });
      onDone();
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const currentRole = form.watch("isAdmin") ? "superadmin" : form.watch("isTeamAdmin") ? "teamadmin" : isAthleteAccess ? "athleteaccess" : "member";
  const applyRole = (v: string) => {
    form.setValue("isAdmin", v === "superadmin");
    form.setValue("isTeamAdmin", v === "teamadmin");
    if (v === "athleteaccess") {
      setIsAthleteAccess(true);
      form.setValue("isAdmin", false);
      form.setValue("isTeamAdmin", false);
      setPerms(ATHLETE_ACCESS_PERMISSIONS);
      form.setValue("permissions", JSON.stringify(ATHLETE_ACCESS_PERMISSIONS));
    } else {
      setIsAthleteAccess(false);
      setLinkedAthleteId(null);
      // Team/Super Admins get full page access (server still gates by the
      // team's enabled areas).
      if (v === "teamadmin" || v === "superadmin") {
        const full = Object.fromEntries(PERMISSION_AREAS.map((a) => [a, "edit"])) as UserPermissions;
        setPerms(full);
        form.setValue("permissions", JSON.stringify(full));
      }
    }
  };
  const roleOptions: { key: string; label: string; desc: string }[] = [
    { key: "member", label: L("Medlem", "Member"), desc: L("Tilgang etter rettigheter", "Access per permissions") },
    { key: "teamadmin", label: L("Lagadmin", "Team Admin"), desc: L("Full tilgang + admin", "Full access + admin") },
    ...(isSuperAdmin ? [{ key: "superadmin", label: L("Superadmin", "Super Admin"), desc: L("Hele systemet", "Entire system") }] : []),
    { key: "athleteaccess", label: L("Utøvertilgang", "Athlete Access"), desc: L("Kun egen utøver", "Own athlete only") },
  ];
  const enabledAreaCount = PERMISSION_AREAS.filter((a) => perms[a] !== "none").length;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        {/* ── Profil ── */}
        <FormSectionLabel>{L("Profil", "Profile")}</FormSectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>{L("Navn", "Name")}</FormLabel><FormControl><Input {...field} placeholder="Ola Nordmann" data-testid="input-user-name" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>{L("E-post", "Email")}</FormLabel><FormControl><Input {...field} placeholder="navn@lag.no" data-testid="input-user-email" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel>{L("Passord", "Password")}</FormLabel>
              <div className="flex gap-2">
                <FormControl><Input {...field} className="font-mono" autoComplete="new-password" data-testid="input-user-password" /></FormControl>
                <Button type="button" variant="outline" className="shrink-0 text-xs" onClick={() => form.setValue("password", generatePassword())} data-testid="button-generate-password">{L("Generer", "Generate")}</Button>
              </div>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="username" render={({ field }) => (
            <FormItem>
              <FormLabel>{L("Brukernavn", "Username")} <span className="text-xs text-muted-foreground font-normal">({L("valgfritt", "optional")})</span></FormLabel>
              <FormControl><Input {...field} placeholder={L("auto fra e-post", "auto from email")} autoComplete="off" data-testid="input-user-username" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* ── Rolle ── */}
        <FormSectionLabel>{L("Rolle", "Role")}</FormSectionLabel>
        <div className={cn("grid gap-2", roleOptions.length === 4 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3")} data-testid="select-user-role">
          {roleOptions.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => applyRole(r.key)}
              data-testid={`role-card-${r.key}`}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-all",
                currentRole === r.key
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:bg-muted/40"
              )}
            >
              <p className={cn("text-sm font-medium", currentRole === r.key ? "text-primary" : "text-foreground")}>{r.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{r.desc}</p>
            </button>
          ))}
        </div>
        {isAthleteAccess && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{L("Tilknyttet utøver", "Linked Athlete")}</label>
            <Select
              value={linkedAthleteId ? String(linkedAthleteId) : ""}
              onValueChange={(v) => setLinkedAthleteId(v ? parseInt(v) : null)}
            >
              <SelectTrigger><SelectValue placeholder={L("Velg utøver...", "Select athlete...")} /></SelectTrigger>
              <SelectContent>
                {athletes.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── Tilgang ── */}
        <FormSectionLabel>{L("Tilgang", "Access")}</FormSectionLabel>
        {isSuperAdmin && teams.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{L("Lag", "Team")}</label>
            <Select
              value={String(selectedTeamId)}
              onValueChange={(v) => {
                const newTeamId = parseInt(v);
                setSelectedTeamId(newTeamId);
                form.setValue("teamId", newTeamId);
                form.setValue("groupScope", "");
              }}
            >
              <SelectTrigger data-testid="select-create-team"><SelectValue /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {groupNames.length > 0 && (
          <FormField control={form.control} name="groupScope" render={({ field }) => (
            <FormItem>
              <FormLabel>{L("Grupper", "Groups")}</FormLabel>
              <FormControl>
                <GroupCheckboxes
                  groupNames={groupNames}
                  selected={selectedGroups}
                  onChange={(groups) => field.onChange(groups.join(","))}
                  testIdPrefix="checkbox-create-group"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
        {!isAthleteAccess && (
          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setShowPermMatrix((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              data-testid="button-toggle-permissions"
            >
              <div>
                <p className="text-sm font-medium">{L("Rettigheter", "Permissions")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {enabledAreaCount} {L("av", "of")} {PERMISSION_AREAS.length} {L("områder på — satt av rollen", "areas on — set by the role")}
                </p>
              </div>
              <span className="flex items-center gap-1 text-xs text-primary shrink-0">
                {showPermMatrix ? L("Skjul", "Hide") : L("Tilpass", "Adjust")}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showPermMatrix && "rotate-180")} />
              </span>
            </button>
            {showPermMatrix && (
              <div className="border-t border-border p-3">
                <PermissionsMatrix
                  value={perms}
                  onChange={(p) => { setPerms(p); form.setValue("permissions", JSON.stringify(p)); }}
                  testIdPrefix="select-create-perm"
                  onPresetApplied={(blind) => form.setValue("isBlindTester", blind)}
                  disabledAreas={getTeamDisabledAreas(teams, selectedTeamId, isSuperAdmin)}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Innstillinger ── */}
        <FormSectionLabel>{L("Innstillinger", "Settings")}</FormSectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2" data-testid="checkbox-send-welcome-email">
            <label htmlFor="toggle-welcome-email" className="flex cursor-pointer items-center gap-2 text-sm select-none">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              {t("admin.sendWelcomeEmail")}
            </label>
            <Switch id="toggle-welcome-email" checked={doSendWelcomeEmail} onCheckedChange={setDoSendWelcomeEmail} />
          </div>
          <FormField control={form.control} name="isBlindTester" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2 space-y-0">
              <label htmlFor="toggle-blind-create" className="flex cursor-pointer items-center gap-2 text-sm select-none" title={L("Produkter og metodikk skjult for denne brukeren", "Products & methodology hidden from this user")}>
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                {L("Blindtester", "Blind tester")}
              </label>
              <FormControl><Switch id="toggle-blind-create" checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-create-blind-tester" /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="isActive" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2 space-y-0">
              <label htmlFor="toggle-active-create" className="text-sm cursor-pointer select-none">{L("Aktiv konto", "Active account")}</label>
              <FormControl><Switch id="toggle-active-create" checked={field.value} onCheckedChange={field.onChange} data-testid="select-user-status" /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="language" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 space-y-0">
              <FormLabel className="text-sm font-normal">{L("Språk", "Language")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger className="h-8 w-28 text-xs" data-testid="select-user-language"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="no">Norsk</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
        </div>

        {/* Sticky footer — always visible while the form scrolls */}
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-2 flex items-center justify-between gap-3 border-t border-border bg-background px-6 py-3">
          <span className="text-xs text-muted-foreground">{L("Alle felt kan endres senere", "Everything can be changed later")}</span>
          <Button type="submit" data-testid="button-create-user" disabled={mutation.isPending}>
            {mutation.isPending ? L("Oppretter…", "Creating…") : L("Opprett bruker", "Create user")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function TeamPermRow({
  userId, team, existingPerms, existingGroupScope, existingIsTeamAdmin, allTeams, isExpanded, onToggle, onSaved, onReset,
}: {
  userId: number;
  team: ApiTeam;
  existingPerms: string | null;
  existingGroupScope: string | null;
  existingIsTeamAdmin: boolean;
  allTeams: ApiTeam[];
  isExpanded: boolean;
  onToggle: () => void;
  onSaved: () => void;
  onReset: () => void;
}) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const [localPerms, setLocalPerms] = useState<UserPermissions>(
    existingPerms ? parsePermissions(existingPerms) : { ...DEFAULT_PERMISSIONS }
  );
  const [localGroupScope, setLocalGroupScope] = useState<string[]>(
    existingGroupScope ? parseGroups(existingGroupScope) : []
  );
  const [localIsTeamAdmin, setLocalIsTeamAdmin] = useState<boolean>(existingIsTeamAdmin);

  const { data: teamGroupsData = [] } = useQuery<ApiGroup[]>({
    queryKey: [`/api/groups?teamScope=${team.id}`],
    enabled: isExpanded,
  });
  const teamGroupNames = teamGroupsData.filter((g) => g.teamId === team.id).map((g) => g.name);

  const saveTeamPermsMutation = useMutation({
    mutationFn: async (perms: UserPermissions) => {
      const res = await apiRequest("PUT", `/api/users/${userId}/team-permissions/${team.id}`, {
        permissions: JSON.stringify(perms),
        groupScope: localGroupScope.join(","),
        isTeamAdmin: localIsTeamAdmin,
      });
      return res.json();
    },
    onSuccess: () => { onSaved(); toast({ title: `Settings saved for ${team.name}` }); },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  const resetTeamPermsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/users/${userId}/team-permissions/${team.id}`);
      return res.json();
    },
    onSuccess: () => { onReset(); toast({ title: `Reset to global settings for ${team.name}` }); },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
      >
        <span className="text-xs font-medium">{team.name}</span>
        <div className="flex items-center gap-2">
          {(existingPerms || existingGroupScope) && (
            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">{L("Egendefinert", "Custom")}</span>
          )}
          {existingIsTeamAdmin && (
            <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full">{L("Lagadmin", "Team Admin")}</span>
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
        </div>
      </button>
      {isExpanded && (
        <div className="p-3 space-y-3 border-t border-border">
          <p className="text-[11px] text-muted-foreground">
            {existingPerms ? L("Egendefinerte innstillinger aktive for dette laget.", "Custom settings active for this team.") : L("Bruker globale innstillinger. Lagre for å opprette en lagspesifikk overstyring.", "Using global settings. Save to create team-specific override.")}
          </p>

          {/* Team Admin toggle */}
          <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
            <div>
              <p className="text-xs font-medium">{L("Lagadmin for ", "Team Admin for ")}{team.name}</p>
              <p className="text-[10px] text-muted-foreground">{L("Kan administrere brukere og innstillinger for dette laget", "Can manage users and settings for this team")}</p>
            </div>
            <button
              type="button"
              onClick={() => setLocalIsTeamAdmin((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors",
                localIsTeamAdmin ? "bg-purple-500" : "bg-muted-foreground/25"
              )}
            >
              <span className={cn(
                "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                localIsTeamAdmin ? "translate-x-[18px]" : "translate-x-[2px]"
              )} />
            </button>
          </div>

          {/* Groups for this team */}
          {teamGroupNames.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium">{L("Grupper i ", "Groups in ")}{team.name}</p>
              <GroupCheckboxes
                groupNames={teamGroupNames}
                selected={localGroupScope}
                onChange={setLocalGroupScope}
                testIdPrefix={`team-group-${team.id}`}
              />
            </div>
          )}

          <PermissionsMatrix
            value={localPerms}
            onChange={setLocalPerms}
            testIdPrefix={`team-perm-${team.id}`}
            disabledAreas={getTeamDisabledAreas(allTeams, team.id, isSuperAdmin)}
          />
          <div className="flex items-center justify-between pt-1">
            {(existingPerms || existingGroupScope) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => resetTeamPermsMutation.mutate()}
                disabled={resetTeamPermsMutation.isPending}
              >
                Reset to global
              </Button>
            )}
            <div className="ml-auto">
              <Button
                type="button"
                size="sm"
                className="text-xs"
                onClick={() => saveTeamPermsMutation.mutate(localPerms)}
                disabled={saveTeamPermsMutation.isPending}
              >
                Save for {team.name}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Manage a share-view account's athlete grants + per-athlete edit toggle (TA/Admin).
function ShareAccountAthletesEditor({ userId }: { userId: number }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const key = [`/api/users/${userId}/athlete-access`];
  const { data } = useQuery<{ isAthleteAccess: boolean; athletes: { id: number; name: string; assigned: boolean; canEdit: boolean }[] }>({ queryKey: key });
  const [grants, setGrants] = useState<Record<number, { assigned: boolean; canEdit: boolean }>>({});
  useEffect(() => {
    if (data?.athletes) {
      const m: Record<number, { assigned: boolean; canEdit: boolean }> = {};
      for (const a of data.athletes) m[a.id] = { assigned: a.assigned, canEdit: a.canEdit };
      setGrants(m);
    }
  }, [data]);
  const save = useMutation({
    mutationFn: async () => {
      const arr = Object.entries(grants).filter(([, v]) => v.assigned).map(([id, v]) => ({ athleteId: Number(id), canEdit: v.canEdit }));
      return apiRequest("PUT", `/api/users/${userId}/athlete-access`, { grants: arr });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: key }); queryClient.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: L("Tilgang lagret", "Access saved") }); },
    onError: (e: any) => toast({ title: L("Feil", "Error"), description: e?.message, variant: "destructive" }),
  });
  if (!data?.athletes) return null;
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="text-sm font-semibold text-foreground">{L("Utøvertilgang (delt visning)", "Athlete access (share view)")}</div>
      <p className="text-xs text-muted-foreground">
        {L("Velg hvilke utøvere kontoen ser. Hak av «Kan redigere» for å la kontoen redigere den utøveren — ellers er den kun lesetilgang.",
           "Choose which athletes this account sees. Tick 'Can edit' to let it edit that athlete — otherwise it is read-only.")}
      </p>
      <div className="max-h-56 overflow-y-auto space-y-1">
        {data.athletes.map((a) => {
          const g = grants[a.id] ?? { assigned: false, canEdit: false };
          return (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded bg-muted/30 px-2 py-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={g.assigned} onChange={(e) => setGrants((p) => ({ ...p, [a.id]: { assigned: e.target.checked, canEdit: e.target.checked ? (p[a.id]?.canEdit ?? false) : false } }))} />
                {a.name}
              </label>
              <label className={cn("flex items-center gap-1.5 text-xs cursor-pointer", !g.assigned && "opacity-40")}>
                <input type="checkbox" disabled={!g.assigned} checked={g.canEdit} onChange={(e) => setGrants((p) => ({ ...p, [a.id]: { assigned: true, canEdit: e.target.checked } }))} />
                {L("Kan redigere", "Can edit")}
              </label>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? L("Lagrer…", "Saving…") : L("Lagre tilgang", "Save access")}</Button>
      </div>
    </div>
  );
}

function EditUserForm({ user, onDone, allGroups, teams }: { user: ApiUser; onDone: () => void; allGroups: ApiGroup[]; teams: ApiTeam[] }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState(user.teamId);
  const [garminWatchOn, setGarminWatchOn] = useState(!!user.garminWatch);
  const [expandedTeamPerms, setExpandedTeamPerms] = useState<number | null>(null);

  const { data: userTeamMemberships = [] } = useQuery<{ id: number; userId: number; teamId: number }[]>({
    queryKey: [`/api/users/${user.id}/teams`],
    enabled: isSuperAdmin && teams.length > 1,
  });
  const memberTeamIds = userTeamMemberships.map((m) => m.teamId);

  // Per-team permissions and group scope for multi-team users
  const { data: teamPermsData = [], refetch: refetchTeamPerms } = useQuery<{ team_id: number; permissions: string; group_scope: string }[]>({
    queryKey: [`/api/users/${user.id}/team-permissions`],
    enabled: isSuperAdmin && memberTeamIds.length > 0,
  });

  const garminWatchMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PUT", `/api/users/${user.id}/garmin-watch`, { enabled });
      return res.json();
    },
    onSuccess: (data) => {
      setGarminWatchOn(data.garminWatch);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: data.garminWatch ? L("Tilgang til overvåkingskø gitt", "Watch Queue access granted") : L("Tilgang til overvåkingskø fjernet", "Watch Queue access removed") });
    },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  const addTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const res = await apiRequest("POST", `/api/users/${user.id}/teams`, { teamId });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/teams`] }); },
    onError: (e: Error) => { toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }); },
  });

  const removeTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const res = await apiRequest("DELETE", `/api/users/${user.id}/teams/${teamId}`);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}/teams`] }); },
    onError: (e: Error) => { toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }); },
  });
  const teamChanged = selectedTeamId !== user.teamId;
  const { data: teamGroups } = useQuery<ApiGroup[]>({
    queryKey: [`/api/groups?teamScope=${selectedTeamId}`],
    enabled: teamChanged && isSuperAdmin,
  });
  const effectiveGroups = teamChanged && teamGroups ? teamGroups : allGroups;
  const groupNames = effectiveGroups.filter((g) => g.teamId === selectedTeamId).map((g) => g.name);
  const [perms, setPerms] = useState<UserPermissions>(parsePermissions(user.permissions));
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      username: user.username || "",
      groupScope: user.groupScope,
      isAdmin: !!user.isAdmin,
      isTeamAdmin: !!user.isTeamAdmin,
      isBlindTester: !!user.isBlindTester,
      permissions: user.permissions || JSON.stringify(DEFAULT_PERMISSIONS),
      isActive: !!user.isActive,
      teamId: user.teamId,
    },
  });

  const selectedGroups = parseGroups(form.watch("groupScope"));

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof editSchema>) => {
      const res = await apiRequest("PUT", `/api/users/${user.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: L("Bruker oppdatert", "User updated") });
      onDone();
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  // ── Tabbed layout (Profil / Rettigheter / Lag / Annet) ──
  const [tab, setTab] = useState<"profile" | "perms" | "teams" | "other">("profile");
  const teamHasWatch = (() => {
    const t = teams.find((t) => t.id === selectedTeamId);
    if (!t || !t.enabledAreas) return false;
    try { return JSON.parse(t.enabledAreas).includes("garmin_watch"); } catch { return false; }
  })();
  const showTeamsTab = isSuperAdmin && teams.length > 1;
  const showOtherTab = teamHasWatch || isSuperAdmin || !!(user as any).isAthleteAccess;
  const roleValue = form.watch("isAdmin") ? "superadmin" : form.watch("isTeamAdmin") ? "teamadmin" : "member";
  const applyEditRole = (v: string) => {
    form.setValue("isAdmin", v === "superadmin");
    form.setValue("isTeamAdmin", v === "teamadmin");
    if (v === "teamadmin" || v === "superadmin") {
      const full = Object.fromEntries(PERMISSION_AREAS.map((a) => [a, "edit"])) as UserPermissions;
      setPerms(full);
      form.setValue("permissions", JSON.stringify(full));
    }
  };
  const editRoleOptions: { key: string; label: string; desc: string }[] = [
    { key: "member", label: L("Medlem", "Member"), desc: L("Tilgang etter rettigheter", "Access per permissions") },
    { key: "teamadmin", label: L("Lagadmin", "Team Admin"), desc: L("Full tilgang + admin", "Full access + admin") },
    ...(isSuperAdmin ? [{ key: "superadmin", label: L("Superadmin", "Super Admin"), desc: L("Hele systemet", "Entire system") }] : []),
  ];
  const initials = (user.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const roleLabel = user.isAdmin ? "Super Admin" : user.isTeamAdmin ? L("Lagadmin", "Team Admin") : (user as any).isAthleteAccess ? L("Utøvertilgang", "Athlete Access") : L("Medlem", "Member");
  const tabs: { key: typeof tab; label: string; badge?: number }[] = [
    { key: "profile", label: L("Profil", "Profile") },
    { key: "perms", label: L("Rettigheter", "Permissions") },
    ...(showTeamsTab ? [{ key: "teams" as const, label: L("Lag", "Teams"), badge: memberTeamIds.length + 1 }] : []),
    ...(showOtherTab ? [{ key: "other" as const, label: L("Annet", "Other") }] : []),
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        {/* Identity header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email} · {roleLabel}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 border-b border-border">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              data-testid={`edit-user-tab-${tb.key}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === tb.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tb.label}
              {tb.badge != null && (
                <span className="rounded-full border border-border bg-muted/50 px-1.5 text-[10px] text-muted-foreground">{tb.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Profil ── */}
        <div className={cn("space-y-3", tab !== "profile" && "hidden")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>{L("Navn", "Name")}</FormLabel><FormControl><Input {...field} data-testid="input-edit-name" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>{L("E-post", "Email")}</FormLabel><FormControl><Input {...field} data-testid="input-edit-email" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="username" render={({ field }) => (
              <FormItem><FormLabel>{L("Brukernavn", "Username")} <span className="text-xs text-muted-foreground font-normal">({L("brukes ved innlogging", "used for login")})</span></FormLabel><FormControl><Input {...field} placeholder="e.g. johndoe" autoComplete="off" data-testid="input-edit-username" /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="isActive" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 space-y-0">
              <label htmlFor="toggle-active-edit" className="text-sm cursor-pointer select-none">{L("Aktiv konto", "Active account")}</label>
              <FormControl><Switch id="toggle-active-edit" checked={field.value} onCheckedChange={field.onChange} data-testid="select-edit-status" /></FormControl>
            </FormItem>
          )} />
        </div>

        {/* ── Rettigheter ── */}
        <div className={cn("space-y-3", tab !== "perms" && "hidden")}>
          <div className={cn("grid gap-2", editRoleOptions.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2")} data-testid="select-edit-role">
            {editRoleOptions.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => applyEditRole(r.key)}
                data-testid={`edit-role-card-${r.key}`}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-all",
                  roleValue === r.key ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40"
                )}
              >
                <p className={cn("text-sm font-medium", roleValue === r.key ? "text-primary" : "text-foreground")}>{r.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{r.desc}</p>
              </button>
            ))}
          </div>
          {groupNames.length > 0 && (
            <FormField control={form.control} name="groupScope" render={({ field }) => (
              <FormItem>
                <FormLabel>{L("Grupper", "Groups")}</FormLabel>
                <FormControl>
                  <GroupCheckboxes
                    groupNames={groupNames}
                    selected={selectedGroups}
                    onChange={(groups) => field.onChange(groups.join(","))}
                    testIdPrefix="checkbox-edit-group"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}
          <PermissionsMatrix
            value={perms}
            onChange={(p) => { setPerms(p); form.setValue("permissions", JSON.stringify(p)); }}
            testIdPrefix="select-edit-perm"
            onPresetApplied={(blind) => form.setValue("isBlindTester", blind)}
            disabledAreas={getTeamDisabledAreas(teams, selectedTeamId, isSuperAdmin)}
          />
          <FormField control={form.control} name="isBlindTester" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 space-y-0">
              <label htmlFor="toggle-blind-edit" className="flex cursor-pointer items-center gap-2 text-sm select-none" title={L("Produkter og metodikk skjult for denne brukeren", "Products & methodology hidden from this user")}>
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                {L("Blindtester", "Blind tester")}
              </label>
              <FormControl><Switch id="toggle-blind-edit" checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-edit-blind-tester" /></FormControl>
            </FormItem>
          )} />
        </div>

        {/* ── Lag ── */}
        {showTeamsTab && (
          <div className={cn("space-y-3", tab !== "teams" && "hidden")}>
            <div className="space-y-2">
              <label className="text-sm font-medium">{L("Hovedlag", "Primary Team")}</label>
              <Select
                value={String(selectedTeamId)}
                onValueChange={(v) => {
                  const newTeamId = parseInt(v);
                  setSelectedTeamId(newTeamId);
                  form.setValue("teamId", newTeamId);
                  form.setValue("groupScope", "");
                }}
              >
                <SelectTrigger data-testid="select-edit-team"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{L("Tilleggslag", "Additional Teams")}</label>
              <div className="flex flex-wrap gap-2">
                {teams.filter((t) => t.id !== selectedTeamId).map((t) => {
                  const isMember = memberTeamIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => isMember ? removeTeamMutation.mutate(t.id) : addTeamMutation.mutate(t.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                        isMember
                          ? "border-green-300 bg-green-50 text-green-700"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {isMember ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {t.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">{L("Klikk for å veksle tilgang. Brukeren kan bytte mellom hovedlag og tilleggslag.", "Click to toggle access. User can switch between primary and additional teams.")}</p>
            </div>
            {memberTeamIds.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{L("Tilganger per lag", "Per-team Permissions")}</label>
                <p className="text-[11px] text-muted-foreground">{L("Overstyr tilganger for bestemte lag denne brukeren tilhører.", "Override permissions for specific teams this user belongs to.")}</p>
                <div className="space-y-2">
                  {teams
                    .filter((t) => memberTeamIds.includes(t.id))
                    .map((t) => {
                      const existingPerms = teamPermsData.find((p) => p.team_id === t.id);
                      return (
                        <TeamPermRow
                          key={t.id}
                          userId={user.id}
                          team={t}
                          existingPerms={existingPerms?.permissions ?? null}
                          existingGroupScope={existingPerms?.group_scope ?? null}
                          existingIsTeamAdmin={!!(existingPerms as any)?.isTeamAdmin}
                          allTeams={teams}
                          isExpanded={expandedTeamPerms === t.id}
                          onToggle={() => setExpandedTeamPerms(expandedTeamPerms === t.id ? null : t.id)}
                          onSaved={refetchTeamPerms}
                          onReset={() => { refetchTeamPerms(); setExpandedTeamPerms(null); }}
                        />
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Annet ── */}
        {showOtherTab && (
          <div className={cn("space-y-3", tab !== "other" && "hidden")}>
            {(teamHasWatch || isSuperAdmin) && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Watch className="h-4 w-4 text-sky-500" />
                    Garmin Watch Queue
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {garminWatchOn ? L("Brukeren har tilgang til overvåkingskø", "User can access Watch Queue") : L("Brukeren har ikke tilgang til overvåkingskø", "User cannot access Watch Queue")}
                    {!teamHasWatch && <span className="ml-1 text-amber-600">(team feature not enabled)</span>}
                  </div>
                </div>
                <Switch
                  checked={garminWatchOn}
                  onCheckedChange={() => garminWatchMutation.mutate(!garminWatchOn)}
                  disabled={garminWatchMutation.isPending}
                  data-testid={`toggle-garmin-watch-${user.id}`}
                />
              </div>
            )}
            {!!(user as any).isAthleteAccess && <ShareAccountAthletesEditor userId={user.id} />}
          </div>
        )}

        {/* Sticky footer */}
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-2 flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-3">
          <Button type="submit" data-testid="button-save-user" disabled={mutation.isPending}>
            {mutation.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function ResetPasswordForm({ user, onDone }: { user: ApiUser; onDone: () => void }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "Password123!" },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof resetSchema>) => {
      const res = await apiRequest("POST", `/api/users/${user.id}/reset-password`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: L("Passord tilbakestilt", "Password reset") });
      onDone();
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem><FormLabel>{L("Nytt passord", "New password")}</FormLabel><FormControl><Input {...field} type="password" data-testid="input-reset-password" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="flex justify-end">
          <Button type="submit" data-testid="button-reset-password" disabled={mutation.isPending}>{L("Tilbakestill", "Reset")}</Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

type ActiveSession = {
  sid: string;
  userId: number;
  userName: string;
  email: string;
  teamId: number | null;
  isAdmin: number;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  lastLoginAt?: string | null;
  lastActivityAt?: string | null;
};

// Short human-readable device/browser from a user-agent string.
function shortDevice(ua: string): string {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "";
  return [os, br].filter(Boolean).join(" · ") || ua.slice(0, 40);
}

// Active sessions live-view. Placed directly under the Login History so an admin
// sees who is currently signed in right below the historical logins. Own session
// is shown but cannot be terminated. New/unfamiliar IPs are flagged in red.
function ActiveSessionsCard({ currentUserId, loginLogs }: { currentUserId: number; loginLogs: LoginLog[] }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const { data: sessions = [], refetch: refetchSessions } = useQuery<ActiveSession[]>({
    queryKey: ["/api/admin/active-sessions"],
    refetchInterval: 15000,
  });
  const forceLogoutMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/admin/force-logout/${userId}`);
      return res.json();
    },
    onSuccess: () => { refetchSessions(); toast({ title: L("Bruker logget ut", "User logged out") }); },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-500" />
          <span className="font-semibold text-foreground">{L("Aktive økter", "Active Sessions")}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {sessions.length}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchSessions()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{L("Oppdateres automatisk hvert 15. sekund. Din egen økt vises, men kan ikke avsluttes.", "Auto-refreshes every 15 s. Your own session is shown but cannot be terminated.")}</p>
      {sessions.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">{L("Fant ingen aktive økter.", "No active sessions found.")}</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm" data-testid="table-active-sessions">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-foreground/80 text-xs">{L("Bruker", "User")}</th>
                <th className="text-left px-3 py-2 font-medium text-foreground/80 text-xs">{L("E-post", "Email")}</th>
                <th className="text-left px-3 py-2 font-medium text-foreground/80 text-xs">{L("Enhet", "Device")}</th>
                <th className="text-left px-3 py-2 font-medium text-foreground/80 text-xs">{L("Siste login", "Last login")}</th>
                <th className="text-left px-3 py-2 font-medium text-foreground/80 text-xs">{L("Siste aktivitet", "Last activity")}</th>
                <th className="text-left px-3 py-2 font-medium text-foreground/80 text-xs">{L("Utløper", "Expires")}</th>
                <th className="text-center px-3 py-2 font-medium text-foreground/80 text-xs">{L("Handling", "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sessions.map((s) => {
                const isMe = s.userId === currentUserId;
                const expires = new Date(s.expiresAt);
                const hoursLeft = Math.round((expires.getTime() - Date.now()) / 3600000);
                return (
                  <tr key={s.sid} className={cn("transition-colors", isMe && "bg-green-50/30 dark:bg-green-900/10")}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{s.userName}</span>
                        {isMe && <span className="rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1.5 py-0.5 text-[9px] font-bold">{L("DEG", "YOU")}</span>}
                        {s.isAdmin === 1 && <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[9px] font-bold">SA</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{s.email}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.userAgent ? <span className="truncate max-w-[220px]" title={s.userAgent}>{shortDevice(s.userAgent)}</span> : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {expires.toLocaleString()} ({hoursLeft}h)
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isMe || forceLogoutMutation.isPending}
                        className={cn("h-7 text-xs", !isMe && "text-destructive hover:text-destructive hover:bg-destructive/10")}
                        data-testid={`button-force-logout-${s.userId}`}
                        onClick={() => {
                          if (confirm(`Force logout ${s.userName}?`)) {
                            forceLogoutMutation.mutate(s.userId);
                          }
                        }}
                      >
                        {isMe ? "—" : (
                          <>
                            <LogOut className="h-3 w-3 mr-1" />
                            Logout
                          </>
                        )}
                      </Button>
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

function SecurityTab({ teams, currentUserId }: { teams: ApiTeam[]; currentUserId: number }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const [reopenAt, setReopenAt] = useState("");

  // Maintenance mode
  const { data: maintenanceData, refetch: refetchMaintenance } = useQuery<{ enabled: boolean; reopenAt: string | null }>({
    queryKey: ["/api/admin/maintenance-mode"],
  });
  const maintenanceEnabled = maintenanceData?.enabled ?? false;

  const toggleMaintenanceMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/admin/maintenance-mode", {
        enabled,
        reopenAt: enabled && reopenAt ? reopenAt : null,
      });
      return res.json();
    },
    onSuccess: (data) => {
      refetchMaintenance();
      if (!data.enabled) setReopenAt("");
      toast({ title: data.enabled ? L("Vedlikeholdsmodus PÅ", "Maintenance mode ON") : L("Vedlikeholdsmodus AV", "Maintenance mode OFF"), description: data.enabled ? L("Alle ikke-SA-brukere er nå blokkert.", "All non-SA users are now blocked.") : L("Normal tilgang gjenopprettet.", "Normal access restored.") });
    },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  // Broadcast notice (soft "updates in progress" popup for all users)
  const { data: broadcastData, refetch: refetchBroadcast } = useQuery<{ enabled: boolean; updatedAt: number }>({
    queryKey: ["/api/broadcast-notice"],
  });
  const broadcastEnabled = broadcastData?.enabled ?? false;
  const toggleBroadcastMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/admin/broadcast-notice", { enabled });
      return res.json();
    },
    onSuccess: (data) => {
      refetchBroadcast();
      toast({ title: data.enabled ? L("Driftsmelding PÅ", "Notice ON") : L("Driftsmelding AV", "Notice OFF"), description: data.enabled ? L("Alle brukere ser nå meldingen om at oppdateringer pågår.", "All users now see the 'updates in progress' notice.") : L("Meldingen er skjult.", "The notice is hidden.") });
    },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  // What's new (#9): SA-authored release note shown once to all users.
  const [whatsNewType, setWhatsNewType] = useState<"feature" | "fix" | "update">("update");
  const [whatsNewText, setWhatsNewText] = useState("");
  const publishWhatsNewMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/admin/whats-new", { type: whatsNewType, text: whatsNewText }); return res.json(); },
    onSuccess: () => { setWhatsNewText(""); queryClient.invalidateQueries({ queryKey: ["/api/whats-new"] }); toast({ title: L("«Nytt i Glidr» publisert", "'What's new' published"), description: L("Vises som popup til alle brukere.", "Shown as a popup to all users.") }); },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  // Active sessions live in the Login History tab (see ActiveSessionsCard).

  // Emergency lockdown
  const lockdownMutation = useMutation({
    mutationFn: async (teamId: number) => {
      const res = await apiRequest("POST", `/api/admin/emergency-lockdown/${teamId}`);
      return res.json();
    },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["/api/admin/active-sessions"] }); toast({ title: `Lockdown complete`, description: `${data.loggedOut} session(s) terminated.` }); },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  // Team pause
  const pauseTeamSecurityMutation = useMutation({
    mutationFn: async ({ id, paused }: { id: number; paused: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/teams/${id}/pause`, { paused });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: vars.paused ? L("Lag suspendert", "Team suspended") : L("Lag gjenopprettet", "Team unsuspended"), description: vars.paused ? L("Lagmedlemmer vil ikke kunne logge inn.", "Team members will be unable to log in.") : L("Lagmedlemmer kan logge inn igjen.", "Team members can log in again.") });
    },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-4" data-testid="tab-content-security">

      {/* Maintenance mode */}
      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-foreground">{L("Vedlikeholdsmodus", "Maintenance Mode")}</span>
              {maintenanceEnabled && (
                <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide animate-pulse">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When enabled, all non-Super Admin users see a maintenance screen and are blocked from the API. You retain full access. Use this before applying critical updates or during an incident.
            </p>
            {!maintenanceEnabled && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">{L("Gjenåpne (valgfritt):", "Reopen at (optional):")}</label>
                <Input
                  type="datetime-local"
                  value={reopenAt}
                  onChange={(e) => setReopenAt(e.target.value)}
                  className="h-7 text-xs w-auto"
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleMaintenanceMutation.mutate(!maintenanceEnabled)}
            disabled={toggleMaintenanceMutation.isPending}
            className={cn(
              "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none mt-1",
              maintenanceEnabled ? "bg-amber-500" : "bg-muted-foreground/25"
            )}
            aria-label={L("Veksle vedlikeholdsmodus","Toggle maintenance mode")}
          >
            <span className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
              maintenanceEnabled ? "translate-x-[22px]" : "translate-x-[2px]"
            )} />
          </button>
        </div>
        {maintenanceEnabled && (
          <div className="mt-3 space-y-2">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              {L("⚠️ Vedlikeholdsmodus er nå ", "⚠️ Maintenance mode is currently ")}<strong>{L("PÅ", "ON")}</strong>{L(". Alle andre brukere er utestengt. Husk å slå det av når du er ferdig.", ". All other users are locked out. Remember to turn it off when done.")}
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">{L("Melding vist til brukere: ", "Message shown to users: ")}</span>
              Maintenance in progress.{maintenanceData?.reopenAt
                ? ` The system will reopen at ${new Date(maintenanceData.reopenAt).toLocaleString("no-NO", { dateStyle: "short", timeStyle: "short" })}.`
                : " The system will be back shortly."}
              {" "}If you have urgent needs, contact your Team Admin.
            </div>
          </div>
        )}
      </Card>

      {/* Broadcast notice (soft) */}
      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-foreground">{L("Driftsmelding", "Broadcast Notice")}</span>
              {broadcastEnabled && (
                <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide animate-pulse">ACTIVE</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {L("Viser en lukkbar melding til ALLE brukere om at oppdateringer pågår og at tjenesten kan være ustabil. Den blokkerer ikke bruk — brukere kan lukke den og fortsette. Teksten følger brukerens språk.",
                 "Shows a dismissible notice to ALL users that updates are in progress and the service may be unstable. It does not block usage — users can dismiss it and continue. The text follows each user's language.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleBroadcastMutation.mutate(!broadcastEnabled)}
            disabled={toggleBroadcastMutation.isPending}
            className={cn("relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none mt-1", broadcastEnabled ? "bg-amber-500" : "bg-muted-foreground/25")}
            aria-label={L("Veksle driftsmelding", "Toggle broadcast notice")}
          >
            <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", broadcastEnabled ? "translate-x-[22px]" : "translate-x-[2px]")} />
          </button>
        </div>
      </Card>

      {/* What's new (#9) */}
      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">{L("Nytt i Glidr", "What's new")}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {L("Publiser en kort melding som vises som popup til alle brukere én gang — bruk denne hver gang du deployer noe nytt.",
             "Publish a short note shown once as a popup to all users — use this whenever you deploy something new.")}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={whatsNewType} onValueChange={(v) => setWhatsNewType(v as any)}>
            <SelectTrigger className="h-9 w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="feature">{L("Ny funksjon", "New feature")}</SelectItem>
              <SelectItem value="fix">{L("Feilretting", "Bug fix")}</SelectItem>
              <SelectItem value="update">{L("Oppdatering", "Update")}</SelectItem>
            </SelectContent>
          </Select>
          <Textarea value={whatsNewText} onChange={(e) => setWhatsNewText(e.target.value)} rows={2} className="flex-1" placeholder={L("Hva er nytt? …", "What's new? …")} data-testid="whats-new-text" />
        </div>
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={() => publishWhatsNewMutation.mutate()} disabled={publishWhatsNewMutation.isPending || !whatsNewText.trim()} data-testid="button-publish-whats-new">
            {publishWhatsNewMutation.isPending ? L("Publiserer…", "Publishing…") : L("Publiser", "Publish")}
          </Button>
        </div>
      </Card>

      {/* Emergency lockdown */}
      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="font-semibold text-foreground">{L("Nødlås av økter", "Emergency Session Lockdown")}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {L("Avslutt umiddelbart ", "Immediately terminate ")}<strong>{L("alle aktive økter", "all active sessions")}</strong>{L(" for hver bruker i et lag. De blir logget ut umiddelbart. Bruk dette hvis innloggingsinformasjon er kompromittert eller mistenkelig aktivitet oppdages.", " for every user in a team. They will be logged out instantly. Use this if credentials are compromised or suspicious activity is detected.")}
        </p>
        <div className="space-y-2">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5">
              <div>
                <span className="text-sm font-medium text-foreground">{team.name}</span>
                {team.isDefault === 1 && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">(default)</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                disabled={lockdownMutation.isPending}
                data-testid={`button-lockdown-team-${team.id}`}
                onClick={() => {
                  if (confirm(`Lock down all sessions for "${team.name}"? All users will be logged out immediately.`)) {
                    lockdownMutation.mutate(team.id);
                  }
                }}
              >
                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                Lockdown
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Team Pause */}
      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <UserX className="h-4 w-4 text-red-500" />
          <span className="font-semibold text-foreground">{L("Lagpause", "Team Pause")}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Suspend a team's login access. <strong>{L("Ingen lagmedlemmer vil kunne logge inn", "All team members will be unable to log in")}</strong> while paused. Super Admins are unaffected. Use this to temporarily block a team without deleting any data.
        </p>
        <div className="space-y-2">
          {teams.map((team) => {
            const isPaused = !!team.isPaused;
            return (
              <div key={team.id} className={cn(
                "flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors",
                isPaused ? "border-red-300 bg-red-50/60 dark:bg-red-900/10 dark:border-red-800" : "border-border bg-muted/30"
              )}>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{team.name}</span>
                    {isPaused && (
                      <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 text-[9px] font-bold uppercase">{L("Suspendert", "Suspended")}</span>
                    )}
                  </div>
                  {isPaused && (
                    <p className="text-[11px] text-red-500 mt-0.5">{L("Ingen medlemmer kan logge inn", "All members cannot log in")}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`button-security-pause-team-${team.id}`}
                  disabled={pauseTeamSecurityMutation.isPending}
                  className={cn(
                    isPaused
                      ? "border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800"
                      : "border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                  )}
                  onClick={() => {
                    if (!isPaused && !confirm(`Pause "${team.name}"? All team members will be unable to log in while paused.`)) return;
                    pauseTeamSecurityMutation.mutate({ id: team.id, paused: !isPaused });
                  }}
                >
                  {isPaused ? (
                    <><ToggleRight className="h-3.5 w-3.5 mr-1.5" />{L("Opphev pause", "Unpause")}</>
                  ) : (
                    <><ToggleLeft className="h-3.5 w-3.5 mr-1.5" />{L("Pause", "Pause")}</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Terms acceptance overview — owner-level compliance data (SA only). */}
      <TermsAcceptanceCard />
    </div>
  );
}

type TermsUserRow = {
  id: number; name: string; email: string;
  teamId: number | null; teamName: string | null; isActive: number;
  termsAcceptedAt: string | null; termsAcceptedVersion: string | null;
};

// Who has accepted the Terms & Policy (and which version), with the ability to
// reset a user's acceptance so the gate reappears for them on next load.
function TermsAcceptanceCard() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const [q, setQ] = useState("");

  const { data } = useQuery<{ currentVersion: string; users: TermsUserRow[] }>({
    queryKey: ["/api/admin/terms-acceptances"],
  });

  const resetMutation = useMutation({
    mutationFn: async (userId: number) => (await apiRequest("DELETE", `/api/admin/terms-acceptances/${userId}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/terms-acceptances"] });
      toast({ title: L("Aksept tilbakestilt", "Acceptance reset"), description: L("Brukeren får vilkårsdialogen på nytt ved neste innlasting.", "The user will see the terms dialog again on next load.") });
    },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  const users = data?.users ?? [];
  const cur = data?.currentVersion;
  const norm = q.trim().toLowerCase();
  const filtered = users.filter((u) =>
    !norm || u.name.toLowerCase().includes(norm) || u.email.toLowerCase().includes(norm) || (u.teamName ?? "").toLowerCase().includes(norm));
  const acceptedCurrent = users.filter((u) => u.termsAcceptedAt && u.termsAcceptedVersion === cur).length;
  const notAccepted = users.filter((u) => !u.termsAcceptedAt).length;
  const oldVersion = users.length - acceptedCurrent - notAccepted;

  return (
    <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-terms-acceptance">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <FileText className="h-4 w-4 text-emerald-600" />
        <span className="font-semibold text-foreground">{L("Vilkårsaksept", "Terms acceptance")}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {L("versjon", "version")} {cur ?? "—"}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5 text-[10px] font-medium">
          <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 dark:bg-emerald-900/30 dark:text-emerald-300">✓ {acceptedCurrent}</span>
          {oldVersion > 0 && <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 dark:bg-amber-900/30 dark:text-amber-300">{L("eldre versjon", "older version")} {oldVersion}</span>}
          <span className="rounded-full bg-red-50 text-red-700 px-2 py-0.5 dark:bg-red-900/30 dark:text-red-300">{L("ikke akseptert", "not accepted")} {notAccepted}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {L("Kun synlig for Super Admin. Tilbakestill en aksept for å vise dialogen på nytt for brukeren.", "Visible to Super Admins only. Reset an acceptance to show the dialog again for that user.")}
      </p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("Søk navn, e-post eller lag…", "Search name, email or team…")} className="mb-3 h-8 max-w-xs text-xs" data-testid="input-terms-search" />
      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-left text-xs">
              <th className="px-3 py-2 font-medium text-foreground/80">{L("Bruker", "User")}</th>
              <th className="px-3 py-2 font-medium text-foreground/80">{L("Lag", "Team")}</th>
              <th className="px-3 py-2 font-medium text-foreground/80">Status</th>
              <th className="px-3 py-2 font-medium text-foreground/80 text-center">{L("Handling", "Action")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map((u) => {
              const acceptedCur = !!u.termsAcceptedAt && u.termsAcceptedVersion === cur;
              const acceptedOld = !!u.termsAcceptedAt && !acceptedCur;
              return (
                <tr key={u.id} data-testid={`row-terms-${u.id}`}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">{u.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{u.email}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{u.teamName ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {acceptedCur ? (
                      <span className="text-emerald-700 dark:text-emerald-300">✓ {new Date(u.termsAcceptedAt!).toLocaleString()} <span className="text-muted-foreground">(v{u.termsAcceptedVersion})</span></span>
                    ) : acceptedOld ? (
                      <span className="text-amber-700 dark:text-amber-300">{L("Eldre versjon", "Older version")} (v{u.termsAcceptedVersion ?? "?"}) — {L("blir spurt på nytt", "will be re-prompted")}</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">{L("Ikke akseptert", "Not accepted")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {u.termsAcceptedAt ? (
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={resetMutation.isPending}
                        data-testid={`button-reset-terms-${u.id}`}
                        onClick={() => { if (confirm(L(`Tilbakestille aksepten for ${u.name}? Dialogen vises på nytt for brukeren.`, `Reset acceptance for ${u.name}? The dialog will be shown again.`))) resetMutation.mutate(u.id); }}
                      >
                        {L("Tilbakestill", "Reset")}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
// ─────────────────────────────────────────────────────────────────────────────

// ─── Team feature dialog ─────────────────────────────────────────────────────

const PLAN_STYLE: Record<string, { active: string; inactive: string; badge: string }> = {
  gray:   { active: "bg-gray-100 text-gray-700 border-gray-400 ring-gray-300 dark:bg-gray-700/60 dark:text-gray-200 dark:border-gray-500", inactive: "border-border text-muted-foreground hover:bg-muted", badge: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
  green:  { active: "bg-green-50 text-green-700 border-green-500 ring-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-600", inactive: "border-border text-muted-foreground hover:bg-muted", badge: "bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  blue:   { active: "bg-blue-50 text-blue-700 border-blue-500 ring-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-600", inactive: "border-border text-muted-foreground hover:bg-muted", badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  purple: { active: "bg-purple-50 text-purple-700 border-purple-500 ring-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-600", inactive: "border-border text-muted-foreground hover:bg-muted", badge: "bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

function detectPlanKey(enabledAreas: string | null): string | null {
  if (!enabledAreas) return null;
  try {
    const features: string[] = JSON.parse(enabledAreas);
    if (!Array.isArray(features)) return null;
    for (const [key, preset] of Object.entries(PLAN_FEATURE_PRESETS)) {
      const pf = [...preset.features].sort();
      const tf = [...features].sort();
      if (pf.length === tf.length && pf.every((f, i) => f === tf[i])) return key;
    }
    return "custom";
  } catch { return null; }
}

function TeamFeaturesDialog({
  team,
  open,
  onOpenChange,
  onSave,
  isPending,
}: {
  team: ApiTeam;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: number, name: string, features: string[]) => void;
  isPending: boolean;
}) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [name, setName] = useState(team.name);
  const [features, setFeatures] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(team.enabledAreas || "null");
      return Array.isArray(parsed) ? parsed : [...PLAN_FEATURE_PRESETS.team.features];
    } catch {
      return [...PLAN_FEATURE_PRESETS.team.features];
    }
  });

  // Re-sync whenever the dialog opens for a (possibly different) team
  useEffect(() => {
    if (!open) return;
    setName(team.name);
    try {
      const parsed = JSON.parse(team.enabledAreas || "null");
      setFeatures(Array.isArray(parsed) ? parsed : [...PLAN_FEATURE_PRESETS.team.features]);
    } catch {
      setFeatures([...PLAN_FEATURE_PRESETS.team.features]);
    }
  }, [open, team.id]);

  const detectedPlan = (() => {
    for (const [key, preset] of Object.entries(PLAN_FEATURE_PRESETS)) {
      const pf = [...preset.features].sort();
      const tf = [...features].sort();
      if (pf.length === tf.length && pf.every((f, i) => f === tf[i])) return key;
    }
    return null;
  })();

  const toggleFeature = (feat: string) =>
    setFeatures((prev) => prev.includes(feat) ? prev.filter((f) => f !== feat) : [...prev, feat]);

  // Accordion: one feature category expanded at a time (chips inside).
  const [openCat, setOpenCat] = useState<string | null>(null);
  const CATEGORY_ICONS: Record<string, React.ElementType> = {
    "Navigation Areas": LayoutDashboard,
    "Field & Runsheet Tools": Watch,
    "Export & Backup": Download,
    "Team Features": Users,
    "Enterprise": Building2,
  };
  const planLabel = detectedPlan ? PLAN_FEATURE_PRESETS[detectedPlan].label : L("Egendefinert", "Custom");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[88vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{L("Laginnstillinger", "Team settings")} · {team.name}</p>
            <p className="text-xs text-muted-foreground">{planLabel} · {features.length} {L("av", "of")} {TEAM_FEATURES.length} {L("funksjoner på", "features on")}</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Team name */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{L("Lagnavn", "Team name")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
          </div>

          {/* Plan presets */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {L("Abonnementsplan", "Subscription plan")}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(PLAN_FEATURE_PRESETS).map(([key, preset]) => {
                const isActive = detectedPlan === key;
                const s = PLAN_STYLE[preset.color];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFeatures([...preset.features])}
                    className={cn(
                      "rounded-xl border px-2 py-2.5 text-sm font-semibold transition-all text-center",
                      isActive
                        ? cn(s.active, "ring-2 ring-offset-1")
                        : s.inactive
                    )}
                  >
                    <div>{preset.label}</div>
                    <div className="text-[10px] font-normal opacity-60 mt-0.5">
                      {preset.features.length} features
                    </div>
                  </button>
                );
              })}
            </div>
            {detectedPlan === null && features.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5">{L("Egendefinert oppsett", "Custom configuration")}</p>
            )}
          </div>

          {/* Feature categories — collapsed summary rows, chips when expanded */}
          {FEATURE_CATEGORIES.map((cat) => {
            const enabledCount = cat.features.filter((f) => features.includes(f)).length;
            const offNames = cat.features
              .filter((f) => !features.includes(f))
              .map((f) => FEATURE_LABELS[f as keyof typeof FEATURE_LABELS]);
            const isOpen = openCat === cat.label;
            const Icon = CATEGORY_ICONS[cat.label] ?? Settings2;
            const summary = enabledCount === cat.features.length
              ? L("Alle på", "All on")
              : offNames.length <= 2
                ? `${enabledCount} ${L("av", "of")} ${cat.features.length} ${L("på", "on")} — ${offNames.join(", ")} ${L("er av", "off")}`
                : `${enabledCount} ${L("av", "of")} ${cat.features.length} ${L("på", "on")}`;
            return (
              <div key={cat.label} className={cn("rounded-xl border transition-colors", isOpen ? "border-primary/40 bg-primary/[0.03]" : "border-border")}>
                <button
                  type="button"
                  onClick={() => setOpenCat(isOpen ? null : cat.label)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                  data-testid={`team-feature-cat-${cat.label.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={cn("h-4 w-4 shrink-0", isOpen ? "text-primary" : "text-muted-foreground")} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{cat.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{summary}</p>
                    </div>
                  </div>
                  <span className={cn("flex items-center gap-1 text-xs shrink-0", isOpen ? "text-primary" : "text-muted-foreground")}>
                    {isOpen ? L("Skjul", "Hide") : L("Vis", "Show")}
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                  </span>
                </button>
                {isOpen && (
                  <div className="flex flex-wrap gap-1.5 border-t border-border/60 p-3">
                    {cat.features.map((feat) => {
                      const on = features.includes(feat);
                      return (
                        <button
                          key={feat}
                          type="button"
                          onClick={() => toggleFeature(feat)}
                          data-testid={`team-feature-${feat}`}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                            on
                              ? "border-primary/50 bg-primary/10 text-primary ring-1 ring-primary/20"
                              : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          {FEATURE_LABELS[feat as keyof typeof FEATURE_LABELS]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
          <span className="text-[11px] text-muted-foreground">
            {features.length} {L("av", "of")} {TEAM_FEATURES.length} {L("funksjoner på", "features on")}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {L("Avbryt", "Cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || isPending}
              onClick={() => onSave(team.id, name.trim(), features)}
            >
              {isPending ? L("Lagrer…", "Saving…") : L("Lagre endringer", "Save changes")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const ALL_TABS: { id: TabId; labelKey: string; superAdminOnly?: boolean; icon: React.ElementType }[] = [
  { id: "overview", labelKey: "admin.tabOverview", icon: LayoutDashboard },
  { id: "users", labelKey: "admin.tabUsers", icon: Users },
  { id: "groups", labelKey: "admin.tabGroups", icon: Layers },
  { id: "teams", labelKey: "admin.tabTeams", superAdminOnly: true, icon: Building2 },
  { id: "backup", labelKey: "admin.tabBackup", icon: Database },
  { id: "activity", labelKey: "admin.tabActivityLog", icon: Activity },
  { id: "logins", labelKey: "admin.tabLoginHistory", icon: LogIn },
  { id: "data", labelKey: "admin.tabDataManagement", icon: HardDrive },
  { id: "watch", labelKey: "admin.tabWatchApp", icon: Watch },
  { id: "danger", labelKey: "admin.tabDangerZone", icon: AlertTriangle },
  { id: "security", labelKey: "admin.tabSecurity", superAdminOnly: true, icon: Shield },
  { id: "registrations", labelKey: "admin.tabRegistrations", superAdminOnly: true, icon: UserPlus },
  { id: "accounting" as TabId, labelKey: "admin.tabAccounting", superAdminOnly: true, icon: CreditCard },
  { id: "guide", labelKey: "admin.tabFeatureGuide", icon: FileText, superAdminOnly: true },
];

// Grouped Admin navigation per the approved control-room design: Overview on
// top, then Personer / Logger / Data / System. Content per tab is unchanged —
// only the menu is organised into sections.
const ADMIN_TAB_GROUPS: { labelNo: string; labelEn: string; ids: TabId[] }[] = [
  { labelNo: "Personer", labelEn: "People", ids: ["users", "groups", "registrations"] },
  { labelNo: "Logger", labelEn: "Logs", ids: ["activity", "logins", "security"] },
  { labelNo: "Data", labelEn: "Data", ids: ["backup", "data", "danger"] },
  { labelNo: "System", labelEn: "System", ids: ["teams", "watch", "accounting", "guide"] },
];

function AdminNav({ activeTab, setActiveTab, isSuperAdmin }: { activeTab: TabId; setActiveTab: (t: TabId) => void; isSuperAdmin: boolean }) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [navQuery, setNavQuery] = useState("");
  const meta = (id: TabId) => ALL_TABS.find((x) => x.id === id);
  const canSee = (id: TabId) => { const m = meta(id); return !!m && (!m.superAdminOnly || isSuperAdmin); };
  // Sidebar display names — a couple differ from the tab labelKeys per the mockup.
  const navLabel = (id: TabId) => {
    if (id === "activity") return L("Aktivitet + papirkurv", "Activity + recycle bin");
    return t(meta(id)!.labelKey);
  };
  const q = navQuery.trim().toLowerCase();
  const matches = (id: TabId) => !q || navLabel(id).toLowerCase().includes(q);
  const firstMatch: TabId | undefined = q
    ? (["overview" as TabId, ...ADMIN_TAB_GROUPS.flatMap((g) => g.ids)]).find((id) => canSee(id) && matches(id))
    : undefined;

  const item = (id: TabId) => {
    const m = meta(id); if (!m || !canSee(id) || !matches(id)) return null;
    const Icon = m.icon;
    const isDanger = id === "danger";
    const active = activeTab === id;
    return (
      <button
        key={id}
        data-testid={`tab-${id}`}
        onClick={() => { setActiveTab(id); setNavQuery(""); }}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left",
          active
            ? "bg-green-50 text-green-700 font-medium dark:bg-green-900/20 dark:text-green-400"
            : isDanger ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", isDanger && !active && "text-red-500")} />
        <span className="truncate">{navLabel(id)}</span>
        {m.superAdminOnly && (
          <span className="ml-auto rounded bg-amber-50 px-1 text-[9px] font-bold text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">SA</span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Mobile: grouped dropdown (the sidebar takes over on lg+). */}
      <div className="lg:hidden">
        <Select value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
          <SelectTrigger data-testid="admin-tab-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="overview">{t("admin.tabOverview")}</SelectItem>
            {ADMIN_TAB_GROUPS.map((g) => g.ids.filter(canSee).map((id) => (
              <SelectItem key={id} value={id}>{L(g.labelNo, g.labelEn)} · {navLabel(id)}</SelectItem>
            )))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: control-room sidebar for BOTH SA and TA. */}
      <aside className="hidden lg:block w-52 shrink-0" data-testid="admin-nav">
        <div className="sticky top-4 flex flex-col gap-3">
          {/* Jump-to-function search: type + Enter opens the first match. */}
          <Input
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && firstMatch) { setActiveTab(firstMatch); setNavQuery(""); }
              if (e.key === "Escape") setNavQuery("");
            }}
            placeholder={L("Hopp til funksjon…", "Jump to function…")}
            className="h-8 text-xs"
            data-testid="input-admin-nav-search"
          />
          <div className="flex flex-col gap-0.5">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{L("Oversikt", "Overview")}</div>
            {item("overview")}
          </div>
          {ADMIN_TAB_GROUPS.map((g) => {
            const visible = g.ids.filter((id) => canSee(id) && matches(id));
            if (visible.length === 0) return null;
            return (
              <div key={g.labelEn} className="flex flex-col gap-0.5">
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{L(g.labelNo, g.labelEn)}</div>
                {visible.map((id) => item(id))}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

// #44: per-team Feedback button config (toggle + Google link).
function FeedbackButtonConfig({ team }: { team: any }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const [url, setUrl] = useState<string>(team.feedbackSheetUrl ?? "");
  const [enabled, setEnabled] = useState<boolean>(team.feedbackEnabled === 1);
  const save = useMutation({
    mutationFn: async () => apiRequest("PUT", `/api/teams/${team.id}/feedback-settings`, { url: url.trim() || null, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback-button"] });
      toast({ title: L("Lagret", "Saved") });
    },
    onError: (e: any) => toast({ title: L("Feil", "Error"), description: e?.message, variant: "destructive" }),
  });
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
      <div className="text-xs font-semibold text-foreground/80">{team.name}</div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" data-testid={`toggle-feedback-${team.id}`} />
        {L("Vis Feedback-knapp i menyen", "Show Feedback button in the sidebar")}
      </label>
      <div className="flex items-center gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/..." className="h-8 text-xs flex-1" data-testid={`input-feedback-url-${team.id}`} />
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} data-testid={`button-save-feedback-${team.id}`}>
          {save.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}
        </Button>
      </div>
    </div>
  );
}

function BackupStatusCard() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { data } = useQuery<{ available: boolean; mode: string; serviceAccountEmail?: string; driveAvailable?: boolean }>({
    queryKey: ["/api/backup/status"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 60_000,
  });

  if (!data) return null;

  if (data.available) {
    const label = data.mode === "service_account" ? L("Tjenestekonto", "Service Account") : L("Replit-kobling", "Replit connector");
    return (
      <Card className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-800">
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">{L("Google Sheets-sikkerhetskopi er klar", "Google Sheets backup is ready")} ({label})</p>
            {data.serviceAccountEmail && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                Service account: <code className="font-mono bg-emerald-100 dark:bg-emerald-900 px-1 rounded break-all">{data.serviceAccountEmail}</code>
              </p>
            )}
            {data.driveAvailable && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-1">
                ✓ Google Drive backup is also available — share a Drive folder with the service account email above.
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="space-y-2 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-semibold">{L("Google Sheets-sikkerhetskopi er ikke konfigurert", "Google Sheets backup is not configured")}</p>
          <p>{L("Slik aktiverer du sikkerhetskopi på Render – legg til en Google-tjenestekonto:", "To enable backup on Render, add a Google Service Account:")}</p>
          <ol className="list-decimal pl-4 space-y-1 text-[11px]">
            <li>{L("Gå til", "Go to")} <strong>console.cloud.google.com</strong> → {L("opprett eller velg et prosjekt", "create or select a project")}</li>
            <li>{L("Aktiver", "Enable the")} <strong>Google Sheets API</strong> {L("og", "and")} <strong>Google Drive API</strong></li>
            <li>{L("Gå til", "Go to")} <strong>IAM &amp; Admin → Service Accounts</strong> → {L("opprett en tjenestekonto", "create a service account")}</li>
            <li>{L("Åpne tjenestekontoen →", "Open the service account →")} <strong>{L("Nøkler", "Keys")}</strong>{L("-fanen", " tab")} → <strong>Add Key → JSON</strong></li>
            <li>{L("Kopier hele innholdet i JSON-filen", "Copy the entire JSON file content")}</li>
            <li>{L("I", "In")} <strong>Render dashboard → Environment</strong>{L(", legg til:", ", add:")}<br />
              <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded font-mono">GOOGLE_SERVICE_ACCOUNT_JSON</code> = {L("JSON-innholdet", "the JSON content")}</li>
            <li>{L("Distribuer tjenesten på nytt", "Redeploy the service")}</li>
            <li>{L("Del Google-arket ditt med tjenestekontoens e-post (", "Share your Google Sheet with the service account email (")}<code className="font-mono">client_email</code>{L(" i JSON-filen) — gi den ", " in the JSON) — give it ")}<strong>{L("Redaktør", "Editor")}</strong>{L("-tilgang", " access")}</li>
          </ol>
        </div>
      </div>
    </Card>
  );
}

function StatCard({ label, value, icon: Icon, color, testId }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string; testId: string }) {
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: "bg-green-50", text: "text-green-600", ring: "ring-green-200" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200" },
    violet: { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-200" },
    sky: { bg: "bg-sky-50", text: "text-sky-600", ring: "ring-sky-200" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-200" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", ring: "ring-indigo-200" },
    teal: { bg: "bg-teal-50", text: "text-teal-600", ring: "ring-teal-200" },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
        </div>
        <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1", c.bg, c.ring)}>
          <Icon className={cn("h-5 w-5", c.text)} />
        </div>
      </div>
    </Card>
  );
}

type UserHistoryData = {
  loginLogs: LoginLog[];
  activityLogs: ActivityEntry[];
  passwordChanges: ActivityEntry[];
};

function UserHistoryDialog({ user: targetUser, open, onClose }: { user: ApiUser | null; open: boolean; onClose: () => void }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [historyTab, setHistoryTab] = useState<"logins" | "activity" | "passwords" | "exports">("logins");

  const { data, isLoading } = useQuery<UserHistoryData>({
    queryKey: ["/api/admin/users", targetUser?.id, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${targetUser!.id}/history?days=30`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: open && targetUser != null,
  });

  const loginLogs = data?.loginLogs ?? [];
  const activityLogs = data?.activityLogs ?? [];
  const passwordChanges = data?.passwordChanges ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-600" />
            History — {targetUser?.name}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{L("Laster historikk…", "Loading history…")}</div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Tab switcher */}
            <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-muted/30 w-fit">
              {([
                { id: "logins", label: `${L("Innlogginger", "Logins")} (${loginLogs.length})` },
                { id: "activity", label: `${L("Aktivitet", "Activity")} (${activityLogs.length})` },
                { id: "passwords", label: `${L("Passordendringer", "Password Changes")} (${passwordChanges.length})` },
                { id: "exports", label: `${L("Eksporter", "Exports")} (${activityLogs.filter((l) => l.action?.startsWith("exported_")).length})` },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setHistoryTab(t.id)}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                    historyTab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {historyTab === "logins" && (
              loginLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{L("Fant ingen innloggingshendelser.", "No login events found.")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-3">{L("Dato/tid", "Date/Time")}</th>
                        <th className="pb-2">{L("Handling", "Action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginLogs.map((l) => (
                        <tr key={l.id} className="border-b border-border/30">
                          <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{new Date(l.loginAt).toLocaleString()}</td>
                          <td className="py-1.5">
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              l.action === "login" ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"
                            )}>{l.action}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {historyTab === "activity" && (
              activityLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{L("Fant ingen aktivitetslogger.", "No activity logs found.")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-3">{L("Dato/tid", "Date/Time")}</th>
                        <th className="pb-2 pr-3">{L("Handling", "Action")}</th>
                        <th className="pb-2 pr-3">{L("Enhet", "Entity")}</th>
                        <th className="pb-2">{L("Detaljer", "Details")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLogs.map((l) => (
                        <tr key={l.id} className="border-b border-border/30">
                          <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                          <td className="py-1.5 pr-3">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{l.action}</span>
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{l.entityType}{l.entityId ? ` #${l.entityId}` : ""}</td>
                          <td className="py-1.5 text-muted-foreground truncate max-w-[200px]">{l.details || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {historyTab === "passwords" && (
              passwordChanges.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{L("Fant ingen passordendringer.", "No password change records found.")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-3">{L("Dato/tid", "Date/Time")}</th>
                        <th className="pb-2">{L("Detaljer", "Details")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {passwordChanges.map((l) => (
                        <tr key={l.id} className="border-b border-border/30">
                          <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                          <td className="py-1.5 text-muted-foreground">{l.details || l.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {historyTab === "exports" && (() => {
              const exportLogs = activityLogs.filter((l) => l.action?.startsWith("exported_"));
              return exportLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{L("Ingen eksporthendelser registrert ennå.", "No export events recorded yet.")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-3">{L("Dato/tid", "Date/Time")}</th>
                        <th className="pb-2 pr-3">{L("Hvem", "Who")}</th>
                        <th className="pb-2">{L("Type", "Type")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportLogs.map((l) => (
                        <tr key={l.id} className="border-b border-border/30">
                          <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                          <td className="py-1.5 pr-3 font-medium">{l.userName}</td>
                          <td className="py-1.5 text-muted-foreground">{l.details || l.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlanHistoryContent({ teamId }: { teamId: number }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/teams", teamId, "plan-history"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/teams/${teamId}/plan-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) return <div className="py-4 text-sm text-muted-foreground">{L("Laster...", "Loading...")}</div>;
  if (history.length === 0) return <div className="py-4 text-sm text-muted-foreground">{L("Ingen planendringer registrert ennå.", "No plan changes recorded yet.")}</div>;

  return (
    <div className="space-y-2 pt-2">
      {history.map((row: any) => (
        <div key={row.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-medium text-foreground">
              {row.old_plan ?? "—"} → {row.new_plan ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">{new Date(row.changed_at).toLocaleString()}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground flex gap-3 flex-wrap">
            {(row.old_price != null || row.new_price != null) && (
              <span>{L("Pris: ", "Price: ")}{row.old_price ?? "—"} → {row.new_price ?? "—"} NOK</span>
            )}
            {row.billing_period && <span>{L("Fakturering: ", "Billing: ")}{row.billing_period}</span>}
            {row.changed_by && <span>{L("Av: ", "By: ")}{row.changed_by}</span>}
          </div>
          {row.notes && <div className="mt-0.5 text-xs text-muted-foreground italic">{row.notes}</div>}
        </div>
      ))}
    </div>
  );
}

function RegistrationsTab() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { data: registrations = [], refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/registrations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/registrations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const [editing, setEditing] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [convertReg, setConvertReg] = useState<any | null>(null);
  const [convertTeamName, setConvertTeamName] = useState("");
  const [convertPlan, setConvertPlan] = useState("");
  const { toast } = useToast();

  async function saveEdit() {
    if (!editing) return;
    await fetch(`/api/admin/registrations/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: editStatus, adminNotes: editNotes }),
    });
    toast({ title: L("Lagret", "Saved") });
    setEditing(null);
    refetch();
  }

  async function handleConvert() {
    if (!convertReg) return;
    try {
      // 1. Create the team
      const teamRes = await apiRequest("POST", "/api/teams", {
        name: convertTeamName,
        enabledAreas: PLAN_FEATURE_PRESETS[convertPlan]?.features ?? [],
      });
      if (!teamRes.ok) {
        const data = await teamRes.json();
        toast({ title: L("Feil", "Error"), description: data.message || "Failed to create team", variant: "destructive" });
        return;
      }
      // 2. Mark registration as converted
      await fetch(`/api/admin/registrations/${convertReg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "converted" }),
      });
      toast({ title: L("Lag opprettet!", "Team created!"), description: `Team "${convertTeamName}" has been created and registration marked as converted.` });
      setConvertReg(null);
      refetch();
    } catch (e: any) {
      toast({ title: L("Feil", "Error"), description: e.message || "Something went wrong", variant: "destructive" });
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    contacted: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    converted: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  };
  const STATUS_LABELS: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    active: "Active",
    rejected: "Rejected",
    converted: "Converted",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{L("Registreringer", "Registrations")} ({registrations.length})</h2>
        <span className="text-xs text-muted-foreground">{L("Fra /get-started og forespørsler om planendring", "From /get-started and plan change requests")}</span>
      </div>

      {registrations.length === 0 && (
        <Card className="rounded-2xl p-8 text-center text-muted-foreground text-sm">{L("Ingen registreringer ennå.", "No registrations yet.")}</Card>
      )}

      <div className="space-y-3">
        {registrations.map((r: any) => (
          <Card key={r.id} className="rounded-2xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sm">{r.team_name ?? r.teamName}</div>
                <div className="text-xs text-muted-foreground">{r.contact_name ?? r.contactName} · {r.email}</div>
                {(r.phone) && <div className="text-xs text-muted-foreground">{r.phone}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? "bg-muted text-muted-foreground"}`}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => { setEditing(r); setEditStatus(r.status); setEditNotes(r.admin_notes ?? r.adminNotes ?? ""); }}>
                  Edit
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive"
                  data-testid={`button-delete-registration-${r.id}`}
                  onClick={async () => {
                    if (!window.confirm(L("Slette denne registreringen?", "Delete this registration?"))) return;
                    await fetch(`/api/admin/registrations/${r.id}`, { method: "DELETE", credentials: "include" });
                    refetch();
                  }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                {r.status !== "converted" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    title={L("Konverter til lag", "Convert to team")}
                    onClick={() => {
                      setConvertReg(r);
                      setConvertTeamName(r.team_name ?? r.teamName ?? "");
                      setConvertPlan(r.plan_name ?? r.planName ?? "team");
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    Lag team
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{L("Plan: ", "Plan: ")}<strong className="text-foreground">{r.plan_name ?? r.planName}</strong></span>
              {(r.user_count ?? r.userCount) && <span>{L("Brukere: ", "Users: ")}{r.user_count ?? r.userCount}</span>}
              {(r.group_count ?? r.groupCount) && <span>{L("Grupper: ", "Groups: ")}{r.group_count ?? r.groupCount}</span>}
              <span>Billing: {(r.billing_period ?? r.billingPeriod) === "annual" ? L("Årlig", "Annual") : L("Månedlig", "Monthly")}</span>
              <span>{new Date(r.created_at ?? r.createdAt).toLocaleDateString("no-NO")}</span>
            </div>
            {(r.invoice_address ?? r.invoiceAddress) && (
              <div className="text-xs text-muted-foreground">{L("Fakturaadresse: ", "Invoice address: ")}{r.invoice_address ?? r.invoiceAddress}</div>
            )}
            {(r.notes) && <div className="text-xs text-muted-foreground italic">«{r.notes}»</div>}
            {(r.admin_notes ?? r.adminNotes) && (
              <div className="text-xs bg-muted rounded px-2 py-1">{L("Adminnotat: ", "Admin note: ")}{r.admin_notes ?? r.adminNotes}</div>
            )}
          </Card>
        ))}
      </div>

      {/* Edit dialog */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{L("Rediger registrering — ", "Edit registration — ")}{editing.team_name ?? editing.teamName}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{L("Status", "Status")}</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{L("Ny", "New")}</SelectItem>
                    <SelectItem value="contacted">{L("Kontaktet", "Contacted")}</SelectItem>
                    <SelectItem value="active">{L("Aktiv", "Active")}</SelectItem>
                    <SelectItem value="rejected">{L("Avvist", "Rejected")}</SelectItem>
                    <SelectItem value="converted">{L("Konvertert", "Converted")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{L("Adminnotat", "Admin note")}</label>
                <textarea className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  rows={3} value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder={L("Internt notat...", "Internal note...")} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditing(null)}>{L("Avbryt", "Cancel")}</Button>
                <Button onClick={saveEdit}>{L("Lagre", "Save")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Convert to team dialog */}
      {convertReg && (
        <Dialog open={!!convertReg} onOpenChange={o => !o && setConvertReg(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{L("Opprett lag fra registrering", "Create team from registration")}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{L("Lagnavn", "Team name")}</label>
                <Input value={convertTeamName} onChange={e => setConvertTeamName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{L("Plan", "Plan")}</label>
                <Select value={convertPlan} onValueChange={setConvertPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["free","starter","team","pro","enterprise"].map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">{L("Dette oppretter et nytt lag og merker registreringen som «konvertert».", 'This will create a new team and mark the registration as "converted".')}</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setConvertReg(null)}>{L("Avbryt", "Cancel")}</Button>
                <Button onClick={handleConvert} disabled={!convertTeamName.trim()}>{L("Opprett lag", "Create team")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


function AccountingTab({ teams }: { teams: ApiTeam[] }) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();

  // ── Plan prices ──────────────────────────────────────────────────
  const { data: planPrices = {} } = useQuery<Record<string, number | null>>({
    queryKey: ["/api/settings/plan-prices"],
    queryFn: async () => {
      const res = await fetch("/api/settings/plan-prices");
      return res.ok ? res.json() : {};
    },
  });

  // ── Plan price editor state ───────────────────────────────────────
  const [editingPrices, setEditingPrices] = useState(false);
  const [priceForm, setPriceForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (planPrices && !editingPrices) {
      setPriceForm({
        free: String((planPrices as any).free ?? 0),
        starter: String((planPrices as any).starter ?? ""),
        team: String((planPrices as any).team ?? ""),
        pro: String((planPrices as any).pro ?? ""),
        enterprise: String((planPrices as any).enterprise ?? ""),
      });
    }
  }, [planPrices, editingPrices]);

  const savePricesMutation = useMutation({
    mutationFn: async (data: Record<string, number | null>) => {
      const res = await fetch("/api/admin/plan-prices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/plan-prices"] });
      setEditingPrices(false);
      toast({ title: t("admin.billingPricesSaved") });
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  // ── Billing records ───────────────────────────────────────────────
  const { data: records = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/billing"],
    queryFn: async () => {
      const res = await fetch("/api/admin/billing", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  const createRecord = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/billing", data);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] }),
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const patchRecord = useMutation({
    mutationFn: async ({ id, ...patch }: any) => {
      const res = await apiRequest("PATCH", `/api/admin/billing/${id}`, patch);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] }),
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const advanceDate = useMutation({
    mutationFn: async ({ id, nextBillingDate }: { id: number; nextBillingDate: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/teams/${id}/plan`, { nextBillingDate });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/teams"] }),
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const deleteRecord = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/billing/${id}`, undefined);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] }),
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  // Undo "Sendt" — just unmark invoiced_at
  async function handleUndoSend(record: any) {
    await patchRecord.mutateAsync({ id: record.id, invoiced: false });
    toast({ title: t("admin.billingToastUndoSent") });
  }

  // Undo "Betalt" — unmark paid_at AND revert nextBillingDate one period back
  async function handleUndoPaid(team: ApiTeam, record: any) {
    const period = (team.billingPeriod ?? (team as any).billing_period ?? "monthly") as string;
    await patchRecord.mutateAsync({ id: record.id, paid: false });
    // Revert the nextBillingDate by one period
    const nextRaw = team.nextBillingDate ?? (team as any).next_billing_date;
    if (nextRaw) {
      const current = parseLocalDate(nextRaw);
      const reverted = new Date(current);
      if (period === "annual") reverted.setFullYear(reverted.getFullYear() - 1);
      else reverted.setMonth(reverted.getMonth() - 1);
      await advanceDate.mutateAsync({ id: team.id, nextBillingDate: reverted.toISOString().split("T")[0] });
    }
    toast({ title: t("admin.billingToastUndoPaid") });
  }

  // ── Helpers ───────────────────────────────────────────────────────
  const DEFAULT_PRICES: Record<string, number> = {
    free: 0, starter: 490, team: 790, pro: 1490, enterprise: 0,
  };

  function effectivePrice(team: ApiTeam): number | null {
    const cp = team.customPrice ?? (team as any).custom_price;
    if (cp != null) return cp;
    const plan = (team.planName ?? (team as any).plan_name ?? "free").toLowerCase();
    const pp = (planPrices as any)[plan];
    if (pp != null) return pp;
    return DEFAULT_PRICES[plan] ?? null;
  }

  function addPeriod(date: Date, period: string): Date {
    const d = new Date(date);
    if (period === "annual") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d;
  }

  function fmt(d: Date) {
    return d.toLocaleDateString("no-NO", { day: "numeric", month: "long", year: "numeric" });
  }

  // ── Per-team billing state ────────────────────────────────────────
  type BillingState =
    | { kind: "no-setup" }
    | { kind: "scheduled"; nextDue: Date }
    | { kind: "ready"; nextDue: Date }
    | { kind: "sent"; record: any }
    | { kind: "pending"; record: any };

  // Parse "YYYY-MM-DD" as local date (avoids UTC-midnight timezone shift)
  function parseLocalDate(raw: string): Date {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function teamState(team: ApiTeam): BillingState {
    const nextRaw = team.nextBillingDate ?? (team as any).next_billing_date;
    if (!nextRaw) return { kind: "no-setup" };
    const nextDue = parseLocalDate(nextRaw);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const unpaid = records
      .filter((r: any) => r.team_id === team.id && !r.paid_at)
      .sort((a: any, b: any) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())[0];

    if (unpaid) {
      if (unpaid.invoiced_at) return { kind: "sent", record: unpaid };
      return { kind: "pending", record: unpaid };
    }
    if (nextDue <= today) return { kind: "ready", nextDue };
    return { kind: "scheduled", nextDue };
  }

  async function handleSend(team: ApiTeam) {
    const state = teamState(team);
    if (state.kind === "pending") {
      await patchRecord.mutateAsync({ id: state.record.id, invoiced: true });
    } else if (state.kind === "ready") {
      const amount = effectivePrice(team);
      if (!amount) return;
      const period = (team.billingPeriod ?? (team as any).billing_period ?? "monthly") as string;
      const dueDate = state.nextDue;
      const periodStart = addPeriod(dueDate, period === "annual" ? "annual-back" : "monthly-back");
      // calculate period start
      const ps = new Date(dueDate);
      if (period === "annual") ps.setFullYear(ps.getFullYear() - 1);
      else ps.setMonth(ps.getMonth() - 1);
      await createRecord.mutateAsync({
        teamId: team.id,
        teamName: team.name,
        amount,
        currency: "NOK",
        description: `Glidr ${team.planName ?? (team as any).plan_name ?? ""} – ${dueDate.toLocaleDateString("no-NO", { month: "long", year: "numeric" })}`,
        periodStart: ps.toISOString().split("T")[0],
        periodEnd: dueDate.toISOString().split("T")[0],
        dueDate: dueDate.toISOString().split("T")[0],
        invoiced: true,
      });
    }
    toast({ title: `${t("admin.billingToastSent")} – ${team.name}` });
  }

  async function handlePaid(team: ApiTeam) {
    const state = teamState(team);
    if (state.kind !== "sent") return;
    const period = (team.billingPeriod ?? (team as any).billing_period ?? "monthly") as string;
    const nextRaw = team.nextBillingDate ?? (team as any).next_billing_date;
    await patchRecord.mutateAsync({ id: state.record.id, paid: true });
    if (nextRaw) {
      const next = addPeriod(new Date(nextRaw), period);
      await advanceDate.mutateAsync({ id: team.id, nextBillingDate: next.toISOString().split("T")[0] });
    }
    toast({ title: `${t("admin.billingToastPaid")} – ${team.name}` });
  }

  // ── Stats ─────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yearEnd = new Date(currentYear, 11, 31);

  const paidThisYear = records
    .filter((r: any) => r.paid_at && new Date(r.paid_at).getFullYear() === currentYear)
    .reduce((s: number, r: any) => s + r.amount, 0);

  const outstanding = records
    .filter((r: any) => r.invoiced_at && !r.paid_at)
    .reduce((s: number, r: any) => s + r.amount, 0);

  const payingTeams = teams.filter((t) => {
    const plan = (t.planName ?? (t as any).plan_name ?? "free").toLowerCase();
    return plan !== "free";
  });

  function estimateRestOfYear(team: ApiTeam): number {
    const amount = effectivePrice(team) ?? 0;
    if (!amount) return 0;
    const period = (team.billingPeriod ?? (team as any).billing_period ?? "monthly") as string;
    const nextRaw = team.nextBillingDate ?? (team as any).next_billing_date;
    if (!nextRaw) return 0;
    let d = parseLocalDate(nextRaw);
    let count = 0;
    while (d <= yearEnd) {
      count++;
      d = addPeriod(d, period);
    }
    return count * amount;
  }

  const estimatedRest = payingTeams.reduce((s, t) => s + estimateRestOfYear(t), 0);

  // Paid history (most recent first)
  const paidRecords = [...records]
    .filter((r: any) => r.paid_at)
    .sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: t("admin.billingPaidThisYear"), value: `${paidThisYear.toLocaleString("no-NO")} NOK`, color: "text-green-600" },
          { label: t("admin.billingOutstanding"), value: `${outstanding.toLocaleString("no-NO")} NOK`, color: outstanding > 0 ? "text-amber-600" : "text-muted-foreground" },
          { label: t("admin.billingEstimatedRest"), value: `${estimatedRest.toLocaleString("no-NO")} NOK`, color: "text-blue-600" },
        ].map((c) => (
          <Card key={c.label} className="rounded-2xl p-4">
            <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
          </Card>
        ))}
      </div>

      {/* Billing schedule */}
      <Card className="rounded-2xl p-5">
        <h3 className="font-semibold text-sm mb-4">{t("admin.billingScheduleTitle")}</h3>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />)}</div>
        ) : payingTeams.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.billingNoPayingTeams")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {payingTeams.map((team) => {
              const state = teamState(team);
              const amount = effectivePrice(team);
              const period = (team.billingPeriod ?? (team as any).billing_period ?? "monthly") as string;

              return (
                <div key={team.id} className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-3",
                  state.kind === "sent"    ? "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-900/10"
                  : state.kind === "ready" ? "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-900/10"
                  : state.kind === "pending" ? "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-900/10"
                  : "border-border bg-muted/20"
                )}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{team.name}</span>
                      <span className="text-xs capitalize text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted">
                        {team.planName ?? (team as any).plan_name ?? "free"}
                      </span>
                      {amount != null && (
                        <span className="text-sm font-bold">
                          {amount.toLocaleString("no-NO")} NOK/{period === "annual" ? "år" : "mnd"} inkl. mva
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] mt-1">
                      {state.kind === "no-setup" && (
                        <span className="text-muted-foreground">{t("admin.billingNoDateSet")}</span>
                      )}
                      {state.kind === "scheduled" && (
                        <span className="text-muted-foreground">{t("admin.billingNextInvoice")} <strong>{fmt(state.nextDue)}</strong></span>
                      )}
                      {(state.kind === "ready" || state.kind === "pending") && (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          {t("admin.billingReadyToSend")} {fmt(state.kind === "ready" ? state.nextDue : new Date(state.record.due_date))}
                        </span>
                      )}
                      {state.kind === "sent" && (
                        <span className="text-blue-700 dark:text-blue-400">
                          {t("admin.billingMarkSent")} {new Date(state.record.invoiced_at).toLocaleDateString("no-NO")} — {t("admin.billingAwaitingPayment")}
                          &nbsp;·&nbsp;{state.record.amount.toLocaleString("no-NO")} {state.record.currency}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 items-center">
                    {(state.kind === "ready" || state.kind === "pending") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSend(team)}
                        disabled={createRecord.isPending || patchRecord.isPending}
                      >
                        {t("admin.billingMarkSent")}
                      </Button>
                    )}
                    {state.kind === "sent" && (<>
                      <Button
                        size="sm"
                        onClick={() => handlePaid(team)}
                        disabled={patchRecord.isPending || advanceDate.isPending}
                      >
                        {t("admin.billingMarkPaid")}
                      </Button>
                      <button
                        title={t("admin.billingUndoSend")}
                        onClick={() => handleUndoSend(state.record)}
                        disabled={patchRecord.isPending}
                        className="p-1.5 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title={t("admin.billingDeleteRecord")}
                        onClick={() => { if (confirm(t("admin.billingConfirmDelete"))) deleteRecord.mutate(state.record.id); }}
                        disabled={deleteRecord.isPending}
                        className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Plan price editor */}
      <Card className="rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">{t("admin.billingPricesTitle")}</h3>
          {!editingPrices ? (
            <Button variant="outline" size="sm" onClick={() => setEditingPrices(true)}>{L("Rediger", "Edit")}</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingPrices(false)}>{L("Avbryt", "Cancel")}</Button>
              <Button size="sm" disabled={savePricesMutation.isPending} onClick={() => {
                const data: Record<string, number | null> = {};
                for (const [k, v] of Object.entries(priceForm)) {
                  data[k] = v === "" ? null : parseFloat(v);
                }
                savePricesMutation.mutate(data);
              }}>{L("Lagre", "Save")}</Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(["free","starter","team","pro","enterprise"] as const).map((plan) => (
            <div key={plan} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground capitalize">{plan}</label>
              {editingPrices ? (
                <div className="relative">
                  <Input
                    type="number"
                    value={priceForm[plan] ?? ""}
                    onChange={(e) => setPriceForm((f) => ({ ...f, [plan]: e.target.value }))}
                    placeholder={plan === "enterprise" ? t("admin.billingCustom") : "0"}
                    className="pr-14 text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">NOK</span>
                </div>
              ) : (
                <div className="text-sm font-semibold">
                  {(planPrices as any)[plan] == null
                    ? <span className="text-muted-foreground">{t("admin.billingCustom")}</span>
                    : <>{Number((planPrices as any)[plan]).toLocaleString("no-NO")} <span className="font-normal text-muted-foreground text-xs">{L("NOK/mnd inkl. mva", "NOK/mo incl. VAT")}</span></>
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Paid history */}
      {paidRecords.length > 0 && (
        <Card className="rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-4">{t("admin.billingHistory")}</h3>
          <div className="flex flex-col gap-2">
            {paidRecords.map((r: any) => {
              const team = teams.find((t) => t.id === r.team_id);
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                    <span className="font-medium">{r.team_name}</span>
                    <span className="font-bold">{r.amount.toLocaleString("no-NO")} {r.currency}</span>
                    {r.description && <span className="text-xs text-muted-foreground truncate">{r.description}</span>}
                  </div>
                  <span className="text-xs text-green-600 flex-shrink-0 whitespace-nowrap">
                    {t("admin.billingPaidOn")} {new Date(r.paid_at).toLocaleDateString("no-NO")}
                  </span>
                  <div className="flex gap-1 flex-shrink-0">
                    {team && (
                      <button
                        title={t("admin.billingUndoPayment")}
                        onClick={() => { if (confirm(t("admin.billingConfirmUndoPaid"))) handleUndoPaid(team, r); }}
                        disabled={patchRecord.isPending || advanceDate.isPending}
                        className="p-1.5 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      title={t("admin.billingDeleteRecord")}
                      onClick={() => { if (confirm(t("admin.billingConfirmDelete"))) deleteRecord.mutate(r.id); }}
                      disabled={deleteRecord.isPending}
                      className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}


export default function Admin() {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { user, isSuperAdmin, isTeamAdmin, canManage } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"member" | "teamAdmin">("member");
  const [editUser, setEditUser] = useState<ApiUser | undefined>();
  // Shared-in user whose per-team access (for THIS team) a TA is managing.
  const [sharedPermUser, setSharedPermUser] = useState<ApiUser | undefined>();
  const [resetUser, setResetUser] = useState<ApiUser | undefined>();
  const [historyUser, setHistoryUser] = useState<ApiUser | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupTeamId, setNewGroupTeamId] = useState<number | undefined>(undefined);
  const [editingGroup, setEditingGroup] = useState<ApiGroup | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingTeam, setEditingTeam] = useState<ApiTeam | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamAreas, setNewTeamAreas] = useState<string[]>([...PLAN_FEATURE_PRESETS.team.features]);
  const [editingTeamAreas, setEditingTeamAreas] = useState<string[]>([]);
  const [configuringTeam, setConfiguringTeam] = useState<ApiTeam | null>(null);

  const [adminTeamScope, setAdminTeamScope] = useState<string>("current");

  const { data: teams = [] } = useQuery<ApiTeam[]>({
    queryKey: ["/api/teams"],
    enabled: canManage,
  });

  const teamScopeParam = isSuperAdmin
    ? adminTeamScope === "all"
      ? "?teamScope=all"
      : adminTeamScope !== "current"
        ? `?teamScope=${adminTeamScope}`
        : ""
    : "";

  const { data: users = [] } = useQuery<ApiUser[]>({
    queryKey: [`/api/users${teamScopeParam}`],
    enabled: canManage,
  });

  // Members filter + sort (TA can narrow the list by role and order it).
  const userRoleOf = (u: ApiUser): "admin" | "teamAdmin" | "athleteAccess" | "member" =>
    u.isAdmin ? "admin" : u.isTeamAdmin ? "teamAdmin" : u.isAthleteAccess ? "athleteAccess" : "member";
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "admin" | "teamAdmin" | "member" | "athleteAccess" | "blind" | "inactive">("all");
  // Origin filter: everyone / only the team's own users / only users shared in
  // from other teams (fromOtherTeam).
  const [userOriginFilter, setUserOriginFilter] = useState<"all" | "own" | "shared">("all");
  const [userSort, setUserSort] = useState<"name" | "created" | "role">("name");
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("asc");
  const [userSearch, setUserSearch] = useState("");
  const displayedUsers = useMemo(() => {
    const roleRank: Record<string, number> = { admin: 0, teamAdmin: 1, member: 2, athleteAccess: 3 };
    const uq = userSearch.trim().toLowerCase();
    let list = users.filter((u) => {
      if (uq && !(`${u.name} ${u.email} ${u.username ?? ""}`.toLowerCase().includes(uq))) return false;
      if (userOriginFilter === "own" && u.fromOtherTeam) return false;
      if (userOriginFilter === "shared" && !u.fromOtherTeam) return false;
      if (userRoleFilter === "all") return true;
      if (userRoleFilter === "blind") return !!u.isBlindTester;
      if (userRoleFilter === "inactive") return !u.isActive;
      return userRoleOf(u) === userRoleFilter;
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (userSort === "name") cmp = (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
      else if (userSort === "created") cmp = (a.createdAt || "").localeCompare(b.createdAt || "");
      else cmp = (roleRank[userRoleOf(a)] ?? 9) - (roleRank[userRoleOf(b)] ?? 9) || (a.name || "").localeCompare(b.name || "");
      return userSortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [users, userSearch, userRoleFilter, userOriginFilter, userSort, userSortDir]);

  const { data: apiGroups = [] } = useQuery<ApiGroup[]>({
    queryKey: [`/api/groups${teamScopeParam}`],
    enabled: canManage,
  });

  const { data: loginLogs = [] } = useQuery<LoginLog[]>({
    queryKey: [`/api/login-logs${teamScopeParam}`],
    enabled: canManage,
  });
  const { data: allSeries = [] } = useQuery<any[]>({
    queryKey: ["/api/series"],
    enabled: canManage,
  });

  const { data: allProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    enabled: canManage,
  });

  const { data: allTests = [] } = useQuery<any[]>({
    queryKey: ["/api/tests"],
    enabled: canManage,
  });

  const { data: allWeather = [] } = useQuery<any[]>({
    queryKey: ["/api/weather"],
    enabled: canManage,
  });

  const { data: adminStats } = useQuery<AdminStats>({
    queryKey: [`/api/admin/stats${teamScopeParam}`],
    enabled: canManage,
  });

  const { data: activities = [] } = useQuery<ActivityEntry[]>({
    queryKey: [`/api/activity${teamScopeParam}`],
    enabled: canManage,
  });

  type UsageRes = { teamName: string | null } & Record<"users" | "groups" | "tests" | "products", { current: number; limit: number | null }>;
  const { data: usage } = useQuery<UsageRes>({
    queryKey: [`/api/team-usage${teamScopeParam}`],
    enabled: canManage,
  });

  // Dashboard "needs attention": new interest registrations (SA only).
  const { data: adminRegistrations = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/registrations"],
    enabled: isSuperAdmin,
  });
  const restoreMutation = useMutation({
    mutationFn: async (logId: number) => (await apiRequest("POST", `/api/audit/${logId}/restore`)).json(),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith("/api/activity") });
      ["/api/tests", "/api/athletes", "/api/products", "/api/weather", "/api/race"].forEach((k) =>
        queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith(k) }));
      toast({ title: L("Gjenopprettet", "Restored"), description: data?.entityType });
    },
    onError: (e: Error) => toast({ title: L("Gjenoppretting mislyktes", "Restore failed"), description: e.message, variant: "destructive" }),
  });
  const [activityActionFilter, setActivityActionFilter] = useState<string>("all");
  const [expandedActivity, setExpandedActivity] = useState<number | null>(null);
  const activityActions = useMemo(
    () => [...new Set(activities.map((a) => a.action).filter(Boolean))].sort(),
    [activities],
  );
  const filteredActivities = useMemo(
    () => (activityActionFilter === "all" ? activities
      : activityActionFilter === "__deletions__" ? activities.filter((a) => a.action === "deleted")
      : activities.filter((a) => a.action === activityActionFilter)),
    [activities, activityActionFilter],
  );

  const groupNames = apiGroups.map((g) => g.name);

  // Follow the ACTIVE team, not the home team — a user who is team admin of
  // another team (shared in + made TA there) administers that team, not home.
  const effectiveTeamId = adminTeamScope === "all" || adminTeamScope === "current"
    ? ((user as any)?.activeTeamId ?? user?.teamId ?? 1)
    : parseInt(adminTeamScope);

  // Keep newGroupTeamId in sync with the selected admin scope so creating a group
  // always targets the currently viewed team without needing the top dropdown.
  useEffect(() => {
    setNewGroupTeamId(effectiveTeamId);
  }, [effectiveTeamId]);

  const scopeLabel = adminTeamScope === "all"
    ? "All teams"
    : adminTeamScope === "current"
      ? undefined
      : teams.find((t) => t.id === parseInt(adminTeamScope))?.name;

  const [pdfLoading, setPdfLoading] = useState(false);

  async function downloadFullPdf(exportScopeParam?: string) {
    setPdfLoading(true);
    try {
      const scope = typeof exportScopeParam === "string" ? exportScopeParam : "";
      const exportRes = await apiRequest("GET", `/api/admin/full-export${scope}`);
      const rawText = await exportRes.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr: any) {
        throw new Error(`Response parse failed (${rawText.length} chars): ${parseErr.message}`);
      }

      // Build lookup maps early — used in both race prep and tests sections below
      const earlyProductMap = new Map<number, any>((data.products ?? []).map((p: any) => [p.id, p]));
      const weatherById = new Map<number, any>((data.weather ?? []).map((w: any) => [w.id, w]));

      const renderWeatherLine = (w: any): string => {
        const parts: string[] = [];
        if (w.snowTemperatureC != null) parts.push(`Snow: ${w.snowTemperatureC}°C`);
        if (w.airTemperatureC != null) parts.push(`Air: ${w.airTemperatureC}°C`);
        if (w.snowHumidityPct != null) parts.push(`Snow hum: ${w.snowHumidityPct}%`);
        if (w.airHumidityPct != null) parts.push(`Air hum: ${w.airHumidityPct}%rH`);
        const snowType = [w.artificialSnow ? `Art. snow: ${w.artificialSnow}` : null, w.naturalSnow ? `Nat. snow: ${w.naturalSnow}` : null].filter(Boolean).join(", ");
        if (snowType) parts.push(snowType);
        if (w.trackHardness) parts.push(`Track: ${w.trackHardness}`);
        if (w.grainSize) parts.push(`Grain: ${w.grainSize}`);
        if (w.wind) parts.push(`Wind: ${w.wind}`);
        if (w.clouds != null) parts.push(`Clouds: ${w.clouds}/8`);
        if (w.precipitation) parts.push(`Precip: ${w.precipitation}`);
        if (w.testQuality != null) parts.push(`Quality: ${w.testQuality}/10`);
        return parts.join("  ·  ");
      };

      const getEntryRounds = (entry: any, numRounds: number) => {
        if (entry.results) {
          try {
            const parsed = typeof entry.results === "string" ? JSON.parse(entry.results) : entry.results;
            if (Array.isArray(parsed)) {
              while (parsed.length < numRounds) parsed.push({ result: null, rank: null });
              return parsed.slice(0, numRounds);
            }
          } catch {}
        }
        const results = [{ result: entry.result0kmCmBehind ?? entry.result_0km_cm_behind, rank: entry.rank0km ?? entry.rank_0km }];
        if (numRounds > 1) results.push({ result: entry.resultXkmCmBehind ?? entry.result_xkm_cm_behind, rank: entry.rankXkm ?? entry.rank_xkm });
        while (results.length < numRounds) results.push({ result: null, rank: null });
        return results;
      };

      const doc = new jsPDF({ orientation: "landscape" });
      let y = 15;
      const pageH = doc.internal.pageSize.getHeight();
      const checkPage = (need: number = 40) => { if (y > pageH - need) { doc.addPage(); y = 15; } };
      const hStyle = { fillColor: [22, 163, 74] as [number, number, number] };

      doc.setFontSize(18);
      doc.text("Glidr — Full Data Export", 14, y);
      y += 6;
      doc.setFontSize(9);
      doc.text(`Generated ${new Date().toLocaleString()}  |  ${data.tests.length} tests  |  ${data.weather.length} weather logs`, 14, y);
      y += 10;

      doc.setFontSize(13);
      doc.text("Users", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Name", "Email", "Groups", "Role", "Active"]],
        body: data.users.map((u: any) => [u.name, u.email, u.groupScope, u.isAdmin ? "Super Admin" : u.isTeamAdmin ? L("Lagadmin", "Team Admin") : L("Medlem", "Member"), u.isActive ? L("Ja", "Yes") : L("Nei", "No")]),
        styles: { fontSize: 8 }, headStyles: hStyle, margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      checkPage();
      doc.setFontSize(13);
      doc.text("Groups", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["ID", "Name"]],
        body: data.groups.map((g: any) => [g.id, g.name]),
        styles: { fontSize: 8 }, headStyles: hStyle, margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      checkPage();
      doc.setFontSize(13);
      doc.text("Testski Series", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Name", "Type", "Brand", "Ski Type", "Skis", "Grind", "Group"]],
        body: data.series.map((s: any) => [s.name, s.type, s.brand || "", s.skiType || "", s.numberOfSkis, s.grind || "", s.groupScope]),
        styles: { fontSize: 8 }, headStyles: hStyle, margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      checkPage();
      doc.setFontSize(13);
      doc.text("Products", 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Brand", "Name", "Type", "Group"]],
        body: data.products.map((p: any) => [p.brand || "", p.name, p.category || "", p.groupScope]),
        styles: { fontSize: 8 }, headStyles: hStyle, margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      if (data.athletes.length > 0) {
        checkPage();
        doc.setFontSize(13);
        doc.text("Athletes", 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [["Name", "Team", "Created By"]],
          body: data.athletes.map((a: any) => [a.name, a.team || "", a.createdByName || ""]),
          styles: { fontSize: 8 }, headStyles: hStyle, margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      if (data.raceSkis.length > 0) {
        checkPage();
        doc.setFontSize(13);
        doc.text(`Raceskis (${data.raceSkis.length})`, 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [["Athlete", "Ski ID", "Serial", "Brand", "Discipline", "Construction", "Mold", "Base", "Grind", "Heights", "Year"]],
          body: data.raceSkis.map((s: any) => [s.athleteName || "", s.skiId || "", s.serialNumber || "", s.brand || "", s.discipline || "", s.construction || "", s.mold || "", s.base || "", s.grind || "", s.heights || "", s.year || ""]),
          styles: { fontSize: 6.5 }, headStyles: hStyle, margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      if (data.raceSkiRegrinds && data.raceSkiRegrinds.length > 0) {
        checkPage();
        doc.setFontSize(13);
        doc.text(`Raceski Regrinds (${data.raceSkiRegrinds.length})`, 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [["Athlete", "Ski ID", "Brand", "Date", "Grind Type", "Stone", "Pattern", "Notes"]],
          body: data.raceSkiRegrinds.map((r: any) => [r.athleteName || "", r.skiId || "", r.brand || "", r.date || "", r.grindType || "", r.stone || "", r.pattern || "", r.notes || ""]),
          styles: { fontSize: 7 }, headStyles: hStyle, margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      if (data.testSkiRegrinds && data.testSkiRegrinds.length > 0) {
        checkPage();
        doc.setFontSize(13);
        doc.text(`Testski Series Regrinds (${data.testSkiRegrinds.length})`, 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [["Series", "Date", "Grind Type", "Stone", "Pattern", "Notes"]],
          body: data.testSkiRegrinds.map((r: any) => [r.seriesName || "", r.date || "", r.grindType || "", r.stone || "", r.pattern || "", r.notes || ""]),
          styles: { fontSize: 7 }, headStyles: hStyle, margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      if (data.racePreps && data.racePreps.length > 0) {
        const resolveRpIds = (raw: string | null | undefined): string => {
          if (!raw) return "";
          if (raw.split(",").some(p => isNaN(Number(p.trim())))) return raw;
          const ids = raw.split(",").map(p => parseInt(p.trim())).filter(n => !isNaN(n));
          const resolved = ids.map(id => { const p = earlyProductMap.get(id); return p ? `${p.brand || ""} ${p.name}`.trim() : ""; }).filter(Boolean).join(" + ");
          return resolved || raw;
        };
        // Per-product application: "Brand Name (app) + ...". Falls back to IDs.
        const resolveRpApps = (appsJson: string | null | undefined, idsFallback: string | null | undefined): string => {
          if (appsJson) {
            try {
              const arr = JSON.parse(appsJson);
              if (Array.isArray(arr)) {
                return arr.map((x: any) => {
                  const p = earlyProductMap.get(x.productId);
                  const nm = p ? `${p.brand || ""} ${p.name}`.trim() : "";
                  if (!nm) return "";
                  return x.application ? `${nm} (${x.application})` : nm;
                }).filter(Boolean).join(" + ");
              }
            } catch {}
          }
          return resolveRpIds(idsFallback);
        };

        // Group entries by race prep ID
        const entriesByRpId = new Map<number, any[]>();
        for (const e of (data.racePrepEntries || [])) {
          const id = e.race_prep_id;
          if (!entriesByRpId.has(id)) entriesByRpId.set(id, []);
          entriesByRpId.get(id)!.push(e);
        }

        checkPage();
        doc.setFontSize(16);
        doc.text(`Race Preparations (${data.racePreps.length})`, 14, y);
        y += 8;

        const sortedRacePreps = [...data.racePreps].sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""));

        for (const rp of sortedRacePreps) {
          checkPage(40);

          const glideStr = resolveRpApps(rp.product_apps, rp.product_ids) || rp.products || "—";
          const structStr = resolveRpApps(rp.structure_apps, rp.structure_ids) || rp.structure || "—";
          const kickStr = resolveRpIds(rp.kick_product_ids) || "—";
          const linkedWx = rp.weather_id ? weatherById.get(rp.weather_id) : null;

          // ── Race prep heading ──
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 41, 59);
          doc.text(`${rp.date}  ·  ${rp.location || "—"}  ·  ${rp.race_type || "—"}  ·  ${rp.discipline || "—"}`, 14, y);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          y += 5;

          // ── Products block ──
          doc.setFontSize(7.5);
          const prodLines: [string, string][] = [
            ["Glid:", glideStr],
            ["Struktur:", structStr],
          ];
          if (kickStr !== "—") prodLines.push(["Kick:", kickStr]);
          if (rp.tette) prodLines.push(["Tette/Binder:", rp.tette]);
          if (rp.method) prodLines.push(["Application:", rp.method]);
          if (rp.notes) prodLines.push(["Notes:", rp.notes]);
          if (rp.created_by_name) prodLines.push(["Created by:", rp.created_by_name]);

          for (const [label, val] of prodLines) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(80, 80, 80);
            doc.text(label, 16, y);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 0, 0);
            const valLines = doc.splitTextToSize(val, 220);
            doc.text(valLines, 50, y);
            y += valLines.length * 4;
          }

          // ── Inline weather ──
          if (linkedWx) {
            doc.setFontSize(7.5);
            doc.setTextColor(14, 116, 144);
            doc.setFont("helvetica", "bold");
            doc.text("Weather/Conditions:", 16, y);
            doc.setFont("helvetica", "normal");
            const wxStr = renderWeatherLine(linkedWx);
            const wxLines = doc.splitTextToSize(wxStr, 220);
            doc.text(wxLines, 50, y);
            doc.setTextColor(0, 0, 0);
            y += wxLines.length * 4;
          }

          y += 1;

          // ── Athletes / startlist ──
          const rpEntries = entriesByRpId.get(rp.id) || [];
          if (rpEntries.length > 0) {
            const isSkating = rp.discipline === "Skating";
            const head = ["Athlete", isSkating ? "Ski (Skating)" : "Ski (Classic)", "Glide ski", "Waxer", "Notes"];
            autoTable(doc, {
              startY: y,
              head: [head],
              body: rpEntries.map((e: any) => [
                e.athlete_name || "—",
                isSkating ? (e.ski_id_skating || e.ski_id || "—") : (e.ski_id_classic || e.ski_id || "—"),
                e.ski_id || "—",
                e.waxer_name || "—",
                e.notes || "",
              ]),
              styles: { fontSize: 7.5 },
              headStyles: { ...hStyle, fontSize: 7.5 },
              margin: { left: 16, right: 14 },
            });
            y = (doc as any).lastAutoTable.finalY + 3;
          } else {
            doc.setFontSize(7.5);
            doc.setTextColor(150, 150, 150);
            doc.text("No athletes registered.", 16, y);
            doc.setTextColor(0, 0, 0);
            y += 4;
          }

          y += 6;
        }
      }

      const productMap = new Map(data.products.map((p: any) => [p.id, p]));
      const seriesMap = new Map(data.series.map((s: any) => [s.id, s]));
      const raceSkiMap = new Map(data.raceSkis.map((s: any) => [s.id, s]));
      const athleteMap = new Map(data.athletes.map((a: any) => [a.id, a]));
      const grindProfileMap = new Map((data.grindProfiles || []).map((gp: any) => [gp.id, gp]));

      const getProductLabel = (entry: any, forAthleteTest = false) => {
        // Grind profile entry
        if (entry.grindProfileId) {
          const gp = grindProfileMap.get(entry.grindProfileId);
          if (gp) {
            const parts = [gp.name, gp.grindType, gp.stone, gp.pattern].filter(Boolean);
            return parts.join(" · ");
          }
        }
        if (entry.raceSkiId) {
          const ski = raceSkiMap.get(entry.raceSkiId);
          // For athlete tests the athlete name is already in the heading — omit it here
          if (ski) return forAthleteTest
            ? `${ski.brand || ""} ${ski.skiId || ""}`.trim()
            : `${ski.athleteName} — ${ski.brand || ""} ${ski.skiId || ""}`.trim();
        }
        const mainProduct = productMap.get(entry.productId);
        const parts: string[] = [];
        if (mainProduct) parts.push(`${mainProduct.brand || ""} ${mainProduct.name}`.trim());
        if (entry.freeTextProduct && !mainProduct) parts.push(entry.freeTextProduct);
        if (entry.additionalProductIds) {
          try {
            const raw = entry.additionalProductIds;
            const addIds = typeof raw === "string"
              ? (raw.startsWith("[") ? JSON.parse(raw) : raw.split(",").map(Number).filter((n: number) => !isNaN(n)))
              : raw;
            if (Array.isArray(addIds)) {
              for (const id of addIds) {
                const p = productMap.get(id);
                if (p) parts.push(`${p.brand || ""} ${p.name}`.trim());
              }
            }
          } catch {}
        }
        return parts.join(" + ") || entry.freeTextProduct || "—";
      };

      const sortedTests = [...data.tests].sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""));
      const grindTests = sortedTests.filter((t: any) => t.testType === "Grind" || t.testType === "Grinding");
      const otherTests = sortedTests.filter((t: any) => t.testType !== "Grind" && t.testType !== "Grinding");

      const renderTestBlock = (testsToRender: any[]) => {
        for (const test of testsToRender) {
          const entries: any[] = data.entriesByTest[test.id] || [];
          const seriesObj = seriesMap.get(test.seriesId);
          const athleteObj = test.athleteId ? athleteMap.get(test.athleteId) : null;
          const isAthleteTest = test.testSkiSource === "raceskis" && !!athleteObj;
          const sourceName = isAthleteTest
            ? athleteObj!.name
            : (seriesObj ? seriesObj.name : "");
          const isClassic = test.testType === "Classic";
          const isGrind = test.testType === "Grind" || test.testType === "Grinding";
          const linkedWeather = test.weatherId ? weatherById.get(test.weatherId) : null;

          checkPage(50);

          // ── Test heading ──
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 41, 59);
          const headingLine = isAthleteTest
            ? `${test.date}  ·  ${test.testType}  ·  ${test.location || ""}  ·  Athlete: ${sourceName}`
            : `${test.date}  ·  ${test.testType}  ·  ${test.location || ""}${sourceName ? `  ·  ${sourceName}` : ""}`;
          doc.text(headingLine, 14, y);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          y += 5;

          // ── Meta ──
          doc.setFontSize(7.5);
          doc.setTextColor(100, 100, 100);
          const metaParts = [
            `Group: ${test.groupScope}`,
            test.createdByName ? `Created by: ${test.createdByName}` : null,
            test.notes ? `Notes: ${test.notes}` : null,
          ].filter(Boolean);
          doc.text(metaParts.join("  |  "), 14, y);
          y += 4;

          // ── Weather inline ──
          if (linkedWeather) {
            doc.setFontSize(7.5);
            doc.setTextColor(14, 116, 144);
            doc.setFont("helvetica", "bold");
            doc.text("Weather/Conditions: ", 14, y);
            doc.setFont("helvetica", "normal");
            const wxLine = renderWeatherLine(linkedWeather);
            const wxLines = doc.splitTextToSize(wxLine, 240);
            doc.text(wxLines, 46, y);
            doc.setTextColor(0, 0, 0);
            y += wxLines.length * 4 + 1;
          }

          // ── Grind parameters ──
          const grindEntries = entries.filter((e: any) => e.grindType || e.grindStone || e.grindPattern || e.grindExtraParams || e.grindProfileId);
          if (grindEntries.length > 0) {
            const uniqueParams = [...new Map(grindEntries.map((e: any) => {
              const key = [e.grindType, e.grindStone, e.grindPattern, e.grindExtraParams, e.grindProfileId].join("|");
              return [key, e];
            })).values()];
            for (const e of uniqueParams) {
              const gp = e.grindProfileId ? grindProfileMap.get(e.grindProfileId) : null;
              const grindParts = [
                (gp?.grindType || e.grindType) ? `Type: ${gp?.grindType || e.grindType}` : null,
                (gp?.stone || e.grindStone) ? `Stone: ${gp?.stone || e.grindStone}` : null,
                (gp?.pattern || e.grindPattern) ? `Pattern: ${gp?.pattern || e.grindPattern}` : null,
                e.grindExtraParams ? `Extra: ${e.grindExtraParams}` : null,
              ].filter(Boolean).join("  ·  ");
              if (grindParts) {
                doc.setFontSize(7.5);
                doc.setTextColor(80, 80, 80);
                doc.setFont("helvetica", "bold");
                doc.text("Grind params: ", 14, y);
                doc.setFont("helvetica", "normal");
                doc.text(grindParts, 38, y);
                doc.setTextColor(0, 0, 0);
                y += 4;
              }
            }
          }

          y += 1;

          if (entries.length > 0) {
            let distanceLabels: string[] = [];
            if (test.distanceLabels) {
              try {
                const parsed = typeof test.distanceLabels === "string" ? JSON.parse(test.distanceLabels) : test.distanceLabels;
                if (Array.isArray(parsed) && parsed.length > 0) distanceLabels = parsed;
              } catch {}
            }
            if (distanceLabels.length === 0) {
              distanceLabels = [test.distanceLabel0km || "0 km"];
              if (test.distanceLabelXkm) distanceLabels.push(test.distanceLabelXkm);
            }

            const productColLabel = isGrind ? "Grind Profile" : (isAthleteTest ? "Ski (brand/ID)" : "Product / Raceski");
            const head = ["Rank", "Ski #", productColLabel, "Method"];
            for (const label of distanceLabels) {
              head.push(`${label} (cm)`);
              head.push("Rank");
            }
            if (isClassic) head.push("Kick");
            head.push("Feeling");

            const body = entries
              .map((e: any) => {
                const rounds = getEntryRounds(e, distanceLabels.length);
                return { entry: e, rounds, firstRank: rounds[0]?.rank ?? 999 };
              })
              .sort((a: any, b: any) => a.firstRank - b.firstRank)
              .map(({ entry: e, rounds }: any) => {
                const row: (string | number)[] = [
                  rounds[0]?.rank ?? "—",
                  e.skiNumber || "",
                  getProductLabel(e, isAthleteTest),
                  e.methodology || "",
                ];
                for (const rr of rounds) {
                  row.push(rr.result != null ? String(rr.result) : "—");
                  row.push(rr.rank != null ? String(rr.rank) : "—");
                }
                if (isClassic) row.push(e.kickRank != null ? String(e.kickRank) : "—");
                row.push(e.feelingRank != null ? String(e.feelingRank) : "—");
                return row;
              });

            autoTable(doc, {
              startY: y, head: [head], body,
              styles: { fontSize: 7 },
              headStyles: { ...hStyle, fontSize: 7 },
              margin: { left: 14, right: 14 },
              didParseCell: (data: any) => {
                if (data.section === "body" && data.column.index === 0) {
                  const rank = data.cell.raw;
                  if (rank === 1) { data.cell.styles.textColor = [16, 185, 129]; data.cell.styles.fontStyle = "bold"; }
                  else if (rank === 2) { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = "bold"; }
                  else if (rank === 3) { data.cell.styles.textColor = [245, 158, 11]; data.cell.styles.fontStyle = "bold"; }
                }
              },
            });
            y = (doc as any).lastAutoTable.finalY + 8;
          } else {
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text("No entries recorded.", 14, y);
            doc.setTextColor(0, 0, 0);
            y += 6;
          }
        }
      };

      checkPage();
      doc.setFontSize(16);
      doc.text(`Tests with Results (${data.tests.length})`, 14, y);
      y += 8;

      // Render regular tests first
      if (otherTests.length > 0) renderTestBlock(otherTests);

      // Grind tests in their own section
      if (grindTests.length > 0) {
        checkPage();
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(`Grind Tests (${grindTests.length})`, 14, y);
        doc.setFont("helvetica", "normal");
        y += 8;
        renderTestBlock(grindTests);
      }
      y += 4;

      checkPage();
      doc.setFontSize(16);
      doc.text(`Weather Logs (${data.weather.length})`, 14, y);
      y += 8;

      if (data.weather.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Date", "Time", "Location", "Snow °C", "Air °C", "Snow Hum%", "Air Hum%", "Clouds", "Wind", "Precip.", "Snow Type", "Grain", "Track", "Quality", "Group"]],
          body: data.weather.map((w: any) => {
            const snowTypes = [w.artificialSnow ? `Art: ${w.artificialSnow}` : null, w.naturalSnow ? `Nat: ${w.naturalSnow}` : null].filter(Boolean).join(", ");
            return [
              w.date, w.time || "", w.location || "",
              w.snowTemperatureC ?? "", w.airTemperatureC ?? "",
              w.snowHumidityPct ?? "", w.airHumidityPct ?? "",
              w.clouds != null ? `${w.clouds}/8` : "", w.wind || "", w.precipitation || "",
              snowTypes || "", w.grainSize || "", w.trackHardness || "",
              w.testQuality != null ? `${w.testQuality}/10` : "",
              w.groupScope,
            ];
          }),
          styles: { fontSize: 6.5 }, headStyles: hStyle, margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      if (data.grindProfiles && data.grindProfiles.length > 0) {
        checkPage();
        doc.setFontSize(13);
        doc.text(`Grind Profiles (${data.grindProfiles.length})`, 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [["ID", "Name", "Type", "Stone", "Pattern", "Extra Params", "Notes", "Created By"]],
          body: data.grindProfiles.map((gp: any) => {
            let extras = "";
            if (gp.extraParams) {
              try { extras = Object.entries(JSON.parse(gp.extraParams)).map(([k, v]) => `${k}: ${v}`).join(", "); }
              catch { extras = gp.extraParams; }
            }
            return [gp.grindId || gp.id, gp.name || "", gp.grindType || "", gp.stone || "", gp.pattern || "", extras, gp.notes || "", gp.createdByName || ""];
          }),
          styles: { fontSize: 7 }, headStyles: hStyle, margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      if (data.grindingRecords.length > 0) {
        checkPage();
        doc.setFontSize(13);
        doc.text(`Grinding Records (${data.grindingRecords.length})`, 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [["Date", "Series", "Type", "Stone", "Notes", "Created By", "Group"]],
          body: data.grindingRecords.map((r: any) => {
            const series = r.seriesId ? seriesMap.get(r.seriesId) : null;
            return [r.date || "", series?.name || (r.seriesId ? `#${r.seriesId}` : "—"), r.grindType || "", r.stone || "", r.notes || "", r.createdByName || "", r.groupScope || ""];
          }),
          styles: { fontSize: 7 }, headStyles: hStyle, margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      if (data.grindingSheets && data.grindingSheets.length > 0) {
        checkPage();
        doc.setFontSize(13);
        doc.text(`Grinding Sheets (${data.grindingSheets.length})`, 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [["Name", "URL", "Created By", "Group"]],
          body: data.grindingSheets.map((s: any) => [s.name || "", s.url || "", s.createdByName || "", s.groupScope || ""]),
          styles: { fontSize: 7 }, headStyles: hStyle, margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      if (data.activities && data.activities.length > 0) {
        checkPage();
        doc.setFontSize(13);
        doc.text(`Activity Log (${data.activities.length})`, 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [["Time", "User", "Action", "Type", "Details", "Group"]],
          body: data.activities.slice(0, 500).map((a: any) => [
            a.createdAt ? new Date(a.createdAt).toLocaleString() : "", a.userName || "", a.action || "",
            a.entityType || "", a.details || "", a.groupScope || "",
          ]),
          styles: { fontSize: 6.5 }, headStyles: hStyle, margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      checkPage();
      doc.setFontSize(13);
      doc.text(`Login History (${data.loginLogs.length})`, 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [["Name", "Email", "Login Time"]],
        body: data.loginLogs.map((l: any) => [l.name, l.email, new Date(l.loginAt).toLocaleString()]),
        styles: { fontSize: 8 }, headStyles: hStyle, margin: { left: 14, right: 14 },
      });

      // Footer on all pages
      {
        const pageCount = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : 1;
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const dateStr = new Date().toLocaleString();
        for (let pg = 1; pg <= pageCount; pg++) {
          doc.setPage(pg);
          doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(130, 130, 130);
          doc.setDrawColor(200, 200, 200);
          doc.line(14, ph - 9, pw - 14, ph - 9);
          doc.text(`Exported by: ${user?.name ?? "Unknown"}  ·  ${dateStr}`, 14, ph - 5);
          doc.text("This document is intended for team members only.", pw - 14, ph - 5, { align: "right" });
          doc.setTextColor(0, 0, 0); doc.setDrawColor(0, 0, 0);
        }
      }
      doc.save("glidr-full-export.pdf");
      const sections = [
        `${data.tests.length} tests`,
        `${data.weather.length} weather`,
        data.raceSkis.length ? `${data.raceSkis.length} race skis` : null,
        data.grindingRecords.length ? `${data.grindingRecords.length} grinds` : null,
        data.raceSkiRegrinds?.length ? `${data.raceSkiRegrinds.length} ski regrinds` : null,
        data.testSkiRegrinds?.length ? `${data.testSkiRegrinds.length} series regrinds` : null,
      ].filter(Boolean).join(", ");
      toast({ title: L("PDF eksportert", "PDF exported"), description: sections });
      fetch("/api/log-export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportType: "pdf_report", details: "Admin PDF export" }),
      }).catch(() => {});
      try {
        await apiRequest("POST", "/api/action-log", { action: "pdf_download", details: "Full data export" });
        queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/login-logs") });
      } catch (_) {}
    } catch (err: any) {
      toast({ title: L("Eksport mislyktes", "Export failed"), description: err.message, variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  }

  const createGroupMutation = useMutation({
    mutationFn: async ({ name, teamId }: { name: string; teamId?: number }) => {
      const res = await apiRequest("POST", "/api/groups", { name, teamId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setNewGroupName("");
      setNewGroupTeamId(undefined);
      toast({ title: L("Gruppe opprettet", "Group created") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PUT", `/api/groups/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setEditingGroup(null);
      toast({ title: L("Gruppe omdøpt", "Group renamed") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/groups/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: L("Gruppe slettet", "Group deleted") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: L("Bruker slettet", "User deleted") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const forceLogoutMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/admin/force-logout/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: L("Brukerøkt avsluttet", "User session terminated") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, value }: { userId: number; value: boolean }) => {
      const res = await apiRequest("PUT", `/api/users/${userId}`, { isActive: value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: L("Brukerstatus oppdatert", "User status updated") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/users/${userId}/unlock`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: L("Konto låst opp", "Account unlocked") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const toggleWatchMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: number; enabled: boolean }) => {
      const res = await apiRequest("PUT", `/api/users/${userId}/garmin-watch`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users${teamScopeParam}`] });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const toggleAllTeamsMutation = useMutation({
    mutationFn: async ({ userId, enabled }: { userId: number; enabled: boolean }) => {
      const res = await apiRequest("PUT", `/api/users/${userId}/all-teams-access`, { enabled });
      return res.json();
    },
    // Optimistic: flip the icon immediately instead of waiting for a refetch.
    onMutate: async ({ userId, enabled }) => {
      const key = [`/api/users${teamScopeParam}`];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<ApiUser[]>(key);
      queryClient.setQueryData<ApiUser[]>(key, (old) => old?.map((x) => x.id === userId ? { ...x, canViewAllTeams: enabled ? 1 : 0 } : x));
      return { prev, key };
    },
    onError: (e: Error, _vars, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: [`/api/users${teamScopeParam}`] }); },
  });

  // Remove a "shared from other team" member's access to this team.
  const removeFromTeamMutation = useMutation({
    mutationFn: async (userId: number) => { const res = await apiRequest("DELETE", `/api/users/${userId}/teams/${effectiveTeamId}`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/users${teamScopeParam}`] }); toast({ title: L("Tilgang fjernet", "Access removed") }); },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  const addExistingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/teams/${effectiveTeamId}/add-member`, { email: addEmail.trim(), role: addRole });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/users${teamScopeParam}`] });
      toast({ title: L("Bruker lagt til laget", "User added to team"), description: data?.name });
      setAddExistingOpen(false); setAddEmail(""); setAddRole("member");
    },
    onError: (e: Error) => {
      const msg = /does not exist/i.test(e.message) ? L("Brukeren finnes ikke i systemet.", "This user does not exist in the system.") : e.message;
      toast({ title: L("Kunne ikke legge til", "Could not add"), description: msg, variant: "destructive" });
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (payload: { name: string; enabledAreas: string[] }) => {
      const res = await apiRequest("POST", "/api/teams", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setNewTeamName("");
      setNewTeamAreas([...PERMISSION_AREAS]);
      toast({ title: L("Lag opprettet", "Team created") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, name, enabledAreas }: { id: number; name: string; enabledAreas: string[] }) => {
      const res = await apiRequest("PUT", `/api/teams/${id}`, { name, enabledAreas });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setEditingTeam(null);
      setConfiguringTeam(null);
      toast({ title: L("Lag oppdatert", "Team updated") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/teams/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: L("Lag slettet", "Team deleted") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const setDefaultTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/teams/${id}/set-default`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: L("Standardlag oppdatert", "Default team updated") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const setPlanMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; planName?: string; maxUsers?: number | null; maxGroups?: number | null; maxTests?: number | null; maxProducts?: number | null }) => {
      const res = await apiRequest("PATCH", `/api/admin/teams/${id}/plan`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: L("Lagret", "Saved") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const [limitsTeam, setLimitsTeam] = useState<ApiTeam | null>(null);
  const [limitsForm, setLimitsForm] = useState<any>({});

  const [editPlanTeam, setEditPlanTeam] = useState<ApiTeam | null>(null);
  const [editPlanForm, setEditPlanForm] = useState<any>({});

  const [notesTeam, setNotesTeam] = useState<ApiTeam | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const [historyTeam, setHistoryTeam] = useState<ApiTeam | null>(null);

  const saveNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/teams/${id}/plan`, { notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setNotesTeam(null);
      toast({ title: L("Notater lagret", "Notes saved") });
    },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  const pauseTeamMutation = useMutation({
    mutationFn: async ({ id, paused }: { id: number; paused: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/teams/${id}/pause`, { paused });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: vars.paused ? L("Lag suspendert", "Team suspended") : L("Lag gjenopprettet", "Team unsuspended"), description: vars.paused ? L("Lagmedlemmer vil ikke kunne logge inn.", "Team members will be unable to log in.") : L("Lagmedlemmer kan logge inn igjen.", "Team members can log in again.") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const saveLogoMutation = useMutation({
    mutationFn: async ({ id, logo }: { id: number; logo: string | null }) => {
      const res = await apiRequest("PUT", `/api/teams/${id}/logo`, { logo });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-team-info"] });
      toast({ title: L("Laglogo lagret", "Team logo saved") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const saveBackupSheetMutation = useMutation({
    mutationFn: async ({ id, url }: { id: number; url: string }) => {
      const res = await apiRequest("PUT", `/api/teams/${id}/backup-sheet`, { url });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: L("Sikkerhetskopiark lagret", "Backup sheet saved") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const runBackupMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/teams/${id}/backup`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: L("Sikkerhetskopi fullført", "Backup completed successfully") });
    },
    onError: (e: Error) => {
      toast({ title: L("Sikkerhetskopi mislyktes", "Backup failed"), description: e.message, variant: "destructive" });
    },
  });

  const saveDriveFolderMutation = useMutation({
    mutationFn: async ({ id, url }: { id: number; url: string }) => {
      const res = await apiRequest("PUT", `/api/teams/${id}/drive-folder`, { url });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: L("Drive-mappe lagret", "Drive folder saved") });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const runDriveBackupMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/teams/${id}/drive-backup`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      if (data?.pdfError) {
        toast({ title: L("Drive-sikkerhetskopi: JSON OK — PDF mislyktes", "Drive backup: JSON OK — PDF failed"), description: data.pdfError, variant: "destructive" });
      } else {
        toast({ title: L("Drive-sikkerhetskopi fullført", "Drive backup completed"), description: L("JSON og PDF lastet opp.", "JSON and PDF uploaded successfully.") });
      }
    },
    onError: (e: Error) => {
      toast({ title: L("Drive-sikkerhetskopi mislyktes", "Drive backup failed"), description: e.message, variant: "destructive" });
    },
  });

  const [backupSheetInputs, setBackupSheetInputs] = useState<Record<number, string>>({});
  const [driveFolderInputs, setDriveFolderInputs] = useState<Record<number, string>>({});

  if (!user) return null;

  if (!canManage) {
    return (
      <AppShell>
        <Card className="fs-card rounded-2xl p-6" data-testid="status-admin-forbidden">
          <div className="text-base font-semibold">{L("Kun admin", "Admin only")}</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Your account does not have access to Admin tools.
          </div>
        </Card>
      </AppShell>
    );
  }

  const stats = adminStats || {
    userCount: users.length,
    testCount: 0,
    productCount: 0,
    seriesCount: 0,
    weatherCount: 0,
    grindingCount: 0,
    loginCount: loginLogs.length,
    activityCount: activities.length,
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("admin.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-admin-subtitle">
              {t("admin.manageDesc")}{scopeLabel ? ` — ${scopeLabel}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && teams.length > 0 && (
              <Select value={adminTeamScope} onValueChange={setAdminTeamScope}>
                <SelectTrigger className="w-[180px] h-9" data-testid="select-admin-team-scope">
                  <Building2 className="h-4 w-4 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current" data-testid="scope-current">{t("admin.currentTeam")}</SelectItem>
                  <SelectItem value="all" data-testid="scope-all">{L("Alle lag", "All teams")}</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)} data-testid={`scope-team-${t.id}`}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              data-testid="button-download-pdf"
              onClick={() => downloadFullPdf()}
              disabled={pdfLoading}
            >
              {pdfLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {pdfLoading ? "Exporting…" : t("admin.downloadPdf")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6" data-testid="admin-body">
        <AdminNav activeTab={activeTab} setActiveTab={setActiveTab} isSuperAdmin={isSuperAdmin} />
        <div className="min-w-0 flex-1 flex flex-col gap-5">

        {activeTab === "overview" && (
          <div className="flex flex-col gap-5" data-testid="tab-content-overview">
            {/* ── Control-room dashboard: status cards + needs-attention ── */}
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              const scopedTeams = isSuperAdmin
                ? (adminTeamScope === "all" ? teams : teams.filter((tm) => tm.id === effectiveTeamId))
                : teams.filter((tm) => tm.id === (user?.teamId ?? -1));
              const configured = scopedTeams.filter((tm) => tm.backupSheetUrl || (tm as any).driveFolderId);
              const isFresh = (ts: string | null) => !!ts && (Date.now() - new Date(ts).getTime()) < 26 * 3600 * 1000;
              const staleBackups = configured.filter((tm) => !isFresh(tm.lastBackupAt));
              const missingDrive = scopedTeams.filter((tm) => !(tm as any).driveFolderId);
              const lockedUsers = users.filter((u) => !!u.loginLocked);
              // Terms acceptance is Super Admin business — never shown to Team Admins.
              const termsMissing = isSuperAdmin
                ? users.filter((u) => !!u.isActive && !u.isAthleteAccess && !(u as any).fromOtherTeam && !(u as any).termsAcceptedAt)
                : [];
              const newRegs = isSuperAdmin ? adminRegistrations.filter((r: any) => (r.status ?? "new") === "new") : [];
              const activityToday = activities.filter((a) => a.createdAt?.slice(0, 10) === today).length;
              const loginsToday = loginLogs.filter((l) => l.loginAt?.slice(0, 10) === today).length;

              const tone = {
                green: "text-emerald-600 dark:text-emerald-400",
                amber: "text-amber-600 dark:text-amber-400",
                red: "text-red-600 dark:text-red-400",
                muted: "text-muted-foreground",
              } as const;
              const dot = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", muted: "bg-muted-foreground/40" } as const;

              const backupTone: keyof typeof tone = configured.length === 0 ? "muted" : staleBackups.length > 0 ? "amber" : "green";
              const backupValue = configured.length === 0
                ? L("Ikke satt opp", "Not set up")
                : staleBackups.length > 0
                  ? `${staleBackups.length} ${L("på etterskudd", "behind")}`
                  : scopedTeams.length === 1 && configured[0]?.lastBackupAt
                    ? new Date(configured[0].lastBackupAt as string).toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                    : L("Alle oppdatert", "All up to date");
              const usersTone: keyof typeof tone = usage?.users.limit != null
                ? (usage.users.current >= usage.users.limit ? "red" : usage.users.current / usage.users.limit >= 0.8 ? "amber" : "green")
                : "muted";
              const usersValue = usage ? `${usage.users.current}${usage.users.limit != null ? ` ${L("av", "of")} ${usage.users.limit}` : ""}` : String(stats.userCount);
              const termsTone: keyof typeof tone = termsMissing.length > 0 ? "amber" : "green";

              const statusCards: { label: string; value: string; toneKey: keyof typeof tone; tab: TabId; testId: string }[] = [
                { label: "Backup", value: backupValue, toneKey: backupTone, tab: "backup", testId: "status-backup" },
                { label: L("Brukere", "Users"), value: usersValue, toneKey: usersTone, tab: "users", testId: "status-users" },
                // Terms card is SA-only; TAs get today's logins instead.
                ...(isSuperAdmin
                  ? [{ label: L("Vilkår", "Terms"), value: termsMissing.length > 0 ? `${termsMissing.length} ${L("mangler", "missing")}` : L("Alle har akseptert", "All accepted"), toneKey: termsTone, tab: "users" as TabId, testId: "status-terms" }]
                  : [{ label: L("Innlogginger i dag", "Logins today"), value: String(loginsToday), toneKey: (loginsToday > 0 ? "green" : "muted") as keyof typeof tone, tab: "logins" as TabId, testId: "status-logins" }]),
                { label: L("Aktivitet i dag", "Activity today"), value: String(activityToday), toneKey: activityToday > 0 ? "green" : "muted", tab: "activity", testId: "status-activity" },
              ];

              const attention: { label: string; action: string; tab: TabId; toneKey: keyof typeof tone; testId: string }[] = [
                ...(lockedUsers.length > 0 ? [{ label: `${lockedUsers.length} ${L("konto(er) er låst etter mislykkede innlogginger", "account(s) locked after failed logins")}`, action: L("Se hvem", "See who"), tab: "users" as TabId, toneKey: "red" as const, testId: "attention-locked" }] : []),
                ...(termsMissing.length > 0 ? [{ label: `${termsMissing.length} ${L("bruker(e) har ikke akseptert vilkårene", "user(s) have not accepted the terms")}`, action: L("Se hvem", "See who"), tab: "users" as TabId, toneKey: "amber" as const, testId: "attention-terms" }] : []),
                ...(newRegs.length > 0 ? [{ label: `${newRegs.length} ${L("ny(e) interesse-registrering(er)", "new interest registration(s)")}`, action: L("Behandle", "Handle"), tab: "registrations" as TabId, toneKey: "amber" as const, testId: "attention-registrations" }] : []),
                ...(missingDrive.length > 0 && isSuperAdmin ? [{ label: `${missingDrive.length} ${L("lag mangler Drive-mappe for backup", "team(s) missing a Drive folder for backup")}`, action: L("Koble til", "Connect"), tab: "backup" as TabId, toneKey: "amber" as const, testId: "attention-drive" }] : []),
                ...(staleBackups.length > 0 ? [{ label: `${staleBackups.length} ${L("lag har backup eldre enn 24 timer", "team(s) have a backup older than 24 hours")}`, action: L("Sjekk", "Check"), tab: "backup" as TabId, toneKey: "amber" as const, testId: "attention-backup" }] : []),
              ];

              return (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="dashboard-status-cards">
                    {statusCards.map((c) => (
                      <button
                        key={c.testId}
                        type="button"
                        onClick={() => setActiveTab(c.tab)}
                        className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/30"
                        data-testid={c.testId}
                      >
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn("h-1.5 w-1.5 rounded-full", dot[c.toneKey])} />
                          {c.label}
                        </div>
                        <div className={cn("mt-1 text-lg font-semibold tabular-nums", tone[c.toneKey])}>{c.value}</div>
                      </button>
                    ))}
                  </div>

                  <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-needs-attention">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h2 className="text-sm font-semibold text-foreground">{L("Trenger oppmerksomhet", "Needs attention")}</h2>
                      {attention.length > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{attention.length}</span>
                      )}
                    </div>
                    {attention.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400" data-testid="attention-all-clear">
                        <Check className="h-4 w-4" />
                        {L("Alt ser bra ut — ingenting krever oppmerksomhet.", "All clear — nothing needs attention.")}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {attention.map((a) => (
                          <button
                            key={a.testId}
                            type="button"
                            onClick={() => setActiveTab(a.tab)}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                              a.toneKey === "red"
                                ? "border-red-200 bg-red-50/60 hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
                                : "border-amber-200 bg-amber-50/60 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
                            )}
                            data-testid={a.testId}
                          >
                            <span className="min-w-0 truncate text-foreground/90">{a.label}</span>
                            <span className={cn("shrink-0 text-xs font-medium", tone[a.toneKey])}>{a.action} →</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>
                </>
              );
            })()}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label={t("admin.statUsers")} value={stats.userCount} icon={Users} color="blue" testId="stat-users" />
              <StatCard label={t("admin.statTests")} value={stats.testCount} icon={FlaskConical} color="emerald" testId="stat-tests" />
              <StatCard label={t("admin.statProducts")} value={stats.productCount} icon={Package} color="amber" testId="stat-products" />
              <StatCard label={t("admin.statSeries")} value={stats.seriesCount} icon={Layers} color="violet" testId="stat-series" />
              <StatCard label={t("admin.statWeather")} value={stats.weatherCount} icon={CloudSun} color="sky" testId="stat-weather" />
              <StatCard label={t("admin.statGrinding")} value={stats.grindingCount} icon={Disc3} color="rose" testId="stat-grinding" />
              <StatCard label={t("admin.statLogins")} value={stats.loginCount} icon={LogIn} color="indigo" testId="stat-logins" />
              <StatCard label={t("admin.statActivities")} value={stats.activityCount} icon={Activity} color="teal" testId="stat-activities" />
            </div>


            {usage && (
              <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-usage">
                <div className="flex items-center gap-2 mb-4">
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50">
                    <BarChart3 className="h-4 w-4 text-sky-600" />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground">{L("Forbruk og kvoter", "Usage & quotas")}{usage.teamName ? ` — ${usage.teamName}` : ""}</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {([
                    [L("Brukere", "Users"), usage.users],
                    [L("Grupper", "Groups"), usage.groups],
                    [L("Tester", "Tests"), usage.tests],
                    [L("Produkter", "Products"), usage.products],
                  ] as [string, { current: number; limit: number | null }][]).map(([label, u]) => {
                    const pct = u.limit ? Math.min(100, Math.round((u.current / u.limit) * 100)) : 0;
                    const near = u.limit != null && pct >= 80;
                    const full = u.limit != null && u.current >= u.limit;
                    return (
                      <div key={label} data-testid={`usage-${label}`}>
                        <div className="mb-1 flex items-baseline justify-between text-xs">
                          <span className="font-medium text-foreground">{label}</span>
                          <span className={cn("tabular-nums", full ? "text-red-600" : near ? "text-amber-600" : "text-muted-foreground")}>
                            {u.current}{u.limit != null ? ` / ${u.limit}` : ` · ${L("ubegrenset", "unlimited")}`}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          {u.limit != null && (
                            <div className={cn("h-full rounded-full transition-all", full ? "bg-red-500" : near ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-recent-activity">
              <div className="flex items-center gap-2 mb-4">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50">
                  <Activity className="h-4 w-4 text-green-600" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">{t("admin.recentActivity")}</h2>
              </div>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="empty-activity">{L("Ingen aktivitet registrert ennå.", "No activity recorded yet.")}</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {activities.slice(0, 20).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5"
                      data-testid={`row-activity-${a.id}`}
                    >
                      <div className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-50 mt-0.5">
                        <Activity className="h-3.5 w-3.5 text-green-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{a.userName}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{a.action}</span>
                          {a.entityType && (
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">{a.entityType}</span>
                          )}
                        </div>
                        {a.details && <p className="mt-0.5 text-xs text-muted-foreground truncate">{a.details}</p>}
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                          {a.groupScope && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">{a.groupScope}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Team Logo */}
            {(isSuperAdmin || isTeamAdmin) && (
              <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-team-logo">
                <div className="flex items-center gap-2 mb-4">
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30">
                    <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{L("Laglogo", "Team Logo")}</h2>
                    <p className="text-xs text-muted-foreground">{L("Vises i sidemenyen i stedet for Glidr-ikonet. Maks 150 KB.", "Shown in the sidebar instead of the Glidr icon. Max 150 KB.")}</p>
                  </div>
                </div>
                {(isSuperAdmin ? teams : teams.filter((t) => t.id === user?.teamId)).map((team) => (
                  <div key={`logo-${team.id}`} className="space-y-3">
                    {isSuperAdmin && teams.length > 1 && (
                      <div className="text-xs font-semibold text-foreground/80">{team.name}</div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      {team.teamLogo && (
                        <img src={team.teamLogo} alt={L("Nåværende logo","Current logo")} className="h-12 w-12 object-contain rounded border border-border" />
                      )}
                      <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                        {team.teamLogo ? L("Bytt logo", "Replace logo") : L("Last opp logo", "Upload logo")}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              const dataUrl = reader.result as string;
                              saveLogoMutation.mutate({ id: team.id, logo: dataUrl });
                            };
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {team.teamLogo && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-destructive hover:text-destructive"
                          disabled={saveLogoMutation.isPending}
                          onClick={() => saveLogoMutation.mutate({ id: team.id, logo: null })}
                          data-testid={`button-remove-logo-${team.id}`}
                        >
                          Remove logo
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {activeTab === "users" && (
          <div className="flex flex-col gap-4" data-testid="tab-content-users">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">{L("Brukere", "Users")} ({displayedUsers.length}{displayedUsers.length !== users.length ? `/${users.length}` : ""})</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={L("Søk navn eller e-post…", "Search name or email…")}
                    className="h-8 w-[190px] pl-8 text-xs"
                    data-testid="input-user-search"
                  />
                </div>
                <Select value={userRoleFilter} onValueChange={(v) => setUserRoleFilter(v as any)}>
                  <SelectTrigger className="h-8 w-auto gap-1 text-xs" data-testid="filter-user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("Alle roller", "All roles")}</SelectItem>
                    <SelectItem value="admin">Super Admin</SelectItem>
                    <SelectItem value="teamAdmin">{L("Lagadmin", "Team Admin")}</SelectItem>
                    <SelectItem value="member">{L("Medlem", "Member")}</SelectItem>
                    <SelectItem value="athleteAccess">{L("Utøvertilgang", "Athlete access")}</SelectItem>
                    <SelectItem value="blind">{L("Blindtestere", "Blind testers")}</SelectItem>
                    <SelectItem value="inactive">{L("Inaktive", "Inactive")}</SelectItem>
                  </SelectContent>
                </Select>
                {/* Origin: hide/show users shared in from other teams */}
                <Select value={userOriginFilter} onValueChange={(v) => setUserOriginFilter(v as any)}>
                  <SelectTrigger className="h-8 w-auto gap-1 text-xs" data-testid="filter-user-origin"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("Alle lag", "All teams")}</SelectItem>
                    <SelectItem value="own">{L("Kun eget lag", "Own team only")}</SelectItem>
                    <SelectItem value="shared">{L("Kun delte fra andre lag", "Only shared from other teams")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={userSort} onValueChange={(v) => setUserSort(v as any)}>
                  <SelectTrigger className="h-8 w-auto gap-1 text-xs" data-testid="sort-user"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">{L("Navn", "Name")}</SelectItem>
                    <SelectItem value="created">{L("Opprettet", "Created")}</SelectItem>
                    <SelectItem value="role">{L("Rolle", "Role")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setUserSortDir((d) => d === "asc" ? "desc" : "asc")} data-testid="sort-user-dir" title={userSortDir === "asc" ? L("Stigende", "Ascending") : L("Synkende", "Descending")}>
                  {userSortDir === "asc" ? "↑" : "↓"}
                </Button>
              </div>
              <Dialog open={addExistingOpen} onOpenChange={(v) => { setAddExistingOpen(v); if (!v) { setAddEmail(""); setAddRole("member"); } }}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-add-existing-user">
                    <UserPlus className="mr-2 h-4 w-4" />
                    {L("Legg til eksisterende", "Add existing")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>{L("Legg til eksisterende bruker", "Add existing user")}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{L("Gi en bruker fra et annet lag tilgang til dette laget. Brukeren må allerede finnes i Glidr.", "Give a user from another team access to this team. The user must already exist in Glidr.")}</p>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">{L("E-post", "Email")}</label>
                      <Input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="navn@lag.no" data-testid="input-add-existing-email"
                        onKeyDown={(e) => { if (e.key === "Enter" && addEmail.trim()) addExistingMutation.mutate(); }} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">{L("Rolle", "Role")}</label>
                      <Select value={addRole} onValueChange={(v) => setAddRole(v as "member" | "teamAdmin")}>
                        <SelectTrigger data-testid="select-add-existing-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">{L("Medlem", "Member")}</SelectItem>
                          <SelectItem value="teamAdmin">{L("Lagadmin", "Team Admin")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => addExistingMutation.mutate()} disabled={addExistingMutation.isPending || !addEmail.trim()} data-testid="button-submit-add-existing">
                        {addExistingMutation.isPending ? L("Legger til…", "Adding…") : L("Legg til", "Add")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-user" className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    New user
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{L("Opprett bruker", "Create user")}</DialogTitle>
                    <p className="text-xs text-muted-foreground">{L("Rollen bestemmer rettighetene — finjuster under Tilgang ved behov.", "The role sets the permissions — fine-tune under Access if needed.")}</p>
                  </DialogHeader>
                  <CreateUserForm onDone={() => setCreateOpen(false)} allGroups={apiGroups} defaultTeamId={effectiveTeamId} teams={teams} />
                </DialogContent>
              </Dialog>
            </div>

            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-1.5">
                {displayedUsers.map((u) => {
                  const userPerms = parsePermissions(u.permissions);
                  const activeAreas = PERMISSION_AREAS.filter((a) => userPerms[a] !== "none");
                  const totalActive = activeAreas.length;
                  const permSummary = totalActive === 0
                    ? "No permissions"
                    : `${totalActive} area${totalActive > 1 ? "s" : ""}`;
                  const permDetail = [
                    ...(activeAreas.length ? [activeAreas.map((a) => t(`nav.${a}`)).join(", ")] : []),
                  ].join(" · ");

                  return (
                    <div
                      key={u.id}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      data-testid={`row-user-${u.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-medium text-foreground">{u.name}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                          {u.username && <span className="text-xs text-muted-foreground/70">@{u.username}</span>}
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            u.isAdmin ? "bg-amber-50 text-amber-600" : u.isTeamAdmin ? "bg-purple-50 text-purple-600" : u.isAthleteAccess ? "bg-sky-50 text-sky-600" : "bg-muted text-muted-foreground"
                          )}>
                            {u.isAdmin ? "Super Admin" : u.isTeamAdmin ? L("Lagadmin", "Team Admin") : u.isAthleteAccess ? L("Utøvertilgang", "Athlete access") : L("Medlem", "Member")}
                          </span>
                          {u.createdAt && (
                            <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap" title={L("Opprettet", "Created")}>
                              {new Date(u.createdAt).toLocaleDateString("no-NO", { year: "numeric", month: "short", day: "numeric" })}
                            </span>
                          )}
                          {u.fromOtherTeam && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300" title={L("Har hjemmelag i et annet lag", "Primary team is elsewhere")}>
                              {L("Delt fra annet lag", "Shared from other team")}
                            </span>
                          )}
                          {!!u.isBlindTester && (
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-600">
                              <EyeOff className="inline h-2.5 w-2.5 mr-0.5" />Blind
                            </span>
                          )}
                          {!u.isActive && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">{L("Inaktiv", "Inactive")}</span>
                          )}
                          {!!u.loginLocked && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 flex items-center gap-0.5">
                              <LockKeyhole className="inline h-2.5 w-2.5" />Locked
                            </span>
                          )}
                          {!!u.garminWatch && (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600 flex items-center gap-0.5">
                              <Watch className="inline h-2.5 w-2.5" />Watch
                            </span>
                          )}
                          {!!u.canViewAllTeams && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 flex items-center gap-0.5 dark:bg-indigo-950/40 dark:text-indigo-300">
                              <Layers className="inline h-2.5 w-2.5" />{L("Alle lag", "All teams")}
                            </span>
                          )}
                          {adminTeamScope !== "current" && teams.length > 0 && (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600">
                              {teams.find((t) => t.id === u.teamId)?.name ?? `Team ${u.teamId}`}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground truncate" title={permDetail} data-testid={`text-perm-summary-${u.id}`}>
                          {permSummary}{totalActive > 0 && ` — ${permDetail}`}
                        </div>
                      </div>
                      <div className="flex items-center justify-end flex-shrink-0 border-t border-border/50 pt-2 sm:border-0 sm:pt-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              data-testid={`user-actions-${u.id}`}
                              title={L("Handlinger", "Actions")}
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="hidden sm:inline">{L("Valg", "Options")}</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{L("Funksjoner", "Features")}</DropdownMenuLabel>
                            {/* Toggle: active. Icon matches the row's status. */}
                            <DropdownMenuItem
                              disabled={u.fromOtherTeam}
                              onSelect={(e) => { e.preventDefault(); toggleActiveMutation.mutate({ userId: u.id, value: !u.isActive }); }}
                              data-testid={`toggle-active-${u.id}`}
                              className="gap-2"
                            >
                              {u.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-red-500" />}
                              <span className="flex-1">{L("Aktiv konto", "Active account")}</span>
                              <Switch checked={!!u.isActive} onCheckedChange={() => {}} className="pointer-events-none" />
                            </DropdownMenuItem>
                            {/* Toggle: watch */}
                            <DropdownMenuItem
                              disabled={u.fromOtherTeam}
                              onSelect={(e) => { e.preventDefault(); toggleWatchMutation.mutate({ userId: u.id, enabled: !u.garminWatch }); }}
                              data-testid={`toggle-watch-${u.id}`}
                              className="gap-2"
                            >
                              <Watch className="h-4 w-4 text-sky-500" />
                              <span className="flex-1">{L("Overvåkingskø", "Watch Queue")}</span>
                              <Switch checked={!!u.garminWatch} onCheckedChange={() => {}} className="pointer-events-none" />
                            </DropdownMenuItem>
                            {/* Toggle: all teams */}
                            <DropdownMenuItem
                              onSelect={(e) => { e.preventDefault(); toggleAllTeamsMutation.mutate({ userId: u.id, enabled: !u.canViewAllTeams }); }}
                              data-testid={`toggle-all-teams-${u.id}`}
                              className="gap-2"
                            >
                              <Layers className="h-4 w-4 text-indigo-500" />
                              <span className="flex-1">{L("Alle lag", "All teams")}</span>
                              <Switch checked={!!u.canViewAllTeams} onCheckedChange={() => {}} className="pointer-events-none" />
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{L("Handlinger", "Actions")}</DropdownMenuLabel>
                            {u.fromOtherTeam ? (
                              <>
                                <DropdownMenuItem className="gap-2" data-testid={`button-shared-perms-${u.id}`} onSelect={() => setSharedPermUser(u)}>
                                  <Settings2 className="h-4 w-4" />{L("Administrer tilgang her", "Manage access here")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2 text-rose-600 focus:text-rose-600"
                                  data-testid={`button-remove-from-team-${u.id}`}
                                  onSelect={() => { if (confirm(L("Fjerne denne brukerens tilgang til laget?", "Remove this user's access to the team?"))) removeFromTeamMutation.mutate(u.id); }}
                                >
                                  <UserX className="h-4 w-4" />{L("Fjern fra laget", "Remove from team")}
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem className="gap-2" data-testid={`button-edit-user-${u.id}`} onSelect={() => setEditUser(u)}>
                                <Pencil className="h-4 w-4" />{L("Rediger bruker", "Edit user")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="gap-2" disabled={u.fromOtherTeam} data-testid={`button-reset-user-${u.id}`} onSelect={() => setResetUser(u)}>
                              <KeyRound className="h-4 w-4" />{L("Tilbakestill passord", "Reset password")}
                            </DropdownMenuItem>
                            {!!u.loginLocked && (
                              <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-600" data-testid={`button-unlock-user-${u.id}`} onSelect={() => unlockMutation.mutate(u.id)}>
                                <LockKeyhole className="h-4 w-4" />{L("Lås opp konto", "Unlock account")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="gap-2 text-orange-600 focus:text-orange-600" disabled={u.fromOtherTeam} data-testid={`button-force-logout-${u.id}`} onSelect={() => { if (confirm(`Force logout ${u.name}?`)) forceLogoutMutation.mutate(u.id); }}>
                              <LogOut className="h-4 w-4" />{L("Tving utlogging", "Force logout")}
                            </DropdownMenuItem>
                            {canManage && (
                              <DropdownMenuItem className="gap-2" data-testid={`button-history-user-${u.id}`} onSelect={() => setHistoryUser(u)}>
                                <Activity className="h-4 w-4 text-violet-500" />{L("Vis historikk", "View history")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 text-red-600 focus:text-red-600"
                              disabled={u.id === user.id || u.fromOtherTeam}
                              data-testid={`button-delete-user-${u.id}`}
                              onSelect={() => { if (confirm(`Delete ${u.name}?`)) deleteMutation.mutate(u.id); }}
                            >
                              <Trash2 className="h-4 w-4" />{L("Slett bruker", "Delete user")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(undefined); }}>
              <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                {/* Identity header inside the form doubles as the visible title. */}
                <DialogHeader className="sr-only"><DialogTitle>{L("Rediger bruker", "Edit user")}</DialogTitle></DialogHeader>
                {editUser && <EditUserForm user={editUser} onDone={() => setEditUser(undefined)} allGroups={apiGroups} teams={teams} />}
              </DialogContent>
            </Dialog>

            {/* Per-team access for a user shared in from another team — the
                receiving team's admin is the first line for this. */}
            <Dialog open={!!sharedPermUser} onOpenChange={(v) => { if (!v) setSharedPermUser(undefined); }}>
              <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{L("Tilgang på dette laget", "Access on this team")}</DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {sharedPermUser?.name} · {L("styrer kun hva brukeren kan se og gjøre hos", "only controls what the user can see and do in")} {teams.find((tm) => tm.id === effectiveTeamId)?.name ?? L("dette laget", "this team")}
                  </p>
                </DialogHeader>
                {sharedPermUser && (() => {
                  const team = teams.find((tm) => tm.id === effectiveTeamId);
                  if (!team) return null;
                  return (
                    <TeamPermRow
                      userId={sharedPermUser.id}
                      team={team}
                      existingPerms={sharedPermUser.permissions ?? null}
                      existingGroupScope={sharedPermUser.groupScope ?? null}
                      existingIsTeamAdmin={!!sharedPermUser.isTeamAdmin}
                      allTeams={teams}
                      isExpanded
                      onToggle={() => {}}
                      onSaved={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/users${teamScopeParam}`] });
                        setSharedPermUser(undefined);
                      }}
                      onReset={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/users${teamScopeParam}`] });
                        setSharedPermUser(undefined);
                      }}
                    />
                  );
                })()}
              </DialogContent>
            </Dialog>

            <Dialog open={!!resetUser} onOpenChange={(v) => { if (!v) setResetUser(undefined); }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>{L("Tilbakestill passord for ", "Reset password for ")}{resetUser?.name}</DialogTitle></DialogHeader>
                {resetUser && <ResetPasswordForm user={resetUser} onDone={() => setResetUser(undefined)} />}
              </DialogContent>
            </Dialog>

            <UserHistoryDialog
              user={historyUser}
              open={historyUser != null}
              onClose={() => setHistoryUser(null)}
            />
          </div>
        )}

        {activeTab === "groups" && (
          <div className="flex flex-col gap-4" data-testid="tab-content-groups">
            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-admin-groups">
              <div className="text-sm font-semibold text-foreground mb-3">Groups ({apiGroups.length})</div>
              <div className="grid grid-cols-1 gap-2">
                {apiGroups.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5"
                    data-testid={`row-group-${g.id}`}
                  >
                    {editingGroup?.id === g.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          className="h-8 text-sm"
                          data-testid="input-edit-group-name"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editingGroupName.trim()) {
                              updateGroupMutation.mutate({ id: g.id, name: editingGroupName.trim() });
                            }
                            if (e.key === "Escape") setEditingGroup(null);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid="button-save-group"
                          disabled={!editingGroupName.trim() || updateGroupMutation.isPending}
                          onClick={() => updateGroupMutation.mutate({ id: g.id, name: editingGroupName.trim() })}
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingGroup(null)} data-testid="button-cancel-edit-group">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm text-foreground">{g.name}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-edit-group-${g.id}`}
                            onClick={() => { setEditingGroup(g); setEditingGroupName(g.name); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-delete-group-${g.id}`}
                            onClick={() => {
                              if (confirm(`Delete group "${g.name}"?`)) {
                                deleteGroupMutation.mutate(g.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={L("Nytt gruppenavn…", "New group name…")}
                  className="h-8 text-sm flex-1"
                  data-testid="input-new-group"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newGroupName.trim()) {
                      createGroupMutation.mutate({ name: newGroupName.trim(), teamId: newGroupTeamId ?? effectiveTeamId });
                    }
                  }}
                />
                {isSuperAdmin && teams.length > 1 && (
                  <Select
                    value={String(newGroupTeamId ?? effectiveTeamId)}
                    onValueChange={(v) => setNewGroupTeamId(parseInt(v))}
                  >
                    <SelectTrigger className="h-8 w-[140px] text-sm" data-testid="select-new-group-team">
                      <SelectValue placeholder={L("Lag", "Team")} />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  size="sm"
                  data-testid="button-add-group"
                  disabled={!newGroupName.trim() || createGroupMutation.isPending}
                  onClick={() => createGroupMutation.mutate({ name: newGroupName.trim(), teamId: newGroupTeamId ?? effectiveTeamId })}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "teams" && isSuperAdmin && (
          <div className="flex flex-col gap-4" data-testid="tab-content-teams">
            {/* Feature dialog for the selected team */}
            {configuringTeam && (
              <TeamFeaturesDialog
                team={configuringTeam}
                open={!!configuringTeam}
                onOpenChange={(o) => { if (!o) setConfiguringTeam(null); }}
                onSave={(id, name, features) =>
                  updateTeamMutation.mutate({ id, name, enabledAreas: features })
                }
                isPending={updateTeamMutation.isPending}
              />
            )}

            <Dialog open={!!limitsTeam} onOpenChange={(o) => { if (!o) setLimitsTeam(null); }}>
              <DialogContent className="sm:max-w-xs">
                <DialogHeader><DialogTitle>{L("Grenser: ", "Limits: ")}{limitsTeam?.name}</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  {[
                    { key: "maxUsers", label: t("admin.accountingMaxUsers") },
                    { key: "maxGroups", label: t("admin.accountingMaxGroups") },
                    { key: "maxTests", label: t("admin.accountingMaxTests") },
                    { key: "maxProducts", label: t("admin.accountingMaxProducts") },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-sm font-medium">{label}</label>
                      <Input type="number" value={limitsForm[key] ?? ""} onChange={(e) => setLimitsForm((f: any) => ({ ...f, [key]: e.target.value }))} placeholder={t("admin.accountingUnlimited")} />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">{t("admin.accountingLimitsNote")}</p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setLimitsTeam(null)}>{t("common.cancel")}</Button>
                    <Button onClick={() => { setPlanMutation.mutate({ id: limitsTeam!.id, maxUsers: limitsForm.maxUsers ? parseInt(limitsForm.maxUsers) : null, maxGroups: limitsForm.maxGroups ? parseInt(limitsForm.maxGroups) : null, maxTests: limitsForm.maxTests ? parseInt(limitsForm.maxTests) : null, maxProducts: limitsForm.maxProducts ? parseInt(limitsForm.maxProducts) : null }); setLimitsTeam(null); }} disabled={setPlanMutation.isPending}>{t("common.save")}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Plan dialog */}
            <Dialog open={!!editPlanTeam} onOpenChange={(o) => { if (!o) setEditPlanTeam(null); }}>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("admin.editPlanTitle")} — {editPlanTeam?.name}</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("admin.editPlanType")}</label>
                    <Select value={editPlanForm.planName} onValueChange={(v) => setEditPlanForm((f: any) => ({ ...f, planName: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["free","starter","team","pro","enterprise"].map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("admin.editPlanCustomPrice")}</label>
                    <Input type="number" value={editPlanForm.customPrice} onChange={(e) => setEditPlanForm((f: any) => ({ ...f, customPrice: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("admin.editPlanBillingPeriod")}</label>
                    <Select value={editPlanForm.billingPeriod} onValueChange={(v) => setEditPlanForm((f: any) => ({ ...f, billingPeriod: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">{t("admin.editPlanMonthly")}</SelectItem>
                        <SelectItem value="annual">{t("admin.editPlanAnnual")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t("admin.editPlanNextDate")}</label>
                    <Input type="date" value={editPlanForm.nextBillingDate} onChange={(e) => setEditPlanForm((f: any) => ({ ...f, nextBillingDate: e.target.value }))} />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <Button variant="outline" onClick={() => setEditPlanTeam(null)}>{t("common.cancel")}</Button>
                    <Button
                      disabled={setPlanMutation.isPending}
                      onClick={() => {
                        setPlanMutation.mutate({
                          id: editPlanTeam!.id,
                          planName: editPlanForm.planName,
                          customPrice: editPlanForm.customPrice !== "" ? parseFloat(editPlanForm.customPrice) : null,
                          billingPeriod: editPlanForm.billingPeriod,
                          nextBillingDate: editPlanForm.nextBillingDate || null,
                        } as any);
                        setEditPlanTeam(null);
                      }}
                    >{t("common.save")}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Notes dialog */}
            <Dialog open={!!notesTeam} onOpenChange={(o) => { if (!o) setNotesTeam(null); }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>{t("admin.teamNotesTitle")} — {notesTeam?.name}</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <textarea
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    rows={5}
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder={t("admin.teamNotesPlaceholder")}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setNotesTeam(null)}>{t("common.cancel")}</Button>
                    <Button onClick={() => saveNotesMutation.mutate({ id: notesTeam!.id, notes: notesValue })} disabled={saveNotesMutation.isPending}>{t("common.save")}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Plan history dialog */}
            <Dialog open={!!historyTeam} onOpenChange={(o) => { if (!o) setHistoryTeam(null); }}>
              <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{t("admin.planHistoryTitle")} — {historyTeam?.name}</DialogTitle></DialogHeader>
                {historyTeam && <PlanHistoryContent teamId={historyTeam.id} />}
              </DialogContent>
            </Dialog>

            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-admin-teams">
              <div className="text-sm font-semibold text-foreground mb-3">Teams ({teams.length})</div>
              <div className="grid grid-cols-1 gap-2">
                {teams.map((team) => {
                  const planKey = detectPlanKey(team.enabledAreas);
                  const planPreset = planKey && planKey !== "custom" ? PLAN_FEATURE_PRESETS[planKey] : null;
                  const planStyle = planPreset ? PLAN_STYLE[planPreset.color] : null;
                  const featureCount = (() => {
                    try { const a = JSON.parse(team.enabledAreas || "null"); return Array.isArray(a) ? a.length : null; }
                    catch { return null; }
                  })();

                  return (
                    <div
                      key={team.id}
                      className={cn(
                        "flex flex-col gap-1 rounded-xl border px-3 py-2.5",
                        team.isPaused ? "border-red-300 bg-red-50/60 dark:bg-red-900/10 dark:border-red-800" : "border-border bg-muted/30"
                      )}
                      data-testid={`row-team-${team.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{team.name}</span>
                          {team.isDefault === 1 && (
                            <span className="rounded-full bg-green-50 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-300">{L("Standard", "Default")}</span>
                          )}
                          {!!team.isPaused && (
                            <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{L("Suspendert", "Suspended")}</span>
                          )}
                          {planPreset && planStyle && (
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", planStyle.badge)}>
                              {planPreset.label}
                            </span>
                          )}
                          {planKey === "custom" && (
                            <span className="rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium">
                              Custom
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {users.filter((u) => u.teamId === team.id).length} users
                          {featureCount !== null && <> · {featureCount} features enabled</>}
                          {!!team.isPaused && <> · <span className="text-red-500 font-medium">{L("Ingen medlemmer kan logge inn", "All members cannot log in")}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {team.isDefault !== 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-set-default-team-${team.id}`}
                            onClick={() => setDefaultTeamMutation.mutate(team.id)}
                            disabled={setDefaultTeamMutation.isPending}
                            title={L("Sett som standard", "Set as default")}
                          >
                            <Shield className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-pause-team-${team.id}`}
                          title={team.isPaused ? L("Opphev lagpause", "Unpause team") : L("Sett laget på pause — medlemmer kan ikke logge inn", "Pause team — members cannot log in")}
                          disabled={pauseTeamMutation.isPending}
                          onClick={() => {
                            const willPause = !team.isPaused;
                            if (willPause && !confirm(`Pause "${team.name}"? All team members will be unable to log in while paused.`)) return;
                            pauseTeamMutation.mutate({ id: team.id, paused: willPause });
                          }}
                          className={cn(team.isPaused ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-muted-foreground hover:text-amber-600 hover:bg-amber-50")}
                        >
                          {team.isPaused ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-configure-team-${team.id}`}
                          title={L("Konfigurer funksjoner", "Configure features")}
                          onClick={() => setConfiguringTeam(team)}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title={L("Sett grenser", "Set limits")} onClick={() => { setLimitsTeam(team); setLimitsForm({ maxUsers: team.maxUsers ?? team.max_users ?? "", maxGroups: team.maxGroups ?? team.max_groups ?? "", maxTests: team.maxTests ?? team.max_tests ?? "", maxProducts: team.maxProducts ?? team.max_products ?? "" }); }}>
                          <Hash className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" title={L("Rediger plan / fakturering", "Edit plan / billing")} onClick={() => { setEditPlanTeam(team); setEditPlanForm({ planName: team.planName ?? (team as any).plan_name ?? "free", customPrice: team.customPrice ?? (team as any).custom_price ?? "", billingPeriod: team.billingPeriod ?? (team as any).billing_period ?? "monthly", nextBillingDate: team.nextBillingDate ?? (team as any).next_billing_date ?? "" }); }}>
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" title={L("Planhistorikk", "Plan history")} onClick={() => setHistoryTeam(team)}>
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" title={L("Rediger notater", "Edit notes")} onClick={() => { setNotesTeam(team); setNotesValue(team.notes ?? ""); }}>
                          <MessageSquare className={cn("h-4 w-4", team.notes ? "text-blue-500" : "text-muted-foreground")} />
                        </Button>
                        {team.isDefault !== 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-delete-team-${team.id}`}
                            onClick={() => {
                              if (confirm(`Delete team "${team.name}"? All data belonging to this team will be orphaned.`)) {
                                deleteTeamMutation.mutate(team.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      </div>
                      {team.notes && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-full px-0.5">{team.notes}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* New team form */}
              <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">{L("Nytt lag", "New team")}</div>
                {/* Plan preset buttons for new team */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">{L("Abonnementsplan", "Subscription plan")}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {Object.entries(PLAN_FEATURE_PRESETS).map(([key, preset]) => {
                      const isActive = (() => {
                        const pf = [...preset.features].sort();
                        const tf = [...newTeamAreas].sort();
                        return pf.length === tf.length && pf.every((f, i) => f === tf[i]);
                      })();
                      const s = PLAN_STYLE[preset.color];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewTeamAreas([...preset.features])}
                          className={cn(
                            "rounded-lg border px-2 py-2 text-xs font-semibold transition-all text-center",
                            isActive ? cn(s.active, "ring-2 ring-offset-1") : s.inactive
                          )}
                        >
                          <div>{preset.label}</div>
                          <div className="text-[10px] font-normal opacity-60 mt-0.5">{preset.features.length} {L("funksjoner", "features")}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder={L("Lagnavn…", "Team name…")}
                    className="h-9 text-sm flex-1"
                    data-testid="input-new-team"
                    onKeyDown={(e) => { if (e.key === "Enter" && newTeamName.trim()) createTeamMutation.mutate({ name: newTeamName.trim(), enabledAreas: newTeamAreas }); }}
                  />
                  <Button
                    size="sm"
                    className="h-9 shrink-0"
                    data-testid="button-add-team"
                    disabled={!newTeamName.trim() || createTeamMutation.isPending}
                    onClick={() => createTeamMutation.mutate({ name: newTeamName.trim(), enabledAreas: newTeamAreas })}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {createTeamMutation.isPending ? L("Oppretter…", "Creating…") : L("Opprett lag", "Create team")}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "security" && isSuperAdmin && (
          <SecurityTab teams={teams} currentUserId={user?.id ?? 0} />
        )}

        {activeTab === "backup" && (
          <div className="flex flex-col gap-4" data-testid="tab-content-backup">
            <BackupStatusCard />
            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-feedback-button">
              <div className="flex items-center gap-2 mb-1">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                  <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Feedback</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">{L("Slå på en Feedback-knapp over søkefeltet som åpner et Google-ark for laget.", "Enable a Feedback button above the search bar that opens a Google sheet for the team.")}</p>
              <div className="space-y-4">
                {(isSuperAdmin ? teams : teams.filter((t) => t.id === user?.teamId)).map((team) => (
                  <FeedbackButtonConfig key={`feedback-${team.id}`} team={team} />
                ))}
              </div>
            </Card>
            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-backup">
              <div className="flex items-center gap-2 mb-1">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                  <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">{L("Google Sheets-sikkerhetskopi", "Google Sheets Backup")}</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">{L("Lim inn en Google Sheets-URL for å sikkerhetskopiere alle data. Sikkerhetskopier kjøres automatisk hvert 30. minutt og kan også startes manuelt.", "Paste a Google Sheets URL to back up all data. Backups run automatically every 30 minutes and can also be triggered manually.")}</p>
              <div className="space-y-4">
                {(isSuperAdmin ? teams : teams.filter((t) => t.id === user?.teamId)).map((team) => {
                  const inputVal = backupSheetInputs[team.id] ?? team.backupSheetUrl ?? '';
                  const hasChanged = inputVal !== (team.backupSheetUrl ?? '');
                  return (
                    <div key={`backup-${team.id}`} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                      {isSuperAdmin && <div className="text-xs font-semibold text-foreground/80">{team.name}</div>}
                      <div className="flex items-center gap-2">
                        <Input
                          value={inputVal}
                          onChange={(e) => setBackupSheetInputs(prev => ({ ...prev, [team.id]: e.target.value }))}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="h-8 text-xs flex-1"
                          data-testid={`input-backup-sheet-${team.id}`}
                        />
                        <Button
                          size="sm"
                          variant={hasChanged ? "default" : "outline"}
                          data-testid={`button-save-backup-sheet-${team.id}`}
                          disabled={!hasChanged || saveBackupSheetMutation.isPending}
                          onClick={() => {
                            saveBackupSheetMutation.mutate({ id: team.id, url: inputVal });
                            setBackupSheetInputs(prev => { const n = { ...prev }; delete n[team.id]; return n; });
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-run-backup-${team.id}`}
                          disabled={!team.backupSheetUrl || runBackupMutation.isPending}
                          onClick={() => runBackupMutation.mutate(team.id)}
                        >
                          {runBackupMutation.isPending ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1 text-xs">{L("Sikkerhetskopi", "Backup")}</span>
                        </Button>
                      </div>
                      {/* Visible backup verification: ✓ on success, ⚠ + reason on failure. */}
                      {(() => {
                        const errAt = team.lastBackupErrorAt ? new Date(team.lastBackupErrorAt).getTime() : 0;
                        const okAt = team.lastBackupAt ? new Date(team.lastBackupAt).getTime() : 0;
                        const failing = !!team.lastBackupError && errAt >= okAt;
                        if (failing) {
                          return (
                            <div className="rounded-md bg-red-50 dark:bg-red-950/30 px-2 py-1 text-[10px] text-red-700 dark:text-red-300" data-testid={`backup-status-${team.id}`}>
                              ⚠ {L("Siste backup FEILET", "Last backup FAILED")} {team.lastBackupErrorAt ? new Date(team.lastBackupErrorAt).toLocaleString() : ""} — {team.lastBackupError}
                              {okAt > 0 && <span className="block text-red-600/70 dark:text-red-400/70">{L("Siste vellykkede:", "Last successful:")} {new Date(team.lastBackupAt!).toLocaleString()}</span>}
                            </div>
                          );
                        }
                        if (okAt > 0) {
                          return (
                            <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-[10px] text-emerald-700 dark:text-emerald-300" data-testid={`backup-status-${team.id}`}>
                              ✓ {L("Siste vellykkede backup:", "Last successful backup:")} {new Date(team.lastBackupAt!).toLocaleString()}
                            </div>
                          );
                        }
                        if (team.backupSheetUrl || (team as any).driveFolderId) {
                          return (
                            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300" data-testid={`backup-status-${team.id}`}>
                              {L("Konfigurert — ingen backup fullført ennå", "Configured — no backup completed yet")}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ── Google Drive backup ── */}
            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                  <HardDrive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">{L("Google Drive-sikkerhetskopi", "Google Drive Backup")}</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Connect a Google Shared Drive folder — Glidr uploads a complete JSON + PDF backup for the team automatically every day at 23:59, plus on demand.
                The same files as the Export Tools buttons (PDF + JSON) are saved automatically.
              </p>

              {/* ── Shared Drive auto-upload (Google Workspace only) ── */}
              {teams.some(t => !(t as any).driveFolderId) && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-3 mb-3 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold">{L("⚠ Automatisk Drive-opplasting krever en delt disk (Google Workspace)", "⚠ Automatic Drive upload requires a Shared Drive (Google Workspace)")}</p>
                <p>{L("Google-tjenestekontoer kan ikke lagre filer i en personlig My Drive. For å bruke automatisk opplasting trenger du en ", "Google service accounts cannot store files in a personal My Drive. To use automatic upload you need a ")}<strong>{L("Delt disk", "Shared Drive")}</strong>{L(" (tilgjengelig på Google Workspace / G Suite):", " (available on Google Workspace / G Suite):")}</p>
                <ol className="list-decimal pl-4 space-y-1 mt-1">
                  <li>{L("Opprett en", "In Google Drive, create a")} <strong>{L("Delt disk", "Shared Drive")}</strong>{L(" i Google Drive (ikke en vanlig mappe).", " (not a regular folder).")}</li>
                  <li>{L("Klikk", "Click")} <strong>{L("Administrer medlemmer", "Manage members")}</strong>{L(" → legg til tjenestekontoens e-post (vist i det grønne kortet over) som ", " → add the service account email (shown in the green card above) as ")}<strong>{L("Bidragsyter", "Contributor")}</strong>.</li>
                  <li>{L("Kopier URL-en til den delte disken og lim den inn nedenfor.", "Copy the Shared Drive URL and paste it below.")}</li>
                </ol>
              </div>
              )}
              <div className="space-y-3">
                {teams.map((team) => {
                  const driveInputVal = driveFolderInputs[team.id] ?? (team as any).driveFolderId ?? '';
                  const driveHasChanged = driveInputVal !== ((team as any).driveFolderId ?? '');
                  const hasDriveFolder = !!(team as any).driveFolderId;
                  return (
                    <div key={`drive-${team.id}`} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                      <div className="text-xs font-medium text-foreground">{team.name} — Shared Drive URL</div>
                      <div className="flex gap-2 items-center">
                        <input
                          className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-mono"
                          placeholder="https://drive.google.com/drive/folders/… (Shared Drive only)"
                          value={driveInputVal}
                          onChange={(e) => setDriveFolderInputs(prev => ({ ...prev, [team.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          disabled={!driveHasChanged || saveDriveFolderMutation.isPending}
                          onClick={() => {
                            saveDriveFolderMutation.mutate({ id: team.id, url: driveInputVal });
                            setDriveFolderInputs(prev => { const n = { ...prev }; delete n[team.id]; return n; });
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!hasDriveFolder || runDriveBackupMutation.isPending}
                          onClick={() => runDriveBackupMutation.mutate(team.id)}
                        >
                          {runDriveBackupMutation.isPending ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1 text-xs">{L("Last opp nå", "Upload now")}</span>
                        </Button>
                        {hasDriveFolder && (
                          <a
                            href={`https://drive.google.com/drive/folders/${(team as any).driveFolderId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                          >
                            Open ↗
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="flex flex-col gap-4" data-testid="tab-content-activity">
            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-activity-log">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50">
                  <Activity className="h-4 w-4 text-teal-600" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">{L("Aktivitetslogg", "Activity Log")} ({filteredActivities.length})</h2>
                <div className="ml-auto">
                  <Select value={activityActionFilter} onValueChange={setActivityActionFilter}>
                    <SelectTrigger className="h-8 w-[200px] text-xs" data-testid="select-activity-action">
                      <SelectValue placeholder={L("Alle handlinger", "All actions")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{L("Alle handlinger", "All actions")}</SelectItem>
                      <SelectItem value="__deletions__">{L("Papirkurv (slettinger — kan gjenopprettes)", "Recycle bin (deletions — restorable)")}</SelectItem>
                      {activityActions.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {filteredActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="empty-activity-log">{L("Ingen aktivitet registrert ennå.", "No activity recorded yet.")}</p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-3">{L("Tid", "Time")}</th>
                        <th className="pb-2 pr-3">{L("Bruker", "User")}</th>
                        <th className="pb-2 pr-3">{L("Handling", "Action")}</th>
                        <th className="pb-2 pr-3">{L("Type", "Type")}</th>
                        <th className="pb-2 pr-3">{L("Detaljer", "Details")}</th>
                        <th className="pb-2">{L("Gruppe", "Group")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivities.slice(0, 1000).map((a) => {
                        const isDelete = a.action === "deleted";
                        const isSaAccess = a.action === "sa_access";
                        const hasSnap = !!a.snapshot;
                        const open = expandedActivity === a.id;
                        let pretty = "";
                        if (hasSnap) { try { pretty = JSON.stringify(JSON.parse(a.snapshot as string), null, 2); } catch { pretty = a.snapshot as string; } }
                        return (
                        <React.Fragment key={a.id}>
                        <tr className={cn("border-b border-border", isDelete && "bg-red-50/40 dark:bg-red-950/10", isSaAccess && "bg-indigo-50/40 dark:bg-indigo-950/10", hasSnap && "cursor-pointer")} data-testid={`row-activitylog-${a.id}`} onClick={hasSnap ? () => setExpandedActivity(open ? null : a.id) : undefined}>
                          <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                          <td className="py-2 pr-3 font-medium text-foreground">{a.userName}</td>
                          <td className="py-2 pr-3">
                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1", isDelete ? "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300" : isSaAccess ? "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300" : "bg-green-50 text-green-700 ring-green-200")}>{isSaAccess ? "support access" : a.action}</span>
                          </td>
                          <td className="py-2 pr-3">
                            {a.entityType && (
                              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">{a.entityType}</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[220px] truncate">
                            {hasSnap && <span className="mr-1 text-muted-foreground">{open ? "▾" : "▸"}</span>}
                            {a.details || "—"}
                            {hasSnap && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{L("øyeblikksbilde", "snapshot")}</span>}
                          </td>
                          <td className="py-2">
                            {a.groupScope ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">{a.groupScope}</span>
                            ) : "—"}
                          </td>
                        </tr>
                        {open && hasSnap && (
                          <tr className="border-b border-border bg-muted/20" data-testid={`snapshot-activitylog-${a.id}`}>
                            <td colSpan={6} className="px-3 py-2">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{L("Slettet data (øyeblikksbilde)", "Deleted data (snapshot)")}</div>
                                {isDelete && ["test", "athlete", "race_ski", "product", "weather"].includes(a.entityType) && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs"
                                    disabled={restoreMutation.isPending}
                                    onClick={(e) => { e.stopPropagation(); if (confirm(L("Gjenopprette denne slettede oppføringen?", "Restore this deleted record?"))) restoreMutation.mutate(a.id); }}
                                    data-testid={`button-restore-${a.id}`}>
                                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />{L("Gjenopprett", "Restore")}
                                  </Button>
                                )}
                              </div>
                              <pre className="max-h-80 overflow-auto rounded-lg bg-background/60 p-3 text-[11px] leading-relaxed text-foreground/90 ring-1 ring-border">{pretty}</pre>
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
          </div>
        )}

        {activeTab === "logins" && (
          <div className="flex flex-col gap-4" data-testid="tab-content-logins">
            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-admin-login-history">
              <div className="flex items-center gap-2 mb-3">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
                  <Clock className="h-4 w-4 text-indigo-600" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">{L("Innloggingshistorikk", "Login History")} ({loginLogs.length})</h2>
              </div>
              {loginLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{L("Ingen innlogginger registrert ennå.", "No login records yet.")}</p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-3">{L("Navn", "Name")}</th>
                        <th className="pb-2 pr-3">{L("E-post", "Email")}</th>
                        <th className="pb-2 pr-3">{L("Handling", "Action")}</th>
                        <th className="pb-2 pr-3">{L("Enhet", "Device")}</th>
                        {isSuperAdmin && <th className="pb-2 pr-3">{L("Enhets-ID", "Device ID")}</th>}
                        <th className="pb-2">{L("Tid", "Time")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginLogs.slice(0, 200).map((log) => {
                        return (
                        <tr key={log.id} className="border-b border-border" data-testid={`row-login-${log.id}`}>
                          <td className="py-2 pr-3 font-medium text-foreground">{log.name}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{log.email}</td>
                          <td className="py-2 pr-3">
                            {log.action === "login" ? (
                              <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">{L("Innlogging", "Login")}</span>
                            ) : log.action === "pdf_download" ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                                PDF {log.details ? `— ${log.details}` : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">{log.action}</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">{log.userAgent ? shortDevice(log.userAgent) : "—"}</td>
                          {isSuperAdmin && <td className="py-2 pr-3 font-mono text-[10px] text-muted-foreground" title={log.deviceId ?? undefined}>{log.deviceId ? log.deviceId.slice(0, 8) : "—"}</td>}
                          <td className="py-2 text-muted-foreground">
                            {new Date(log.loginAt).toLocaleString()}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Active sessions live-view — directly under the login history (SA only). */}
            {isSuperAdmin && <ActiveSessionsCard currentUserId={user?.id ?? 0} loginLogs={loginLogs} />}
          </div>
        )}

        {activeTab === "data" && <DataManagementTab teamScopeParam={teamScopeParam} downloadFullPdf={downloadFullPdf} pdfLoading={pdfLoading} isSuperAdmin={isSuperAdmin} teams={teams} />}

        {activeTab === "watch" && <WatchAppTab isSuperAdmin={isSuperAdmin} teams={teams} />}

        {activeTab === "guide" && (
          <div className="space-y-6">
            <Card className="fs-card rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-violet-100 dark:bg-violet-900/30 p-3">
                  <FileText className="h-6 w-6 text-violet-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-1">{L("Glidr funksjonsguide", "Glidr Feature Guide")}</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    A complete, confidential reference document covering all platform features, role requirements, and the permission system. Updated automatically as new features are added.
                  </p>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 mb-4">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>{L("Konfidensielt:", "Confidential:")}</strong> This document contains proprietary feature descriptions and internal workflows. Do not distribute to third parties or use as a reference for competing software development.
                    </p>
                  </div>
                  <Button
                    onClick={() => generateFeatureGuidePDF()}
                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </Card>

            {/* Strategy document (owner / SA only) */}
            <Card className="fs-card rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/30 p-3">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-1">{L("Glidr strategidokument", "Glidr Strategy Document")}</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    {L("Komplett eierdokument: strategi, system, utvikling, kommersialisering, priser, rettigheter, exit og risiko — grunnlaget for en trygg og bærekraftig fremtid for Glidr.", "Complete owner document: strategy, system, development, commercialization, pricing, rights, exit and risk — the foundation for a safe and sustainable future for Glidr.")}
                  </p>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 mb-4">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>{L("Strengt konfidensielt:", "Strictly confidential:")}</strong> {L("Kun for eier. Del ikke med lag, forbund eller tredjeparter. Prisspenn er veiledende — ikke finansielle råd.", "Owner only. Do not share with teams, federations or third parties. Pricing ranges are indicative — not financial advice.")}
                    </p>
                  </div>
                  <Button
                    onClick={() => generateStrategyPDF()}
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
                    data-testid="button-strategy-pdf"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </Card>

            {/* Letter of Intent draft (owner / SA only) */}
            <Card className="fs-card rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/30 p-3">
                  <FileText className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-1">{L("Intensjonsavtale (utkast)", "Letter of Intent (draft)")}</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    {L("Utkast til pilotavtale mot US Ski Team: full tilgang i vinter mot tilbakemeldinger, betaling fra neste sesong (bak betalingsmur), og full dataeksport hvis de ikke fortsetter.", "Draft pilot agreement for the U.S. Ski Team: full access this winter in exchange for feedback, paid from next season (behind a paywall), and full data export if they don't continue.")}
                  </p>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 mb-4">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>{L("Utkast — ikke juridisk råd:", "Draft — not legal advice:")}</strong> {L("Må kvalitetssikres av advokat før bruk. Felter i [klammer] fylles ut.", "Must be reviewed by legal counsel before use. Complete the [bracketed] fields.")}
                    </p>
                  </div>
                  <Button
                    onClick={() => generateLetterOfIntentPDF()}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                    data-testid="button-loi-pdf"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="fs-card rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-amber-100 dark:bg-amber-900/30 p-3">
                  <FileText className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-1">{L("Glidr kundepresentasjon", "Glidr Customer Presentation")}</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    The full interactive HTML pitch deck. Switch between Norwegian and English with the language toggle. Includes feature overview, workflow, security, pricing and CTA slides. Opens in a new tab.
                  </p>
                  <a
                    href="/api/admin/presentation"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Åpne presentasjon / Open presentation
                    </Button>
                  </a>
                </div>
              </div>
            </Card>

            <Card className="fs-card rounded-2xl p-6">
              <h3 className="font-semibold mb-3">{L("Dokumentinnhold", "Document Contents")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                {[
                  "Introduction & Role Overview",
                  "Tests (all types, AI entry, blind testing)",
                  "Products & Combination Search",
                  "Weather & Conditions (15 fields)",
                  "Analytics & Compare",
                  "Race Preparations",
                  "Athletes & Race Skis",
                  "Grinding & Grind Profiles",
                  "Garmin Watch Integration",
                  "Offline Mode",
                  "My Account",
                  "★ Team Admin Features",
                  "Permission System",
                  "Competitive Reservation & Legal",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="fs-card rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/30 p-3">
                  <FileText className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-1">{L("Glidr salgsbrosjyre", "Glidr Sales Brochure")}</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    A professional 7-page sales PDF presenting Glidr's value proposition, key features, analytics capabilities, and the development platform narrative. Use this when introducing Glidr to potential customers or new team members. Available in Norwegian and English.
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      onClick={() => generateSalesPDF("no")}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Last ned salgsbrosjyre (NO)
                    </Button>
                    <Button
                      onClick={() => generateSalesPDF("en")}
                      variant="outline"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download sales brochure (EN)
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "danger" && <DangerZoneTab />}

        {activeTab === "registrations" && (
          <RegistrationsTab />
        )}

        {activeTab === "accounting" && isSuperAdmin && (
          <div className="flex flex-col gap-5">
            <AccountingTab teams={teams} />
          </div>
        )}
        </div>
        </div>
      </div>
    </AppShell>
  );
}

type WatchAppMeta = { file: { id: number; filename: string; version: string | null; notes: string | null; uploadedAt: string; uploadedByName: string | null } | null; canDownload: boolean };
type WatchAppDownload = { id: number; teamId: number | null; teamName: string | null; userId: number | null; userName: string | null; downloadedAt: string };

// #19–21: SA uploads the sideloadable watch-app file; Team Admins granted the
// "download watch-app" permission download it here to load onto athletes'
// watches via cable. Every download is logged for the SA overview.
function WatchAppTab({ isSuperAdmin, teams }: { isSuperAdmin: boolean; teams: ApiTeam[] }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");

  const { data: meta } = useQuery<WatchAppMeta>({ queryKey: ["/api/watch-app/meta"] });
  const { data: downloads = [] } = useQuery<WatchAppDownload[]>({
    queryKey: ["/api/watch-app/downloads"],
    enabled: isSuperAdmin,
  });

  const uploadMutation = useMutation({
    mutationFn: async (payload: { filename: string; mimeType: string; data: string; version: string; notes: string }) => {
      const res = await apiRequest("POST", "/api/watch-app", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watch-app/meta"] });
      toast({ title: L("Klokkeapp lastet opp", "Watch app uploaded") });
      setVersion(""); setNotes("");
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: Error) => toast({ title: L("Opplasting mislyktes", "Upload failed"), description: e.message, variant: "destructive" }),
  });

  const permMutation = useMutation({
    mutationFn: async (v: { id: number; enabled: boolean }) => {
      const res = await apiRequest("PUT", `/api/teams/${v.id}/watch-app-permission`, { enabled: v.enabled });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/teams"] }),
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 3.5 * 1024 * 1024) { toast({ title: L("Filen er for stor (maks 3,5 MB)", "File too large (max 3.5 MB)"), variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => uploadMutation.mutate({ filename: file.name, mimeType: file.type || "application/octet-stream", data: String(reader.result), version, notes });
    reader.onerror = () => toast({ title: L("Kunne ikke lese filen", "Could not read file"), variant: "destructive" });
    reader.readAsDataURL(file);
  };

  const howTo = (
    <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-2">{L("Slik installerer du klokkeappen", "How to install the watch app")}</h3>
      <ol className="list-decimal pl-5 space-y-1.5 text-xs text-muted-foreground">
        <li>{L("Last ned klokkeapp-filen med knappen over.", "Download the watch-app file with the button above.")}</li>
        <li>{L("Koble klokken til datamaskinen med USB-kabel. Klokken vises som en disk (Garmin).", "Connect the watch to the computer with a USB cable. It shows up as a drive (Garmin).")}</li>
        <li>{L("Kopier filen inn i mappen GARMIN/APPS på klokken.", "Copy the file into the GARMIN/APPS folder on the watch.")}</li>
        <li>{L("Koble fra klokken trygt og start den på nytt om nødvendig.", "Safely eject the watch and restart it if needed.")}</li>
        <li>{L("Åpne Glidr-appen på klokken og skriv inn lagets Watch-PIN (se Watch-køen).", "Open the Glidr app on the watch and enter the team's Watch PIN (see the Watch queue).")}</li>
      </ol>
    </Card>
  );

  const canDownload = !!meta?.canDownload;

  return (
    <div className="flex flex-col gap-4" data-testid="tab-content-watch">
      {/* Current file + download */}
      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Watch className="h-4 w-4 text-sky-500" />
          <span className="font-semibold text-foreground">{L("Klokkeapp", "Watch app")}</span>
        </div>
        {meta?.file ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium text-foreground">{meta.file.filename}{meta.file.version ? ` · v${meta.file.version}` : ""}</div>
              <div className="text-xs text-muted-foreground">
                {L("Lastet opp", "Uploaded")} {new Date(meta.file.uploadedAt).toLocaleString()}{meta.file.uploadedByName ? ` · ${meta.file.uploadedByName}` : ""}
              </div>
              {meta.file.notes && <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{meta.file.notes}</div>}
            </div>
            {canDownload ? (
              <a href="/api/watch-app/download" data-testid="link-download-watch-app">
                <Button size="sm"><Download className="h-4 w-4 mr-1.5" />{L("Last ned klokkeapp", "Download watch app")}</Button>
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">{L("Be Super Admin om nedlastingstilgang.", "Ask the Super Admin for download access.")}</span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{L("Ingen klokkeapp er lastet opp ennå.", "No watch app has been uploaded yet.")}</p>
        )}
      </Card>

      {(meta?.file || canDownload) && howTo}

      {/* SA-only: upload + per-team permission + download overview */}
      {isSuperAdmin && (
        <>
          <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-3">{L("Last opp ny klokkeapp-fil", "Upload a new watch-app file")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{L("Versjon (valgfritt)", "Version (optional)")}</label>
                <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.3" className="h-8 text-xs" data-testid="input-watch-app-version" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{L("Notat (valgfritt)", "Notes (optional)")}</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={L("Hva er nytt", "What's new")} className="h-8 text-xs" data-testid="input-watch-app-notes" />
              </div>
            </div>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} data-testid="input-watch-app-file" />
            <Button size="sm" variant="outline" disabled={uploadMutation.isPending} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1.5" />{uploadMutation.isPending ? L("Laster opp…", "Uploading…") : L("Velg fil og last opp", "Choose file & upload")}
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">{L("Erstatter gjeldende fil. Maks 3,5 MB.", "Replaces the current file. Max 3.5 MB.")}</p>
          </Card>

          <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-1">{L("Nedlastingstilgang per lag", "Download access per team")}</h3>
            <p className="text-xs text-muted-foreground mb-3">{L("Lagadmins i lag med tilgang kan laste ned klokkeapp-filen.", "Team admins in teams with access can download the watch-app file.")}</p>
            <div className="flex flex-col gap-1.5">
              {teams.map((team) => {
                const enabled = (team as any).watchAppDownload === 1;
                return (
                  <div key={team.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                    <span className="text-sm">{team.name}</span>
                    <button
                      type="button"
                      onClick={() => permMutation.mutate({ id: team.id, enabled: !enabled })}
                      disabled={permMutation.isPending}
                      className={cn("relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors", enabled ? "bg-sky-500" : "bg-muted-foreground/25")}
                      data-testid={`toggle-watch-app-perm-${team.id}`}
                    >
                      <span className={cn("pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", enabled ? "translate-x-[18px]" : "translate-x-[2px]")} />
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-3">{L("Nedlastinger (oversikt)", "Downloads (overview)")} ({downloads.length})</h3>
            {downloads.length === 0 ? (
              <p className="text-sm text-muted-foreground">{L("Ingen nedlastinger ennå.", "No downloads yet.")}</p>
            ) : (
              <div className="max-h-[360px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-3">{L("Bruker", "User")}</th>
                      <th className="pb-2 pr-3">{L("Lag", "Team")}</th>
                      <th className="pb-2">{L("Tid", "Time")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downloads.map((d) => (
                      <tr key={d.id} className="border-b border-border">
                        <td className="py-2 pr-3 font-medium text-foreground">{d.userName ?? "—"}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{d.teamName ?? "—"}</td>
                        <td className="py-2 text-muted-foreground">{new Date(d.downloadedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function DataManagementTab({ teamScopeParam, downloadFullPdf, pdfLoading, isSuperAdmin, teams }: { teamScopeParam: string; downloadFullPdf: (scope?: string) => void; pdfLoading: boolean; isSuperAdmin: boolean; teams: ApiTeam[] }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const { data: dbStats } = useQuery<any>({ queryKey: [`/api/admin/db-stats${teamScopeParam}`] });

  const [exportTeamId, setExportTeamId] = useState<number | "all">("all");
  const exportTeamScopeParam = isSuperAdmin
    ? exportTeamId === "all"
      ? "?teamScope=all"
      : `?teamScope=${exportTeamId}`
    : "";

  const removeDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/products/remove-duplicates");
      return res.json();
    },
    onSuccess: (data: { removed: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: data.removed > 0 ? `Removed ${data.removed} duplicate${data.removed !== 1 ? "s" : ""}` : "No duplicates found" });
    },
    onError: (e: Error) => {
      toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" });
    },
  });

  const [xlsLoading, setXlsLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSelections, setImportSelections] = useState({
    series: true,
    products: true,
    tests: true,
    weather: true,
  });

  const importOptions = [
    { key: "series" as const, label: "Test Series" },
    { key: "products" as const, label: "Products" },
    { key: "tests" as const, label: "Tests & Results" },
    { key: "weather" as const, label: "Weather Logs" },
  ];

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const data = {
        series: importSelections.series ? raw.series : [],
        products: importSelections.products ? raw.products : [],
        tests: importSelections.tests ? raw.tests : [],
        entriesByTest: importSelections.tests ? raw.entriesByTest : {},
        weather: importSelections.weather ? raw.weather : [],
      };
      const res = await apiRequest("POST", "/api/admin/import", data);
      const result = await res.json();
      const parts = [];
      if (importSelections.series) parts.push(`${result.imported.series} series`);
      if (importSelections.products) parts.push(`${result.imported.products} products`);
      if (importSelections.tests) parts.push(`${result.imported.tests} tests`);
      if (importSelections.weather) parts.push(`${result.imported.weather} weather logs`);
      toast({
        title: L("Import fullført", "Import complete"),
        description: `Imported: ${parts.join(", ")}. Skipped: ${result.imported.skipped} duplicates.`,
      });
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({ title: L("Import mislyktes", "Import failed"), description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  async function downloadXlsExport() {
    setXlsLoading(true);
    try {
      const exportRes = await apiRequest("GET", `/api/admin/full-export${exportTeamScopeParam}`);
      const rawText = await exportRes.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr: any) {
        throw new Error(`Response parse failed: ${parseErr.message}`);
      }

      const wb = XLSX.utils.book_new();

      const testsRows = data.tests.map((t: any) => {
        const series = data.series.find((s: any) => s.id === t.seriesId);
        return { ID: t.id, Date: t.date, Type: t.testType, Location: t.location || "", Series: series?.name || "", Group: t.groupScope, Notes: t.notes || "", Source: t.testSkiSource || "series" };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(testsRows), "Tests");

      const weatherRows = data.weather.map((w: any) => ({
        ID: w.id, Date: w.date, Time: w.time || "", Location: w.location || "",
        "Snow°C": w.snowTemperatureC ?? "", "Air°C": w.airTemperatureC ?? "",
        "SnowHum%": w.snowHumidityPct ?? "", "AirHum%": w.airHumidityPct ?? "",
        Clouds: w.clouds ?? "", Wind: w.wind || "", Precip: w.precipitation || "",
        NaturalSnow: w.naturalSnow || "", ArtificialSnow: w.artificialSnow || "",
        GrainSize: w.grainSize || "", TrackHardness: w.trackHardness || "",
        Quality: w.testQuality ?? "", Group: w.groupScope,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weatherRows), "Weather");

      const productRows = data.products.map((p: any) => ({
        ID: p.id, Brand: p.brand || "", Name: p.name, Type: p.category || "", Group: p.groupScope, Stock: p.stockQuantity ?? 0,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), "Products");

      if (data.series?.length) {
        const seriesRows = data.series.map((s: any) => ({
          ID: s.id, Name: s.name, Brand: s.brand || "", SkiType: s.skiType || "", TestType: s.testType, Group: s.groupScope,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(seriesRows), "Series");
      }

      if (data.athletes?.length) {
        const athleteRows = data.athletes.map((a: any) => ({
          ID: a.id, Name: a.name, Team: a.team || "", CreatedBy: a.createdByName || "",
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(athleteRows), "Athletes");
      }

      if (data.raceSkis?.length) {
        const raceSkiRows = data.raceSkis.map((s: any) => ({
          ID: s.id, AthleteID: s.athleteId, SkiID: s.skiId, Serial: s.serialNumber || "",
          Brand: s.brand || "", Discipline: s.discipline, Construction: s.construction || "",
          Mold: s.mold || "", Base: s.base || "", Grind: s.grind || "",
          Heights: s.heights || "", Year: s.year || "",
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(raceSkiRows), "Race Skis");
      }

      if (data.grindProfiles?.length) {
        const grindProfileRows = data.grindProfiles.map((gp: any) => ({
          ID: gp.id, Name: gp.name, Type: gp.grindType || "", Stone: gp.stone || "",
          Pattern: gp.pattern || "", ExtraParams: gp.extraParams || "", CreatedBy: gp.createdByName || "", CreatedAt: gp.createdAt || "",
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grindProfileRows), "Grind Profiles");
      }

      XLSX.writeFile(wb, "glidr-export.xlsx");
      fetch("/api/log-export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportType: "excel_export", details: "Admin Excel export" }),
      }).catch(() => {});
      toast({ title: L("Excel eksportert", "Excel exported") });
    } catch (err: any) {
      toast({ title: L("Eksport mislyktes", "Export failed"), description: err.message, variant: "destructive" });
    } finally {
      setXlsLoading(false);
    }
  }


  return (
    <div className="flex flex-col gap-4" data-testid="tab-content-data">
      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-db-stats">
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
            <Database className="h-4 w-4 text-violet-600" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">{L("Databaseoversikt", "Database Overview")}</h2>
        </div>
        {dbStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { label: "Users", val: dbStats.userCount },
              { label: "Tests", val: dbStats.testCount },
              { label: "Products", val: dbStats.productCount },
              { label: "Series", val: dbStats.seriesCount },
              { label: "Weather", val: dbStats.weatherCount },
              { label: "Grinding", val: dbStats.grindingCount },
              { label: "Athletes", val: dbStats.athleteCount },
              { label: "Raceskis", val: dbStats.raceSkiCount },
              { label: "Login Logs", val: dbStats.loginCount },
              { label: "Activity Logs", val: dbStats.activityCount },
              { label: "Active Sessions", val: dbStats.sessionCount },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-center">
                <div className="text-lg font-bold text-foreground">{item.val ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{L("Laster...", "Loading...")}</p>
        )}
      </Card>

      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-export-tools">
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
            <Download className="h-4 w-4 text-emerald-600" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">{L("Eksportverktøy", "Export Tools")}</h2>
        </div>
        {isSuperAdmin && teams.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{L("Eksporter for lag:", "Export for team:")}</span>
            <Select value={String(exportTeamId)} onValueChange={(v) => setExportTeamId(v === "all" ? "all" : parseInt(v))}>
              <SelectTrigger className="h-7 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L("Alle lag", "All teams")}</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium text-foreground mb-1">{L("PDF-eksport", "PDF Export")}</h3>
            <p className="text-xs text-muted-foreground mb-3">{L("Eksporter alle appdata som et omfattende PDF-dokument.", "Export all app data as a comprehensive PDF document.")}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" data-testid="button-export-pdf-data" onClick={() => downloadFullPdf(exportTeamScopeParam)} disabled={pdfLoading}>
                {pdfLoading ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                {pdfLoading ? L("Eksporterer…", "Exporting…") : L("Eksporter PDF", "Export PDF")}
              </Button>
              <Button size="sm" variant="outline" data-testid="button-export-json-data" onClick={async () => {
                try {
                  // Complete export via the auto-discovering engine: every table,
                  // per team — or the FULL SYSTEM when SA selects "All teams".
                  const res = await apiRequest("GET", `/api/admin/export-json${exportTeamScopeParam}`);
                  const json = await res.text();
                  const blob = new Blob([json], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = exportTeamScopeParam === "?teamScope=all"
                    ? `glidr-system-backup-${new Date().toISOString().slice(0, 10)}.json`
                    : `glidr-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err: any) {
                  toast({ title: L("Eksport mislyktes", "Export failed"), description: err.message, variant: "destructive" });
                }
              }}>
                <Download className="mr-2 h-3.5 w-3.5" />
                {L("Last ned JSON (komplett)", "Download JSON (complete)")}
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium text-foreground mb-1">{L("Excel-eksport", "Excel Export")}</h3>
            <p className="text-xs text-muted-foreground mb-3">{L("Eksporter alle data som en Excel-arbeidsbok med egne ark per datatype.", "Export all data as an Excel workbook with separate sheets per data type.")}</p>
            <Button size="sm" variant="outline" data-testid="button-export-xlsx" onClick={downloadXlsExport} disabled={xlsLoading}>
              {xlsLoading ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
              {xlsLoading ? L("Eksporterer…", "Exporting…") : L("Eksporter Excel", "Export Excel")}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50">
            <HardDrive className="h-4 w-4 text-green-600" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">{L("Importer data", "Import Data")}</h2>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-foreground mb-1">{L("Importer fra Glidr-sikkerhetskopi", "Import from Glidr backup")}</h3>
            <p className="text-xs text-muted-foreground">
              {L("Last opp en Glidr JSON-eksport og velg hva som skal importeres. Duplikater hoppes automatisk over.", "Upload a Glidr JSON export and choose what to import. Duplicates are automatically skipped.")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground mb-2">{L("Velg hva som skal importeres:", "Select what to import:")}</p>
            <div className="grid grid-cols-2 gap-2">
              {importOptions.map((opt) => (
                <label
                  key={opt.key}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition-all select-none",
                    importSelections[opt.key]
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={importSelections[opt.key]}
                    onChange={(e) => setImportSelections((prev) => ({ ...prev, [opt.key]: e.target.checked }))}
                  />
                  <div className={cn(
                    "h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0",
                    importSelections[opt.key] ? "bg-green-600 border-green-600" : "border-border bg-background"
                  )}>
                    {importSelections[opt.key] && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-all",
              importing || Object.values(importSelections).every((v) => !v)
                ? "border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50"
                : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
            )}>
              {importing
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Importing…</>
                : <><HardDrive className="h-3.5 w-3.5" /> Choose JSON file</>
              }
              <input
                type="file"
                accept=".json"
                className="sr-only"
                disabled={importing || Object.values(importSelections).every((v) => !v)}
                onChange={handleImport}
              />
            </label>
            <p className="text-[11px] text-muted-foreground">
              Use "Download JSON" above to get the export file.
            </p>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-maintenance">
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50">
            <Trash2 className="h-4 w-4 text-orange-600" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">{L("Vedlikehold", "Maintenance")}</h2>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-foreground">{L("Fjern dupliserte produkter", "Remove Duplicate Products")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{L("Fjerner dupliserte produkter med identisk merke+navn. Kan ikke angres.", "Removes duplicate products with identical brand+name. Cannot be undone.")}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
              data-testid="button-remove-duplicates"
              disabled={removeDuplicatesMutation.isPending}
              onClick={() => {
                if (confirm("Remove duplicate products? This will keep the oldest entry for each brand + name combination and delete the rest.")) {
                  removeDuplicatesMutation.mutate();
                }
              }}
            >
              {removeDuplicatesMutation.isPending
                ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
              Remove Duplicates
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DangerZoneTab() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();

  const purgeActivityMutation = useMutation({
    mutationFn: async (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      const res = await apiRequest("POST", "/api/admin/purge-activity-logs", { beforeDate: d.toISOString() });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/activity") });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string).startsWith("/api/admin/db-stats") });
      toast({ title: `${data.deleted} activity log entries removed` });
    },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  const purgeLoginMutation = useMutation({
    mutationFn: async (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      const res = await apiRequest("POST", "/api/admin/purge-login-logs", { beforeDate: d.toISOString() });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/login-logs") });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/db-stats") });
      toast({ title: `${data.deleted} login log entries removed` });
    },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  const forceLogoutAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/force-logout-all");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/db-stats") });
      toast({ title: L("Alle andre brukere er logget ut", "All other users have been logged out") });
    },
    onError: (e: Error) => toast({ title: L("Feil", "Error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-4" data-testid="tab-content-danger">
      <div className="rounded-2xl border-2 border-red-200 bg-red-50/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-100">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <h2 className="text-sm font-semibold text-red-900">{L("Faresone", "Danger Zone")}</h2>
          <span className="text-xs text-red-500">{L("Disse handlingene kan ikke angres.", "These actions are irreversible.")}</span>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">{L("Slett gamle aktivitetslogger", "Purge Old Activity Logs")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{L("Fjern aktivitetslogger eldre enn en valgt periode.", "Remove activity log entries older than a specified period.")}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm" variant="outline"
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                  data-testid="button-purge-activity-90"
                  disabled={purgeActivityMutation.isPending}
                  onClick={() => {
                    if (confirm("Delete all activity logs older than 90 days? This cannot be undone.")) {
                      purgeActivityMutation.mutate(90);
                    }
                  }}
                >
                  <Eraser className="mr-1.5 h-3.5 w-3.5" /> 90+ days
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  data-testid="button-purge-activity-30"
                  disabled={purgeActivityMutation.isPending}
                  onClick={() => {
                    if (confirm("Delete all activity logs older than 30 days? This cannot be undone.")) {
                      purgeActivityMutation.mutate(30);
                    }
                  }}
                >
                  <Eraser className="mr-1.5 h-3.5 w-3.5" /> 30+ days
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">{L("Slett gammel innloggingshistorikk", "Purge Old Login History")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{L("Fjern innloggingshistorikk eldre enn en valgt periode.", "Remove login history entries older than a specified period.")}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm" variant="outline"
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                  data-testid="button-purge-logins-90"
                  disabled={purgeLoginMutation.isPending}
                  onClick={() => {
                    if (confirm("Delete all login logs older than 90 days? This cannot be undone.")) {
                      purgeLoginMutation.mutate(90);
                    }
                  }}
                >
                  <Eraser className="mr-1.5 h-3.5 w-3.5" /> 90+ days
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  data-testid="button-purge-logins-30"
                  disabled={purgeLoginMutation.isPending}
                  onClick={() => {
                    if (confirm("Delete all login logs older than 30 days? This cannot be undone.")) {
                      purgeLoginMutation.mutate(30);
                    }
                  }}
                >
                  <Eraser className="mr-1.5 h-3.5 w-3.5" /> 30+ days
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">{L("Tving utlogging av alle brukere", "Force Logout All Users")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{L("Avslutt alle aktive økter unntatt din egen. Brukere må logge inn på nytt.", "Terminate all active sessions except your own. Users will need to log in again.")}</p>
              </div>
              <Button
                size="sm" variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 flex-shrink-0"
                data-testid="button-force-logout-all"
                disabled={forceLogoutAllMutation.isPending}
                onClick={() => {
                  if (confirm("Force logout ALL other users? They will need to log in again.")) {
                    forceLogoutAllMutation.mutate();
                  }
                }}
              >
                <UserX className="mr-1.5 h-3.5 w-3.5" /> Logout All
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
