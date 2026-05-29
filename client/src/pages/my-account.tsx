// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Watch, RefreshCw, Copy, Check, KeyRound, Mail, Users, Shield, Smartphone, Eye, EyeOff, ToggleLeft, ToggleRight, AtSign, Pencil, Trash2, UserPlus, PanelLeft, PanelTop, Camera } from "lucide-react";
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
import { getNavLayout, setNavLayout, type NavLayout } from "@/lib/nav-layout";
import { type AccentColor, ACCENT_COLORS, ACCENT_NAV, getAccentColor, setAccentColor } from "@/lib/accent-color";
import { cn, setGlidrDateFormat } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useAppSettings } from "@/lib/app-settings";
import { resetTour } from "@/components/product-tour";

// ─── Preset avatars ────────────────────────────────────────────────────────────
const PRESET_AVATARS = [
  // Row 1 — original 5
  "https://api.dicebear.com/7.x/adventurer/svg?seed=alpine",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=nordic",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=glacier",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=summit",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=telemark",
  // Row 2 — 5 more
  "https://api.dicebear.com/7.x/adventurer/svg?seed=slalom",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=freeride",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=mogul",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=downhill",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=biathlon",
  // Row 3 — 5 more
  "https://api.dicebear.com/7.x/adventurer/svg?seed=powder",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=couloir",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=traverse",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=carving",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=skijump",
  // Row 4 — 5 more
  "https://api.dicebear.com/7.x/adventurer/svg?seed=snowplow",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=schuss",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=herringbone",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=kickturn",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=langlauf",
];

// ─── Section IDs ───────────────────────────────────────────────────────────────
type Section = "profile" | "security" | "preferences" | "language" | "watch" | "sessions" | "subscription" | "teamadmin" | "dangerzone";

