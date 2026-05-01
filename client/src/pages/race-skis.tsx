import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Users, LayoutGrid, List } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Athlete = {
  id: number;
  name: string;
  team: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
};

export default function RaceSkis() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try {
      const stored = localStorage.getItem("glidr-raceskis-view-mode");
      if (stored === "list" || stored === "grid") return stored;
    } catch {}
    return "grid";
  });

  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ["/api/athletes"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; team: string }) => {
      const res = await apiRequest("POST", "/api/athletes", {
        name: data.name,
        team: data.team.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/athletes"] });
      toast({ title: "Athlete added" });
      setOpen(false);
      setName("");
      setTeam("");
    },
    onError: (e) => {
      toast({
        title: "Could not add athlete",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), team: team.trim() });
  };

  function toggleView(mode: "grid" | "list") {
    setViewMode(mode);
    try { localStorage.setItem("glidr-raceskis-view-mode", mode); } catch {}
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl" data-testid="text-raceskis-title">
              Raceskis
            </h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-raceskis-subtitle">
              Manage athlete profiles and race ski inventory
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5" data-testid="view-mode-toggle">
              <button
                onClick={() => toggleView("grid")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid="button-view-grid"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Grid
              </button>
              <button
                onClick={() => toggleView("list")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid="button-view-list"
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>

          <Dialog open={open} onOpenChange={(v) => {
            setOpen(v);
            if (!v) { setName(""); setTeam(""); }
          }}>
            <DialogTrigger asChild>
              <Button
                data-testid="button-add-athlete"
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Athlete
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Athlete</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Johannes Klæbo"
                    required
                    data-testid="input-athlete-name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Team</label>
                  <Input
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder="e.g., Norway"
                    data-testid="input-athlete-team"
                  />
                </div>
                <div className="flex items-center justify-end">
                  <Button
                    type="submit"
                    data-testid="button-save-athlete"
                    disabled={createMutation.isPending || !name.trim()}
                  >
                    {createMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Athletes list */}
        {athletes.length === 0 ? (
          <Card
            className="fs-card rounded-2xl p-6 text-sm text-muted-foreground"
            data-testid="empty-athletes"
          >
            No athletes yet. Add your first athlete to get started.
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {athletes.map((athlete) => (
              <AppLink
                key={athlete.id}
                href={`/raceskis/${athlete.id}`}
                testId={`link-athlete-${athlete.id}`}
              >
                <Card
                  className="fs-card rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer"
                  data-testid={`card-athlete-${athlete.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold" data-testid={`text-athlete-name-${athlete.id}`}>
                        {athlete.name}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {athlete.team && (
                          <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800">
                            <Users className="mr-1 h-3 w-3" />
                            {athlete.team}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground" data-testid={`text-athlete-created-by-${athlete.id}`}>
                          {athlete.createdByName}
                        </span>
                      </div>
                    </div>
                    <div className="inline-flex rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                      {new Date(athlete.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Card>
              </AppLink>
            ))}
          </div>
        ) : (
          /* List view */
          <Card className="fs-card rounded-2xl overflow-hidden" data-testid="list-athletes">
            <div className="divide-y divide-border/40">
              {athletes.map((athlete) => (
                <AppLink
                  key={athlete.id}
                  href={`/raceskis/${athlete.id}`}
                  testId={`link-athlete-${athlete.id}`}
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 cursor-pointer"
                    data-testid={`row-athlete-${athlete.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-sm" data-testid={`text-athlete-name-${athlete.id}`}>
                        {athlete.name}
                      </span>
                    </div>
                    {athlete.team && (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800 shrink-0">
                        <Users className="mr-1 h-3 w-3" />
                        {athlete.team}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0" data-testid={`text-athlete-created-by-${athlete.id}`}>
                      {athlete.createdByName}
                    </span>
                  </div>
                </AppLink>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
