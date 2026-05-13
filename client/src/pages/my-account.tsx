import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Watch, RefreshCw, Copy, Check, KeyRound, Mail, Users, Shield, Smartphone, Eye, EyeOff, ToggleLeft, ToggleRight, AtSign, Pencil } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMobileNav } from "@/components/mobile-nav";
import { cn } from "@/lib/utils";

export default function MyAccount() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      toast({ title: "Username updated" });
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
      toast({ title: "Password changed" });
      setShowPassForm(false);
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
      setPassError("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
  const roleLabel = user.isAdmin ? "Super Admin" : user.isTeamAdmin ? "Team Admin" : "Member";

  return (
    <AppShell>
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl sm:text-3xl flex items-center gap-3" data-testid="text-my-account-title">
          <User className="h-7 w-7 text-blue-500" />
          My Account
        </h1>

        {/* Profile */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Profile</h2>

          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Name</div>
              <div className="text-sm font-medium" data-testid="text-profile-name">{user.name}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
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
                  <Button variant="outline" size="sm" onClick={() => { setShowUsernameForm(false); setUsernameError(""); }}>Cancel</Button>
                  <Button size="sm" onClick={() => changeUsernameMutation.mutate()} disabled={changeUsernameMutation.isPending || !newUsername.trim()}>
                    {changeUsernameMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {groups.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-muted-foreground mb-1">Groups</div>
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
              <div className="text-xs text-muted-foreground">Role</div>
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
              <div className="text-sm font-medium">Mobile navigation</div>
              <div className="text-xs text-muted-foreground">Show a bottom tab bar on small screens</div>
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
              Password
            </h2>
            {!showPassForm && (
              <Button variant="outline" size="sm" onClick={() => setShowPassForm(true)}>
                Change password
              </Button>
            )}
          </div>

          {showPassForm && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Current password</label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="Current password"
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
                <label className="text-sm font-medium">New password</label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="New password"
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
                <label className="text-sm font-medium">Confirm new password</label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Confirm new password"
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
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!currentPass || !newPass || !confirmPass || changePasswordMutation.isPending}
                  onClick={handleSavePassword}
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? "Saving…" : "Save"}
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
      </div>
    </AppShell>
  );
}