// ─── Avatar section ────────────────────────────────────────────────────────────
function AvatarSection() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>((user as any)?.avatarUrl ?? null);

  const saveMutation = useMutation({
    mutationFn: async (avatarUrl: string | null) => {
      const res = await apiRequest("PUT", "/api/auth/me/avatar", { avatarUrl });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("account.avatarSaved") });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("account.avatarTooLarge"), variant: "destructive" });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      toast({ title: t("account.avatarTooLarge"), variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (dataUrl.length > 200 * 1024 * 1.37) {
        toast({ title: t("account.avatarTooLarge"), variant: "destructive" });
        return;
      }
      setSelected(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  const currentAvatar = (user as any)?.avatarUrl;

  return (
    <Card className="rounded-2xl p-6 space-y-4">
      <div>
        <h3 className="font-semibold">{t("account.avatar")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("account.avatarDesc")}</p>
      </div>

      {/* Current avatar preview */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full overflow-hidden border border-border shrink-0 bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
          {(selected || currentAvatar) ? (
            <img
              src={selected ?? currentAvatar}
              alt="avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-white font-bold text-lg">
              {(user?.name ?? "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            {t("account.avatarUpload")}
          </Button>
          {(selected || currentAvatar) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setSelected(null)}
            >
              {t("account.avatarRemove")}
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Preset avatars */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t("account.avatarPreset")}</p>
        <div className="flex gap-2 flex-wrap">
          {PRESET_AVATARS.map((url) => (
            <button
              key={url}
              onClick={() => setSelected(url)}
              className={cn(
                "h-11 w-11 rounded-full overflow-hidden border-2 transition-all",
                selected === url
                  ? "border-green-600 ring-2 ring-green-600/30"
                  : "border-border hover:border-foreground/40"
              )}
            >
              <img src={url} alt="preset avatar" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      <Button
        size="sm"
        disabled={saveMutation.isPending || selected === currentAvatar}
        onClick={() => saveMutation.mutate(selected)}
      >
        {saveMutation.isPending ? t("account.avatarSaving") : t("account.avatarSave")}
      </Button>
    </Card>
  );
}

// ─── Invite members section ────────────────────────────────────────────────────
function InviteMembersSection() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const { data: invitations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/invitations"],
    queryFn: async () => {
      const res = await fetch("/api/invitations", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/invitations", { email });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: t("common.error"), description: data.message || "Failed to send invitation.", variant: "destructive" });
        return;
      }
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({ title: t("account.inviteSent") });
    } catch {
      toast({ title: t("common.error"), description: "Failed to send invitation.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(id: number) {
    try {
      const res = await apiRequest("DELETE", `/api/invitations/${id}`, undefined);
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
    } catch {
      toast({ title: t("common.error"), description: "Failed to revoke invitation.", variant: "destructive" });
    }
  }

  return (
    <Card className="rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">{t("account.inviteMembers")}</h3>
      </div>

      <form onSubmit={handleInvite} className="flex gap-2">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("account.inviteEmail")}
          className="flex-1"
        />
        <Button type="submit" disabled={sending} size="sm">
          {sending ? t("account.inviteSending") : t("account.inviteSend")}
        </Button>
      </form>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{t("account.invitePending")}</p>
        {isLoading ? (
          <div className="h-8 bg-muted/40 rounded animate-pulse" />
        ) : invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("account.inviteNone")}</p>
        ) : (
          <ul className="space-y-2">
            {invitations.map((inv: any) => (
              <li key={inv.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{inv.email}</span>
                  <span className={`text-xs mt-0.5 ${inv.accepted_at ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                    {inv.accepted_at ? t("account.inviteStatusAccepted") : t("account.inviteStatusPending")}
                  </span>
                </div>
                {!inv.accepted_at && (
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    className="ml-2 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                    title={t("account.inviteRevoke")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

// ─── Plan change section ────────────────────────────────────────────────────────
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

  const { data: planPrices } = useQuery<Record<string, number | null>>({
    queryKey: ["/api/settings/plan-prices"],
    queryFn: async () => {
      const res = await fetch("/api/settings/plan-prices");
      return res.ok ? res.json() : {};
    },
    staleTime: 60_000,
  });

  const PLANS = [
    { value: "free", label: `Free — ${(planPrices?.free ?? 0).toLocaleString("no-NO")} ${t("account.planPriceUnit")}` },
    { value: "starter", label: `Starter — ${planPrices?.starter != null ? planPrices.starter.toLocaleString("no-NO") + " " + t("account.planPriceMonthly") : "—"}` },
    { value: "team", label: `Team — ${planPrices?.team != null ? planPrices.team.toLocaleString("no-NO") + " " + t("account.planPriceMonthly") : "—"}` },
    { value: "pro", label: `Pro — ${planPrices?.pro != null ? planPrices.pro.toLocaleString("no-NO") + " " + t("account.planPriceMonthly") : "—"}` },
    { value: "enterprise", label: "Enterprise / Federation" },
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

// ─── Two-factor section ────────────────────────────────────────────────────────
function TwoFactorSection() {
  const { t } = useI18n();
  const { toast } = useToast();

  const { data: status, refetch } = useQuery<{ enabled: boolean; hasSecret: boolean }>({
    queryKey: ["/api/auth/2fa/status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/2fa/status", { credentials: "include" });
      return res.json();
    },
  });

  const [setupOpen, setSetupOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

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
            {status?.enabled ? t("account.twoFactorEnabled") : t("account.twoFactorSecurityDesc")}
          </p>
        </div>
        <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status?.enabled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
          {status?.enabled ? t("account.twoFactorStatus") : t("account.twoFactorStatusDisabled")}
        </div>
      </div>

      <div className="flex gap-2">
        {!status?.enabled && <Button size="sm" onClick={startSetup}>{t("account.twoFactorSetup")}</Button>}
        {status?.enabled && <Button size="sm" variant="destructive" onClick={() => setDisableOpen(true)}>{t("account.twoFactorDisable")}</Button>}
      </div>

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
                <div className="rounded-lg bg-muted px-3 py-2 text-xs font-mono text-center break-all">{manualEntry}</div>
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
                <strong>{t("account.twoFactorBackupSave")}</strong> {t("account.twoFactorBackupDesc")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code) => (
                  <div key={code} className="rounded-lg bg-muted px-3 py-2 text-sm font-mono text-center">{code}</div>
                ))}
              </div>
              <Button className="w-full" onClick={() => { setSetupOpen(false); setBackupCodes(null); toast({ title: t("account.twoFactorEnabled2"), description: t("account.twoFactorEnabledDesc") }); }}>
                {t("account.twoFactorBackupSaved")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                {disableSubmitting ? t("account.twoFactorDisabling") : t("account.twoFactorDisable")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Active sessions section ────────────────────────────────────────────────────
interface SessionInfo {
  sid: string;
  isCurrent: boolean;
  ipAddress: string;
  userAgent: string;
  loginAt: string | null;
  expiresAt: string;
}

function parseBrowserName(ua: string): string {
  if (!ua || ua === "unknown") return "Unknown device";
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) return "Mobile";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  return "Desktop";
}

function ActiveSessionsSection() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sessions, isLoading } = useQuery<SessionInfo[]>({
    queryKey: ["/api/auth/my-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-sessions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (sid: string) => {
      const res = await fetch(`/api/auth/sessions/${encodeURIComponent(sid)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to revoke session");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-sessions"] });
      toast({ title: t("account.revokeSession") });
    },
    onError: (e: Error) => {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    },
  });

  return (
    <Card className="rounded-2xl p-6 space-y-4">
      <h3 className="font-semibold">{t("account.activeSessions")}</h3>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />)}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("account.sessionNoInfo")}</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.sid} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{parseBrowserName(session.userAgent)}</span>
                  {session.isCurrent && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      {t("account.thisDevice")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {session.ipAddress !== "unknown" ? session.ipAddress : "—"}
                  {session.loginAt && <> &middot; {new Date(session.loginAt).toLocaleString()}</>}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={session.isCurrent || revokeMutation.isPending}
                title={session.isCurrent ? t("account.sessionsCurrent") : t("account.revokeSession")}
                onClick={() => revokeMutation.mutate(session.sid)}
                className={session.isCurrent ? "opacity-40 cursor-not-allowed" : ""}
              >
                {t("account.revokeSession")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Delete account button ──────────────────────────────────────────────────────
function DeleteAccountButton() {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const { toast } = useToast();

  async function handleDelete() {
    if (inputVal !== "DELETE") return;
    try {
      await apiRequest("POST", "/api/account/delete", {});
      window.location.href = "/login";
    } catch {
      toast({ title: t("common.error"), description: "Could not delete account. Contact support.", variant: "destructive" });
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        {t("account.deleteAccount")}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4 space-y-3">
      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
        Your tests, products, and weather data will remain accessible to your team. Only your personal account info will be removed.
      </div>
      <p className="text-sm font-medium text-red-700 dark:text-red-400">{t("account.deleteConfirmLabel")} <strong>DELETE</strong></p>
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
          {t("account.deleteConfirmPermanent")}
        </button>
        <button onClick={() => { setConfirming(false); setInputVal(""); }} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

// ─── Download my data button ────────────────────────────────────────────────────
function DownloadMyDataButton() {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch("/api/users/me/data-export", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to export data");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "glidr-my-data.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Could not download data. Try again later.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
      {downloading ? "Downloading…" : "Download my data"}
    </Button>
  );
}

// ─── Left nav items ─────────────────────────────────────────────────────────────
interface NavItem {
  id: Section;
  labelKey: string;
  icon: React.ElementType;
  condition?: boolean;
}

// ─── Main page ──────────────────────────────────────────────────────────────────
export default function MyAccount() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lang, setLang } = useLanguage();

  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [copied, setCopied] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [pinRegenerating, setPinRegenerating] = useState(false);

  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const { commercializationEnabled } = useAppSettings();

  const changeUsernameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/users/me/username", { username: newUsername.trim() });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("account.usernameUpdated") });
      setShowUsernameForm(false);
      setNewUsername("");
      setUsernameError("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (e: Error) => {
      setUsernameError(e.message || "Failed to update username");
    },
  });

  const [showPassForm, setShowPassForm] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passError, setPassError] = useState("");

  const [adminMode, setAdminMode] = useState<boolean>(() => {
    try { return localStorage.getItem("glidr-sa-admin-mode") === "true"; } catch { return false; }
  });

  const mobileNavStore = useMobileNav();
  const [mobileNavOn, setMobileNavOn] = useState(false);
  useEffect(() => { setMobileNavOn(mobileNavStore.get()); }, []);
  const toggleMobileNav = () => {
    const next = !mobileNavOn;
    setMobileNavOn(next);
    mobileNavStore.set(next);
  };

  const [currentNavLayout, setCurrentNavLayout] = useState<NavLayout>(() => getNavLayout());
  const toggleNavLayout = (layout: NavLayout) => {
    setCurrentNavLayout(layout);
    setNavLayout(layout);
    window.dispatchEvent(new Event("glidr-nav-layout-change"));
  };

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => getAccentColor());
  function handleAccentColor(color: AccentColor) {
    setAccentColor(color);
    setAccentColorState(color);
  }

  const [dateFormat, setDateFormatState] = useState<'european' | 'american'>('european');
  useEffect(() => {
    const fmt = (user as any)?.dateFormat as 'european' | 'american' | undefined;
    if (fmt) setDateFormatState(fmt);
  }, [(user as any)?.dateFormat]);
  const updateProfileMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("PUT", "/api/user/profile", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });
  function handleDateFormat(fmt: 'european' | 'american') {
    setDateFormatState(fmt);
    setGlidrDateFormat(fmt);
    updateProfileMutation.mutate({ dateFormat: fmt });
  }

  const { data: watchCodeData, isLoading: watchCodeLoading } = useQuery<{ watchCode: string }>({
    queryKey: ["/api/auth/my-watch-code"],
    enabled: !!user,
  });

  const hasGarminWatch = !!(user as any)?.garminWatch || !!(user as any)?.isTeamAdmin || !!(user as any)?.isAdmin;

  const { data: teamCodesData, isLoading: teamCodesLoading } = useQuery<{ teamPin: string }>({
    queryKey: ["/api/watch/team-codes"],
    enabled: !!user && hasGarminWatch,
  });

  async function regeneratePin() {
    setPinRegenerating(true);
    try {
      await fetch("/api/watch/pin/regenerate", { method: "POST", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/watch/team-codes"] });
    } finally {
      setPinRegenerating(false);
    }
  }

  function copyPin(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 1500);
    });
  }


  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/my-watch-code/regenerate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/my-watch-code"] });
      toast({ title: t("account.watchCodeRegenerated") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
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
      setCurrentPass(""); setNewPass(""); setConfirmPass(""); setPassError("");
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const handleSavePassword = () => {
    if (newPass.length < 7) { setPassError("New password must be at least 7 characters"); return; }
    if (!/[0-9]/.test(newPass)) { setPassError("Password must contain at least one number"); return; }
    if (!/[^A-Za-z0-9]/.test(newPass)) { setPassError("Password must contain at least one special character"); return; }
    if (newPass !== confirmPass) { setPassError("Passwords don't match"); return; }
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
  const avatarUrl = (user as any)?.avatarUrl;
  const userInitials = user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const navItems: NavItem[] = [
    { id: "profile", labelKey: "account.profile", icon: User },
    { id: "security", labelKey: "account.navSecurity", icon: KeyRound },
    { id: "preferences", labelKey: "account.navPreferences", icon: Smartphone },
    { id: "language", labelKey: "account.navLanguage", icon: Mail },
    ...(hasGarminWatch ? [{ id: "watch" as Section, labelKey: "account.navWatch", icon: Watch }] : []),
    { id: "sessions", labelKey: "account.navSessions", icon: Shield },
    ...(commercializationEnabled && isTeamAdmin && !user?.isAdmin
      ? [{ id: "subscription" as Section, labelKey: "account.navSubscription", icon: Shield }]
      : []
    ),
    ...((user?.isTeamAdmin === 1 || user?.isAdmin === 1)
      ? [{ id: "teamadmin" as Section, labelKey: "account.navTeamAdmin", icon: UserPlus }]
      : []
    ),
    { id: "dangerzone", labelKey: "account.navDangerZone", icon: Trash2 },
  ];

  // ── Section content renderer ─────────────────────────────────────────────────
  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <div className="space-y-4">
            {/* Profile header with avatar */}
            <div className="flex items-center gap-4 mb-2">
              <div className="h-14 w-14 rounded-full overflow-hidden border border-border shrink-0 bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-white font-bold">{userInitials}</span>
                )}
              </div>
              <div>
                <div className="font-semibold text-lg leading-tight">{user.name}</div>
                <div className="text-sm text-muted-foreground">{roleLabel}</div>
              </div>
            </div>

            <AvatarSection />

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
                      <div className="text-xs text-muted-foreground">{t("account.username")}</div>
                      <div className="text-sm font-medium" data-testid="text-profile-username">
                        {user.username || <span className="text-muted-foreground italic">{t("account.usernameNotSet")}</span>}
                      </div>
                    </div>
                  </div>
                  {!showUsernameForm && (
                    <Button variant="ghost" size="sm" onClick={() => { setNewUsername(user.username || ""); setShowUsernameForm(true); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {t("account.usernameChange")}
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
                    <p className="text-xs text-muted-foreground">{t("account.usernameHint")}</p>
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
          </div>
        );

      case "security":
        return (
          <div className="space-y-4">
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
                      <Input type={showCurrent ? "text" : "password"} value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} placeholder={t("account.currentPassword")} data-testid="input-current-password" />
                      <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t("account.newPassword")}</label>
                    <div className="relative">
                      <Input type={showNew ? "text" : "password"} value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder={t("account.newPassword")} data-testid="input-new-password" />
                      <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t("account.confirmPassword")}</label>
                    <div className="relative">
                      <Input type={showConfirm ? "text" : "password"} value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder={t("account.confirmPassword")} data-testid="input-confirm-password" />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {passError && <p className="text-xs text-destructive">{passError}</p>}
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setShowPassForm(false); setCurrentPass(""); setNewPass(""); setConfirmPass(""); setPassError(""); }}>
                      {t("common.cancel")}
                    </Button>
                    <Button size="sm" disabled={!currentPass || !newPass || !confirmPass || changePasswordMutation.isPending} onClick={handleSavePassword} data-testid="button-change-password">
                      {changePasswordMutation.isPending ? t("common.saving") : t("common.save")}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {user?.isAdmin === 1 && <TwoFactorSection />}

            {/* Admin mode (super admin only) */}
            {user.isAdmin === 1 && (
              <Card className="p-5 space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-500" />
                  {t("account.adminSettings")}
                </h2>
                <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{t("account.adminMode")}</div>
                    <div className="text-xs text-muted-foreground">{t("account.adminModeDesc")}</div>
                  </div>
                  <button
                    type="button"
                    data-testid="button-admin-mode-toggle"
                    onClick={() => {
                      const next = !adminMode;
                      setAdminMode(next);
                      try { localStorage.setItem("glidr-sa-admin-mode", String(next)); } catch {}
                      toast({ title: next ? t("account.adminModeOnToast") : t("account.adminModeOffToast"), description: next ? t("account.adminModeOnDesc") : t("account.adminModeOffDesc") });
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                      adminMode
                        ? "border-purple-300 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {adminMode ? <ToggleRight className="h-3.5 w-3.5 text-purple-600" /> : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                    {adminMode ? t("account.adminModeOn") : t("account.adminModeOff")}
                  </button>
                </div>
              </Card>
            )}
          </div>
        );

      case "preferences":
        return (
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              {t("account.displayPreferences")}
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

            <div className="rounded-xl bg-muted/50 px-4 py-3 space-y-2">
              <div>
                <div className="text-sm font-medium">{t("account.navLayout")}</div>
                <div className="text-xs text-muted-foreground">{t("account.navLayoutDesc")}</div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => toggleNavLayout("sidebar")}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-2.5 text-xs font-medium transition-colors",
                    currentNavLayout === "sidebar"
                      ? ACCENT_NAV[accentColor].selectedBtn
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  <PanelLeft className="h-5 w-5" />
                  {t("account.navLayoutSidebar")}
                </button>
                <button
                  onClick={() => toggleNavLayout("top")}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-2.5 text-xs font-medium transition-colors",
                    currentNavLayout === "top"
                      ? ACCENT_NAV[accentColor].selectedBtn
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  <PanelTop className="h-5 w-5" />
                  {t("account.navLayoutTop")}
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-muted/50 px-4 py-3 space-y-3">
              <div>
                <div className="text-sm font-medium">{t("account.accentColour")}</div>
                <div className="text-xs text-muted-foreground">{t("account.accentColourDesc")}</div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    title={c.label}
                    onClick={() => handleAccentColor(c.id)}
                    className={cn(
                      "h-8 w-8 rounded-full transition-all",
                      accentColor === c.id
                        ? "scale-110 outline outline-2 outline-offset-2 outline-foreground/40"
                        : "hover:scale-105 outline outline-1 outline-transparent hover:outline-foreground/20"
                    )}
                    style={{ background: `hsl(${c.hsl})` }}
                    aria-pressed={accentColor === c.id}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-muted/50 px-4 py-3 space-y-2">
              <div>
                <div className="text-sm font-medium">{t("preferences.dateFormat")}</div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleDateFormat("european")}
                  className={cn(
                    "flex-1 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors",
                    dateFormat === "european"
                      ? ACCENT_NAV[accentColor].selectedBtn
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                  aria-pressed={dateFormat === "european"}
                >
                  {t("preferences.dateFormatEuropean")}
                </button>
                <button
                  onClick={() => handleDateFormat("american")}
                  className={cn(
                    "flex-1 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors",
                    dateFormat === "american"
                      ? ACCENT_NAV[accentColor].selectedBtn
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                  aria-pressed={dateFormat === "american"}
                >
                  {t("preferences.dateFormatAmerican")}
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Guided Tour</div>
                <div className="text-xs text-muted-foreground">Restart the step-by-step feature tour</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs shrink-0"
                onClick={() => {
                  resetTour();
                  window.location.reload();
                }}
              >
                Restart tour
              </Button>
            </div>
          </Card>
        );

      case "language":
        return (
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
        );

      case "watch":
        return (
          <div className="space-y-4">
            {/* Personal code */}
            <Card className="p-5 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Watch className="h-4 w-4 text-sky-500" />
                {t("account.watchCode")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("account.watchCodeDesc")}</p>

              {watchCodeLoading ? (
                <div className="h-12 bg-muted/50 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-lg border border-border bg-muted/30 px-4 py-3 text-2xl font-mono font-bold tracking-[0.3em] text-center">
                    {watchCodeData?.watchCode ?? "—"}
                  </div>
                  <button
                    onClick={handleCopy}
                    title={t("common.copy")}
                    className="p-2 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => { if (confirm(t("account.watchCodeRegenConfirm"))) regenerateMutation.mutate(); }}
                    disabled={regenerateMutation.isPending}
                    title={t("common.generate")}
                    className="p-2 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground/60">{t("account.watchCodePrivate")}</p>
            </Card>

            {/* Team ID + member codes */}
            <Card className="p-5 space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Watch className="h-4 w-4 text-sky-500" />
                {t("account.teamWatch")}
              </h2>

              {/* Team PIN */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">{t("account.teamId")}</p>
                {teamCodesLoading ? (
                  <div className="h-12 bg-muted/50 rounded-lg animate-pulse" />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-2.5">
                      <span className="font-mono text-2xl font-bold tracking-[0.25em] text-foreground">
                        {teamCodesData?.teamPin ?? "—"}
                      </span>
                      <button
                        onClick={() => teamCodesData && copyPin(teamCodesData.teamPin)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title={t("common.copy")}
                      >
                        {copiedPin ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {isTeamAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={regeneratePin}
                        disabled={pinRegenerating}
                        className="gap-1.5 text-xs"
                      >
                        <RefreshCw className={`h-3 w-3 ${pinRegenerating ? "animate-spin" : ""}`} />
                        {t("account.regenerate")}
                      </Button>
                    )}
                  </div>
                )}
              </div>

            </Card>
          </div>
        );

      case "sessions":
        return <ActiveSessionsSection />;

      case "subscription":
        return <PlanChangeSection />;

      case "teamadmin":
        return <InviteMembersSection />;

      case "dangerzone":
        return (
          <Card className="rounded-2xl p-5 sm:p-6 border-red-200 dark:border-red-900/50">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-red-500" />
              <h2 className="text-base font-semibold">{t("account.dangerZone")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{t("account.dangerZoneDesc")}</p>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">{t("account.dataExport")}</p>
                <p className="text-xs text-muted-foreground mb-2">{t("account.dataExportDesc")}</p>
                <DownloadMyDataButton />
              </div>
              <div>
                <DeleteAccountButton />
              </div>
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <AppShell>
      <div data-testid="text-my-account-title">
        <h1 className="text-2xl sm:text-3xl flex items-center gap-3 mb-6">
          <User className="h-7 w-7 text-blue-500" />
          {t("account.title")}
        </h1>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
          {/* ── Left nav (desktop) ─────────────────────────────────────── */}
          <aside className="hidden md:block w-[220px] shrink-0 sticky top-4">
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* ── Mobile tab bar ─────────────────────────────────────────── */}
          <div className="md:hidden w-full">
            <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-none">
              {navItems.map((item) => {
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60"
                    )}
                  >
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right panel ────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0 space-y-4">
            {renderSection()}
          </main>
        </div>
      </div>
    </AppShell>
  );
}
