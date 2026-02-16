import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Plus, Pencil, Trash2, KeyRound, Check, X, Clock, Download,
  Users, FlaskConical, Package, Layers, CloudSun, Disc3, LogIn, Activity,
  Shield, LogOut, ToggleLeft, ToggleRight,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  canAccessGrinding: number;
  isActive: number;
};

type ApiGroup = { id: number; name: string };

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

type TabId = "overview" | "users" | "groups" | "activity" | "logins";

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
                : "border-gray-100 bg-gray-50/50 text-muted-foreground hover:bg-background/50"
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
  isActive: z.boolean(),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  groupScope: z.string().min(1, "At least one group is required"),
  isAdmin: z.boolean(),
  canAccessGrinding: z.boolean(),
  isActive: z.boolean(),
});

const resetSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

function CreateUserForm({ onDone, groupNames }: { onDone: () => void; groupNames: string[] }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "password", groupScope: groupNames[0] || "", isAdmin: false, isActive: true },
  });

  const selectedGroups = parseGroups(form.watch("groupScope"));

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema>) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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
        <FormField control={form.control} name="isAdmin" render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Select value={field.value ? "admin" : "member"} onValueChange={(v) => field.onChange(v === "admin")}>
              <FormControl><SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
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

function EditUserForm({ user, onDone, groupNames }: { user: ApiUser; onDone: () => void; groupNames: string[] }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      groupScope: user.groupScope,
      isAdmin: !!user.isAdmin,
      canAccessGrinding: !!user.canAccessGrinding,
      isActive: !!user.isActive,
    },
  });

  const selectedGroups = parseGroups(form.watch("groupScope"));

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof editSchema>) => {
      const res = await apiRequest("PUT", `/api/users/${user.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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
        <FormField control={form.control} name="isAdmin" render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <Select value={field.value ? "admin" : "member"} onValueChange={(v) => field.onChange(v === "admin")}>
              <FormControl><SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="canAccessGrinding" render={({ field }) => (
          <FormItem>
            <FormLabel>Grinding Access</FormLabel>
            <Select value={field.value ? "yes" : "no"} onValueChange={(v) => field.onChange(v === "yes")}>
              <FormControl><SelectTrigger data-testid="select-edit-grinding"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="no">No Access</SelectItem>
                <SelectItem value="yes">Has Access</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
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

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "groups", label: "Groups" },
  { id: "activity", label: "Activity Log" },
  { id: "logins", label: "Login History" },
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
    <Card className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
        </div>
        <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1", c.bg, c.ring)}>
          <Icon className={cn("h-5 w-5", c.text)} />
        </div>
      </div>
    </Card>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<ApiUser | undefined>();
  const [resetUser, setResetUser] = useState<ApiUser | undefined>();
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<ApiGroup | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  const isAdmin = !!user && !!user.isAdmin;

  const { data: users = [] } = useQuery<ApiUser[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });

  const { data: apiGroups = [] } = useQuery<ApiGroup[]>({
    queryKey: ["/api/groups"],
    enabled: isAdmin,
  });

  const { data: loginLogs = [] } = useQuery<LoginLog[]>({
    queryKey: ["/api/login-logs"],
    enabled: isAdmin,
  });

  const { data: allSeries = [] } = useQuery<any[]>({
    queryKey: ["/api/series"],
    enabled: isAdmin,
  });

  const { data: allProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    enabled: isAdmin,
  });

  const { data: allTests = [] } = useQuery<any[]>({
    queryKey: ["/api/tests"],
    enabled: isAdmin,
  });

  const { data: allWeather = [] } = useQuery<any[]>({
    queryKey: ["/api/weather"],
    enabled: isAdmin,
  });

  const { data: adminStats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: isAdmin,
  });

  const { data: activities = [] } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/activity"],
    enabled: isAdmin,
  });

  const groupNames = apiGroups.map((g) => g.name);

  async function downloadFullPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    let y = 15;

    doc.setFontSize(18);
    doc.text("Glidr — Full Data Export", 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, y);
    y += 10;

    doc.setFontSize(13);
    doc.text("Users", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Name", "Email", "Groups", "Role"]],
      body: users.map((u) => [u.name, u.email, u.groupScope, u.isAdmin ? "Admin" : "Member"]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(13);
    doc.text("Groups", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["ID", "Name"]],
      body: apiGroups.map((g) => [g.id, g.name]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }
    doc.setFontSize(13);
    doc.text("Test Ski Series", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Name", "Type", "Brand", "Ski Type", "Skis", "Group"]],
      body: allSeries.map((s: any) => [s.name, s.type, s.brand || "", s.skiType || "", s.numberOfSkis, s.groupScope]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }
    doc.setFontSize(13);
    doc.text("Products", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Brand", "Name", "Type", "Group"]],
      body: allProducts.map((p: any) => [p.brand || "", p.name, p.type, p.groupScope]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }
    doc.setFontSize(13);
    doc.text("Tests", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Date", "Type", "Location", "Series ID", "Notes", "Group"]],
      body: allTests.map((t: any) => [t.date, t.testType, t.location || "", t.seriesId, t.notes || "", t.groupScope]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }
    doc.setFontSize(13);
    doc.text("Weather Logs", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Date", "Time", "Location", "Snow °C", "Air °C", "Snow Hum.", "Air Hum.", "Group"]],
      body: allWeather.map((w: any) => [
        w.date, w.time || "", w.location || "",
        w.snowTemperatureC ?? "", w.airTemperatureC ?? "",
        w.snowHumidityPct ?? "", w.airHumidityPct ?? "",
        w.groupScope,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 15; }
    doc.setFontSize(13);
    doc.text("Login History", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Name", "Email", "IP Address", "Login Time"]],
      body: loginLogs.map((l) => [l.name, l.email, l.ipAddress || "—", new Date(l.loginAt).toLocaleString()]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 },
    });

    doc.save("glidr-full-export.pdf");
    try {
      await apiRequest("POST", "/api/action-log", { action: "pdf_download", details: "Full data export" });
      queryClient.invalidateQueries({ queryKey: ["/api/login-logs"] });
    } catch (_) {}
  }

  const createGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/groups", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setNewGroupName("");
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
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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

  const toggleGrindingMutation = useMutation({
    mutationFn: async ({ userId, value }: { userId: number; value: boolean }) => {
      const res = await apiRequest("PUT", `/api/users/${userId}`, { canAccessGrinding: value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Grinding access updated" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User status updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  if (!user.isAdmin) {
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin</h1>
            <p className="mt-1 text-sm text-gray-500" data-testid="text-admin-subtitle">
              Manage users, groups, and access.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              data-testid="button-download-pdf"
              onClick={downloadFullPdf}
            >
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm" data-testid="admin-tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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

            <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="card-recent-activity">
              <div className="flex items-center gap-2 mb-4">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
              </div>
              {activities.length === 0 ? (
                <p className="text-sm text-gray-400" data-testid="empty-activity">No activity recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {activities.slice(0, 20).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5"
                      data-testid={`row-activity-${a.id}`}
                    >
                      <div className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 mt-0.5">
                        <Activity className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{a.userName}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{a.action}</span>
                          {a.entityType && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">{a.entityType}</span>
                          )}
                        </div>
                        {a.details && <p className="mt-0.5 text-xs text-gray-500 truncate">{a.details}</p>}
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">{new Date(a.createdAt).toLocaleString()}</span>
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
              <h2 className="text-sm font-semibold text-gray-900">Users ({users.length})</h2>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-user" className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    New user
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
                  <CreateUserForm onDone={() => setCreateOpen(false)} groupNames={groupNames} />
                </DialogContent>
              </Dialog>
            </div>

            <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-2">
                {users.map((u) => {
                  const userGroups = parseGroups(u.groupScope);
                  return (
                    <div
                      key={u.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5"
                      data-testid={`row-user-${u.id}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{u.name}</span>
                          {!u.isActive && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-red-200">Inactive</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{u.email}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {userGroups.map((g) => (
                            <span
                              key={g}
                              className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/20"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={cn(
                          "rounded-full border px-3 py-1 text-xs",
                          u.isAdmin ? "border-amber-500/30 bg-amber-50 text-amber-600" : "bg-white"
                        )}>
                          {u.isAdmin ? "Admin" : "Member"}
                        </div>
                        {u.canAccessGrinding ? (
                          <button
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 transition"
                            data-testid={`toggle-grinding-${u.id}`}
                            title="Disable grinding access"
                            onClick={() => toggleGrindingMutation.mutate({ userId: u.id, value: false })}
                          >
                            <Disc3 className="inline h-3 w-3 mr-1" />Grinding
                          </button>
                        ) : (
                          <button
                            className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-medium text-gray-400 hover:bg-gray-100 transition"
                            data-testid={`toggle-grinding-${u.id}`}
                            title="Enable grinding access"
                            onClick={() => toggleGrindingMutation.mutate({ userId: u.id, value: true })}
                          >
                            <Disc3 className="inline h-3 w-3 mr-1" />Grinding
                          </button>
                        )}
                        <button
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
                            u.isActive
                              ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                              : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                          )}
                          data-testid={`toggle-active-${u.id}`}
                          title={u.isActive ? "Deactivate user" : "Activate user"}
                          onClick={() => toggleActiveMutation.mutate({ userId: u.id, value: !u.isActive })}
                        >
                          {u.isActive ? <ToggleRight className="inline h-3 w-3 mr-1" /> : <ToggleLeft className="inline h-3 w-3 mr-1" />}
                          {u.isActive ? "Active" : "Inactive"}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-edit-user-${u.id}`}
                          onClick={() => setEditUser(u)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-reset-user-${u.id}`}
                          onClick={() => setResetUser(u)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-force-logout-${u.id}`}
                          title="Force logout"
                          onClick={() => {
                            if (confirm(`Force logout ${u.name}?`)) {
                              forceLogoutMutation.mutate(u.id);
                            }
                          }}
                        >
                          <LogOut className="h-4 w-4 text-orange-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-delete-user-${u.id}`}
                          disabled={u.id === user.id}
                          onClick={() => {
                            if (confirm(`Delete ${u.name}?`)) {
                              deleteMutation.mutate(u.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(undefined); }}>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
                {editUser && <EditUserForm user={editUser} onDone={() => setEditUser(undefined)} groupNames={groupNames} />}
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
            <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="card-admin-groups">
              <div className="text-sm font-semibold text-gray-900 mb-3">Groups ({apiGroups.length})</div>
              <div className="grid grid-cols-1 gap-2">
                {apiGroups.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5"
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
                        <span className="text-sm text-gray-900">{g.name}</span>
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
                  className="h-8 text-sm"
                  data-testid="input-new-group"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newGroupName.trim()) {
                      createGroupMutation.mutate(newGroupName.trim());
                    }
                  }}
                />
                <Button
                  size="sm"
                  data-testid="button-add-group"
                  disabled={!newGroupName.trim() || createGroupMutation.isPending}
                  onClick={() => createGroupMutation.mutate(newGroupName.trim())}
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
            <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="card-activity-log">
              <div className="flex items-center gap-2 mb-4">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50">
                  <Activity className="h-4 w-4 text-teal-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Activity Log ({activities.length})</h2>
              </div>
              {activities.length === 0 ? (
                <p className="text-sm text-gray-400" data-testid="empty-activity-log">No activity recorded yet.</p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
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
                        <tr key={a.id} className="border-b border-gray-100" data-testid={`row-activitylog-${a.id}`}>
                          <td className="py-2 pr-3 text-xs text-gray-500 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                          <td className="py-2 pr-3 font-medium text-gray-900">{a.userName}</td>
                          <td className="py-2 pr-3">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">{a.action}</span>
                          </td>
                          <td className="py-2 pr-3">
                            {a.entityType && (
                              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">{a.entityType}</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-xs text-gray-500 max-w-[200px] truncate">{a.details || "—"}</td>
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
            <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="card-admin-login-history">
              <div className="flex items-center gap-2 mb-3">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
                  <Clock className="h-4 w-4 text-indigo-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Login History ({loginLogs.length})</h2>
              </div>
              {loginLogs.length === 0 ? (
                <p className="text-sm text-gray-400">No login records yet.</p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                        <th className="pb-2 pr-3">Name</th>
                        <th className="pb-2 pr-3">Email</th>
                        <th className="pb-2 pr-3">Action</th>
                        <th className="pb-2 pr-3">IP Address</th>
                        <th className="pb-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginLogs.slice(0, 200).map((log) => (
                        <tr key={log.id} className="border-b border-gray-100" data-testid={`row-login-${log.id}`}>
                          <td className="py-2 pr-3 font-medium text-gray-900">{log.name}</td>
                          <td className="py-2 pr-3 text-gray-500">{log.email}</td>
                          <td className="py-2 pr-3">
                            {log.action === "login" ? (
                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">Login</span>
                            ) : log.action === "pdf_download" ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                                PDF {log.details ? `— ${log.details}` : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">{log.action}</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs text-gray-500">{log.ipAddress || "—"}</td>
                          <td className="py-2 text-gray-500">
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
      </div>
    </AppShell>
  );
}
