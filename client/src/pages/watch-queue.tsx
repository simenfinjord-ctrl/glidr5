import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Watch, Trash2, RotateCcw, RefreshCw, Eye, Archive, List, Copy, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type QueueItem = {
  id: number;
  test_id: number | null;
  series_id: number | null;
  test_name: string | null;
  series_name: string | null;
  added_by_name: string;
  added_at: string;
  status: "active" | "completed";
  completed_at: string | null;
  session_code: string | null;
};

function displayName(item: QueueItem): string {
  return item.test_name || item.series_name || `Test #${item.test_id ?? item.id}`;
}

function SessionCode({ item, isAdmin }: { item: QueueItem; isAdmin: boolean }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/watch/queue/${item.id}/refresh-code`).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/watch/queue"] });
      toast({ title: "New code generated", description: `New code: ${data.code}` });
    },
    onError: () => toast({ title: "Error", description: "Could not refresh code.", variant: "destructive" }),
  });

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!item.session_code) {
    if (!isAdmin) return null;
    return (
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
        onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
        <RefreshCw className={cn("h-3 w-3", refreshMutation.isPending && "animate-spin")} />
        Get code
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono font-bold text-base tracking-[0.25em] text-sky-600 select-all">
        {item.session_code}
      </span>
      <Button variant="ghost" size="icon" className="h-6 w-6" title="Copy code"
        onClick={() => copy(item.session_code!)}>
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </Button>
      {isAdmin && (
        <Button variant="ghost" size="icon" className="h-6 w-6" title="Refresh code"
          onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
          <RefreshCw className={cn("h-3 w-3", refreshMutation.isPending && "animate-spin")} />
        </Button>
      )}
    </div>
  );
}

export default function WatchQueue() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = !!(user?.isAdmin || user?.isTeamAdmin);
  const [tab, setTab] = useState<"active" | "archive">("active");

  const { data: queue = [], isLoading: queueLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/watch/queue"],
  });

  const { data: archive = [], isLoading: archiveLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/watch/queue/archive"],
    enabled: tab === "archive",
  });

  const { data: pinData, refetch: refetchPin } = useQuery<{ pin: string; teamName: string }>({
    queryKey: ["/api/watch/pin"],
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/watch/queue/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/watch/queue"] }),
    onError: () => toast({ title: "Error", description: "Could not remove item.", variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/watch/queue/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watch/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/watch/queue/archive"] });
      toast({ title: "Restored", description: "Test moved back to active queue." });
    },
    onError: () => toast({ title: "Error", description: "Could not restore item.", variant: "destructive" }),
  });

  const regenPinMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/watch/pin/regenerate"),
    onSuccess: () => {
      refetchPin();
      toast({ title: "PIN regenerated", description: "Update the PIN in your Garmin watch app." });
    },
  });

  const items = tab === "active" ? queue : archive;
  const isLoading = tab === "active" ? queueLoading : archiveLoading;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Watch className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Watch Queue</h1>
            <p className="text-sm text-muted-foreground">Tests queued for the Garmin app</p>
          </div>
        </div>

        {/* Watch PIN card */}
        {pinData && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                    Garmin Watch PIN
                  </p>
                  <p className="text-3xl font-mono font-bold tracking-widest text-primary">
                    {pinData.pin}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter this code when setting up the Glidr watch app
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => regenPinMutation.mutate()}
                    disabled={regenPinMutation.isPending}
                    className="shrink-0"
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-1", regenPinMutation.isPending && "animate-spin")} />
                    New PIN
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setTab("active")}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
              tab === "active"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
            Queue
            {queue.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {queue.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setTab("archive")}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
              tab === "archive"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Archive className="h-4 w-4" />
            Archive
          </button>
        </div>

        {/* Items */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {tab === "active" ? (
              <>
                <Watch className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No tests in queue</p>
                <p className="text-sm mt-1">
                  Open a test and click <strong>Add to Watch</strong> to queue it for the Garmin app.
                </p>
              </>
            ) : (
              <>
                <Archive className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No archived tests</p>
                <p className="text-sm mt-1">Completed tests will appear here.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Card key={item.id} className="hover:bg-accent/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{displayName(item)}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                        <span>Added by {item.added_by_name}</span>
                        <span>·</span>
                        <span>{new Date(item.added_at).toLocaleDateString()}</span>
                        {item.completed_at && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-600 font-medium">
                              Done {new Date(item.completed_at).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                      {tab === "active" && (
                        <div className="mt-2">
                          <SessionCode item={item} isAdmin={isAdmin} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.test_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                        >
                          <a href={`/tests/${item.test_id}`}>
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {tab === "archive" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => restoreMutation.mutate(item.id)}
                          disabled={restoreMutation.isPending}
                          title="Restore to queue"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeMutation.mutate(item.id)}
                          disabled={removeMutation.isPending}
                          title="Remove from queue"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
