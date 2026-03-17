import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Plus, Pencil, Trash2, KeyRound, Check, X, Clock, Download,
  Users, FlaskConical, Package, Layers, CloudSun, Disc3, LogIn, Activity,
  Shield, LogOut, ToggleLeft, ToggleRight, Database, AlertTriangle,
  HardDrive, UserX, Eraser, RefreshCw, Building2,
} from "lucide-react";
import { PERMISSION_AREAS, DEFAULT_PERMISSIONS, ROLE_PRESETS } from "@shared/schema";
import type { UserPermissions, PermissionLevel } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type ApiUser = {
  id: number;
  email: string;
  name: string;
  groupScope: string;
  isAdmin: number;
  isTeamAdmin: number;
  teamId: number;
  permissions: string;
  isActive: number;
};

type ApiTeam = {
  id: number;
  name: string;
  createdAt: string;
  isDefault: number;
};

const AREA_LABELS: Record<string, string> = {
  dashboard: "Dashboard", tests: "Tests", testskis: "Testskis", products: "Products",
  weather: "Weather", analytics: "Analytics", grinding: "Grinding", raceskis: "Raceskis",
  suggestions: "Suggestions"
};

function parsePermissions(permStr: string): UserPermissions {
  try {
    return JSON.parse(permStr);
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

function PermissionsMatrix({
  value,
  onChange,
  testIdPrefix,
}: {
  value: UserPermissions;
  onChange: (perms: UserPermissions) => void;
  testIdPrefix: string;
}) {
  const levels: PermissionLevel[] = ["none", "view", "edit"];
  const levelStyles: Record<PermissionLevel, { active: string; inactive: string }> = {
    none: { active: "bg-gray-500 text-white", inactive: "text-muted-foreground hover:bg-muted" },
    view: { active: "bg-blue-500 text-white", inactive: "text-blue-600 hover:bg-blue-50" },
    edit: { active: "bg-green-500 text-white", inactive: "text-green-600 hover:bg-green-50" },
  };

  const setAll = (level: PermissionLevel) => {
    const next = { ...value };
    for (const area of PERMISSION_AREAS) next[area] = level;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-medium">Permissions</span>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground mr-1">Presets:</span>
          {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              className="rounded-full px-2 py-0.5 text-[10px] font-medium border border-teal-300 text-teal-600 hover:bg-teal-50 transition-colors"
              onClick={() => onChange({ ...preset.permissions })}
              data-testid={`${testIdPrefix}-preset-${key}`}
            >
              {preset.label}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground ml-1 mr-1">Set all:</span>
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
        {PERMISSION_AREAS.map((area) => (
          <div key={area} className="flex items-center justify-between px-3 h-8">
            <span className="text-xs text-foreground/80">{AREA_LABELS[area] || area}</span>
            <div className="flex items-center gap-0.5">
              {levels.map((l) => {
                const selected = (value[area] || "none") === l;
                return (
                  <button
                    key={l}
                    type="button"
                    data-testid={`${testIdPrefix}-${area}${selected ? "" : `-opt-${l}`}`}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors",
                      selected ? levelStyles[l].active : levelStyles[l].inactive
                    )}
                    onClick={() => onChange({ ...value, [area]: l })}
                  >
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
  createdAt: string;
  groupScope: string;
};

type TabId = "overview" | "users" | "groups" | "teams" | "activity" | "logins" | "data" | "danger";

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
  password: z.string().min(1, "Password is required"),
  groupScope: z.string().min(1, "At least one group is required"),
  isAdmin: z.boolean(),
  isTeamAdmin: z.boolean(),
  permissions: z.string(),
  isActive: z.boolean(),
  teamId: z.number().optional(),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  groupScope: z.string().min(1, "At least one group is required"),
  isAdmin: z.boolean(),
  isTeamAdmin: z.boolean(),
  permissions: z.string(),
  isActive: z.boolean(),
  teamId: z.number().optional(),
});

const resetSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

function CreateUserForm({ onDone, allGroups, defaultTeamId, teams }: { onDone: () => void; allGroups: ApiGroup[]; defaultTeamId: number; teams: ApiTeam[] }) {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const [perms, setPerms] = useState<UserPermissions>({ ...DEFAULT_PERMISSIONS });
  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId);
  const teamChanged = selectedTeamId !== defaultTeamId;
  const { data: teamGroups } = useQuery<ApiGroup[]>({
    queryKey: [`/api/groups?teamScope=${selectedTeamId}`],
    enabled: teamChanged && isSuperAdmin,
  });
  const effectiveGroups = teamChanged && teamGroups ? teamGroups : allGroups;
  const groupNames = effectiveGroups.filter((g) => g.teamId === selectedTeamId).map((g) => g.name);
  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "password", groupScope: groupNames[0] || "", isAdmin: false, isTeamAdmin: false, permissions: JSON.stringify(DEFAULT_PERMISSIONS), isActive: true, teamId: defaultTeamId },
  });

  const selectedGroups = parseGroups(form.watch("groupScope"));

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema>) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "User created" });
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
          <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} data-testid="input-user-name" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} data-testid="input-user-email" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem><FormLabel>Password</FormLabel><FormControl><Input {...field} type="password" data-testid="input-user-password" /></FormControl><FormMessage /></FormItem>
        )} />
        {isSuperAdmin && teams.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Team</label>
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
        <FormField control={form.control} name="groupScope" render={({ field }) => (
          <FormItem>
            <FormLabel>Groups (select one or more)</FormLabel>
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
        <FormField control={form.control} name="isAdmin" render={() => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Select
              value={form.watch("isAdmin") ? "superadmin" : form.watch("isTeamAdmin") ? "teamadmin" : "member"}
              onValueChange={(v) => {
                form.setValue("isAdmin", v === "superadmin");
                form.setValue("isTeamAdmin", v === "teamadmin");
              }}
            >
              <FormControl><SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="teamadmin">Team Admin</SelectItem>
                {isSuperAdmin && <SelectItem value="superadmin">Super Admin</SelectItem>}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <PermissionsMatrix
          value={perms}
          onChange={(p) => { setPerms(p); form.setValue("permissions", JSON.stringify(p)); }}
          testIdPrefix="select-create-perm"
        />
        <FormField control={form.control} name="isActive" render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select value={field.value ? "active" : "inactive"} onValueChange={(v) => field.onChange(v === "active")}>
              <FormControl><SelectTrigger data-testid="select-user-status"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex justify-end">
          <Button type="submit" data-testid="button-create-user" disabled={mutation.isPending}>Create</Button>
        </div>
      </form>
    </Form>
  );
}

function EditUserForm({ user, onDone, allGroups, teams }: { user: ApiUser; onDone: () => void; allGroups: ApiGroup[]; teams: ApiTeam[] }) {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState(user.teamId);
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
      groupScope: user.groupScope,
      isAdmin: !!user.isAdmin,
      isTeamAdmin: !!user.isTeamAdmin,
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
      toast({ title: "User updated" });
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
          <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} data-testid="input-edit-name" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} data-testid="input-edit-email" /></FormControl><FormMessage /></FormItem>
        )} />
        {isSuperAdmin && teams.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Team</label>
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
        )}
        <FormField control={form.control} name="groupScope" render={({ field }) => (
          <FormItem>
            <FormLabel>Groups (select one or more)</FormLabel>
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
        <FormField control={form.control} name="isAdmin" render={() => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Select
              value={form.watch("isAdmin") ? "superadmin" : form.watch("isTeamAdmin") ? "teamadmin" : "member"}
              onValueChange={(v) => {
                form.setValue("isAdmin", v === "superadmin");
                form.setValue("isTeamAdmin", v === "teamadmin");
              }}
            >
              <FormControl><SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="teamadmin">Team Admin</SelectItem>
                {isSuperAdmin && <SelectItem value="superadmin">Super Admin</SelectItem>}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <PermissionsMatrix
          value={perms}
          onChange={(p) => { setPerms(p); form.setValue("permissions", JSON.stringify(p)); }}
          testIdPrefix="select-edit-perm"
        />
        <FormField control={form.control} name="isActive" render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select value={field.value ? "active" : "inactive"} onValueChange={(v) => field.onChange(v === "active")}>
              <FormControl><SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex justify-end">
          <Button type="submit" data-testid="button-save-user" disabled={mutation.isPending}>Save</Button>
        </div>
      </form>
    </Form>
  );
}

function ResetPasswordForm({ user, onDone }: { user: ApiUser; onDone: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "password" },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof resetSchema>) => {
      const res = await apiRequest("POST", `/api/users/${user.id}/reset-password`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password reset" });
      onDone();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem><FormLabel>New password</FormLabel><FormControl><Input {...field} type="password" data-testid="input-reset-password" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="flex justify-end">
          <Button type="submit" data-testid="button-reset-password" disabled={mutation.isPending}>Reset</Button>
        </div>
      </form>
    </Form>
  );
}

const ALL_TABS: { id: TabId; label: string; superAdminOnly?: boolean }[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "groups", label: "Groups" },
  { id: "teams", label: "Teams", superAdminOnly: true },
  { id: "activity", label: "Activity Log" },
  { id: "logins", label: "Login History" },
  { id: "data", label: "Data Management" },
  { id: "danger", label: "Danger Zone" },
];

