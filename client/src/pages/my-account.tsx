import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Watch, RefreshCw, Copy, Check, KeyRound, Mail, Users, Shield, Smartphone, Eye, EyeOff, ToggleLeft, ToggleRight, AtSign, Pencil } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMobileNav } from "@/components/mobile-nav";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

function PlanChangeSection() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [requestedPlan, setRequestedPlan] = useState("team");
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentPlan = (user as any)?.team?.planName ?? (user as any)?.planName ?? "free";

  const PLANS = [
    { value: "free", label: "Free — €0" },
    { value: "starter", label: "Starter — €25/mo" },
    { value: "team", label: "Team — €79/mo" },
    { value: "pro", label: "Pro — €149/mo" },
    { value: "enterprise", label: "Federation / Enterprise" },
  ];

  async function submit() {
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/account/plan-change-request", { requestedPlan, billingPeriod, notes });
      if (!res.ok) throw new Error();
      toast({ title: t("account.planChangeSent"), description: t("account.planChangeSentDesc") });
      setOpen(false);
      setNotes("");
    } catch {
      toast({ title: t("common.error"), description: "Something went wrong. Contact us at hei@glidr.no", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{t("account.subscription")}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("account.currentPlan")}: <strong className="text-foreground capitalize">{currentPlan}</strong>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t("account.requestPlanChange")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("account.requestPlanChange")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("account.desiredPlan")}</label>
              <Select value={requestedPlan} onValueChange={setRequestedPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("account.billing")}</label>
              <div className="flex gap-4">
                {[{ value: "monthly", label: t("account.monthly") }, { value: "annual", label: t("account.annual") }].map(o => (
                  <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="bp" value={o.value} checked={billingPeriod === o.value} onChange={() => setBillingPeriod(o.value)} className="accent-foreground" />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("account.noteOptional")}</label>
              <textarea className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background resize-none focus:outline-none"
                rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything we should know?" />
            </div>
            <p className="text-xs text-muted-foreground">{t("account.planChangeNote")}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? t("common.sending") : t("common.send")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TwoFactorSection() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, refetch } = useQuery<{ enabled: boolean; hasSecret: boolean }>({
    queryKey: ["/api/auth/2fa/status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/2fa/status", { credentials: "include" });
      return res.json();
    },
  });

  // Setup flow state
  const [setupOpen, setSetupOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Disable flow state
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableSubmitting, setDisableSubmitting] = useState(false);

  async function startSetup() {
    const res = await fetch("/api/auth/2fa/setup", { credentials: "include" });
    const data = await res.json();
    setQrDataUrl(data.qrDataUrl);
    setManualEntry(data.manualEntry);
    setSetupOpen(true);
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setSetupError(null);
    setSetupSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/2fa/enable", { code: setupCode });
      const data = await res.json();
      if (!res.ok) { setSetupError(data.message); return; }
      setBackupCodes(data.backupCodes);
      refetch();
    } catch {
      setSetupError("Something went wrong.");
    } finally {
      setSetupSubmitting(false);
    }
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisableError(null);
    setDisableSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/2fa/disable", { password: disablePassword, code: disableCode });
      const data = await res.json();
      if (!res.ok) { setDisableError(data.message); return; }
      toast({ title: t("account.twoFactorDisable") });
      setDisableOpen(false);
      setDisablePassword("");
      setDisableCode("");
      refetch();
    } catch {
      setDisableError("Something went wrong.");
    } finally {
      setDisableSubmitting(false);
    }
  }

  return (
    <Card className="rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{t("account.twoFactor")}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {status?.enabled
              ? t("account.twoFactorEnabled")
              : "Add an extra layer of security to your Super Admin account."}
          </p>
        </div>
        <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status?.enabled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
          {status?.enabled ? "Enabled" : "Disabled"}
        </div>
      </div>

      <div className="flex gap-2">
        {!status?.enabled && (
          <Button size="sm" onClick={startSetup}>{t("account.twoFactorSetup")}</Button>
        )}
        {status?.enabled && (
          <Button size="sm" variant="destructive" onClick={() => setDisableOpen(true)}>{t("account.twoFactorDisable")}</Button>
        )}
      </div>

      {/* Setup dialog */}
      <Dialog open={setupOpen} onOpenChange={(o) => { if (!o) { setSetupOpen(false); setBackupCodes(null); setSetupCode(""); setQrDataUrl(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{backupCodes ? t("account.backupCodes") : t("account.twoFactorSetup")}</DialogTitle>
          </DialogHeader>

          {!backupCodes ? (
            <form onSubmit={confirmEnable} className="space-y-5 pt-2">
              <p className="text-sm text-muted-foreground">{t("account.twoFactorScanQr")}</p>
              {qrDataUrl && (
                <div className="flex justify-center">
                  <img src={qrDataUrl} alt="2FA QR Code" className="rounded-xl border border-border" />
                </div>
              )}
              {manualEntry && (
                <div className="rounded-lg bg-muted px-3 py-2 text-xs font-mono text-center break-all">
                  {manualEntry}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("account.twoFactorCode")}</label>
                <input
                  autoFocus
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("account.twoFactorCodePlaceholder")}
                  maxLength={6}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              {setupError && <p className="text-sm text-red-500">{setupError}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setSetupOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={setupSubmitting || setupCode.length < 6}>
                  {setupSubmitting ? t("account.twoFactorVerifying") : t("account.twoFactorVerify")}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 text-sm text-amber-800 dark:text-amber-300">
                <strong>Save these backup codes now.</strong> Each code can only be used once. Store them somewhere safe — you'll need them if you lose access to your authenticator app.
              </div>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code) => (
                  <div key={code} className="rounded-lg bg-muted px-3 py-2 text-sm font-mono text-center">{code}</div>
                ))}
              </div>
              <Button className="w-full" onClick={() => { setSetupOpen(false); setBackupCodes(null); toast({ title: t("account.twoFactorEnabled2"), description: "Your account is now protected with two-factor authentication." }); }}>
                I've saved my backup codes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable dialog */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("account.twoFactorDisable")}</DialogTitle></DialogHeader>
          <form onSubmit={confirmDisable} className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">{t("account.twoFactorDisableDesc")}</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("account.currentPassword")}</label>
              <input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("account.twoFactorCode")}</label>
              <input value={disableCode} onChange={(e) => setDisableCode(e.target.value)}
                placeholder="000000"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-foreground/20" />
            </div>
            {disableError && <p className="text-sm text-red-500">{disableError}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDisableOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" variant="destructive" disabled={disableSubmitting}>
                {disableSubmitting ? "Disabling…" : t("account.twoFactorDisable")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function MyAccount() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lang, setLang } = useLanguage();

  // Watch code
  const [copied, setCopied] = useState(false);

  // Username form
  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const changeUsernameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/users/me/username", { username: newUsername.trim() });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Username updated" }); // no dedicated i18n key; keep as-is
      setShowUsernameForm(false);
      setNewUsername("");
      setUsernameError("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (e: Error) => {
      setUsernameError(e.message || "Failed to update username");
    },
  });

  // Password form
  const [showPassForm, setShowPassForm] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passError, setPassError] = useState("");

  // Admin mode toggle (super admin only)
  const [adminMode, setAdminMode] = useState<boolean>(() => {
    try { return localStorage.getItem("glidr-sa-admin-mode") === "true"; } catch { return false; }
  });

  // Mobile nav toggle
  const mobileNavStore = useMobileNav();
  const [mobileNavOn, setMobileNavOn] = useState(false);
  useEffect(() => { setMobileNavOn(mobileNavStore.get()); }, []);
  const toggleMobileNav = () => {
    const next = !mobileNavOn;
    setMobileNavOn(next);
    mobileNavStore.set(next);
  };

  const { data: watchCodeData, isLoading: watchCodeLoading } = useQuery<{ watchCode: string }>({
    queryKey: ["/api/auth/my-watch-code"],
    enabled: !!user,
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/my-watch-code/regenerate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-watch-code"] });
      toast({ title: "Watch code regenerated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: currentPass,
        newPassword: newPass,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("account.passwordUpdated") });
      setShowPassForm(false);
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
      setPassError("");
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const handleSavePassword = () => {
    if (newPass.length < 7) {
      setPassError("New password must be at least 7 characters");
      return;
    }
    if (!/[0-9]/.test(newPass)) {
      setPassError("Password must contain at least one number");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPass)) {
      setPassError("Password must contain at least one special character");
      return;
    }
    if (newPass !== confirmPass) {
      setPassError("Passwords don't match");
      return;
    }
    setPassError("");
    changePasswordMutation.mutate();
  };

  const handleCopy = () => {
    if (watchCodeData?.watchCode) {
      navigator.clipboard.writeText(watchCodeData.watchCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!user) return null;

  const groups = user.groupScope?.split(",").map((s: string) => s.trim()).filter(Boolean) || [];
  const isTeamAdmin = !!(user as any).isTeamAdmin;
  const roleLabel = user.isAdmin ? t("account.admin") : user.isTeamAdmin ? t("account.teamAdmin") : t("account.member");

  return (
    <AppShell>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl sm:text-3xl flex items-center gap-3" data-testid="text-my-account-title">
          <User className="h-7 w-7 text-blue-500" />
          {t("account.title")}
        </h1>

        {/* Profile */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("account.profile")}</h2>

          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">{t("account.name")}</div>
              <div className="text-sm font-medium" data-testid="text-profile-name">{user.name}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">{t("account.email")}</div>
              <div className="text-sm font-medium" data-testid="text-profile-email">{user.email}</div>
            </div>
          </div>

          {/* Username */}
          <div className="rounded-xl bg-muted/50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AtSign className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Username</div>
                  <div className="text-sm font-medium" data-testid="text-profile-username">{user.username || <span className="text-muted-foreground italic">not set</span>}</div>
                </div>
              </div>
              {!showUsernameForm && (
                <Button variant="ghost" size="sm" onClick={() => { setNewUsername(user.username || ""); setShowUsernameForm(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Change
                </Button>
              )}
            </div>
            {showUsernameForm && (
              <div className="mt-3 space-y-2">
                <Input
                  value={newUsername}
                  onChange={(e) => { setNewUsername(e.target.value); setUsernameError(""); }}
                  placeholder="e.g. johndoe"
                  autoComplete="username"
                  data-testid="input-new-username"
                />
                {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
                <p className="text-xs text-muted-foreground">Letters, numbers, dots, underscores and dashes only.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setShowUsernameForm(false); setUsernameError(""); }}>{t("common.cancel")}</Button>
                  <Button size="sm" onClick={() => changeUsernameMutation.mutate()} disabled={changeUsernameMutation.isPending || !newUsername.trim()}>
                    {changeUsernameMutation.isPending ? t("common.saving") : t("common.save")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {groups.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-muted-foreground mb-1">{t("account.groups")}</div>
                <div className="flex flex-wrap gap-1">
                  {groups.map((g: string) => (
                    <span key={g} className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-800">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">{t("account.role")}</div>
              <div className="text-sm font-medium">{roleLabel}</div>
            </div>
          </div>
        </Card>

        {/* Display preferences */}
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Display preferences
          </h2>
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
            <div>
              <div className="text-sm font-medium">{t("account.mobileNav")}</div>
              <div className="text-xs text-muted-foreground">{t("account.mobileNavDesc")}</div>
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

        {/* Admin Mode (super admin only) */}
        {user.isAdmin === 1 && (
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-500" />
              Admin Settings
            </h2>
            <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
              <div>
                <div className="text-sm font-medium">Admin Mode</div>
                <div className="text-xs text-muted-foreground">Show the Overview nav item and admin-only UI</div>
              </div>
              <button
                type="button"
                data-testid="button-admin-mode-toggle"
                onClick={() => {
                  const next = !adminMode;
                  setAdminMode(next);
                  try { localStorage.setItem("glidr-sa-admin-mode", String(next)); } catch {}
                  toast({ title: next ? "Admin Mode ON" : "Admin Mode OFF", description: next ? "Overview nav item is now visible." : "Overview nav item hidden." });
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                  adminMode
                    ? "border-purple-300 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                )}
              >
                {adminMode
                  ? <ToggleRight className="h-3.5 w-3.5 text-purple-600" />
                  : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                {adminMode ? "Admin Mode ON" : "Admin Mode"}
              </button>
            </div>
          </Card>
        )}

        {/* Change password */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {t("account.changePassword")}
            </h2>
            {!showPassForm && (
              <Button variant="outline" size="sm" onClick={() => setShowPassForm(true)}>
                {t("account.changePassword")}
              </Button>
            )}
          </div>

          {showPassForm && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("account.currentPassword")}</label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder={t("account.currentPassword")}
                    data-testid="input-current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("account.newPassword")}</label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder={t("account.newPassword")}
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("account.confirmPassword")}</label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder={t("account.confirmPassword")}
                    data-testid="input-confirm-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {passError && (
                <p className="text-xs text-destructive">{passError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPassForm(false);
                    setCurrentPass("");
                    setNewPass("");
                    setConfirmPass("");
                    setPassError("");
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  disabled={!currentPass || !newPass || !confirmPass || changePasswordMutation.isPending}
                  onClick={handleSavePassword}
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* My Watch Code */}
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Watch className="h-4 w-4 text-sky-500" />
            My Watch Code
          </h2>
          <p className="text-sm text-muted-foreground">
            Enter this 4-digit code on your Garmin watch to identify yourself. Your name will then appear in Live Runsheet and runsheet history.
          </p>

          {watchCodeLoading ? (
            <div className="h-12 bg-muted/50 rounded-lg animate-pulse" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-lg border border-border bg-muted/30 px-4 py-3 text-2xl font-mono font-bold tracking-[0.3em] text-center">
                {watchCodeData?.watchCode ?? "—"}
              </div>
              <button
                onClick={handleCopy}
                title="Copy"
                className="p-2 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                onClick={() => {
                  if (confirm("Generate a new watch code? Your old code will stop working.")) {
                    regenerateMutation.mutate();
                  }
                }}
                disabled={regenerateMutation.isPending}
                title="Regenerate code"
                className="p-2 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}

          <p className="text-xs text-muted-foreground/60">
            Keep this code private. If it's compromised, regenerate it.
          </p>
        </Card>

        {/* Two-factor authentication (super admin only) */}
        {user?.isAdmin === 1 && <TwoFactorSection />}

        {/* Language preference */}
        <Card className="rounded-2xl p-6 space-y-3">
          <h3 className="font-semibold">{t("account.language")}</h3>
          <p className="text-sm text-muted-foreground">{t("account.languageDesc")}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setLang("en")}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${lang === "en" ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}
            >
              {t("account.english")}
            </button>
            <button
              onClick={() => setLang("no")}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${lang === "no" ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}
            >
              {t("account.norwegian")}
            </button>
          </div>
        </Card>

        {/* Plan change request - team admins only */}
        {isTeamAdmin && !user?.isAdmin && (
          <PlanChangeSection />
        )}

        {/* Danger zone */}
        <Card className="rounded-2xl p-5 sm:p-6 border-red-200 dark:border-red-900/50">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-red-500" />
            <h2 className="text-base font-semibold">Danger zone</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Deleting your account anonymises all your personal data in accordance with GDPR. Test data entered by your account remains (attributed to "Deleted User") to preserve your team's records. This cannot be undone.
          </p>
          <DeleteAccountButton />
        </Card>
      </div>
    </AppShell>
  );
}

function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const { toast } = useToast();

  async function handleDelete() {
    if (inputVal !== "DELETE") return;
    try {
      await apiRequest("POST", "/api/account/delete", {});
      window.location.href = "/login";
    } catch {
      toast({ title: "Error", description: "Could not delete account. Contact support.", variant: "destructive" });
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        Delete my account
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4 space-y-3">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">Type <strong>DELETE</strong> to confirm:</p>
      <Input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        placeholder="DELETE"
        className="border-red-300 focus-visible:ring-red-400 font-mono"
      />
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={inputVal !== "DELETE"}
          className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
        >
          Permanently delete
        </button>
        <button onClick={() => { setConfirming(false); setInputVal(""); }} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
