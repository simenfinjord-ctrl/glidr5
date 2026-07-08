import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Users, LayoutGrid, List, Archive, ArchiveRestore, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Athlete = {
  id: number;
  name: string;
  team: string | null;
  defaultSkiBrand: string | null;
  heightCm: string | null;
  weightKg: string | null;
  poleHeight: string | null;
  poleHeightSkate: string | null;
  bindingPosition: string | null;
  skiServicePreferences: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
  archived?: number;
};

// Compact profile chips (brand, height, weight, pole, binding) shown per athlete.
function athleteMetricChips(a: Athlete, lang: string): { label: string; value: string }[] {
  const L = (no: string, en: string) => (lang === "no" ? no : en);
  return ([
    [L("Merke", "Brand"), a.defaultSkiBrand],
    [L("Høyde", "Height"), a.heightCm ? `${a.heightCm} cm` : null],
    [L("Vekt", "Weight"), a.weightKg ? `${a.weightKg} kg` : null],
    [L("Stav (kl.)", "Pole (cl.)"), a.poleHeight],
    [L("Stav (sk.)", "Pole (sk.)"), a.poleHeightSkate],
    [L("Binding", "Binding"), a.bindingPosition],
  ] as [string, string | null][])
    .filter(([, v]) => !!v)
    .map(([label, value]) => ({ label, value: value as string }));
}

