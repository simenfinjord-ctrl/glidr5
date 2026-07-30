import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Users, Shield, Mail, Search, X, Phone, Globe, Clock, FlaskConical, Trash2,
  ArrowUpDown, ChevronDown, List, LayoutGrid, AlignJustify, Calendar,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useAppSettings } from "@/lib/app-settings";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  isTeamAdmin: boolean;
  groupScope: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  phone: string | null;
  // Shared in from another team: labelled by where they come from, since
  // "Admin"/"Member" says nothing useful about a guest.
  isExternal: boolean;
  homeTeamName: string | null;
  testCount: number;
  lastTestAt: string | null;
  // Team Admins only — the server omits it for everyone else.
  lastSeen?: string | null;
}

type TeamProfile = {
  id: number;
  name: string;
  teamLogo: string | null;
  nation: string | null;
  timezone: string;
  memberCount: number;
  billing?: {
    maxUsers: number | null;
    planName: string | null;
    subscriptionStatus: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  };
}

import { useI18n } from "@/lib/i18n";

type SortKey = "name-asc" | "name-desc";
type ViewMode = "list" | "grid" | "compact";

const SORT_LABELS: Record<SortKey, string> = {
  "name-asc": "Name A → Z",
  "name-desc": "Name Z → A",
};

function formatMemberSince(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function MemberAvatar({ member, size = "sm" }: { member: TeamMember; size?: "sm" | "lg" }) {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const cls = size === "lg"
    ? "h-14 w-14 rounded-full object-cover border border-border shrink-0"
    : "h-9 w-9 rounded-full object-cover border border-border shrink-0";

  const fallbackCls = size === "lg"
    ? "h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-sm font-bold text-white shrink-0"
    : "h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-[10px] font-bold text-white shrink-0";

  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt={member.name}
        className={cls}
      />
    );
  }

  return (
    <div className={fallbackCls}>
      {initials}
    </div>
  );
}

function RoleBadge({ member }: { member: TeamMember }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const isTeamAdmin = member.isTeamAdmin;
  // A guest's role belongs to their own team — here, what matters is who they
  // represent.
  if (member.isExternal) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
        <Users className="h-2.5 w-2.5" />
        {member.homeTeamName || L("Annet lag", "Another team")}
      </span>
    );
  }
  if (isTeamAdmin) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
        <Shield className="h-2.5 w-2.5" />
        {L("Admin", "Admin")}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {L("Medlem", "Member")}
    </span>
  );
}

