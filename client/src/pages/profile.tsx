import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { User, KeyRound, Mail, Users, Shield, Watch, Link2, Unlink, CheckCircle2, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(4, "New password must be at least 4 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [garminConnecting, setGarminConnecting] = useState(false);

  const { data: garminStatus, refetch: refetchGarmin } = useQuery<{ connected: boolean; garminUserId: string | null }>({
    queryKey: ["/api/garmin/status"],
    queryFn: async () => {
      const res = await fetch("/api/garmin/status", { credentials: "include" });
      if (!res.ok) return { connected: false, garminUserId: null };
      return res.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("garmin") === "connected") {
      toast({ title: "Garmin connected", description: "Your Garmin account has been linked successfully." });
      refetchGarmin();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.history.replaceState({}, "", "/profile");
    } else if (params.get("garmin") === "error") {
      toast({ title: "Garmin connection failed", description: "Could not link your Garmin account. Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", "/profile");
    }
  }, []);

  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordSchema>) => {
      const res = await apiRequest("POST", "/api/users/me/password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      form.reset();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const connectGarmin = async () => {
    setGarminConnecting(true);
    try {
      const res = await apiRequest("GET", "/api/garmin/auth");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "Error", description: data.message || "Could not start Garmin connection", variant: "destructive" });
        setGarminConnecting(false);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Garmin connection failed", variant: "destructive" });
      setGarminConnecting(false);
    }
  };

  const disconnectGarmin = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/garmin/disconnect");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Garmin disconnected" });
      refetchGarmin();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  const groups = user.groupScope?.split(",").map((s: string) => s.trim()).filter(Boolean) || [];

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-profile-title">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your account information and settings</p>
        </div>

        <Card className="fs-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground" data-testid="text-profile-name">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.isAdmin ? "Administrator" : "Member"}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="text-sm font-medium" data-testid="text-profile-email">{user.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Groups</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {groups.map((g: string) => (
                    <span key={g} className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">{g}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Role</div>
                <div className="text-sm font-medium">{user.isAdmin ? "Admin" : "Member"}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="fs-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
              <Watch className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground">Garmin Connect</div>
              <div className="text-xs text-muted-foreground">Link your Garmin account for watch integration</div>
            </div>
          </div>

          {garminStatus?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-green-50 dark:bg-green-900/20 px-4 py-3 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-green-800 dark:text-green-200" data-testid="text-garmin-connected">Connected</div>
                  <div className="text-xs text-green-600 dark:text-green-400">Garmin ID: {garminStatus.garminUserId}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectGarmin.mutate()}
                  disabled={disconnectGarmin.isPending}
                  data-testid="button-garmin-disconnect"
                  className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  <Unlink className="mr-1 h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
              <p className="text-xs text-muted-foreground px-1">
                Your watch will automatically connect to runsheet sessions without entering a code.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your Garmin account to automatically sync runsheet sessions to your watch. No more manual code entry.
              </p>
              <Button
                onClick={connectGarmin}
                disabled={garminConnecting}
                data-testid="button-garmin-connect"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {garminConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" />
                )}
                Connect Garmin Account
              </Button>
            </div>
          )}
        </Card>

        <Card className="fs-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground">Change Password</div>
              <div className="text-xs text-muted-foreground">Update your login credentials</div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="currentPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl><Input {...field} type={showPassword ? "text" : "password"} data-testid="input-current-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="newPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl><Input {...field} type={showPassword ? "text" : "password"} data-testid="input-new-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl><Input {...field} type={showPassword ? "text" : "password"} data-testid="input-confirm-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} className="rounded" />
                  Show passwords
                </label>
                <Button type="submit" data-testid="button-change-password" disabled={mutation.isPending}>
                  Change Password
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </AppShell>
  );
}
