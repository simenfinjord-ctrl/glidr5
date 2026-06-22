import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, EyeOff, Eye, MapPin, Calendar, Clock, Thermometer, Droplets, Snowflake, Award, FlaskConical, Pencil, Trash2, FileText, Copy, Trophy, ClipboardList, Share2, Watch, ImageIcon, MessageSquare, Send, Link2, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn, fmtDate } from "@/lib/utils";
import { parseApplication } from "@/lib/parse-application";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { RunsheetDialog, type BracketResult } from "@/components/runsheet-dialog";
import { ReviewRunsheetDialog } from "@/components/review-runsheet-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Test = {
  id: number;
  date: string;
  location: string;
  testName: string | null;
  weatherId: number | null;
  testType: string;
  seriesId: number;
  notes: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  distanceLabels: string | null;
  grindParameters: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
  testSkiSource: string;
  athleteId: number | null;
  teamId: number;
};

type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  additionalProductIds: string | null;
  freeTextProduct: string | null;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  resultXkmCmBehind: number | null;
  rankXkm: number | null;
  results: string | null;
  feelingRank: number | null;
  feelingNote: string | null;
  kickRank: number | null;
  raceSkiId: number | null;
  grindType: string | null;
  grindStone: string | null;
  grindPattern: string | null;
  grindExtraParams: string | null;
};

type RaceSki = {
  id: number;
  serialNumber: string | null;
  skiId: string;
};

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
};

type Series = {
  id: number;
  name: string;
};

type Weather = {
  id: number;
  date: string;
  time: string;
  location: string;
  snowTemperatureC: number;
  airTemperatureC: number;
  snowHumidityPct: number;
  airHumidityPct: number;
  clouds: number | null;
  visibility: string | null;
  wind: string | null;
  precipitation: string | null;
  artificialSnow: string | null;
  naturalSnow: string | null;
  grainSize: string | null;
  snowHumidityType: string | null;
  trackHardness: string | null;
  testQuality: number | null;
  snowType: string | null;
};

type RoundResult = { result: number | null; rank: number | null };

function getDistanceLabels(test: Test): string[] {
  if (test.distanceLabels) {
    try {
      const parsed = JSON.parse(test.distanceLabels);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  const labels: string[] = [test.distanceLabel0km || "0 km"];
  if (test.distanceLabelXkm) {
    labels.push(test.distanceLabelXkm);
  }
  return labels;
}

function getEntryRounds(entry: TestEntry, numRounds: number): RoundResult[] {
  if (entry.results) {
    try {
      const parsed = JSON.parse(entry.results);
      if (Array.isArray(parsed)) {
        while (parsed.length < numRounds) parsed.push({ result: null, rank: null });
        return parsed.slice(0, numRounds);
      }
    } catch {}
  }
  const results: RoundResult[] = [
    { result: entry.result0kmCmBehind, rank: entry.rank0km },
  ];
  if (numRounds > 1) {
    results.push({ result: entry.resultXkmCmBehind, rank: entry.rankXkm });
  }
  while (results.length < numRounds) results.push({ result: null, rank: null });
  return results;
}

function RankBadge({ rank, size = "sm" }: { rank: number | null; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "min-w-12 px-3 py-1.5 text-sm" : "min-w-8 px-2 py-0.5 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold",
        sizeClass,
        rank === 1 && "bg-gradient-to-r from-yellow-500/20 to-yellow-400/10 text-yellow-400 ring-1 ring-yellow-500/30",
        rank === 2 && "bg-gradient-to-r from-slate-300/20 to-slate-200/10 text-slate-300 ring-1 ring-slate-300/30",
        rank === 3 && "bg-gradient-to-r from-amber-700/20 to-amber-600/10 text-amber-600 ring-1 ring-amber-700/30",
        rank !== null && rank > 3 && "bg-muted/60 text-muted-foreground",
        rank === null && "text-muted-foreground",
      )}
    >
      {rank ?? "—"}
    </span>
  );
}

function AddToWatchButton({ testId, testName, seriesId, hasAccess }: { testId: number; testName: string; seriesId: number; hasAccess: boolean }) {
  const { toast } = useToast();
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { data: queue = [] } = useQuery<any[]>({
    queryKey: ["/api/watch/queue"],
    enabled: hasAccess,
  });
  const inQueue = queue.some((q: any) => q.test_id === testId && q.status === "active");

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/watch/queue", { testId, seriesId, testName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watch/queue"] });
      toast({ title: t("watchQueue.addToQueue"), description: L("Åpne Garmin-appen og velg «Fra liste».", "Open the Garmin app and select «From list».") });
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("409") || msg.includes("Already")) {
        toast({ title: t("watchQueue.active"), description: L("Denne testen er allerede i klokkekøen.", "This test is already in the watch queue."), variant: "destructive" });
      } else {
        toast({ title: t("common.error"), description: L("Kunne ikke legge til i klokkekø.", "Could not add to watch queue."), variant: "destructive" });
      }
    },
  });

  return (
    <Button
      variant={inQueue ? "secondary" : "outline"}
      size="sm"
      disabled={inQueue || addMutation.isPending}
      onClick={() => addMutation.mutate()}
      data-testid="button-add-to-watch"
    >
      <Watch className="mr-2 h-4 w-4" />
      {inQueue ? t("watchQueue.active") : t("watchQueue.addToQueue")}
    </Button>
  );
}

