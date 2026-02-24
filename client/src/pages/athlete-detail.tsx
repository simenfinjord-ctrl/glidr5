import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Users,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Athlete = {
  id: number;
  name: string;
  team: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
};

type RaceSki = {
  id: number;
  athleteId: number;
  serialNumber: string | null;
  skiId: string;
  brand: string | null;
  discipline: string;
  construction: string | null;
  mold: string | null;
  base: string | null;
  grind: string | null;
  heights: string | null;
  year: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
};

type RaceSkiRegrind = {
  id: number;
  raceSkiId: number;
  date: string;
  grindType: string;
  stone: string | null;
  pattern: string | null;
  notes: string | null;
  createdAt: string;
  createdById: number;
  createdByName: string;
};

type AthleteAccess = {
  id: number;
  athleteId: number;
  userId: number;
};

type UserItem = {
  id: number;
  name: string;
  email: string;
};

export default function AthleteDetail() {
  const [, params] = useRoute("/raceskis/:id");
  const [, navigate] = useLocation();
  const athleteId = params?.id ? parseInt(params.id) : null;
  const { user } = useAuth();
  const { toast } = useToast();

  const [skiDialogOpen, setSkiDialogOpen] = useState(false);
  const [editingSki, setEditingSki] = useState<RaceSki | null>(null);
  const [regrindDialogOpen, setRegrindDialogOpen] = useState(false);
  const [regrindSkiId, setRegrindSkiId] = useState<number | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [editAthleteOpen, setEditAthleteOpen] = useState(false);
  const [expandedSkiId, setExpandedSkiId] = useState<number | null>(null);

  const [skiForm, setSkiForm] = useState({
    skiId: "",
    serialNumber: "",
    brand: "",
    discipline: "Classic",
    construction: "",
    mold: "",
    base: "",
    grind: "",
    heights: "",
    year: "",
  });

  const [regrindForm, setRegrindForm] = useState({
    date: new Date().toISOString().split("T")[0],
    grindType: "",
    stone: "",
    pattern: "",
    notes: "",
  });

  const [athleteForm, setAthleteForm] = useState({ name: "", team: "" });
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const { data: athletes = [] } = useQuery<Athlete[]>({
    queryKey: ["/api/athletes"],
  });
  const athlete = athletes.find((a) => a.id === athleteId);

  const { data: skis = [] } = useQuery<RaceSki[]>({
    queryKey: [`/api/athletes/${athleteId}/skis`],
    enabled: !!athleteId,
  });

  const { data: access = [] } = useQuery<AthleteAccess[]>({
    queryKey: [`/api/athletes/${athleteId}/access`],
    enabled: !!athleteId,
  });

  const { data: users = [] } = useQuery<UserItem[]>({
    queryKey: ["/api/users"],
    retry: false,
  });

  const isOwnerOrAdmin =
    user?.isAdmin || (athlete && user?.id === athlete.createdById);

  const createSkiMutation = useMutation({
    mutationFn: async (data: typeof skiForm) => {
      const body = {
        skiId: data.skiId,
        serialNumber: data.serialNumber.trim() || null,
        brand: data.brand.trim() || null,
        discipline: data.discipline,
        construction: data.construction.trim() || null,
        mold: data.mold.trim() || null,
        base: data.base.trim() || null,
        grind: data.grind.trim() || null,
        heights: data.discipline === "Classic" ? data.heights.trim() || null : null,
        year: data.year.trim() || null,
      };
      const res = await apiRequest("POST", `/api/athletes/${athleteId}/skis`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: "Ski added" });
      setSkiDialogOpen(false);
      resetSkiForm();
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateSkiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof skiForm }) => {
      const body = {
        skiId: data.skiId,
        serialNumber: data.serialNumber.trim() || null,
        brand: data.brand.trim() || null,
        discipline: data.discipline,
        construction: data.construction.trim() || null,
        mold: data.mold.trim() || null,
        base: data.base.trim() || null,
        grind: data.grind.trim() || null,
        heights: data.discipline === "Classic" ? data.heights.trim() || null : null,
        year: data.year.trim() || null,
      };
      const res = await apiRequest("PUT", `/api/race-skis/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: "Ski updated" });
      setSkiDialogOpen(false);
      setEditingSki(null);
      resetSkiForm();
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteSkiMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/race-skis/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: "Ski deleted" });
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const createRegrindMutation = useMutation({
    mutationFn: async ({ skiId, data }: { skiId: number; data: typeof regrindForm }) => {
      const body = {
        date: data.date,
        grindType: data.grindType,
        stone: data.stone.trim() || null,
        pattern: data.pattern.trim() || null,
        notes: data.notes.trim() || null,
      };
      const res = await apiRequest("POST", `/api/race-skis/${skiId}/regrinds`, body);
      return res.json();
    },
    onSuccess: () => {
      if (regrindSkiId) {
        queryClient.invalidateQueries({ queryKey: [`/api/race-skis/${regrindSkiId}/regrinds`] });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      toast({ title: "Regrind added" });
      setRegrindDialogOpen(false);
      resetRegrindForm();
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteRegrindMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/race-ski-regrinds/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/race-skis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/skis`] });
      if (expandedSkiId) {
        queryClient.invalidateQueries({ queryKey: [`/api/race-skis/${expandedSkiId}/regrinds`] });
      }
      toast({ title: "Regrind deleted" });
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateAccessMutation = useMutation({
    mutationFn: async (userIds: number[]) => {
      const res = await apiRequest("PUT", `/api/athletes/${athleteId}/access`, { userIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/athletes/${athleteId}/access`] });
      toast({ title: "Access updated" });
      setAccessDialogOpen(false);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const updateAthleteMutation = useMutation({
    mutationFn: async (data: { name: string; team: string }) => {
      const res = await apiRequest("PUT", `/api/athletes/${athleteId}`, {
        name: data.name,
        team: data.team.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/athletes"] });
      toast({ title: "Athlete updated" });
      setEditAthleteOpen(false);
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  const deleteAthleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/athletes/${athleteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/athletes"] });
      toast({ title: "Athlete deleted" });
      navigate("/raceskis");
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    },
  });

  function resetSkiForm() {
    setSkiForm({ skiId: "", serialNumber: "", brand: "", discipline: "Classic", construction: "", mold: "", base: "", grind: "", heights: "", year: "" });
  }

  function resetRegrindForm() {
    setRegrindForm({ date: new Date().toISOString().split("T")[0], grindType: "", stone: "", pattern: "", notes: "" });
  }

  function openEditSki(ski: RaceSki) {
    setEditingSki(ski);
    setSkiForm({
      skiId: ski.skiId,
      serialNumber: ski.serialNumber || "",
      brand: ski.brand || "",
      discipline: ski.discipline,
      construction: ski.construction || "",
      mold: ski.mold || "",
      base: ski.base || "",
      grind: ski.grind || "",
      heights: ski.heights || "",
      year: ski.year || "",
    });
    setSkiDialogOpen(true);
  }

  function openAddSki() {
    setEditingSki(null);
    resetSkiForm();
    setSkiDialogOpen(true);
  }

  function openRegrind(skiId: number) {
    setRegrindSkiId(skiId);
    resetRegrindForm();
    setRegrindDialogOpen(true);
  }

  function openAccessDialog() {
    setSelectedUserIds(access.map((a) => a.userId));
    setAccessDialogOpen(true);
  }

  function openEditAthlete() {
    if (athlete) {
      setAthleteForm({ name: athlete.name, team: athlete.team || "" });
      setEditAthleteOpen(true);
    }
  }

  function handleSkiSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!skiForm.skiId.trim()) return;
    if (editingSki) {
      updateSkiMutation.mutate({ id: editingSki.id, data: skiForm });
    } else {
      createSkiMutation.mutate(skiForm);
    }
  }

  function handleRegrindSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!regrindForm.grindType.trim() || !regrindSkiId) return;
    createRegrindMutation.mutate({ skiId: regrindSkiId, data: regrindForm });
  }

  function handleAthleteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!athleteForm.name.trim()) return;
    updateAthleteMutation.mutate(athleteForm);
  }

  if (!athlete) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-20" data-testid="not-found-athlete">
          <p className="text-muted-foreground">Athlete not found.</p>
          <AppLink href="/raceskis">
            <Button variant="secondary" data-testid="button-back-raceskis">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </AppLink>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        {/* Back button */}
        <div>
          <AppLink href="/raceskis" testId="link-back-raceskis">
            <Button variant="ghost" size="sm" data-testid="button-back-raceskis">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </AppLink>
        </div>

        {/* Athlete header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl" data-testid="text-athlete-name">
              {athlete.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {athlete.team && (
                <span
                  className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800"
                  data-testid="text-athlete-team"
                >
                  <Users className="mr-1 h-3 w-3" />
                  {athlete.team}
                </span>
              )}
              <span className="text-xs text-muted-foreground" data-testid="text-athlete-created-by">
                {athlete.createdByName}
              </span>
            </div>
          </div>

          {isOwnerOrAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="button-edit-athlete"
                onClick={openEditAthlete}
              >
                <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-delete-athlete"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => {
                  if (confirm("Delete this athlete and all their skis?")) {
                    deleteAthleteMutation.mutate();
                  }
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          )}
        </div>

        {/* Access management */}
        {isOwnerOrAdmin && (
          <Card className="fs-card rounded-2xl p-4" data-testid="card-access-management">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Access</h2>
                <p className="mt-0.5 text-xs text-muted-foreground" data-testid="text-shared-with">
                  Shared with: {access.length > 0
                    ? access.map((a) => {
                        const u = users.find((u) => u.id === a.userId);
                        return u?.name || `User #${a.userId}`;
                      }).join(", ")
                    : "—"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-manage-access"
                onClick={openAccessDialog}
              >
                <Users className="mr-1.5 h-3.5 w-3.5" />
                Manage Access
              </Button>
            </div>
          </Card>
        )}

        {/* Race Skis */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold" data-testid="text-skis-heading">
            Skis ({skis.length})
          </h2>
          <Button
            data-testid="button-add-ski"
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
            size="sm"
            onClick={openAddSki}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Ski
          </Button>
        </div>

        {skis.length === 0 ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-skis">
            No skis yet. Add the first ski for this athlete.
          </Card>
        ) : (
          <div className="space-y-3">
            {skis.map((ski) => (
              <SkiCard
                key={ski.id}
                ski={ski}
                expanded={expandedSkiId === ski.id}
                onToggle={() => setExpandedSkiId(expandedSkiId === ski.id ? null : ski.id)}
                onEdit={() => openEditSki(ski)}
                onDelete={() => {
                  if (confirm("Delete this ski?")) deleteSkiMutation.mutate(ski.id);
                }}
                onRegrind={() => openRegrind(ski.id)}
                onDeleteRegrind={(id) => {
                  if (confirm("Delete this regrind record?")) deleteRegrindMutation.mutate(id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Ski Dialog */}
      <Dialog
        open={skiDialogOpen}
        onOpenChange={(v) => {
          setSkiDialogOpen(v);
          if (!v) { setEditingSki(null); resetSkiForm(); }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSki ? "Edit" : "Add Ski"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSkiSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Ski ID *</label>
              <Input
                value={skiForm.skiId}
                onChange={(e) => setSkiForm((f) => ({ ...f, skiId: e.target.value }))}
                required
                data-testid="input-ski-id"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Serial Number</label>
              <Input
                value={skiForm.serialNumber}
                onChange={(e) => setSkiForm((f) => ({ ...f, serialNumber: e.target.value }))}
                data-testid="input-ski-serial"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Brand</label>
              <Input
                value={skiForm.brand}
                onChange={(e) => setSkiForm((f) => ({ ...f, brand: e.target.value }))}
                data-testid="input-ski-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Discipline</label>
              <Select
                value={skiForm.discipline}
                onValueChange={(v) => setSkiForm((f) => ({ ...f, discipline: v }))}
              >
                <SelectTrigger data-testid="select-ski-discipline">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Classic">Classic</SelectItem>
                  <SelectItem value="Skate">Skate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Construction</label>
              <Input
                value={skiForm.construction}
                onChange={(e) => setSkiForm((f) => ({ ...f, construction: e.target.value }))}
                data-testid="input-ski-construction"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Mold</label>
              <Input
                value={skiForm.mold}
                onChange={(e) => setSkiForm((f) => ({ ...f, mold: e.target.value }))}
                data-testid="input-ski-mold"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Base</label>
              <Input
                value={skiForm.base}
                onChange={(e) => setSkiForm((f) => ({ ...f, base: e.target.value }))}
                data-testid="input-ski-base"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Grind</label>
              <Input
                value={skiForm.grind}
                onChange={(e) => setSkiForm((f) => ({ ...f, grind: e.target.value }))}
                data-testid="input-ski-grind"
              />
            </div>
            {skiForm.discipline === "Classic" && (
              <div>
                <label className="mb-1 block text-sm font-medium">Heights</label>
                <Input
                  value={skiForm.heights}
                  onChange={(e) => setSkiForm((f) => ({ ...f, heights: e.target.value }))}
                  data-testid="input-ski-heights"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Year</label>
              <Input
                value={skiForm.year}
                onChange={(e) => setSkiForm((f) => ({ ...f, year: e.target.value }))}
                data-testid="input-ski-year"
              />
            </div>
            <div className="flex items-center justify-end pt-2">
              <Button
                type="submit"
                data-testid="button-save-ski"
                disabled={createSkiMutation.isPending || updateSkiMutation.isPending || !skiForm.skiId.trim()}
              >
                {(createSkiMutation.isPending || updateSkiMutation.isPending) ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Regrind Dialog */}
      <Dialog
        open={regrindDialogOpen}
        onOpenChange={(v) => {
          setRegrindDialogOpen(v);
          if (!v) { setRegrindSkiId(null); resetRegrindForm(); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Regrind</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegrindSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Date *</label>
              <Input
                type="date"
                value={regrindForm.date}
                onChange={(e) => setRegrindForm((f) => ({ ...f, date: e.target.value }))}
                required
                data-testid="input-regrind-date"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Grind Type *</label>
              <Input
                value={regrindForm.grindType}
                onChange={(e) => setRegrindForm((f) => ({ ...f, grindType: e.target.value }))}
                required
                data-testid="input-regrind-type"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Stone</label>
              <Input
                value={regrindForm.stone}
                onChange={(e) => setRegrindForm((f) => ({ ...f, stone: e.target.value }))}
                data-testid="input-regrind-stone"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Pattern</label>
              <Input
                value={regrindForm.pattern}
                onChange={(e) => setRegrindForm((f) => ({ ...f, pattern: e.target.value }))}
                data-testid="input-regrind-pattern"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <Input
                value={regrindForm.notes}
                onChange={(e) => setRegrindForm((f) => ({ ...f, notes: e.target.value }))}
                data-testid="input-regrind-notes"
              />
            </div>
            <div className="flex items-center justify-end pt-2">
              <Button
                type="submit"
                data-testid="button-save-regrind"
                disabled={createRegrindMutation.isPending || !regrindForm.grindType.trim()}
              >
                {createRegrindMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Access Dialog */}
      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users available.</p>
            ) : (
              users
                .filter((u) => u.id !== athlete?.createdById)
                .map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer"
                    data-testid={`checkbox-access-user-${u.id}`}
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(u.id)}
                      onCheckedChange={(checked) => {
                        setSelectedUserIds((prev) =>
                          checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                        );
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </label>
                ))
            )}
          </div>
          <div className="flex items-center justify-end pt-2">
            <Button
              data-testid="button-save-access"
              onClick={() => updateAccessMutation.mutate(selectedUserIds)}
              disabled={updateAccessMutation.isPending}
            >
              {updateAccessMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Athlete Dialog */}
      <Dialog open={editAthleteOpen} onOpenChange={setEditAthleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAthleteSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Name *</label>
              <Input
                value={athleteForm.name}
                onChange={(e) => setAthleteForm((f) => ({ ...f, name: e.target.value }))}
                required
                data-testid="input-edit-athlete-name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Team</label>
              <Input
                value={athleteForm.team}
                onChange={(e) => setAthleteForm((f) => ({ ...f, team: e.target.value }))}
                data-testid="input-edit-athlete-team"
              />
            </div>
            <div className="flex items-center justify-end pt-2">
              <Button
                type="submit"
                data-testid="button-save-edit-athlete"
                disabled={updateAthleteMutation.isPending || !athleteForm.name.trim()}
              >
                {updateAthleteMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SkiCard({
  ski,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onRegrind,
  onDeleteRegrind,
}: {
  ski: RaceSki;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRegrind: () => void;
  onDeleteRegrind: (id: number) => void;
}) {
  const { data: regrinds = [] } = useQuery<RaceSkiRegrind[]>({
    queryKey: [`/api/race-skis/${ski.id}/regrinds`],
    enabled: expanded,
  });

  return (
    <Card className="fs-card rounded-2xl p-4" data-testid={`card-ski-${ski.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div
          className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1"
          onClick={onToggle}
          data-testid={`toggle-ski-${ski.id}`}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm" data-testid={`text-ski-id-${ski.id}`}>
                {ski.skiId}
              </span>
              {ski.brand && (
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800">
                  {ski.brand}
                </span>
              )}
              <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800">
                {ski.discipline}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {ski.grind && (
                <span data-testid={`text-ski-grind-${ski.id}`}>
                  <strong className="text-foreground">Current Grind:</strong> {ski.grind}
                </span>
              )}
              {ski.construction && <span>Construction: {ski.construction}</span>}
              {ski.mold && <span>Mold: {ski.mold}</span>}
              {ski.base && <span>Base: {ski.base}</span>}
              {ski.discipline === "Classic" && ski.heights && (
                <span>Heights: {ski.heights}</span>
              )}
              {ski.year && <span>Year: {ski.year}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            data-testid={`button-regrind-ski-${ski.id}`}
            onClick={onRegrind}
            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Regrind
          </Button>
          <Button variant="ghost" size="sm" data-testid={`button-edit-ski-${ski.id}`} onClick={onEdit}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid={`button-delete-ski-${ski.id}`}
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-border/40 pt-3" data-testid={`section-regrinds-${ski.id}`}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Regrind History
          </h3>
          {regrinds.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid={`text-no-regrinds-${ski.id}`}>
              No regrind history
            </p>
          ) : (
            <div className="space-y-2">
              {regrinds.map((rg) => (
                <div
                  key={rg.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2"
                  data-testid={`row-regrind-${rg.id}`}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                    <span className="font-medium">{rg.date}</span>
                    <span className="font-semibold text-foreground">{rg.grindType}</span>
                    {rg.stone && <span className="text-muted-foreground">Stone: {rg.stone}</span>}
                    {rg.pattern && <span className="text-muted-foreground">Pattern: {rg.pattern}</span>}
                    {rg.notes && <span className="text-muted-foreground italic">{rg.notes}</span>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`button-delete-regrind-${rg.id}`}
                    onClick={() => onDeleteRegrind(rg.id)}
                    className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