export default function RaceSkis() {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [brand, setBrand] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [poleHeight, setPoleHeight] = useState("");
  const [poleHeightSkate, setPoleHeightSkate] = useState("");
  const [bindingPosition, setBindingPosition] = useState("");
  const [skiServicePreferences, setSkiServicePreferences] = useState("");
  const resetAthleteForm = () => { setName(""); setTeam(""); setBrand(""); setHeightCm(""); setWeightKg(""); setPoleHeight(""); setPoleHeightSkate(""); setBindingPosition(""); setSkiServicePreferences(""); };
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    try {
      const stored = localStorage.getItem("glidr-raceskis-view-mode");
      if (stored === "list" || stored === "grid") return stored;
    } catch {}
    return "grid";
  });

  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");

  const { data: allAthletes = [] } = useQuery<Athlete[]>({
    queryKey: ["/api/athletes?includeArchived=1"],
  });
  const activeAthletes = allAthletes.filter((a) => !a.archived);
  const archivedAthletes = allAthletes.filter((a) => a.archived);
  const q = search.trim().toLowerCase();
  const matchesSearch = (a: Athlete) =>
    !q || a.name.toLowerCase().includes(q) || (a.team ?? "").toLowerCase().includes(q) || (a.defaultSkiBrand ?? "").toLowerCase().includes(q);
  // While searching, span BOTH active and archived athletes so an archived one
  // is findable without first switching to the archive view; otherwise honour
  // the archive toggle.
  const athletes = (q ? allAthletes : (showArchived ? archivedAthletes : activeAthletes)).filter(matchesSearch);

  const canEdit = can("raceskis", "edit");

  const archiveMutation = useMutation({
    mutationFn: async (data: { id: number; archived: boolean }) => {
      const res = await apiRequest("POST", `/api/athletes/${data.id}/archive`, { archived: data.archived });
      return res.json();
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/athletes?includeArchived=1"] });
      queryClient.invalidateQueries({ queryKey: ["/api/athletes"] });
      toast({ title: vars.archived ? L("Utøver arkivert", "Athlete archived") : L("Utøver gjenopprettet", "Athlete restored") });
    },
    onError: (e) => toast({ title: L("Handlingen mislyktes", "Action failed"), description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  const toggleArchive = (e: React.MouseEvent, athlete: Athlete) => {
    e.preventDefault();
    e.stopPropagation();
    archiveMutation.mutate({ id: athlete.id, archived: !athlete.archived });
  };

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; team: string; brand: string; heightCm: string; weightKg: string; poleHeight: string; poleHeightSkate: string; bindingPosition: string; skiServicePreferences: string }) => {
      const res = await apiRequest("POST", "/api/athletes", {
        name: data.name,
        team: data.team.trim() || null,
        defaultSkiBrand: data.brand.trim() || null,
        heightCm: data.heightCm.trim() || null,
        weightKg: data.weightKg.trim() || null,
        poleHeight: data.poleHeight.trim() || null,
        poleHeightSkate: data.poleHeightSkate.trim() || null,
        bindingPosition: data.bindingPosition.trim() || null,
        skiServicePreferences: data.skiServicePreferences.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/athletes?includeArchived=1"] });
      queryClient.invalidateQueries({ queryKey: ["/api/athletes"] });
      toast({ title: t("raceskis.athleteAdded") });
      setOpen(false);
      resetAthleteForm();
    },
    onError: (e) => {
      toast({
        title: t("raceskis.couldNotAdd"),
        description: e instanceof Error ? e.message : t("raceskis.unknownError"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), team: team.trim(), brand: brand.trim(), heightCm, weightKg, poleHeight, poleHeightSkate, bindingPosition, skiServicePreferences });
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
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-raceskis-title">
              {t("raceskis.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-raceskis-subtitle">
              {t("raceskis.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Archived toggle */}
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                showArchived
                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                  : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
              )}
              data-testid="button-toggle-archived"
            >
              <Archive className="h-3.5 w-3.5" />
              {showArchived ? L("Viser arkiv", "Showing archive") : L("Arkivert", "Archived")}
              {archivedAthletes.length > 0 && (
                <span className="rounded-full bg-amber-200/70 px-1.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-800/50 dark:text-amber-200">{archivedAthletes.length}</span>
              )}
            </button>

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
            if (!v) resetAthleteForm();
          }}>
            <DialogTrigger asChild>
              <Button
                data-testid="button-add-athlete"
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("raceskis.addAthlete")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("raceskis.addAthlete")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{L("Navn", "Name")}</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={L("f.eks. Johannes Klæbo", "e.g., Johannes Klæbo")}
                    required
                    data-testid="input-athlete-name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{L("Lag", "Team")}</label>
                  <Input
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder={L("f.eks. Norge", "e.g., Norway")}
                    data-testid="input-athlete-team"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{L("Standard skimerke", "Default ski brand")}</label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder={L("f.eks. Madshus", "e.g., Madshus")}
                    data-testid="input-athlete-brand"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{L("Fylles automatisk inn på nye skipar.", "Auto-fills on every new ski pair.")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{L("Høyde (cm)", "Height (cm)")}</label>
                    <Input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="180" data-testid="input-athlete-height" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{L("Vekt (kg)", "Weight (kg)")}</label>
                    <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="72" data-testid="input-athlete-weight" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{L("Stavhøyde (klassisk)", "Pole height (classic)")}</label>
                    <Input value={poleHeight} onChange={(e) => setPoleHeight(e.target.value)} placeholder="152 cm" data-testid="input-athlete-pole-height" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{L("Stavhøyde (skøyt)", "Pole height (skate)")}</label>
                    <Input value={poleHeightSkate} onChange={(e) => setPoleHeightSkate(e.target.value)} placeholder="162 cm" data-testid="input-athlete-pole-height-skate" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{L("Bindingsposisjon", "Binding position")}</label>
                    <Input value={bindingPosition} onChange={(e) => setBindingPosition(e.target.value)} placeholder="0 / -1 cm" data-testid="input-athlete-binding" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{L("Ski-service-preferanser", "Ski-service preferences")}</label>
                  <Textarea value={skiServicePreferences} onChange={(e) => setSkiServicePreferences(e.target.value)} rows={3} placeholder={L("f.eks. trenger godt feste, vil bare teste 2 par på renndagen, foretrekker varm grunning…", "e.g., needs solid kick, only wants to test 2 pairs on race day, prefers warm base prep…")} data-testid="input-athlete-service-prefs" />
                </div>
                <div className="flex items-center justify-end">
                  <Button
                    type="submit"
                    data-testid="button-save-athlete"
                    disabled={createMutation.isPending || !name.trim()}
                  >
                    {createMutation.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Search — spans both active and archived athletes */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L("Søk i aktive og arkiverte løpere…", "Search active and archived athletes…")}
            className="pl-9"
            data-testid="input-athlete-search"
          />
        </div>

        {/* Athletes list */}
        {athletes.length === 0 ? (
          <Card
            className="fs-card rounded-2xl p-6 text-sm text-muted-foreground"
            data-testid="empty-athletes"
          >
            {q ? L("Ingen løpere samsvarer med søket.", "No athletes match your search.") : showArchived ? L("Ingen arkiverte utøvere.", "No archived athletes.") : t("raceskis.noAthletes")}
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
                        {athlete.archived && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800">
                            <Archive className="mr-1 h-3 w-3" />
                            {L("Arkivert", "Archived")}
                          </span>
                        )}
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
                      {athleteMetricChips(athlete, language).length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid={`athlete-metrics-${athlete.id}`}>
                          {athleteMetricChips(athlete, language).map((m) => (
                            <span key={m.label} className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                              <span className="font-medium text-foreground">{m.label}:</span> {m.value}
                            </span>
                          ))}
                        </div>
                      )}
                      {athlete.skiServicePreferences && (
                        <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-200/60 dark:ring-amber-900/40 px-2.5 py-1.5">
                          <div className="text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">{language === "no" ? "Ski-service" : "Ski service"}</div>
                          <div className="text-[11px] text-foreground/90 whitespace-pre-wrap line-clamp-3">{athlete.skiServicePreferences}</div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="inline-flex rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                        {new Date(athlete.createdAt).toLocaleDateString()}
                      </div>
                      {canEdit && (
                        <button
                          onClick={(e) => toggleArchive(e, athlete)}
                          disabled={archiveMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          data-testid={`button-archive-athlete-${athlete.id}`}
                        >
                          {athlete.archived ? (<><ArchiveRestore className="h-3 w-3" />{L("Gjenopprett", "Restore")}</>) : (<><Archive className="h-3 w-3" />{L("Arkiver", "Archive")}</>)}
                        </button>
                      )}
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
                      {athlete.archived && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800 align-middle">
                          <Archive className="mr-1 h-3 w-3" />
                          {L("Arkivert", "Archived")}
                        </span>
                      )}
                      {athleteMetricChips(athlete, language).length > 0 && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          {athleteMetricChips(athlete, language).map((m) => (
                            <span key={m.label}><span className="font-medium text-foreground">{m.label}:</span> {m.value}</span>
                          ))}
                        </div>
                      )}
                      {athlete.skiServicePreferences && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                          <span className="font-medium text-amber-700 dark:text-amber-400">{language === "no" ? "Ski-service" : "Ski service"}:</span> {athlete.skiServicePreferences}
                        </div>
                      )}
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
                    {canEdit && (
                      <button
                        onClick={(e) => toggleArchive(e, athlete)}
                        disabled={archiveMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                        data-testid={`button-archive-athlete-${athlete.id}`}
                        title={athlete.archived ? L("Gjenopprett", "Restore") : L("Arkiver", "Archive")}
                      >
                        {athlete.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </button>
                    )}
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
