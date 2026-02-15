import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2, KeyRound, Check, X, Clock, Download } from "lucide-react";
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
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  groupScope: z.string().min(1, "At least one group is required"),
  isAdmin: z.boolean(),
});

const resetSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

function CreateUserForm({ onDone, groupNames }: { onDone: () => void; groupNames: string[] }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "password", groupScope: groupNames[0] || "", isAdmin: false },
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
    defaultValues: { name: user.name, email: user.email, groupScope: user.groupScope, isAdmin: !!user.isAdmin },
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

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<ApiUser | undefined>();
  const [resetUser, setResetUser] = useState<ApiUser | undefined>();
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<ApiGroup | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  const { data: users = [] } = useQuery<ApiUser[]>({
    queryKey: ["/api/users"],
    enabled: !!user && !!user.isAdmin,
  });

  const { data: apiGroups = [] } = useQuery<ApiGroup[]>({
    queryKey: ["/api/groups"],
    enabled: !!user && !!user.isAdmin,
  });

  const { data: loginLogs = [] } = useQuery<LoginLog[]>({
    queryKey: ["/api/login-logs"],
    enabled: !!user && !!user.isAdmin,
  });

  const { data: allSeries = [] } = useQuery<any[]>({
    queryKey: ["/api/series"],
    enabled: !!user && !!user.isAdmin,
  });

  const { data: allProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    enabled: !!user && !!user.isAdmin,
  });

  const { data: allTests = [] } = useQuery<any[]>({
    queryKey: ["/api/tests"],
    enabled: !!user && !!user.isAdmin,
  });

  const { data: allWeather = [] } = useQuery<any[]>({
    queryKey: ["/api/weather"],
    enabled: !!user && !!user.isAdmin,
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

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-admin-subtitle">
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
        </div>

        <Card className="fs-card rounded-2xl p-6">
          <div className="text-sm font-semibold">Users ({users.length})</div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {users.map((u) => {
              const userGroups = parseGroups(u.groupScope);
              return (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/50 px-3 py-2"
                  data-testid={`row-user-${u.id}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{u.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{u.email}</div>
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
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "rounded-full border px-3 py-1 text-xs",
                      u.isAdmin ? "border-amber-500/30 bg-amber-50 text-amber-600" : "bg-white"
                    )}>
                      {u.isAdmin ? "Admin" : "Member"}
                    </div>
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

        <Card className="fs-card rounded-2xl p-6" data-testid="card-admin-groups">
          <div className="text-sm font-semibold">Groups ({apiGroups.length})</div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {apiGroups.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-xl border bg-background/50 px-3 py-2"
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
                    <span className="text-sm">{g.name}</span>
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

        <Card className="fs-card rounded-2xl p-6" data-testid="card-admin-login-history">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="text-sm font-semibold">Login History ({loginLogs.length})</div>
          </div>
          {loginLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No login records yet.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3">Name</th>
                    <th className="pb-2 pr-3">Email</th>
                    <th className="pb-2 pr-3">Action</th>
                    <th className="pb-2 pr-3">IP Address</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {loginLogs.slice(0, 200).map((log) => (
                    <tr key={log.id} className="border-b border-border/20" data-testid={`row-login-${log.id}`}>
                      <td className="py-2 pr-3 font-medium">{log.name}</td>
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
    </AppShell>
  );
}