/** Contribution + contact, on one line. Everything here is team-visible. */
function MemberMeta({ member, showLastSeen }: { member: TeamMember; showLastSeen: boolean }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  return (
    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Mail className="h-3 w-3 shrink-0" />
        {member.email}
      </span>
      {member.phone && (
        <a href={`tel:${member.phone.replace(/\s/g, "")}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Phone className="h-3 w-3 shrink-0" />
          {member.phone}
        </a>
      )}
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <FlaskConical className="h-3 w-3 shrink-0" />
        {member.testCount > 0
          ? L(`${member.testCount} tester · sist ${formatMemberSince(member.lastTestAt)}`,
              `${member.testCount} tests · last ${formatMemberSince(member.lastTestAt)}`)
          : L("Ingen tester ennå", "No tests yet")}
      </span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3 shrink-0" />
        {L("Medlem siden:", "Member since:")} {formatMemberSince(member.createdAt)}
      </span>
      {showLastSeen && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
          <Clock className="h-3 w-3 shrink-0" />
          {L("Sist aktiv:", "Last active:")} {formatMemberSince(member.lastSeen ?? null)}
        </span>
      )}
    </div>
  );
}

/** Identity for everyone; seats and plan only where the server sent them. */
function TeamCard({ profile }: { profile: TeamProfile }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const b = profile.billing;
  const seatsUsed = profile.memberCount;
  const seatsMax = b?.maxUsers ?? null;
  const full = seatsMax != null && seatsUsed >= seatsMax;
  return (
    <Card className="rounded-2xl p-4 flex flex-wrap items-center gap-4">
      {profile.teamLogo ? (
        <img src={profile.teamLogo} alt={profile.name} className="h-12 w-12 rounded-xl object-contain bg-muted/40 p-1 shrink-0" />
      ) : (
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold shrink-0">
          {profile.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">{profile.name}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {profile.nation && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{profile.nation}</span>}
          {/* Everyone needs this: it decides what every logged time means. */}
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{profile.timezone}</span>
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{L(`${seatsUsed} medlemmer`, `${seatsUsed} members`)}</span>
        </div>
      </div>
      {b && (
        <div className="text-right shrink-0">
          {seatsMax != null && (
            <p className={cn("text-sm font-semibold", full ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
              {L(`${seatsUsed} av ${seatsMax} plasser`, `${seatsUsed} of ${seatsMax} seats`)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {[b.planName, b.subscriptionStatus].filter(Boolean).join(" · ")}
            {b.currentPeriodEnd ? ` · ${L("til", "until")} ${formatMemberSince(b.currentPeriodEnd)}` : ""}
          </p>
        </div>
      )}
    </Card>
  );
}

function ManageMemberForm({ member, allGroups, onSave, onRemove, saving }: {
  member: TeamMember;
  allGroups: string[];
  onSave: (body: Record<string, unknown>) => void;
  onRemove: () => void;
  saving: boolean;
}) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [groups, setGroups] = useState<string[]>(
    member.groupScope ? member.groupScope.split(",").map((g) => g.trim()).filter(Boolean) : [],
  );
  const [phone, setPhone] = useState(member.phone ?? "");
  const [admin, setAdmin] = useState(member.isTeamAdmin);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const toggle = (g: string) => setGroups((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">{L("Grupper", "Groups")}</p>
        {allGroups.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{L("Ingen grupper er opprettet ennå.", "No groups created yet.")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {allGroups.map((g) => (
              <button key={g} type="button" onClick={() => toggle(g)}
                className={cn("rounded-full px-2.5 py-1 text-xs ring-1 transition-colors",
                  groups.includes(g)
                    ? "bg-green-500 text-white ring-green-500"
                    : "bg-muted text-muted-foreground ring-border hover:bg-muted/70")}>
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {!member.isExternal && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{L("Telefon", "Phone")}</p>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+47 000 00 000" className="h-9 text-sm" />
          <p className="mt-1 text-[11px] text-muted-foreground">{L("Synlig for hele laget.", "Visible to the whole team.")}</p>
        </div>
      )}

      {member.isExternal ? (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {L(`${member.name} er delt inn fra ${member.homeTeamName}. Rollen deres styres av det laget — her setter du bare gruppetilgangen.`,
             `${member.name} is shared in from ${member.homeTeamName}. Their role is managed by that team — here you only set group access.`)}
        </p>
      ) : (
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="h-4 w-4 accent-green-600" />
            <span className="inline-flex items-center gap-1"><Shield className="h-3.5 w-3.5" />{L("Lagadministrator", "Team admin")}</span>
          </label>
          {admin && !member.isTeamAdmin && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {L("Gir redigeringstilgang til alle områder laget har.", "Grants edit access to every area the team has.")}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        {confirmRemove ? (
          <button type="button" disabled={saving} onClick={onRemove}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline">
            <Trash2 className="h-3.5 w-3.5" />
            {member.isExternal ? L("Bekreft: fjern tilgang", "Confirm: remove access") : L("Bekreft: deaktiver (kan gjenopprettes i Admin)", "Confirm: deactivate (restorable in Admin)")}
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmRemove(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
            {member.isExternal ? L("Fjern fra laget", "Remove from team") : L("Deaktiver medlem", "Deactivate member")}
          </button>
        )}
        <Button size="sm" disabled={saving}
          onClick={() => onSave(member.isExternal
            ? { groupScope: groups.join(",") }
            : { groupScope: groups.join(","), phone, isTeamAdmin: admin })}>
          {saving ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}
        </Button>
      </div>
    </div>
  );
}

export default function MyTeam() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { user } = useAuth();
  const isTeamAdmin = !!(user as any)?.isTeamAdmin || !!(user as any)?.isAdmin;
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const { data: joinRequests } = useQuery<{ incoming: any[]; outgoing: any[] }>({
    queryKey: ["/api/team-join-requests"],
    enabled: isTeamAdmin,
  });
  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/team/invite-user", { email: inviteEmail.trim() });
      if (!res.ok) throw new Error((await res.json())?.message ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      setInviteOpen(false); setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/team-join-requests"] });
      toast({ title: L("Invitasjon sendt", "Invitation sent"), description: L("Brukeren får forespørselen på dashbordet, i innboksen og på e-post.", "The user gets the request on their dashboard, inbox and email.") });
    },
    onError: (e: any) => toast({ title: L("Kunne ikke invitere", "Could not invite"), description: e?.message, variant: "destructive" }),
  });
  const cancelInvite = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/team-join-requests/${id}/cancel`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/team-join-requests"] }),
  });

  // Editing a member without leaving the roster. Guests keep their role at
  // home — for them only their groups in THIS team are ours to set.
  const saveMember = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => {
      const res = await apiRequest("PUT", `/api/team/members/${id}/access`, body);
      if (!res.ok) throw new Error((await res.json())?.message ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      toast({ title: L("Lagret", "Saved") });
      setManageId(null);
    },
    onError: (e: any) => toast({ title: L("Kunne ikke lagre", "Could not save"), description: e?.message, variant: "destructive" }),
  });
  const removeMember = useMutation({
    mutationFn: async (m: TeamMember) => {
      // A guest is only unshared from this team; an own member is deactivated,
      // not deleted, so a mistake can be undone from Admin.
      const res = m.isExternal
        ? await apiRequest("DELETE", `/api/users/${m.id}/team-permissions/${profileTeamId ?? 0}`, undefined)
        : await apiRequest("PUT", `/api/team/members/${m.id}/access`, { isActive: false });
      if (!res.ok) throw new Error((await res.json())?.message ?? "Failed");
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team/profile"] });
      toast({ title: L("Medlem fjernet", "Member removed") });
      setManageId(null);
    },
    onError: (e: any) => toast({ title: L("Kunne ikke fjerne", "Could not remove"), description: e?.message, variant: "destructive" }),
  });

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name-asc");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "member">("all");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  // "own" = members of this team, otherwise the name of the team a guest is from.
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [manageId, setManageId] = useState<number | null>(null);
  const { commercializationEnabled } = useAppSettings();

  const { data: profile } = useQuery<TeamProfile>({
    queryKey: ["/api/team/profile"],
    enabled: !!user,
  });
  const profileTeamId = profile?.id ?? null;

  const { data: teamGroups = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/groups"],
    enabled: isTeamAdmin,
  });

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members"],
    queryFn: async () => {
      const res = await fetch("/api/team/members", { credentials: "include" });
      if (!res.ok) throw new Error(L("Kunne ikke hente lagmedlemmer", "Failed to fetch team members"));
      return res.json();
    },
    enabled: !!user,
  });

  // Every group name in play: the team's own groups plus any scope already on
  // a member (a guest may carry a scope that is no longer in the group list).
  const allGroups = useMemo(() => {
    const set = new Set<string>();
    teamGroups.forEach((g) => { if (g?.name) set.add(g.name); });
    members.forEach((m) => {
      m.groupScope
        ?.split(",")
        .map((g) => g.trim())
        .filter(Boolean)
        .forEach((g) => set.add(g));
    });
    return Array.from(set).sort();
  }, [members, teamGroups]);

  // The teams represented on this page: our own, plus every team a guest is
  // shared in from — both are things you may want to filter down to.
  const externalTeams = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => { if (m.isExternal && m.homeTeamName) set.add(m.homeTeamName); });
    return Array.from(set).sort();
  }, [members]);

  const filtered = useMemo(() => {
    let list = [...members];

    // Search
    const q = search.toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.username ?? "").toLowerCase().includes(q) ||
          (m.groupScope ?? "").toLowerCase().includes(q),
      );
    }

    // Role filter
    if (roleFilter === "admin") list = list.filter((m) => m.isTeamAdmin);
    if (roleFilter === "member") list = list.filter((m) => !m.isTeamAdmin);

    // Team filter
    if (teamFilter === "own") list = list.filter((m) => !m.isExternal);
    else if (teamFilter) list = list.filter((m) => m.homeTeamName === teamFilter);

    // Group filter
    if (groupFilter) {
      list = list.filter((m) =>
        m.groupScope
          ?.split(",")
          .map((g) => g.trim())
          .includes(groupFilter),
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortKey === "name-desc") return b.name.localeCompare(a.name);
      return a.name.localeCompare(b.name); // name-asc default
    });

    return list;
  }, [members, search, roleFilter, groupFilter, teamFilter, sortKey]);

  const activeFilters =
    (roleFilter !== "all" ? 1 : 0) + (groupFilter ? 1 : 0) + (teamFilter ? 1 : 0);
  const managed = members.find((m) => m.id === manageId) ?? null;

  return (
    <AppShell>
      <div className="space-y-5">
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{L("Inviter bruker fra et annet lag", "Invite a user from another team")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {L("Skriv inn e-posten til en eksisterende Glidr-bruker. Vedkommende får forespørselen på sitt dashbord og må selv takke ja — de beholder tilgangen til sitt nåværende lag.",
                   "Enter the email of an existing Glidr user. They get the request on their dashboard and must accept it themselves — they keep access to their current team.")}
              </p>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={L("bruker@annetlag.no", "user@otherteam.com")} data-testid="input-invite-email" />
              {(joinRequests?.outgoing ?? []).length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-muted-foreground">{L("Venter på svar", "Awaiting reply")}</div>
                  {(joinRequests?.outgoing ?? []).map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                      <span className="truncate">{r.userName} · {r.userEmail}</span>
                      <button type="button" className="ml-2 shrink-0 text-muted-foreground underline decoration-dotted hover:text-foreground" onClick={() => cancelInvite.mutate(r.id)}>
                        {L("Avbryt", "Cancel")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setInviteOpen(false)}>{L("Lukk", "Close")}</Button>
                <Button size="sm" disabled={!inviteEmail.trim() || inviteMutation.isPending} onClick={() => inviteMutation.mutate()} data-testid="button-send-invite">
                  {inviteMutation.isPending ? L("Sender…", "Sending…") : L("Send invitasjon", "Send invitation")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Manage a single member, without leaving the roster */}
        <Dialog open={!!managed} onOpenChange={(o) => !o && setManageId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{managed?.name}</DialogTitle>
            </DialogHeader>
            {managed && <ManageMemberForm
              key={managed.id}
              member={managed}
              allGroups={allGroups}
              onSave={(body) => saveMember.mutate({ id: managed.id, body })}
              onRemove={() => removeMember.mutate(managed)}
              saving={saveMember.isPending || removeMember.isPending}
            />}
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-green-500 shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{L("Mitt lag", "My Team")}</h1>
          {isTeamAdmin && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setInviteOpen(true)} data-testid="button-invite-user">
              {L("Inviter fra annet lag", "Invite from another team")}
            </Button>
          )}
          {!isLoading && (
            <span className="ml-1 text-sm text-muted-foreground">
              {filtered.length}/{members.length}
            </span>
          )}
        </div>

        {profile && <TeamCard profile={commercializationEnabled ? profile : { ...profile, billing: undefined }} />}

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L("Søk medlemmer…", "Search members…")}
              className="pl-8 pr-8 h-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-9 gap-1.5 text-sm", activeFilters > 0 && "border-green-500 text-green-600 dark:text-green-400")}
              >
                {L("Filter", "Filter")}
                {activeFilters > 0 && (
                  <span className="ml-0.5 rounded-full bg-green-500 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center">
                    {activeFilters}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wide pb-1">
                {L("Rolle", "Role")}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                <DropdownMenuRadioItem value="all">{L("Alle roller", "All roles")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="admin">{L("Kun admin", "Admin only")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="member">{L("Kun medlemmer", "Members only")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              {allGroups.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wide pb-1">
                    {L("Gruppe", "Group")}
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={groupFilter ?? ""}
                    onValueChange={(v) => setGroupFilter(v || null)}
                  >
                    <DropdownMenuRadioItem value="">{L("Alle grupper", "All groups")}</DropdownMenuRadioItem>
                    {allGroups.map((g) => (
                      <DropdownMenuRadioItem key={g} value={g}>
                        {g}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </>
              )}

              {externalTeams.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wide pb-1">
                    {L("Lag", "Team")}
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={teamFilter ?? ""} onValueChange={(v) => setTeamFilter(v || null)}>
                    <DropdownMenuRadioItem value="">{L("Alle lag", "All teams")}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="own">{profile?.name ?? L("Eget lag", "Own team")}</DropdownMenuRadioItem>
                    {externalTeams.map((tn) => (
                      <DropdownMenuRadioItem key={tn} value={tn}>{tn}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </>
              )}

              {activeFilters > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <button
                    onClick={() => { setRoleFilter("all"); setGroupFilter(null); setTeamFilter(null); }}
                    className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {L("Nullstill filtre", "Clear filters")}
                  </button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm">
                <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                {L("Sortér", "Sort")}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wide pb-1">
                {L("Sortér etter", "Sort by")}
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {key === "name-asc" ? L("Navn A → Å", "Name A → Z") : L("Navn Å → A", "Name Z → A")}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5 h-9">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded transition-colors",
                viewMode === "list"
                  ? "bg-green-600 text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={L("Liste", "List view")}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded transition-colors",
                viewMode === "grid"
                  ? "bg-green-600 text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={L("Rutenett", "Grid view")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("compact")}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded transition-colors",
                viewMode === "compact"
                  ? "bg-green-600 text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={L("Kompakt", "Compact view")}
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Member views */}
        {isLoading ? (
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="rounded-2xl overflow-hidden">
            <div className="p-8 text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                {members.length === 0 ? L("Ingen lagmedlemmer funnet.", "No team members found.") : L("Ingen medlemmer samsvarer med filtrene.", "No members match your filters.")}
              </p>
              {(search || activeFilters > 0) && (
                <button
                  onClick={() => { setSearch(""); setRoleFilter("all"); setGroupFilter(null); setTeamFilter(null); }}
                  className="text-xs text-green-600 hover:underline"
                >
                  {L("Nullstill alle filtre", "Clear all filters")}
                </button>
              )}
            </div>
          </Card>
        ) : viewMode === "list" ? (
          /* LIST VIEW */
          <Card className="rounded-2xl overflow-hidden">
            <div className="divide-y divide-border">
              {filtered.map((member) => {
                const groups = member.groupScope
                  ? member.groupScope.split(",").map((g) => g.trim()).filter(Boolean)
                  : [];

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <MemberAvatar member={member} />

                    <div className="flex-1 min-w-0">
                      {/* Name + role badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{member.name}</span>
                        <RoleBadge member={member} />
                      </div>

                      {/* Contact, contribution and (admins only) last activity */}
                      <MemberMeta member={member} showLastSeen={isTeamAdmin} />

                      {/* Groups */}
                      {groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {groups.map((g) => (
                            <button
                              key={g}
                              onClick={() => setGroupFilter(groupFilter === g ? null : g)}
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 transition-colors",
                                groupFilter === g
                                  ? "bg-green-500 text-white ring-green-500"
                                  : "bg-green-50 text-green-700 ring-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-800",
                              )}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1.5">
                          <span className="text-[10px] text-muted-foreground/50 italic">{L("Ingen gruppe tilordnet", "No group assigned")}</span>
                        </div>
                      )}
                    </div>

                    {isTeamAdmin && member.id !== user?.id && (
                      <button type="button" onClick={() => setManageId(member.id)}
                        className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
                        {L("Administrer", "Manage")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : viewMode === "grid" ? (
          /* GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((member) => {
              const groups = member.groupScope
                ? member.groupScope.split(",").map((g) => g.trim()).filter(Boolean)
                : [];

              return (
                <Card
                  key={member.id}
                  className="rounded-2xl p-4 flex flex-col items-center text-center gap-2 hover:bg-muted/20 transition-colors"
                >
                  <MemberAvatar member={member} size="lg" />
                  <div className="w-full">
                    <p className="font-medium text-sm truncate">{member.name}</p>
                    <div className="flex justify-center mt-1">
                      <RoleBadge member={member} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{member.email}</p>
                    {member.phone && <p className="text-xs text-muted-foreground truncate">{member.phone}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {member.testCount > 0 ? L(`${member.testCount} tester`, `${member.testCount} tests`) : L("Ingen tester", "No tests")}
                      {" · "}{L("siden", "since")} {formatMemberSince(member.createdAt)}
                    </p>
                  </div>
                  {groups.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 w-full">
                      {groups.map((g) => (
                        <button
                          key={g}
                          onClick={() => setGroupFilter(groupFilter === g ? null : g)}
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 transition-colors",
                            groupFilter === g
                              ? "bg-green-500 text-white ring-green-500"
                              : "bg-green-50 text-green-700 ring-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-800",
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                  {isTeamAdmin && member.id !== user?.id && (
                    <button type="button" onClick={() => setManageId(member.id)}
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
                      {L("Administrer", "Manage")}
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          /* COMPACT VIEW */
          <Card className="rounded-2xl overflow-hidden">
            <div className="divide-y divide-border">
              {filtered.map((member) => {
                const groups = member.groupScope
                  ? member.groupScope.split(",").map((g) => g.trim()).filter(Boolean)
                  : [];

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 transition-colors flex-wrap"
                  >
                    <span className="font-medium text-sm">{member.name}</span>
                    <RoleBadge member={member} />
                    <span className="text-xs text-muted-foreground">{member.email}</span>
                    {member.phone && <span className="text-xs text-muted-foreground">{member.phone}</span>}
                    <span className="text-xs text-muted-foreground">{member.testCount > 0 ? L(`${member.testCount} tester`, `${member.testCount} tests`) : "—"}</span>
                    {groups.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGroupFilter(groupFilter === g ? null : g)}
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 transition-colors",
                          groupFilter === g
                            ? "bg-green-500 text-white ring-green-500"
                            : "bg-green-50 text-green-700 ring-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-800",
                        )}
                      >
                        {g}
                      </button>
                    ))}
                    {isTeamAdmin && member.id !== user?.id && (
                      <button type="button" onClick={() => setManageId(member.id)}
                        className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
                        {L("Administrer", "Manage")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
