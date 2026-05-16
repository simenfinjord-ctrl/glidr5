import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mail, MailOpen, Trash2, CheckCheck, ChevronDown, ChevronUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

type InboxMessage = {
  id: number;
  to_user_id: number;
  from_user_id: number | null;
  from_name: string | null;
  subject: string;
  body: string;
  is_read: number;
  created_at: string;
  team_name: string | null;
  action_type: string | null;
  action_data: string | null;
};

export default function Inbox() {
  const [, navigate] = useLocation();
  const { isSuperAdmin, isTeamAdmin } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Redirect users who are neither SA nor TA
  if (!isSuperAdmin && !isTeamAdmin) {
    navigate("/dashboard");
    return null;
  }

  const [resetTarget, setResetTarget] = useState<{ userId: number; userName: string; userEmail: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetDone, setResetDone] = useState<string | null>(null); // holds the new password after reset
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  function generateTempPassword(): string {
    const chars = "abcdefghjkmnpqrstuvwxyz";
    const digits = "23456789";
    const upper = chars[Math.floor(Math.random() * chars.length)].toUpperCase();
    const rest = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const nums = Array.from({ length: 2 }, () => digits[Math.floor(Math.random() * digits.length)]).join("");
    return `${upper}${rest}${nums}!`;
  }

  async function handleReset() {
    if (!resetTarget || !newPassword) return;
    setResetting(true);
    setResetError(null);
    try {
      const res = await apiRequest("POST", `/api/users/${resetTarget.userId}/reset-password`, { password: newPassword });
      const data = await res.json();
      if (!res.ok) { setResetError(data.message || "Failed"); return; }
      setResetDone(newPassword);
    } catch {
      setResetError("Something went wrong.");
    } finally {
      setResetting(false);
    }
  }

  const { data: messages = [], isLoading } = useQuery<InboxMessage[]>({
    queryKey: ["/api/inbox"],
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PUT", `/api/inbox/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/inbox/read-all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/unread-count"] });
      toast({ title: t("inbox.allRead") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/inbox/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/unread-count"] });
      toast({ title: t("inbox.deleted") });
    },
  });

  function handleExpand(msg: InboxMessage) {
    const isNowOpen = expandedId !== msg.id;
    setExpandedId(isNowOpen ? msg.id : null);
    if (isNowOpen && msg.is_read === 0) {
      markReadMutation.mutate(msg.id);
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  const unreadCount = messages.filter((m) => m.is_read === 0).length;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="heading-inbox">
              <Mail className="h-6 w-6 text-primary" />
              {t("inbox.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("inbox.subtitle")}
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {`${unreadCount} ${t("inbox.unread")}`}
                </span>
              )}
            </p>
          </div>
          {messages.length > 0 && unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read"
              className="flex items-center gap-1.5"
            >
              <CheckCheck className="h-4 w-4" />
              {t("inbox.markAllRead")}
            </Button>
          )}
        </div>

        {/* Message list */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">{t("inbox.loading")}</div>
        ) : messages.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
            <MailOpen className="h-12 w-12 opacity-30" />
            <p className="text-sm font-medium">{t("inbox.empty")}</p>
            <p className="text-xs">{t("inbox.emptyDesc")}</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((msg) => {
              const isExpanded = expandedId === msg.id;
              const isUnread = msg.is_read === 0;
              return (
                <Card
                  key={msg.id}
                  className={cn(
                    "overflow-hidden transition-shadow",
                    isUnread ? "border-blue-300 shadow-sm dark:border-blue-700" : "border-border"
                  )}
                  data-testid={`inbox-message-${msg.id}`}
                >
                  {/* Row header */}
                  <button
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                    onClick={() => handleExpand(msg)}
                    data-testid={`inbox-message-toggle-${msg.id}`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isUnread ? (
                        <Mail className="h-4 w-4 text-blue-500" />
                      ) : (
                        <MailOpen className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-sm", isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                          {msg.subject}
                        </span>
                        {isUnread && (
                          <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {t("inbox.from")}: <span className="font-medium">{msg.from_name ?? "Unknown"}</span>
                          {msg.team_name && (
                            <span className="ml-1 text-muted-foreground/70">· {msg.team_name}</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground/60">·</span>
                        <span className="text-xs text-muted-foreground/60">{formatDate(msg.created_at)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 mt-0.5 text-muted-foreground">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 py-4 bg-muted/20">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {msg.body}
                      </p>
                      {msg.action_type === "reset_password" && (() => {
                        let actionData: { userId: number; userName: string; userEmail: string } | null = null;
                        try { actionData = JSON.parse(msg.action_data ?? ""); } catch {}
                        if (!actionData) return null;
                        return (
                          <div className="mt-4 rounded-xl border border-border bg-background p-4 space-y-3">
                            <div className="text-sm font-semibold">{t("inbox.resetPasswordFor", { name: actionData.userName })}</div>
                            <div className="text-xs text-muted-foreground">{actionData.userEmail}</div>
                            {!resetDone || resetTarget?.userId !== actionData.userId ? (
                              <>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={resetTarget?.userId === actionData.userId ? newPassword : ""}
                                    onChange={(e) => { setResetTarget(actionData!); setNewPassword(e.target.value); setResetDone(null); }}
                                    onFocus={() => setResetTarget(actionData!)}
                                    placeholder={t("inbox.newTempPassword")}
                                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                  />
                                  <Button size="sm" variant="outline" type="button"
                                    onClick={() => { setResetTarget(actionData!); setNewPassword(generateTempPassword()); setResetDone(null); }}>
                                    {t("common.generate")}
                                  </Button>
                                </div>
                                {resetError && resetTarget?.userId === actionData.userId && (
                                  <p className="text-xs text-red-500">{resetError}</p>
                                )}
                                <Button size="sm"
                                  disabled={resetting || !newPassword || resetTarget?.userId !== actionData.userId}
                                  onClick={() => { setResetTarget(actionData!); handleReset(); }}>
                                  {resetting && resetTarget?.userId === actionData.userId ? t("inbox.resetting") : t("inbox.resetPassword")}
                                </Button>
                              </>
                            ) : (
                              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 space-y-2">
                                <p className="text-xs font-semibold text-green-800 dark:text-green-300">{t("inbox.resetSuccess")}</p>
                                <p className="text-xs text-green-700 dark:text-green-400">{t("inbox.resetSuccessDesc")}</p>
                                <div className="flex items-center gap-2">
                                  <code className="flex-1 text-sm font-mono bg-white dark:bg-black/20 rounded px-2 py-1 border border-green-200 dark:border-green-700">{resetDone}</code>
                                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(resetDone!); toast({ title: t("common.copied") }); }}>
                                    {t("common.copy")}
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">{t("inbox.resetAskChange")}</p>
                                <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setResetDone(null); setNewPassword(""); setResetTarget(null); }}>
                                  {t("inbox.resetAgain")}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="mt-4 flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteMutation.mutate(msg.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-message-${msg.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" />
                          {t("inbox.delete")}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
