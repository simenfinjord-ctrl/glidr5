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
};

export default function Inbox() {
  const [, navigate] = useLocation();
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Redirect non-SA users
  if (!isSuperAdmin) {
    navigate("/dashboard");
    return null;
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
      toast({ title: "All messages marked as read" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/inbox/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/unread-count"] });
      toast({ title: "Message deleted" });
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
              SA Inbox
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Problem reports from users
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {unreadCount} unread
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
              Mark all as read
            </Button>
          )}
        </div>

        {/* Message list */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading…</div>
        ) : messages.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
            <MailOpen className="h-12 w-12 opacity-30" />
            <p className="text-sm font-medium">Your inbox is empty</p>
            <p className="text-xs">Problem reports from users will appear here.</p>
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
                          From: <span className="font-medium">{msg.from_name ?? "Unknown"}</span>
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
                          Delete
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