function StatCard({ label, value, icon: Icon, color, testId }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string; testId: string }) {
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-200" },
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

export default function Admin() {
  const { user, isSuperAdmin, canManage } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<ApiUser | undefined>();
  const [resetUser, setResetUser] = useState<ApiUser | undefined>();
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupTeamId, setNewGroupTeamId] = useState<number | undefined>(undefined);
  const [editingGroup, setEditingGroup] = useState<ApiGroup | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingTeam, setEditingTeam] = useState<ApiTeam | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");

  const [adminTeamScope, setAdminTeamScope] = useState<string>("current");

  const { data: teams = [] } = useQuery<ApiTeam[]>({
    queryKey: ["/api/teams"],
    enabled: isSuperAdmin,
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

  const groupNames = apiGroups.map((g) => g.name);

  const effectiveTeamId = adminTeamScope === "all" || adminTeamScope === "current"
    ? (user?.teamId ?? 1)
    : parseInt(adminTeamScope);

  const scopeLabel = adminTeamScope === "all"
    ? "All teams"
    : adminTeamScope === "current"
      ? undefined
      : teams.find((t) => t.id === parseInt(adminTeamScope))?.name;

  const [pdfLoading, setPdfLoading] = useState(false);

  async function downloadFullPdf() {
    setPdfLoading(true);
    try {
      const exportRes = await apiRequest("GET", "/api/admin/full-export");
      const rawText = await exportRes.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr: any) {
        throw new Error(`Response parse failed (${rawText.length} chars): ${parseErr.message}`);
      }

      const doc = new jsPDF({ orientation: "landscape" });
      let y = 15;
      const pageH = doc.internal.pageSize.getHeight();
      const checkPage = (need: number = 40) => { if (y > pageH - need) { doc.addPage(); y = 15; } };
      const hStyle = { fillColor: [59, 130, 246] as [number, number, number] };

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
        body: data.users.map((u: any) => [u.name, u.email, u.groupScope, u.isAdmin ? "Super Admin" : u.isTeamAdmin ? "Team Admin" : "Member", u.isActive ? "Yes" : "No"]),
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

      const productMap = new Map(data.products.map((p: any) => [p.id, p]));
      const seriesMap = new Map(data.series.map((s: any) => [s.id, s]));
      const raceSkiMap = new Map(data.raceSkis.map((s: any) => [s.id, s]));
      const athleteMap = new Map(data.athletes.map((a: any) => [a.id, a]));

      const getProductLabel = (entry: any) => {
        if (entry.raceSkiId) {
          const ski = raceSkiMap.get(entry.raceSkiId);
          if (ski) return `${ski.athleteName} — ${ski.brand || ""} ${ski.skiId || ""}`.trim();
        }
        const mainProduct = productMap.get(entry.productId);
        const parts: string[] = [];
        if (mainProduct) parts.push(`${mainProduct.brand || ""} ${mainProduct.name}`.trim());
        if (entry.additionalProductIds) {
          try {
            const addIds = typeof entry.additionalProductIds === "string"
              ? JSON.parse(entry.additionalProductIds) : entry.additionalProductIds;
            if (Array.isArray(addIds)) {
              for (const id of addIds) {
                const p = productMap.get(id);
                if (p) parts.push(`${p.brand || ""} ${p.name}`.trim());
              }
            }
          } catch {}
        }
        return parts.join(" + ") || "—";
      };

      checkPage();
      doc.setFontSize(16);
      doc.text(`Tests with Results (${data.tests.length})`, 14, y);
      y += 8;

      const sortedTests = [...data.tests].sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""));

      for (const test of sortedTests) {
        const entries: any[] = data.entriesByTest[test.id] || [];
        const seriesObj = seriesMap.get(test.seriesId);
        const athleteObj = test.athleteId ? athleteMap.get(test.athleteId) : null;
        const sourceName = test.testSkiSource === "raceskis"
          ? (athleteObj ? `Athlete: ${athleteObj.name}` : "Raceskis")
          : (seriesObj ? seriesObj.name : "");
        const isClassic = test.testType === "Classic";

        checkPage(50);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`${test.date} — ${test.testType} — ${sourceName}`, 14, y);
        doc.setFont("helvetica", "normal");
        y += 4;
        doc.setFontSize(8);
        const meta = [
          test.location ? `Location: ${test.location}` : null,
          test.notes ? `Notes: ${test.notes}` : null,
          `Group: ${test.groupScope}`,
        ].filter(Boolean).join("  |  ");
        doc.text(meta, 14, y);
        y += 4;

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

          const head = ["Rank", "Ski", "Product / Raceski", "Method"];
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
                getProductLabel(e),
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
            styles: { fontSize: 7 }, headStyles: hStyle, margin: { left: 14, right: 14 },
          });
          y = (doc as any).lastAutoTable.finalY + 8;
        } else {
          doc.setFontSize(8);
          doc.text("No entries", 14, y);
          y += 6;
        }
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

      if (data.grindingRecords.length > 0) {
        checkPage();
        doc.setFontSize(13);
        doc.text(`Grinding Records (${data.grindingRecords.length})`, 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [["Date", "Type", "Stone", "Notes", "Created By", "Group"]],
          body: data.grindingRecords.map((r: any) => [r.date || "", r.grindType || "", r.stone || "", r.notes || "", r.createdByName || "", r.groupScope || ""]),
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
        head: [["Name", "Email", "IP Address", "Login Time"]],
        body: data.loginLogs.map((l: any) => [l.name, l.email, l.ipAddress || "—", new Date(l.loginAt).toLocaleString()]),
        styles: { fontSize: 8 }, headStyles: hStyle, margin: { left: 14, right: 14 },
      });

      doc.save("glidr-full-export.pdf");
      const sections = [
        `${data.tests.length} tests`,
        `${data.weather.length} weather`,
        data.raceSkis.length ? `${data.raceSkis.length} race skis` : null,
        data.grindingRecords.length ? `${data.grindingRecords.length} grinds` : null,
        data.raceSkiRegrinds?.length ? `${data.raceSkiRegrinds.length} ski regrinds` : null,
        data.testSkiRegrinds?.length ? `${data.testSkiRegrinds.length} series regrinds` : null,
      ].filter(Boolean).join(", ");
      toast({ title: "PDF exported", description: sections });
      try {
        await apiRequest("POST", "/api/action-log", { action: "pdf_download", details: "Full data export" });
        queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/login-logs") });
      } catch (_) {}
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
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
      toast({ title: "Group created" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
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
      toast({ title: "Group renamed" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/groups/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Group deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "User deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const forceLogoutMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/admin/force-logout/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User session terminated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, value }: { userId: number; value: boolean }) => {
      const res = await apiRequest("PUT", `/api/users/${userId}`, { isActive: value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "User status updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/teams", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setNewTeamName("");
      toast({ title: "Team created" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PUT", `/api/teams/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Team updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/teams/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Team deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const setDefaultTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/teams/${id}/set-default`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Default team updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  if (!canManage) {
    return (
      <AppShell>
        <Card className="fs-card rounded-2xl p-6" data-testid="status-admin-forbidden">
          <div className="text-base font-semibold">Admin only</div>
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
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-admin-subtitle">
              Manage users, groups, and access.{scopeLabel ? ` — ${scopeLabel}` : ""}
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
                  <SelectItem value="current" data-testid="scope-current">Current team</SelectItem>
                  <SelectItem value="all" data-testid="scope-all">All teams</SelectItem>
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
              onClick={downloadFullPdf}
              disabled={pdfLoading}
            >
              {pdfLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {pdfLoading ? "Exporting…" : "Download PDF"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm" data-testid="admin-tab-bar">
          {ALL_TABS.filter((tab) => !tab.superAdminOnly || isSuperAdmin).map((tab) => (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="flex flex-col gap-5" data-testid="tab-content-overview">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Users" value={stats.userCount} icon={Users} color="blue" testId="stat-users" />
              <StatCard label="Tests" value={stats.testCount} icon={FlaskConical} color="emerald" testId="stat-tests" />
              <StatCard label="Products" value={stats.productCount} icon={Package} color="amber" testId="stat-products" />
              <StatCard label="Series" value={stats.seriesCount} icon={Layers} color="violet" testId="stat-series" />
              <StatCard label="Weather" value={stats.weatherCount} icon={CloudSun} color="sky" testId="stat-weather" />
              <StatCard label="Grinding" value={stats.grindingCount} icon={Disc3} color="rose" testId="stat-grinding" />
              <StatCard label="Logins" value={stats.loginCount} icon={LogIn} color="indigo" testId="stat-logins" />
              <StatCard label="Activities" value={stats.activityCount} icon={Activity} color="teal" testId="stat-activities" />
            </div>

            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-recent-activity">
              <div className="flex items-center gap-2 mb-4">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
              </div>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="empty-activity">No activity recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {activities.slice(0, 20).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5"
                      data-testid={`row-activity-${a.id}`}
                    >
                      <div className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 mt-0.5">
                        <Activity className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{a.userName}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{a.action}</span>
                          {a.entityType && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">{a.entityType}</span>
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
          </div>
        )}

        {activeTab === "users" && (
          <div className="flex flex-col gap-4" data-testid="tab-content-users">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Users ({users.length})</h2>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-user" className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    New user
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
                  <CreateUserForm onDone={() => setCreateOpen(false)} allGroups={apiGroups} defaultTeamId={effectiveTeamId} teams={teams} />
                </DialogContent>
              </Dialog>
            </div>

            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-1.5">
                {users.map((u) => {
                  const userPerms = parsePermissions(u.permissions);
                  const viewAreas = PERMISSION_AREAS.filter((a) => userPerms[a] === "view");
                  const editAreas = PERMISSION_AREAS.filter((a) => userPerms[a] === "edit");
                  const totalActive = viewAreas.length + editAreas.length;
                  const permSummary = totalActive === 0
                    ? "No permissions"
                    : `${totalActive} area${totalActive > 1 ? "s" : ""}` +
                      (viewAreas.length ? ` · ${viewAreas.length} view` : "") +
                      (editAreas.length ? ` · ${editAreas.length} edit` : "");
                  const permDetail = [
                    ...(viewAreas.length ? [`${viewAreas.map((a) => AREA_LABELS[a]).join(", ")} (view)`] : []),
                    ...(editAreas.length ? [`${editAreas.map((a) => AREA_LABELS[a]).join(", ")} (edit)`] : []),
                  ].join(" · ");

                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
                      data-testid={`row-user-${u.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{u.name}</span>
                          <span className="text-xs text-muted-foreground">{u.email}</span>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            u.isAdmin ? "bg-amber-50 text-amber-600" : u.isTeamAdmin ? "bg-purple-50 text-purple-600" : "bg-muted text-muted-foreground"
                          )}>
                            {u.isAdmin ? "Super Admin" : u.isTeamAdmin ? "Team Admin" : "Member"}
                          </span>
                          {!u.isActive && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">Inactive</span>
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
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          className={cn(
                            "rounded p-1 transition-colors",
                            u.isActive ? "text-green-600 hover:bg-green-50" : "text-red-500 hover:bg-red-50"
                          )}
                          data-testid={`toggle-active-${u.id}`}
                          title={u.isActive ? "Deactivate user" : "Activate user"}
                          onClick={() => toggleActiveMutation.mutate({ userId: u.id, value: !u.isActive })}
                        >
                          {u.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                        </button>
                        <button
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground/80"
                          data-testid={`button-edit-user-${u.id}`}
                          title="Edit user"
                          onClick={() => setEditUser(u)}
                        >
                          <Pencil className="h-4.5 w-4.5" />
                        </button>
                        <button
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground/80"
                          data-testid={`button-reset-user-${u.id}`}
                          title="Reset password"
                          onClick={() => setResetUser(u)}
                        >
                          <KeyRound className="h-4.5 w-4.5" />
                        </button>
                        <button
                          className="rounded p-1 text-orange-500 hover:bg-orange-50"
                          data-testid={`button-force-logout-${u.id}`}
                          title="Force logout"
                          onClick={() => {
                            if (confirm(`Force logout ${u.name}?`)) {
                              forceLogoutMutation.mutate(u.id);
                            }
                          }}
                        >
                          <LogOut className="h-4.5 w-4.5" />
                        </button>
                        <button
                          className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-30"
                          data-testid={`button-delete-user-${u.id}`}
                          disabled={u.id === user.id}
                          title="Delete user"
                          onClick={() => {
                            if (confirm(`Delete ${u.name}?`)) {
                              deleteMutation.mutate(u.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(undefined); }}>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
                {editUser && <EditUserForm user={editUser} onDone={() => setEditUser(undefined)} allGroups={apiGroups} teams={teams} />}
              </DialogContent>
            </Dialog>

            <Dialog open={!!resetUser} onOpenChange={(v) => { if (!v) setResetUser(undefined); }}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Reset password for {resetUser?.name}</DialogTitle></DialogHeader>
                {resetUser && <ResetPasswordForm user={resetUser} onDone={() => setResetUser(undefined)} />}
              </DialogContent>
            </Dialog>
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
                  placeholder="New group name…"
                  className="h-8 text-sm flex-1"
                  data-testid="input-new-group"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newGroupName.trim()) {
                      createGroupMutation.mutate({ name: newGroupName.trim(), teamId: newGroupTeamId });
                    }
                  }}
                />
                {isSuperAdmin && teams.length > 1 && (
                  <Select
                    value={newGroupTeamId ? String(newGroupTeamId) : "default"}
                    onValueChange={(v) => setNewGroupTeamId(v === "default" ? undefined : parseInt(v))}
                  >
                    <SelectTrigger className="h-8 w-[140px] text-sm" data-testid="select-new-group-team">
                      <SelectValue placeholder="Team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Current team</SelectItem>
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
                  onClick={() => createGroupMutation.mutate({ name: newGroupName.trim(), teamId: newGroupTeamId })}
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
            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-admin-teams">
              <div className="text-sm font-semibold text-foreground mb-3">Teams ({teams.length})</div>
              <div className="grid grid-cols-1 gap-2">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5"
                    data-testid={`row-team-${team.id}`}
                  >
                    {editingTeam?.id === team.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editingTeamName}
                          onChange={(e) => setEditingTeamName(e.target.value)}
                          className="h-8 text-sm"
                          data-testid="input-edit-team-name"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editingTeamName.trim()) {
                              updateTeamMutation.mutate({ id: team.id, name: editingTeamName.trim() });
                              setEditingTeam(null);
                            }
                            if (e.key === "Escape") setEditingTeam(null);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid="button-save-team"
                          disabled={!editingTeamName.trim() || updateTeamMutation.isPending}
                          onClick={() => {
                            updateTeamMutation.mutate({ id: team.id, name: editingTeamName.trim() });
                            setEditingTeam(null);
                          }}
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingTeam(null)} data-testid="button-cancel-edit-team">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-foreground">{team.name}</span>
                          {team.isDefault === 1 && (
                            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">Default</span>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {users.filter((u) => u.teamId === team.id).length} users
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
                              title="Set as default"
                            >
                              <Shield className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-edit-team-${team.id}`}
                            onClick={() => { setEditingTeam(team); setEditingTeamName(team.name); }}
                          >
                            <Pencil className="h-4 w-4" />
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
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="New team name…"
                  className="h-8 text-sm"
                  data-testid="input-new-team"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTeamName.trim()) {
                      createTeamMutation.mutate(newTeamName.trim());
                    }
                  }}
                />
                <Button
                  size="sm"
                  data-testid="button-add-team"
                  disabled={!newTeamName.trim() || createTeamMutation.isPending}
                  onClick={() => createTeamMutation.mutate(newTeamName.trim())}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="flex flex-col gap-4" data-testid="tab-content-activity">
            <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-activity-log">
              <div className="flex items-center gap-2 mb-4">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50">
                  <Activity className="h-4 w-4 text-teal-600" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Activity Log ({activities.length})</h2>
              </div>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="empty-activity-log">No activity recorded yet.</p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-3">Time</th>
                        <th className="pb-2 pr-3">User</th>
                        <th className="pb-2 pr-3">Action</th>
                        <th className="pb-2 pr-3">Type</th>
                        <th className="pb-2 pr-3">Details</th>
                        <th className="pb-2">Group</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.slice(0, 200).map((a) => (
                        <tr key={a.id} className="border-b border-border" data-testid={`row-activitylog-${a.id}`}>
                          <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                          <td className="py-2 pr-3 font-medium text-foreground">{a.userName}</td>
                          <td className="py-2 pr-3">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">{a.action}</span>
                          </td>
                          <td className="py-2 pr-3">
                            {a.entityType && (
                              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">{a.entityType}</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[200px] truncate">{a.details || "—"}</td>
                          <td className="py-2">
                            {a.groupScope ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">{a.groupScope}</span>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
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
                <h2 className="text-sm font-semibold text-foreground">Login History ({loginLogs.length})</h2>
              </div>
              {loginLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No login records yet.</p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 pr-3">Name</th>
                        <th className="pb-2 pr-3">Email</th>
                        <th className="pb-2 pr-3">Action</th>
                        <th className="pb-2 pr-3">IP Address</th>
                        <th className="pb-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginLogs.slice(0, 200).map((log) => (
                        <tr key={log.id} className="border-b border-border" data-testid={`row-login-${log.id}`}>
                          <td className="py-2 pr-3 font-medium text-foreground">{log.name}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{log.email}</td>
                          <td className="py-2 pr-3">
                            {log.action === "login" ? (
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">Login</span>
                            ) : log.action === "pdf_download" ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                                PDF {log.details ? `— ${log.details}` : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">{log.action}</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{log.ipAddress || "—"}</td>
                          <td className="py-2 text-muted-foreground">
                            {new Date(log.loginAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === "data" && <DataManagementTab teamScopeParam={teamScopeParam} />}

        {activeTab === "danger" && <DangerZoneTab />}
      </div>
    </AppShell>
  );
}

function DataManagementTab({ teamScopeParam }: { teamScopeParam: string }) {
  const { toast } = useToast();
  const { data: dbStats } = useQuery<any>({ queryKey: [`/api/admin/db-stats${teamScopeParam}`] });

  const [csvLoading, setCsvLoading] = useState(false);
  const [xlsLoading, setXlsLoading] = useState(false);

  async function downloadXlsExport() {
    setXlsLoading(true);
    try {
      const exportRes = await apiRequest("GET", "/api/admin/full-export");
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

      XLSX.writeFile(wb, "glidr-export.xlsx");
      toast({ title: "Excel exported" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setXlsLoading(false);
    }
  }

  async function downloadCsvExport() {
    setCsvLoading(true);
    try {
      const exportRes = await apiRequest("GET", "/api/admin/full-export");
      const rawText = await exportRes.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr: any) {
        throw new Error(`Response parse failed (${rawText.length} chars): ${parseErr.message}`);
      }

      const csvRows: string[] = [];
      csvRows.push("=== TESTS ===");
      csvRows.push("ID,Date,Type,Location,Series,Group,Notes,Source");
      for (const t of data.tests) {
        const series = data.series.find((s: any) => s.id === t.seriesId);
        csvRows.push([t.id, t.date, t.testType, `"${t.location || ""}"`, `"${series?.name || ""}"`, t.groupScope, `"${(t.notes || "").replace(/"/g, '""')}"`, t.testSkiSource || "series"].join(","));
      }

      csvRows.push("");
      csvRows.push("=== WEATHER ===");
      csvRows.push("ID,Date,Time,Location,Snow°C,Air°C,SnowHum%,AirHum%,Clouds,Wind,Precip,NaturalSnow,ArtificialSnow,GrainSize,TrackHardness,Quality,Group");
      for (const w of data.weather) {
        csvRows.push([w.id, w.date, w.time || "", `"${w.location || ""}"`, w.snowTemperatureC ?? "", w.airTemperatureC ?? "", w.snowHumidityPct ?? "", w.airHumidityPct ?? "", w.clouds ?? "", w.wind || "", w.precipitation || "", w.naturalSnow || "", w.artificialSnow || "", w.grainSize || "", w.trackHardness || "", w.testQuality ?? "", w.groupScope].join(","));
      }

      csvRows.push("");
      csvRows.push("=== PRODUCTS ===");
      csvRows.push("ID,Brand,Name,Type,Group");
      for (const p of data.products) {
        csvRows.push([p.id, `"${p.brand || ""}"`, `"${p.name}"`, p.category || "", p.groupScope].join(","));
      }

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "glidr-export.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV exported" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setCsvLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="tab-content-data">
      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-db-stats">
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
            <Database className="h-4 w-4 text-violet-600" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Database Overview</h2>
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
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
      </Card>

      <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="card-export-tools">
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
            <Download className="h-4 w-4 text-emerald-600" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Export Tools</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium text-foreground mb-1">Full PDF Report</h3>
            <p className="text-xs text-muted-foreground mb-3">Complete data export with all tests, results, weather, athletes, and history.</p>
            <Button size="sm" variant="outline" data-testid="button-export-pdf-data" onClick={() => document.querySelector<HTMLButtonElement>('[data-testid="button-download-pdf"]')?.click()}>
              <Download className="mr-2 h-3.5 w-3.5" /> Export PDF
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium text-foreground mb-1">CSV Data Export</h3>
            <p className="text-xs text-muted-foreground mb-3">Export tests, weather, and products in CSV format for spreadsheets.</p>
            <Button size="sm" variant="outline" data-testid="button-export-csv" onClick={downloadCsvExport} disabled={csvLoading}>
              {csvLoading ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
              {csvLoading ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium text-foreground mb-1">Excel Export</h3>
            <p className="text-xs text-muted-foreground mb-3">Export all data as an Excel workbook with separate sheets per data type.</p>
            <Button size="sm" variant="outline" data-testid="button-export-xlsx" onClick={downloadXlsExport} disabled={xlsLoading}>
              {xlsLoading ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
              {xlsLoading ? "Exporting…" : "Export Excel"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DangerZoneTab() {
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
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const forceLogoutAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/force-logout-all");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/admin/db-stats") });
      toast({ title: "All other users have been logged out" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-4" data-testid="tab-content-danger">
      <div className="rounded-2xl border-2 border-red-200 bg-red-50/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-100">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <h2 className="text-sm font-semibold text-red-900">Danger Zone</h2>
          <span className="text-xs text-red-500">These actions are irreversible.</span>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">Purge Old Activity Logs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Remove activity log entries older than a specified period.</p>
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
                <h3 className="text-sm font-medium text-foreground">Purge Old Login History</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Remove login history entries older than a specified period.</p>
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
                <h3 className="text-sm font-medium text-foreground">Force Logout All Users</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Terminate all active sessions except your own. Users will need to log in again.</p>
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
