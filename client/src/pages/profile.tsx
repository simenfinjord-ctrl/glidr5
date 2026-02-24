import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { User, KeyRound, Mail, Users, Shield, Globe } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);

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

  const languageMutation = useMutation({
    mutationFn: async (language: string) => {
      const res = await apiRequest("PUT", "/api/users/me/language", { language });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: t("profile.language"), description: "Language updated" });
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-profile-title">{t("profile.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("profile.subtitle")}</p>
        </div>

        <Card className="fs-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900" data-testid="text-profile-name">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.isAdmin ? "Administrator" : "Member"}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="text-sm font-medium" data-testid="text-profile-email">{user.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <Users className="h-4 w-4 text-gray-400" />
              <div>
                <div className="text-xs text-muted-foreground">Groups</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {groups.map((g: string) => (
                    <span key={g} className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">{g}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <Shield className="h-4 w-4 text-gray-400" />
              <div>
                <div className="text-xs text-muted-foreground">Role</div>
                <div className="text-sm font-medium">{user.isAdmin ? "Admin" : "Member"}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="fs-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-base font-semibold text-gray-900">Change Password</div>
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
        <Card className="fs-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
              <Globe className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">{t("profile.language")}</div>
              <div className="text-xs text-muted-foreground">{t("profile.selectLanguage")}</div>
            </div>
          </div>
          <Select
            value={user.language || "en"}
            onValueChange={(v) => languageMutation.mutate(v)}
          >
            <SelectTrigger data-testid="select-language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="no">Norsk</SelectItem>
            </SelectContent>
          </Select>
        </Card>
      </div>
    </AppShell>
  );
}
