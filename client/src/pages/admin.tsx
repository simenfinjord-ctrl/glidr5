import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
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

type ApiUser = {
  id: number;
  email: string;
  name: string;
  groupScope: string;
  isAdmin: number;
};

const GROUPS = ["Admin", "World Cup", "U23", "Biathlon"];

const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
  groupScope: z.string().min(1, "Group is required"),
  isAdmin: z.boolean(),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  groupScope: z.string().min(1, "Group is required"),
  isAdmin: z.boolean(),
});

const resetSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "password", groupScope: "U23", isAdmin: false },
  });

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
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="groupScope" render={({ field }) => (
            <FormItem>
              <FormLabel>Group</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger data-testid="select-user-group"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
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
        </div>
        <div className="flex justify-end">
          <Button type="submit" data-testid="button-create-user" disabled={mutation.isPending}>Create</Button>
        </div>
      </form>
    </Form>
  );
}

function EditUserForm({ user, onDone }: { user: ApiUser; onDone: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: user.name, email: user.email, groupScope: user.groupScope, isAdmin: !!user.isAdmin },
  });

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
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="groupScope" render={({ field }) => (
            <FormItem>
              <FormLabel>Group</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger data-testid="select-edit-group"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
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
        </div>
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

  const { data: users = [] } = useQuery<ApiUser[]>({
    queryKey: ["/api/users"],
    enabled: !!user && !!user.isAdmin,
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

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-user">
                <Plus className="mr-2 h-4 w-4" />
                New user
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
              <CreateUserForm onDone={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <Card className="fs-card rounded-2xl p-6">
          <div className="text-sm font-semibold">Users ({users.length})</div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/50 px-3 py-2"
                data-testid={`row-user-${u.id}`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email} · Group {u.groupScope}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full border bg-card/70 px-3 py-1 text-xs">
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
            ))}
          </div>
        </Card>

        <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(undefined); }}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
            {editUser && <EditUserForm user={editUser} onDone={() => setEditUser(undefined)} />}
          </DialogContent>
        </Dialog>

        <Dialog open={!!resetUser} onOpenChange={(v) => { if (!v) setResetUser(undefined); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Reset password for {resetUser?.name}</DialogTitle></DialogHeader>
            {resetUser && <ResetPasswordForm user={resetUser} onDone={() => setResetUser(undefined)} />}
          </DialogContent>
        </Dialog>

        <Card className="fs-card rounded-2xl p-6" data-testid="card-admin-groups">
          <div className="text-sm font-semibold">Groups</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {GROUPS.map((g) => (
              <div key={g} className="rounded-full border bg-card/70 px-3 py-1 text-xs">{g}</div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