function AttachmentsSection({ testId }: { testId: number }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery<any[]>({
    queryKey: [`/api/tests/${testId}/attachments`],
    queryFn: async () => {
      const res = await fetch(`/api/tests/${testId}/attachments`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: L("Kun bildefiler støttes", "Only image files are supported"), variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/tests/${testId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ filename: file.name, mimeType: file.type, data: base64 }),
      });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${testId}/attachments`] });
      toast({ title: L("Bilde lastet opp", "Photo uploaded") });
    } catch {
      toast({ title: L("Opplasting mislyktes", "Upload failed"), variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{L("Bilder", "Photos")}</h3>
        <label className={`cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? "Uploading..." : "Add photo"}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">{L("Ingen bilder vedlagt.", "No photos attached.")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a: any) => (
            <a
              key={a.id}
              href={`/api/attachments/${a.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              <ImageIcon className="h-3 w-3 text-muted-foreground" />
              <span className="max-w-[140px] truncate">{a.filename}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render comment text with @mentions highlighted.
 *  Mentions are stored as @First_Last (underscores for spaces).
 *  Display replaces underscores back to spaces. */
function CommentText({ text }: { text: string }) {
  // Split on @word (with optional underscores/dots) tokens
  const parts = text.split(/(@[a-zA-Z0-9._-]+)/g);
  return (
    <p className="mt-0.5 text-sm text-foreground/90 whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        /^@[a-zA-Z0-9._-]+/.test(part) ? (
          <span key={i} className="font-semibold text-blue-600 dark:text-blue-400">
            {/* Show @First Last (spaces back in) */}
            @{part.slice(1).replace(/_/g, " ")}
          </span>
        ) : (
          part
        )
      )}
    </p>
  );
}

function CommentsSection({ testId }: { testId: number }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionIdx, setMentionIdx] = useState(0);

  const { data: comments = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/tests/${testId}/comments`],
    queryFn: async () => {
      const res = await fetch(`/api/tests/${testId}/comments`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Fetch members who have access to this test's group (for @mention dropdown)
  const { data: mentionableUsers = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: [`/api/tests/${testId}/mentionable-users`],
    queryFn: async () => {
      const res = await fetch(`/api/tests/${testId}/mentionable-users`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60_000,
    enabled: !!user,
  });

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase().trim();
    // When q is empty (just "@" typed), show first 6 members
    if (!q) return mentionableUsers.slice(0, 6);
    return mentionableUsers
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, mentionableUsers]);

  // Detect @mention while typing
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    const pos = e.target.selectionStart ?? val.length;
    // Find last @ before cursor that hasn't been closed by a space
    const beforeCursor = val.slice(0, pos);
    const match = beforeCursor.match(/@(\S*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(pos - match[0].length);
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  }, []);

  // Insert mention on selection
  const insertMention = useCallback((name: string) => {
    const ta = inputRef.current;
    if (!ta) return;
    const before = content.slice(0, mentionStart);
    const after = content.slice(ta.selectionStart ?? content.length);
    // Encode spaces as underscores so the whole name is one token (@First_Last)
    const inserted = `@${name.replace(/\s+/g, "_")} `;
    const next = before + inserted + after;
    setContent(next);
    setMentionQuery(null);
    // Restore cursor after the inserted mention
    requestAnimationFrame(() => {
      ta.focus();
      const pos = (before + inserted).length;
      ta.setSelectionRange(pos, pos);
    });
  }, [content, mentionStart]);

  // Keyboard nav in mention dropdown
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionMatches.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionMatches[mentionIdx].name); return; }
      if (e.key === "Escape") { setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      submit(e as any);
    }
  }, [mentionQuery, mentionMatches, mentionIdx, insertMention]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMentionQuery(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tests/${testId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (!res.ok) throw new Error();
      setContent("");
      setMentionQuery(null);
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${testId}/comments`] });
    } catch {
      toast({ title: L("Feil", "Error"), description: L("Kunne ikke publisere kommentar.", "Could not post comment."), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(id: number) {
    await fetch(`/api/comments/${id}`, { method: "DELETE", credentials: "include" });
    queryClient.invalidateQueries({ queryKey: [`/api/tests/${testId}/comments`] });
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="fs-card rounded-2xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
          <MessageSquare className="h-4 w-4 text-blue-600" />
        </div>
        <h2 className="text-base font-semibold">{L("Kommentarer", "Comments")}</h2>
        {comments.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{comments.length}</span>
        )}
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{L("Ingen kommentarer ennå. Bli den første!", "No comments yet. Be the first!")}</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c: any) => (
            <div key={c.id} className="flex items-start gap-3 group">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                {c.user_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{c.user_name}</span>
                  <span className="text-xs text-muted-foreground">{formatTime(c.created_at)}</span>
                </div>
                <CommentText text={c.content} />
              </div>
              {(user?.id === c.user_id || (user as any)?.isAdmin) && (
                <button
                  onClick={() => deleteComment(c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                  title={L("Slett", "Delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input + mention dropdown */}
      <form onSubmit={submit} className="flex items-end gap-2">
        <div className="relative flex-1" ref={dropdownRef}>
          <textarea
            ref={inputRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={L("Skriv en kommentar… skriv @ for å nevne noen", "Write a comment… type @ to mention someone")}
            className="w-full min-h-[60px] max-h-[160px] resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={2000}
            data-testid="input-comment"
          />
          {/* @mention dropdown */}
          {mentionQuery !== null && mentionMatches.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-56 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
              {mentionMatches.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(m.name); }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                    i === mentionIdx
                      ? "bg-blue-600 text-white"
                      : "hover:bg-muted text-foreground",
                  )}
                >
                  <div className={cn(
                    "h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold",
                    i === mentionIdx ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {m.name[0]?.toUpperCase()}
                  </div>
                  <span className="truncate">{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button type="submit" size="sm" disabled={submitting || !content.trim()} className="h-9 gap-1.5 self-end">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}

export default function TestDetail() {
  const [, params] = useRoute("/tests/:id");
  const id = params?.id;
  const testId = id ? parseInt(id) : NaN;
  const { isBlindTester, isSuperAdmin, can } = useAuth();
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const lang = language === "no" ? "no" : "en";
  const hasWatchAccess = can("garmin_watch");
  const canEditTests = can("tests", "edit");
  const [hideDetailsState, setHideDetails] = useState(false);
  const hideDetails = isBlindTester || hideDetailsState;
  const [, setLocation] = useLocation();
  const navigate = setLocation;
  const { toast } = useToast();

  // ── All-tests list for prev/next navigation ──────────────────────────────
  const { data: allTests = [] } = useQuery<Test[], Error, { id: number; date: string; createdAt: string }[]>({
    queryKey: ["/api/tests"],
    select: (data) => [...data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });

  const testIndex = allTests.findIndex((t) => t.id === testId);
  const prevId = testIndex > 0 ? allTests[testIndex - 1].id : null;
  const nextId = testIndex < allTests.length - 1 ? allTests[testIndex + 1].id : null;

  // Keyboard navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft" && prevId) navigate(`/tests/${prevId}`);
      if (e.key === "ArrowRight" && nextId) navigate(`/tests/${nextId}`);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevId, nextId, navigate]);

  // Touch swipe detection
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      // Don't navigate if focus is inside a text field or an open dialog
      const active = document.activeElement;
      const inTextField = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      const inDialog = !!document.querySelector('[role="dialog"]');
      if (!inTextField && !inDialog) {
        if (dx > 0 && prevId) navigate(`/tests/${prevId}`);
        if (dx < 0 && nextId) navigate(`/tests/${nextId}`);
      }
    }
    touchStartX.current = null;
  };
  // ────────────────────────────────────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRunsheet, setShowRunsheet] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copyLinkLoading, setCopyLinkLoading] = useState(false);

  const [showReviewRunsheet, setShowReviewRunsheet] = useState(false);
  const [visibleGrindCols, setVisibleGrindCols] = useState<string[]>(["grindType"]);

  // Shared test actions — used by both the desktop button row and the mobile "Options" menu.
  async function openEditTest() {
    // Warm the React Query cache before navigating to edit (avoids the Radix Select
    // race that blanks form fields on first visit).
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: [`/api/tests/${id}`],
        queryFn: () => fetch(`/api/tests/${id}`, { credentials: "include" }).then((r) => r.json()),
      }),
      queryClient.prefetchQuery({
        queryKey: [`/api/tests/${id}/entries`],
        queryFn: () => fetch(`/api/tests/${id}/entries`, { credentials: "include" }).then((r) => r.json()),
      }),
    ]);
    setLocation(`/tests/${id}/edit`);
  }
  async function copyPublicLink() {
    setCopyLinkLoading(true);
    try {
      const res = await fetch(`/api/tests/${id}/public-link`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to generate link");
      const { url } = await res.json();
      await navigator.clipboard.writeText(url);
      toast({ title: L("Lenke kopiert til utklippstavle", "Link copied to clipboard") });
    } catch {
      toast({ title: L("Kunne ikke kopiere lenke", "Could not copy link"), variant: "destructive" });
    } finally {
      setCopyLinkLoading(false);
    }
  }

  // ── Feeling test (drag-rank ski pairs 1..N + comment → feeling_rank/feeling_note) ──
  const [feelingOpen, setFeelingOpen] = useState(false);
  const [feelingOrder, setFeelingOrder] = useState<number[]>([]);
  const [feelingNotes, setFeelingNotes] = useState<Record<number, string>>({});
  const feelingDragIdx = useRef<number | null>(null);
  const feelingMutation = useMutation({
    mutationFn: async () => {
      const rankings = feelingOrder.map((entryId, i) => ({ entryId, feelingRank: i + 1, feelingNote: feelingNotes[entryId] || null }));
      await apiRequest("PATCH", `/api/tests/${id}/feeling`, { rankings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${id}/entries`] });
      setFeelingOpen(false);
    },
    onError: (e) => { toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" }); },
  });
  function openFeeling() {
    const init = [...entries].sort((a, b) => {
      const ra = a.feelingRank ?? 999, rb = b.feelingRank ?? 999;
      return ra !== rb ? ra - rb : a.skiNumber - b.skiNumber;
    });
    setFeelingOrder(init.map((e) => e.id));
    setFeelingNotes(Object.fromEntries(init.map((e) => [e.id, (e as any).feelingNote || ""])));
    setFeelingOpen(true);
  }
  function feelingDrop(targetIdx: number) {
    const from = feelingDragIdx.current;
    feelingDragIdx.current = null;
    if (from === null || from === targetIdx) return;
    setFeelingOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  }

  const runsheetMutation = useMutation({
    mutationFn: async ({ results, bracket }: { results: BracketResult[]; bracket: any[][] }) => {
      await apiRequest("PATCH", `/api/tests/${id}/runsheet-results`, { results, bracket });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${id}/entries`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${id}`] });
      toast({ title: t("newTest.runsheetApplied") });
      setShowRunsheet(false);
    },
    onError: (e) => {
      toast({
        title: t("runsheets.couldNotApply"),
        description: e instanceof Error ? e.message : t("tests.unknownError"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/tests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      toast({ title: t("testDetail.deleteTest") });
      setLocation(
        test?.testType === "Grind" ? "/grinding"
        : (isRaceSkiTest && (test as any).athleteId) ? `/raceskis/${(test as any).athleteId}?tab=tests`
        : "/tests"
      );
    },
    onError: (e) => {
      toast({
        title: t("newTest.errorSave"),
        description: e instanceof Error ? e.message : t("tests.unknownError"),
        variant: "destructive",
      });
    },
  });

  type TeamItem = { id: number; name: string };
  const { data: allTeams = [] } = useQuery<TeamItem[]>({
    queryKey: ["/api/teams"],
    enabled: isSuperAdmin && showShareDialog,
  });

  const shareMutation = useMutation({
    mutationFn: async (targetTeamIds: number[]) => {
      const res = await apiRequest("POST", `/api/tests/${id}/share`, { targetTeamIds });
      return res.json();
    },
    onSuccess: (data: { sharedTeams: string[] }) => {
      setShowShareDialog(false);
      setSelectedTeamIds([]);
      toast({ title: `${t("testDetail.shareLink")}: ${data.sharedTeams.join(", ")}` });
    },
    onError: (e) => {
      toast({
        title: t("common.error"),
        description: e instanceof Error ? e.message : t("tests.unknownError"),
        variant: "destructive",
      });
    },
  });

  const { data: test, isLoading: testLoading } = useQuery<Test>({
    queryKey: [`/api/tests/${id}`],
    enabled: !!id,
  });

  const { data: entries = [] } = useQuery<TestEntry[]>({
    queryKey: [`/api/tests/${id}/entries`],
    enabled: !!id,
  });

  const { data: series = [] } = useQuery<Series[]>({
    queryKey: ["/api/series"],
  });

  const { data: weatherList = [] } = useQuery<Weather[]>({
    queryKey: ["/api/weather"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const isRaceSkiTest = test?.testSkiSource === "raceskis";
  const athleteId = test?.athleteId;

  const { data: raceSkisData = [] } = useQuery<RaceSki[]>({
    queryKey: [`/api/athletes/${athleteId}/skis?includeArchived=true`],
    enabled: isRaceSkiTest && !!athleteId,
  });

  const skiLabels = useMemo(() => {
    if (isRaceSkiTest) {
      if (raceSkisData.length === 0) return undefined;
      const raceSkiById = new Map(raceSkisData.map((rs) => [rs.id, rs]));
      const labels: Record<number, string> = {};
      for (const entry of entries) {
        if (entry.raceSkiId) {
          const rs = raceSkiById.get(entry.raceSkiId);
          if (rs) {
            // Show the Ski-ID (#14) — fall back to serial only if Ski-ID is missing.
            labels[entry.skiNumber] = rs.skiId || rs.serialNumber || String(entry.skiNumber);
          }
        } else if ((entry as any).freeTextProduct) {
          // Free-text (borrowed) ski — not in the garage, shown by its label.
          labels[entry.skiNumber] = (entry as any).freeTextProduct;
        }
      }
      return Object.keys(labels).length > 0 ? labels : undefined;
    }
    if (test?.seriesId) {
      const s = series.find((sr) => sr.id === test.seriesId);
      if (s && (s as any).pairLabels) {
        try {
          const parsed = JSON.parse((s as any).pairLabels);
          if (typeof parsed === "object" && parsed !== null) {
            const labels: Record<number, string> = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === "string" && v) labels[Number(k)] = v;
            }
            if (Object.keys(labels).length > 0) return labels;
          }
        } catch {}
      }
    }
    return undefined;
  }, [isRaceSkiTest, raceSkisData, entries, test?.seriesId, series]);

  const seriesById = new Map(series.map((s) => [s.id, s.name] as const));
  const productsById = new Map(products.map((p) => [p.id, p] as const));

  const weather = test?.weatherId
    ? weatherList.find((w) => w.id === test.weatherId)
    : null;

  const distLabels = test ? getDistanceLabels(test) : ["0 km"];

  // ── Sortable results (#16) — remembered per waxer across tests ───────────────
  const [testSort, setTestSort] = useState<string>(() => {
    try { return localStorage.getItem("glidr-raceski-test-sort") || "skiNumber|asc"; } catch { return "skiNumber|asc"; }
  });
  function toggleTestSort(col: string) {
    setTestSort((prev) => {
      const [k, d] = prev.split("|");
      const next = k === col ? `${col}|${d === "asc" ? "desc" : "asc"}` : `${col}|asc`;
      try { localStorage.setItem("glidr-raceski-test-sort", next); } catch {}
      return next;
    });
  }
  function testSortArrow(col: string) {
    const [k, d] = testSort.split("|");
    return k === col ? (d === "desc" ? " ↓" : " ↑") : "";
  }
  function testSortVal(entry: TestEntry, key: string): number | string {
    const rounds = getEntryRounds(entry, distLabels.length);
    if (key === "skiNumber") return skiLabels?.[entry.skiNumber] ?? entry.skiNumber;
    if (key === "rank") return rounds[0]?.rank ?? Number.POSITIVE_INFINITY;
    if (key === "feeling") return entry.feelingRank ?? Number.POSITIVE_INFINITY;
    if (key === "kick") return (entry as any).kickRank ?? Number.POSITIVE_INFINITY;
    if (key.startsWith("diff")) { const i = parseInt(key.slice(4)) || 0; const v = rounds[i]?.result; return v ?? Number.POSITIVE_INFINITY; }
    if (key.startsWith("grind:")) { const c = key.slice(6); return String((entry as any)[c] ?? ""); }
    return entry.skiNumber;
  }
  const sortedEntries = useMemo(() => {
    const [key, dir] = testSort.split("|");
    const arr = [...entries].sort((a, b) => {
      const av = testSortVal(a, key), bv = testSortVal(b, key);
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      return dir === "desc" ? -cmp : cmp;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, testSort, skiLabels, distLabels.length]);

  // ── Rank basis (#36): diff vs feeling. Diff-rank is ALWAYS what analytics
  // uses (rank0km on the entries); this toggle only changes what the Rank column
  // displays here, shown only when both a diff rank and a feeling rank exist.
  const rankBothAvailable = useMemo(() => {
    const hasDiff = entries.some((e) => getEntryRounds(e, distLabels.length)[0]?.rank != null);
    const hasFeel = entries.some((e) => e.feelingRank != null);
    return hasDiff && hasFeel;
  }, [entries, distLabels.length]);
  const [rankBasis, setRankBasis] = useState<"diff" | "feel">(() => {
    try { return (localStorage.getItem("glidr-raceski-rank-basis") as "diff" | "feel") || "diff"; } catch { return "diff"; }
  });
  function chooseRankBasis(v: "diff" | "feel") {
    setRankBasis(v);
    try { localStorage.setItem("glidr-raceski-rank-basis", v); } catch {}
  }

  // ── Grind column helpers (hooks must be before any early returns) ────────────
  function parseExtraParams(json: string | null): Record<string, string> {
    if (!json) return {};
    try { return JSON.parse(json); } catch { return {}; }
  }
  const isGrindTest = test?.testType === "Grind";
  const grindExtraParamKeys = useMemo(() => {
    if (!isGrindTest) return [];
    const keys = new Set<string>();
    // "stone" and "pattern" are already shown via dedicated grindStone/grindPattern columns
    const SKIP = new Set(["stone", "pattern"]);
    for (const e of sortedEntries) {
      for (const k of Object.keys(parseExtraParams(e.grindExtraParams))) {
        if (!SKIP.has(k.toLowerCase())) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [isGrindTest, sortedEntries]);
  const allGrindCols = useMemo(
    () => ["grindType", "grindStone", "grindPattern", ...grindExtraParamKeys],
    [grindExtraParamKeys]
  );
  const GRIND_COL_LABELS: Record<string, string> = {
    grindType: "Grind Name",
    grindStone: "Stone",
    grindPattern: "Pattern",
    ra_value: "RA-value",
  };
  function formatGrindColLabel(col: string): string {
    if (GRIND_COL_LABELS[col]) return GRIND_COL_LABELS[col];
    // Show the key exactly as written (preserving user capitalisation)
    return col;
  }
  function getEntryGrindValue(entry: TestEntry, col: string): string | null {
    if (col === "grindType") return entry.grindType || null;
    if (col === "grindStone") return entry.grindStone || null;
    if (col === "grindPattern") return entry.grindPattern || null;
    return parseExtraParams(entry.grindExtraParams)[col] ?? null;
  }
  function toggleGrindCol(col: string) {
    setVisibleGrindCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  async function generatePDF() {
    setPdfLoading(true);
    try {
    const res = await fetch(`/api/tests/${id}/pdf`, { credentials: "include" });
    if (!res.ok) {
      let errMsg = `Server returned ${res.status}`;
      try { const body = await res.json(); if (body?.message) errMsg = body.message; } catch {}
      toast({ title: L("PDF mislyktes", "PDF failed"), description: errMsg, variant: "destructive" });
      return;
    }
    const { test: pdfTest, entries: pdfEntries, weather: pdfWeather, comments: pdfComments } = await res.json();

    const isNo = lang === "no";
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // ── Header ──
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(isNo ? "GLIDR — Testrapport" : "GLIDR — Test Report", 14, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(
      `${isNo ? "Generert" : "Generated"} ${new Date().toLocaleDateString(isNo ? "nb-NO" : "en-GB")} ${new Date().toLocaleTimeString(isNo ? "nb-NO" : "en-GB", { hour: "2-digit", minute: "2-digit" })}`,
      14, 24,
    );
    // Development platform tagline (right side)
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(160, 160, 160);
    doc.text(
      isNo ? "Det vi gjorde i dag, er ikke godt nok i morgen." : "What we did today is not good enough tomorrow.",
      pageW - 14, 24, { align: "right" },
    );

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 27, pageW - 14, 27);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`${pdfTest.location} — ${pdfTest.test_type} Test`, 14, 35);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text(`${isNo ? "Dato" : "Date"}: ${pdfTest.date}  |  ${isNo ? "Serie" : "Series"}: ${pdfTest.series_name ?? "—"}  |  ${isNo ? "Opprettet av" : "Created by"}: ${pdfTest.created_by_name ?? "—"}`, 14, 42);

    let y = 50;

    // ── Weather ──
    if (pdfWeather) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text(isNo ? "Vær- og føreforhold" : "Weather Conditions", 14, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      const wx = [
        pdfWeather.air_temperature_c != null ? `${isNo ? "Lufttemp" : "Air Temp"}: ${pdfWeather.air_temperature_c}°C` : null,
        pdfWeather.snow_temperature_c != null ? `${isNo ? "Snøtemp" : "Snow Temp"}: ${pdfWeather.snow_temperature_c}°C` : null,
        pdfWeather.air_humidity_pct != null ? `${isNo ? "Luftfuktighet" : "Air Humidity"}: ${pdfWeather.air_humidity_pct}%rH` : null,
        pdfWeather.snow_humidity_pct != null ? `${isNo ? "Snøfukt (Doser)" : "Snow Hum (Doser)"}: ${pdfWeather.snow_humidity_pct}%` : null,
        pdfWeather.snow_type ? `${isNo ? "Snøtype" : "Snow Type"}: ${pdfWeather.snow_type}` : null,
        pdfWeather.track_hardness ? `${isNo ? "Spor" : "Track"}: ${pdfWeather.track_hardness}` : null,
      ].filter(Boolean).join("   |   ");
      doc.text(wx as string, 14, y);
      y += 10;
    }

    // ── Results table ──
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(isNo ? "Resultater" : "Results", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [[
        isNo ? "Rang" : "Rank",
        "Ski #",
        isNo ? "Produkt" : "Product",
        isNo ? "Metode" : "Methodology",
        isNo ? "Resultat (cm)" : "Result (cm)",
      ]],
      body: pdfEntries.map((e: any) => [
        e.rank0km ?? "—",
        e.ski_number,
        e.brand ? `${e.brand} ${e.product_name}` : "—",
        e.methodology || "—",
        e.result0km_cm_behind != null ? `${e.result0km_cm_behind}` : "—",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const rank = data.cell.raw;
          if (rank === 1) { data.cell.styles.textColor = [16, 185, 129]; data.cell.styles.fontStyle = "bold"; }
          else if (rank === 2) { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = "bold"; }
          else if (rank === 3) { data.cell.styles.textColor = [245, 158, 11]; data.cell.styles.fontStyle = "bold"; }
        }
      },
    });

    // ── Comments ──
    if (pdfComments.length > 0) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? 200;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text(isNo ? "Kommentarer" : "Comments", 14, finalY + 10);
      let cy = finalY + 18;
      for (const c of pdfComments) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text(`${c.user_name}`, 14, cy);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        const lines = doc.splitTextToSize(c.content, pageW - 28);
        doc.text(lines, 14, cy + 5);
        cy += 5 + (lines as string[]).length * 5 + 4;
        doc.setTextColor(0);
      }
    }

    // ── Footer ──
    const pgCount = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : 1;
    const dateStr = new Date().toLocaleString(isNo ? "nb-NO" : "en-GB");
    for (let pg = 1; pg <= pgCount; pg++) {
      doc.setPage(pg);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130, 130, 130);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, pageH - 9, pageW - 14, pageH - 9);
      doc.text(`${isNo ? "Eksportert av" : "Exported by"}: ${pdfTest.created_by_name ?? "—"}  ·  ${dateStr}`, 14, pageH - 5);
      doc.text(isNo ? "Dette dokumentet er kun for teammedlemmer." : "This document is intended for team members only.", pageW - 14, pageH - 5, { align: "right" });
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(0, 0, 0);
    }

    doc.save(`glidr-test-${pdfTest.location}-${pdfTest.date}.pdf`);
    } catch (err: any) {
      toast({ title: L("PDF mislyktes", "PDF failed"), description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  }

  if (testLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20 text-muted-foreground" data-testid="loading-test">
          {t("common.loading")}
        </div>
      </AppShell>
    );
  }

  if (!test) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-20" data-testid="not-found-test">
          <p className="text-muted-foreground">{t("common.noData")}</p>
          <AppLink href="/tests">
            <Button variant="secondary" data-testid="button-back-tests">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("testDetail.backToTests")}
            </Button>
          </AppLink>
        </div>
      </AppShell>
    );
  }

  const isGrind = test.testType === "Grind";
  const isClassic = test.testType === "Classic";
  const grindParams = isGrind && test.grindParameters ? (() => { try { return JSON.parse(test.grindParameters); } catch { return {}; } })() : {};
  const testTypeBadgeClass = test.testType === "Glide" ? "fs-badge-glide" : test.testType === "Grind" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "fs-badge-structure";

  return (
    <AppShell activeNav={isRaceSkiTest ? "/raceskis" : undefined}>
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <AppLink
                href={isGrind ? "/grinding" : (isRaceSkiTest && (test as any).athleteId) ? `/raceskis/${(test as any).athleteId}?tab=tests` : "/tests"}
                testId="link-back-tests"
              >
                <Button variant="ghost" size="sm" data-testid="button-back-tests">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {isGrind
                    ? `${t("testDetail.back")} — ${t("grinding.title")}`
                    : (isRaceSkiTest && (test as any).athleteId)
                    ? L("Tilbake til utøver", "Back to athlete")
                    : t("testDetail.backToTests")}
                </Button>
              </AppLink>
              {allTests.length > 0 && (
                <div className="flex items-center gap-1 ml-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={prevId === null}
                    onClick={() => prevId && navigate(`/tests/${prevId}`)}
                    data-testid="button-prev-test"
                    className="h-8 w-8 p-0"
                    title={L("Forrige test", "Previous test")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {testIndex >= 0 ? `${testIndex + 1} / ${allTests.length}` : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={nextId === null}
                    onClick={() => nextId && navigate(`/tests/${nextId}`)}
                    data-testid="button-next-test"
                    className="h-8 w-8 p-0"
                    title={L("Neste test", "Next test")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {/* Mobile: collapse all actions into a single "Options" dropdown so they
                don't overflow horizontally on narrow screens. */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-test-options">
                    <MoreHorizontal className="mr-2 h-4 w-4" />
                    {L("Valg", "Options")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {!isBlindTester && (
                    <DropdownMenuItem onClick={() => setHideDetails((v) => !v)}>
                      {hideDetails ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                      {hideDetails ? t("tests.showBlind") : t("tests.hideBlind")}
                    </DropdownMenuItem>
                  )}
                  {!isBlindTester && isRaceSkiTest && sortedEntries.length > 0 && (
                    <DropdownMenuItem onClick={openFeeling}>
                      <Award className="mr-2 h-4 w-4" />
                      {L("Feelingtest", "Feeling test")}
                    </DropdownMenuItem>
                  )}
                  {sortedEntries.length >= 2 && (
                    <DropdownMenuItem onClick={() => setShowRunsheet(true)}>
                      <Trophy className="mr-2 h-4 w-4" />
                      {t("testDetail.runsheet")}
                    </DropdownMenuItem>
                  )}
                  {(test as any)?.runsheetBracket && (
                    <DropdownMenuItem onClick={() => setShowReviewRunsheet(true)}>
                      <ClipboardList className="mr-2 h-4 w-4" />
                      {t("testDetail.runsheet")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {isSuperAdmin && (
                    <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                      <Share2 className="mr-2 h-4 w-4" />
                      {t("testDetail.shareLink")}
                    </DropdownMenuItem>
                  )}
                  {canEditTests && (
                    <DropdownMenuItem onClick={copyPublicLink} disabled={copyLinkLoading}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Copy link
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setLocation(`/tests/new?duplicate=${id}`)}>
                    <Copy className="mr-2 h-4 w-4" />
                    {t("newTest.duplicateTest")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={generatePDF} disabled={pdfLoading}>
                    <FileText className="mr-2 h-4 w-4" />
                    {pdfLoading ? "Generating…" : "PDF"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openEditTest}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("testDetail.editTest")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteDialog(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("testDetail.deleteTest")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="hidden sm:flex items-center gap-2 flex-wrap justify-end">
              {sortedEntries.length >= 2 && (
                <Button variant="outline" size="sm" onClick={() => setShowRunsheet(true)} data-testid="button-complete-runsheet">
                  <Trophy className="mr-2 h-4 w-4" />
                  {t("testDetail.runsheet")}
                </Button>
              )}
              {(test as any)?.runsheetBracket && (
                <Button variant="outline" size="sm" onClick={() => setShowReviewRunsheet(true)} data-testid="button-review-runsheet">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  {t("testDetail.runsheet")}
                </Button>
              )}
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)} data-testid="button-share-test">
                  <Share2 className="mr-2 h-4 w-4" />
                  {t("testDetail.shareLink")}
                </Button>
              )}
              {canEditTests && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={copyLinkLoading}
                  data-testid="button-copy-link"
                  onClick={copyPublicLink}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Copy link
                </Button>
              )}
              <AppLink href={`/tests/new?duplicate=${id}`} testId="link-duplicate-test">
                <Button variant="outline" size="sm" data-testid="button-duplicate-test">
                  <Copy className="mr-2 h-4 w-4" />
                  {t("newTest.duplicateTest")}
                </Button>
              </AppLink>
              <Button variant="outline" size="sm" onClick={generatePDF} disabled={pdfLoading} className="gap-1.5 cursor-pointer" data-testid="button-download-pdf">
                <FileText className="h-4 w-4" />
                {pdfLoading ? "Generating…" : "PDF"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-edit-test"
                onClick={openEditTest}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t("testDetail.editTest")}
              </Button>
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" data-testid="button-delete-test">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("testDetail.deleteTest")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("testDetail.deleteTest")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("testDetail.confirmDelete")} "{(test as any).testName || test.location}" ({test.date})
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate()}
                      data-testid="button-confirm-delete-test"
                    >
                      {deleteMutation.isPending ? t("common.deleting") : t("common.delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-test-title">
              {(test as any).testName || test.location}
            </h1>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", testTypeBadgeClass)} data-testid="badge-test-type">
              {test.testType}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{fmtDate(test.date)} · {seriesById.get(test.seriesId) ?? "Series"} · {test.groupScope}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="fs-card rounded-2xl p-4 sm:p-5" data-testid="card-test-metadata">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <FlaskConical className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-base font-semibold">{t("testDetail.title")}</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-background/40 px-3 py-2.5">
                <Calendar className="h-4 w-4 text-primary/70" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("common.date")}</div>
                  <div className="text-sm font-medium" data-testid="text-test-date">
                    {fmtDate(test.date)}
                    {(test as any).startTime && (
                      <span className="ml-2 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />{(test as any).startTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-background/40 px-3 py-2.5">
                <MapPin className="h-4 w-4 text-emerald-600/70" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("common.location")}</div>
                  <div className="text-sm font-medium" data-testid="text-test-location">{test.location}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("tests.series")}</div>
                  <div className="text-sm font-medium" data-testid="text-test-series">{seriesById.get(test.seriesId) ?? "—"}</div>
                </div>
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("common.created")} {t("common.by")}</div>
                  <div className="text-sm font-medium" data-testid="text-test-created-by">{test.createdByName}</div>
                </div>
              </div>
              {distLabels.length > 0 && (
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("testDetail.distance")}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {distLabels.map((label, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {label || `Round ${i + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {test.notes && (
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("common.notes")}</div>
                  <div className="text-sm" data-testid="text-test-notes">{test.notes}</div>
                </div>
              )}
              {isGrind && (grindParams.grindType || grindParams.stone || grindParams.pattern) && (
                <div className="rounded-xl bg-indigo-50/50 px-3 py-2.5 ring-1 ring-indigo-100">
                  <div className="text-[11px] uppercase tracking-wider text-indigo-600/70 mb-1">{t("testDetail.grindParams")}</div>
                  <div className="flex flex-wrap gap-2">
                    {grindParams.grindType && (
                      <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700" data-testid="text-grind-type">{grindParams.grindType}</span>
                    )}
                    {grindParams.stone && (
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80" data-testid="text-grind-stone">{grindParams.stone}</span>
                    )}
                    {grindParams.pattern && (
                      <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80" data-testid="text-grind-pattern">{grindParams.pattern}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {weather && (
            <Card className="fs-card rounded-2xl p-4 sm:p-5" data-testid="card-test-weather">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50">
                  <Snowflake className="h-4 w-4 text-sky-600" />
                </div>
                <h2 className="text-base font-semibold">{t("testDetail.weather")}</h2>
                {weather.testQuality != null && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-200">
                    {t("weather.testQuality")} {weather.testQuality}/10
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl fs-gradient-emerald px-3 py-3 ring-1 ring-emerald-500/10" data-testid="text-weather-snow-temp">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-700/70">
                    <Thermometer className="h-3 w-3" /> {t("testDetail.snowTemp")}
                  </div>
                  <div className="mt-1 text-lg font-bold text-emerald-700">{weather.snowTemperatureC}°C</div>
                </div>
                <div className="rounded-xl fs-gradient-blue px-3 py-3 ring-1 ring-sky-500/10" data-testid="text-weather-air-temp">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-sky-700/70">
                    <Thermometer className="h-3 w-3" /> {t("testDetail.airTemp")}
                  </div>
                  <div className="mt-1 text-lg font-bold text-sky-700">{weather.airTemperatureC}°C</div>
                </div>
                {weather.snowHumidityPct != null && (
                  <div className="rounded-xl fs-gradient-amber px-3 py-3 ring-1 ring-amber-500/10" data-testid="text-weather-snow-humidity">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-300/70">
                      <Droplets className="h-3 w-3" /> Snow humidity
                    </div>
                    <div className="mt-1 text-lg font-bold text-amber-300">{weather.snowHumidityPct}%</div>
                  </div>
                )}
                {weather.airHumidityPct != null && (
                  <div className="rounded-xl fs-gradient-violet px-3 py-3 ring-1 ring-violet-500/10" data-testid="text-weather-air-humidity">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-violet-700/70">
                      <Droplets className="h-3 w-3" /> Air humidity
                    </div>
                    <div className="mt-1 text-lg font-bold text-violet-700">{weather.airHumidityPct}%rH</div>
                  </div>
                )}
              </div>

              {(weather.clouds != null || weather.visibility || weather.wind || weather.precipitation) && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {weather.clouds != null && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("weather.clouds").replace(" (%)", "")}</div>
                      <div className="text-sm font-medium">{weather.clouds}/8</div>
                    </div>
                  )}
                  {weather.visibility && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("weather.visibility")}</div>
                      <div className="text-sm font-medium">{weather.visibility}</div>
                    </div>
                  )}
                  {weather.wind && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("weather.wind")}</div>
                      <div className="text-sm font-medium">{weather.wind}</div>
                    </div>
                  )}
                  {weather.precipitation && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("weather.precipitation")}</div>
                      <div className="text-sm font-medium">{weather.precipitation}</div>
                    </div>
                  )}
                </div>
              )}

              {(weather.artificialSnow || weather.naturalSnow || weather.grainSize || weather.snowHumidityType || weather.trackHardness) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {weather.artificialSnow && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-medium text-pink-700 ring-1 ring-pink-200">
                      {t("weather.artificialSnow")}: {weather.artificialSnow}
                    </span>
                  )}
                  {weather.naturalSnow && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                      {t("weather.naturalSnow")}: {weather.naturalSnow}
                    </span>
                  )}
                  {weather.grainSize && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-300 ring-1 ring-orange-500/20">
                      {t("weather.grainSize")}: {weather.grainSize}
                    </span>
                  )}
                  {weather.snowHumidityType && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-500/20">
                      {t("weather.snowHumidityType")}: {weather.snowHumidityType}
                    </span>
                  )}
                  {weather.trackHardness && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-300 ring-1 ring-rose-200">
                      {t("testDetail.trackHardness")}: {weather.trackHardness}
                    </span>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>

        <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-test-results">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
                <Award className="h-4 w-4 text-emerald-600" />
              </div>
              <h2 className="text-base font-semibold">{t("common.results")}</h2>
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">{sortedEntries.length} {t("testDetail.entries")}</span>
              {rankBothAvailable && (
                <div className="ml-1 inline-flex rounded-lg border border-border bg-background/60 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => chooseRankBasis("diff")}
                    className={cn("rounded-md px-2 py-0.5 transition-colors", rankBasis === "diff" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                    data-testid="rank-by-diff"
                  >
                    {L("Rangér på diff", "Rank by diff")}
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseRankBasis("feel")}
                    className={cn("rounded-md px-2 py-0.5 transition-colors", rankBasis === "feel" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                    data-testid="rank-by-feel"
                  >
                    {L("Rangér på feeling", "Rank by feel")}
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isBlindTester && <>
              {hasWatchAccess && <AddToWatchButton testId={test.id} testName={test.testName || `${test.location} · ${test.date}`} seriesId={test.seriesId} />}
              </>}
              {!isBlindTester && (
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex"
                  data-testid="button-toggle-hide"
                  onClick={() => setHideDetails((v) => !v)}
                >
                  {hideDetails ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                  {hideDetails ? t("tests.showBlind") : t("tests.hideBlind")}
                </Button>
              )}
              {!isBlindTester && isRaceSkiTest && sortedEntries.length > 0 && (
                <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={openFeeling} data-testid="button-feelingtest">
                  <Award className="mr-2 h-4 w-4" />
                  {L("Feelingtest", "Feeling test")}
                </Button>
              )}
            </div>
          </div>
          {/* Grind column chooser */}
          {isGrind && allGrindCols.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mr-1">{t("testDetail.skiNo")}:</span>
              {allGrindCols.map((col) => {
                const active = visibleGrindCols.includes(col);
                const label = formatGrindColLabel(col);
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => toggleGrindCol(col)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition-colors",
                      active
                        ? "bg-violet-600 text-white ring-violet-600"
                        : "bg-muted text-muted-foreground ring-border hover:ring-violet-400 hover:text-foreground"
                    )}
                    data-testid={`toggle-grind-col-${col}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {sortedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="empty-entries">
              {t("testDetail.noEntries")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-results">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground select-none">
                    <th className="pb-3 pr-3 cursor-pointer hover:text-foreground" onClick={() => toggleTestSort("skiNumber")}>{isRaceSkiTest ? "Ski-ID" : t("tests.skiNumber")}{testSortArrow("skiNumber")}</th>
                    {!isGrind && <th className="pb-3 pr-3">{t("tests.product")}</th>}
                    {isGrind && visibleGrindCols.map((col) => (
                      <th key={col} className="pb-3 pr-3 cursor-pointer hover:text-foreground" onClick={() => toggleTestSort(`grind:${col}`)}>{formatGrindColLabel(col)}{testSortArrow(`grind:${col}`)}</th>
                    ))}
                    {distLabels.map((label, i) => (
                      <th key={i} className="pb-3 pr-3 cursor-pointer hover:text-foreground" onClick={() => toggleTestSort(`diff${i}`)}>
                        {(label?.trim() || `Round ${i + 1}`)} ({t("tests.cmBehind")}){testSortArrow(`diff${i}`)}
                      </th>
                    ))}
                    <th className="pb-3 pr-3 cursor-pointer hover:text-foreground" onClick={() => toggleTestSort("rank")}>{t("common.rank")}{testSortArrow("rank")}</th>
                    <th className="pb-3 cursor-pointer hover:text-foreground" onClick={() => toggleTestSort("feeling")}>{t("newTest.feeling")}{testSortArrow("feeling")}</th>
                    {isClassic && <th className="pb-3 pl-3 cursor-pointer hover:text-foreground" onClick={() => toggleTestSort("kick")}>{t("newTest.kick")}{testSortArrow("kick")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry, idx) => {
                    const product = entry.productId
                      ? productsById.get(entry.productId)
                      : null;
                    const additionalIds = entry.additionalProductIds
                      ? entry.additionalProductIds.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
                      : [];
                    // Pair each product with its parsed application (pipe-separated)
                    const appParts = entry.methodology ? entry.methodology.split("|") : [];
                    const productEntries = [
                      product ? { name: `${product.brand} ${product.name}`, app: parseApplication(appParts[0]?.trim() ?? "").interpreted } : null,
                      ...additionalIds.map((aid, i) => {
                        const p = productsById.get(aid);
                        return p ? { name: `${p.brand} ${p.name}`, app: parseApplication(appParts[i + 1]?.trim() ?? "").interpreted } : null;
                      }),
                    ].filter((x): x is { name: string; app: string } => !!x);

                    const rounds = getEntryRounds(entry, distLabels.length);
                    const firstRank = rounds[0]?.rank ?? null;
                    // Displayed rank follows the chosen basis; analytics still uses diff (firstRank).
                    const displayRank = rankBothAvailable && rankBasis === "feel" ? (entry.feelingRank ?? null) : firstRank;

                    return (
                      <tr
                        key={entry.id}
                        data-testid={`row-entry-${entry.id}`}
                        className={cn(
                          "border-b border-border/30 last:border-0 transition-colors",
                          displayRank === 1 && "bg-emerald-500/8",
                          displayRank === 2 && "bg-sky-500/8",
                          displayRank === 3 && "bg-amber-500/8",
                          idx % 2 === 0 && !displayRank && "bg-background/20",
                        )}
                      >
                        <td className="py-3 pr-3" data-testid={`text-ski-number-${entry.id}`}>
                          <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-lg bg-background/50 px-2 text-sm font-semibold ring-1 ring-border/50">
                            {skiLabels?.[entry.skiNumber] ?? entry.skiNumber}
                          </span>
                          {isRaceSkiTest && entry.raceSkiId && (() => {
                            const g = raceSkisData.find((rs) => rs.id === entry.raceSkiId)?.grind;
                            return g ? <div className="mt-0.5 text-[10px] text-muted-foreground">{g}</div> : null;
                          })()}
                        </td>
                        {!isGrind && (
                          <td className="py-3 pr-5" data-testid={`text-product-${entry.id}`}>
                            {hideDetails ? "" : (
                              productEntries.length > 0 ? (
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  {productEntries.map((pe, i) => (
                                    <span key={i} className="flex items-baseline gap-1.5 text-sm">
                                      <span className="font-medium">{pe.name}</span>
                                      {pe.app && (
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{pe.app}</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              ) : "—"
                            )}
                          </td>
                        )}
                        {isGrind && visibleGrindCols.map((col) => (
                          <td key={col} className="py-3 pr-3 text-sm text-muted-foreground" data-testid={`text-grind-${col}-${entry.id}`}>
                            {getEntryGrindValue(entry, col) ?? <span className="opacity-40">—</span>}
                          </td>
                        ))}
                        {rounds.map((rr, roundIdx) => (
                          <td key={`res-${roundIdx}`} className="py-3 pr-3 font-mono text-sm" data-testid={`text-result-${roundIdx}-${entry.id}`}>
                            {rr.result ?? "—"}
                          </td>
                        ))}
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <RankBadge rank={displayRank} size="lg" />
                            {!hideDetails && displayRank === 1 && (
                              <span
                                className="rounded-full bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 ring-1 ring-emerald-500/30"
                                data-testid={`badge-winner-${entry.id}`}
                              >
                                {t("common.winner")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3" data-testid={`text-feeling-${entry.id}`}>
                          {entry.feelingRank != null ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex min-w-8 w-fit items-center justify-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-700">
                                {entry.feelingRank}
                              </span>
                              {(entry as any).feelingNote ? (
                                <span className="text-xs text-muted-foreground italic max-w-[12rem] whitespace-normal break-words" data-testid={`text-feeling-note-${entry.id}`}>
                                  {(entry as any).feelingNote}
                                </span>
                              ) : null}
                            </div>
                          ) : "—"}
                        </td>
                        {isClassic && (
                        <td className="py-3 pl-3" data-testid={`text-kick-${entry.id}`}>
                          {entry.kickRank != null ? (
                            <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-semibold text-orange-700">
                              {entry.kickRank}
                            </span>
                          ) : "—"}
                        </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <AttachmentsSection testId={test.id} />

        <CommentsSection testId={test.id} />

        {sortedEntries.length >= 2 && (
          <RunsheetDialog
            open={showRunsheet}
            onOpenChange={setShowRunsheet}
            skiPairs={sortedEntries.map((e) => e.skiNumber)}
            skiLabels={skiLabels}
            testId={test.id}
            onApplyResults={(results, bracket) => runsheetMutation.mutate({ results, bracket })}
          />
        )}

        {(test as any)?.runsheetBracket && (
          <ReviewRunsheetDialog
            open={showReviewRunsheet}
            onOpenChange={setShowReviewRunsheet}
            bracketJson={(test as any).runsheetBracket}
            skiLabels={skiLabels}
            watchOperatorName={(test as any).watchOperatorName}
          />
        )}

        <Dialog open={feelingOpen} onOpenChange={setFeelingOpen}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{L("Feelingtest", "Feeling test")}</DialogTitle></DialogHeader>
              <p className="text-xs text-muted-foreground -mt-1">{L("Dra skiparene i rekkefølge (eller bruk pilene) — 1 = best. Rangen lagres som «Feeling».", "Drag the ski pairs into order (or use the arrows) — 1 = best. The rank is saved as “Feeling”.")}</p>
              <div className="space-y-1.5 pb-12 sm:pb-0">
                {feelingOrder.map((eid, i) => {
                  const entry = entries.find((e) => e.id === eid);
                  if (!entry) return null;
                  const label = skiLabels?.[entry.skiNumber] ?? `#${entry.skiNumber}`;
                  return (
                    <div
                      key={eid}
                      draggable
                      onDragStart={() => { feelingDragIdx.current = i; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => feelingDrop(i)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5"
                      data-testid={`feeling-row-${eid}`}
                    >
                      <span className="cursor-grab active:cursor-grabbing select-none text-muted-foreground text-sm shrink-0" title={L("Dra for å sortere", "Drag to reorder")}>⠿</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold shrink-0">{i + 1}</span>
                      <span className="font-medium text-sm shrink-0 min-w-[3rem]">{label}</span>
                      <Input value={feelingNotes[eid] ?? ""} onChange={(e) => setFeelingNotes((p) => ({ ...p, [eid]: e.target.value }))} placeholder={L("Kommentar…", "Comment…")} className="h-7 text-xs flex-1" data-testid={`feeling-note-${eid}`} />
                      <div className="flex flex-col shrink-0">
                        <button type="button" disabled={i === 0} onClick={() => setFeelingOrder((p) => { const j = i - 1; if (j < 0) return p; const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n; })} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none">▲</button>
                        <button type="button" disabled={i === feelingOrder.length - 1} onClick={() => setFeelingOrder((p) => { const j = i + 1; if (j >= p.length) return p; const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n; })} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none">▼</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFeelingOpen(false)}>{L("Avbryt", "Cancel")}</Button>
                <Button onClick={() => feelingMutation.mutate()} disabled={feelingMutation.isPending} data-testid="button-save-feeling">
                  {feelingMutation.isPending ? L("Lagrer…", "Saving…") : L("Lagre rangering", "Save ranking")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        {isSuperAdmin && (
          <Dialog open={showShareDialog} onOpenChange={(open) => { setShowShareDialog(open); if (!open) setSelectedTeamIds([]); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("testDetail.shareLink")}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto py-2">
                {allTeams
                  .filter((t: TeamItem) => t.id !== test?.teamId)
                  .map((t: TeamItem) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`team-${t.id}`}
                        checked={selectedTeamIds.includes(t.id)}
                        onCheckedChange={(checked) => {
                          setSelectedTeamIds((prev) =>
                            checked ? [...prev, t.id] : prev.filter((tid) => tid !== t.id)
                          );
                        }}
                        data-testid={`checkbox-team-${t.id}`}
                      />
                      <label htmlFor={`team-${t.id}`} className="cursor-pointer text-sm">{t.name}</label>
                    </div>
                  ))}
                {allTeams.filter((t: TeamItem) => t.id !== test?.teamId).length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setShowShareDialog(false); setSelectedTeamIds([]); }} data-testid="button-cancel-share">
                  {t("common.cancel")}
                </Button>
                <Button
                  disabled={selectedTeamIds.length === 0 || shareMutation.isPending}
                  onClick={() => shareMutation.mutate(selectedTeamIds)}
                  data-testid="button-confirm-share"
                >
                  {shareMutation.isPending ? t("common.sending") : `${t("testDetail.shareLink")} (${selectedTeamIds.length})`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </AppShell>
  );
}
