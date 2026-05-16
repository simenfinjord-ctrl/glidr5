import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { User, KeyRound, Mail, Users, Shield, Smartphone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useMobileNav } from "@/components/mobile-nav";
import { useI18n } from "@/lib/i18n";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(4, "New password must be at least 4 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Profile() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const mobileNavStore = useMobileNav();
  const [mobileNavOn, setMobileNavOn] = useState(false);
  useEffect(() => { setMobileNavOn(mobileNavStore.get()); }, []);
  const toggleMobileNav = () => {
    const next = !mobileNavOn;
    setMobileNavOn(next);
    mobileNavStore.set(next);
  };

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
      toast({ title: t("account.passwordUpdated") });
      form.reset();
    },
    onError: (e: Error) => {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  const groups = user.groupScope?.split(",").map((s: string) => s.trim()).filter(Boolean) || [];

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-profile-title">{t("profile.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("profile.subtitle")}</p>
        </div>

        <Card className="fs-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center">
              <User className="h-6 w-6 text-green-600" />
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
                    <span key={g} className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">{g}</span>
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
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground">Display preferences</div>
              <div className="text-xs text-muted-foreground">Appearance settings for this device</div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
            <div>
              <div className="text-sm font-medium">{t("profile.mobileNav")}</div>
              <div className="text-xs text-muted-foreground">{t("profile.mobileNavToggle")}</div>
            </div>
            <button
              onClick={toggleMobileNav}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none ${mobileNavOn ? "bg-primary" : "bg-muted-foreground/30"}`}
              role="switch"
              aria-checked={mobileNavOn}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${mobileNavOn ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </Card>

        <Card className="fs-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground">{t("profile.changePassword")}</div>
              <div className="text-xs text-muted-foreground">{t("profile.updateCredentials")}</div>
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
