import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Trash2, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { fmtDate } from "@/lib/utils";

type PrepComment = {
  id: number;
  racePrepId: number;
  userId: number;
  userName: string;
  content: string;
  createdAt: string;
};

// Per-race-prep waxer comments. A waxer sees only their own; Team/Super Admins
// see everyone's. Visibility/auth is enforced server-side.
export function RacePrepComments({
  prepId,
  lang,
}: {
  prepId: number;
  lang: "no" | "en";
}) {
  const L = (no: string, en: string) => (lang === "en" ? en : no);
  const { user, isSuperAdmin, isTeamAdmin } = useAuth();
  const isAdmin = isSuperAdmin || isTeamAdmin;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const queryKey = [`/api/race-preps/${prepId}/comments`];
  const { data: comments = [], isLoading } = useQuery<PrepComment[]>({ queryKey });

  async function send() {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    try {
      await apiRequest("POST", `/api/race-preps/${prepId}/comments`, { content });
      setDraft("");
      queryClient.invalidateQueries({ queryKey });
    } finally {
      setSending(false);
    }
  }

  async function remove(id: number) {
    await apiRequest("DELETE", `/api/race-prep-comments/${id}`);
    queryClient.invalidateQueries({ queryKey });
  }

  function fmtTime(iso: string): string {
    try {
      const d = new Date(iso);
      const time = d.toLocaleTimeString(lang === "no" ? "nb-NO" : "en-GB", { hour: "2-digit", minute: "2-digit" });
      return `${fmtDate(iso.slice(0, 10))} ${time}`;
    } catch {
      return iso;
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{L("Kommentarer", "Comments")}</h4>
        <span className="inline-flex items-center gap-1 ml-1 rounded-full bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-900">
          <Lock className="h-2.5 w-2.5" />
          {isAdmin
            ? L("Synlig for smører + admin", "Visible to waxer + admin")
            : L("Kun synlig for deg + admin", "Only visible to you + admin")}
        </span>
      </div>

      {/* Comment list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-1">…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-1">
          {L("Ingen kommentarer ennå.", "No comments yet.")}
        </p>
      ) : (
        <div className="flex flex-col gap-2 mb-2">
          {comments.map((c) => {
            const canDelete = isAdmin || c.userId === (user as any)?.id;
            return (
              <div key={c.id} className="rounded-lg bg-background border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-foreground">{c.userName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{fmtTime(c.createdAt)}</span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        title={L("Slett", "Delete")}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-snug">{c.content}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add comment */}
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          }}
          rows={1}
          placeholder={L("Skriv en kommentar…", "Write a comment…")}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm min-h-[34px] max-h-28"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !draft.trim()}
          className="h-[34px] w-[34px] flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 flex-shrink-0"
          title={L("Send", "Send")}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
