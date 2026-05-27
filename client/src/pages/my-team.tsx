import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, Shield, Mail, Search, X,
  ArrowUpDown, ChevronDown, List, LayoutGrid, AlignJustify, Calendar,
  Watch, RefreshCw, Copy, Check,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
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
}

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
    ? "h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-sm font-bold text-white shrink-0"
    : "h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0";

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

function RoleBadge({ isTeamAdmin }: { isTeamAdmin: boolean }) {
  if (isTeamAdmin) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
        <Shield className="h-2.5 w-2.5" />
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      Member
    </span>
  );
}

export default function MyTeam() {
  const { user } = useAuth();
  const isTeamAdmin = !!(user as any)?.isTeamAdmin || !!(user as any)?.isAdmin;
  const hasGarminWatch = !!(user as any)?.garminWatch || isTeamAdmin;

  const queryClient = useQueryClient();
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedCode, setCopiedCode] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const { data: watchData } = useQuery<{ teamPin: string; members: { id: number; name: string; watchCode: string; isTeamAdmin: boolean }[] }>({
    queryKey: ["/api/watch/team-codes"],
    enabled: !!user && hasGarminWatch,
  });

  async function regeneratePin() {
    setRegenerating(true);
    try {
      await fetch("/api/watch/pin/regenerate", { method: "POST", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/watch/team-codes"] });
    } finally {
      setRegenerating(false);
    }
  }

  function copyToClipboard(text: string, type: "pin" | number) {
    navigator.clipboard.writeText(text).then(() => {
      if (type === "pin") {
        setCopiedPin(true);
        setTimeout(() => setCopiedPin(false), 1500);
      } else {
        setCopiedCode(type as number);
        setTimeout(() => setCopiedCode(null), 1500);
      }
    });
  }

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name-asc");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "member">("all");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members"],
    queryFn: async () => {
      const res = await fetch("/api/team/members", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team members");
      return res.json();
    },
    enabled: !!user,
  });

  // Collect all unique group names across all members
  const allGroups = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      m.groupScope
        ?.split(",")
        .map((g) => g.trim())
        .filter(Boolean)
        .forEach((g) => set.add(g));
    });
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
  }, [members, search, roleFilter, groupFilter, sortKey]);

  const activeFilters =
    (roleFilter !== "all" ? 1 : 0) + (groupFilter ? 1 : 0);

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-green-500 shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-semibold">My Team</h1>
          {!isLoading && (
            <span className="ml-1 text-sm text-muted-foreground">
              {filtered.length}/{members.length}
            </span>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members…"
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
                Filter
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
                Role
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                <DropdownMenuRadioItem value="all">All roles</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="admin">Admin only</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="member">Members only</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              {allGroups.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wide pb-1">
                    Group
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={groupFilter ?? ""}
                    onValueChange={(v) => setGroupFilter(v || null)}
                  >
                    <DropdownMenuRadioItem value="">All groups</DropdownMenuRadioItem>
                    {allGroups.map((g) => (
                      <DropdownMenuRadioItem key={g} value={g}>
                        {g}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </>
              )}

              {activeFilters > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <button
                    onClick={() => { setRoleFilter("all"); setGroupFilter(null); }}
                    className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear filters
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
                {SORT_LABELS[sortKey].split(":")[0].split("→")[0].trim().replace("Name ", "").replace("Joined", "Date") || "Sort"}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal uppercase tracking-wide pb-1">
                Sort by
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {label}
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
              title="List view"
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
              title="Grid view"
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
              title="Compact view"
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
                {members.length === 0 ? "No team members found." : "No members match your filters."}
              </p>
              {(search || activeFilters > 0) && (
                <button
                  onClick={() => { setSearch(""); setRoleFilter("all"); setGroupFilter(null); }}
                  className="text-xs text-green-600 hover:underline"
                >
                  Clear all filters
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
                        <RoleBadge isTeamAdmin={member.isTeamAdmin} />
                      </div>

                      {/* Email + member since */}
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" />
                          {member.email}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          Member since: {formatMemberSince(member.createdAt)}
                        </span>
                      </div>

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
                          <span className="text-[10px] text-muted-foreground/50 italic">No group assigned</span>
                        </div>
                      )}
                    </div>

                    {isTeamAdmin && member.id !== user?.id && (
                      <AppLink
                        href="/admin"
                        className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        Manage
                      </AppLink>
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
                      <RoleBadge isTeamAdmin={member.isTeamAdmin} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{member.email}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Since: {formatMemberSince(member.createdAt)}
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
                    <AppLink
                      href="/admin"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      Manage
                    </AppLink>
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
                    <RoleBadge isTeamAdmin={member.isTeamAdmin} />
                    <span className="text-xs text-muted-foreground">{member.email}</span>
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
                      <AppLink
                        href="/admin"
                        className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        Manage
                      </AppLink>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        {/* Watch section — only for users with Garmin Watch access */}
        {hasGarminWatch && watchData && (
          <Card className="rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10">
                <Watch className="h-4 w-4 text-sky-500" />
              </div>
              <h2 className="text-sm font-semibold">Watch</h2>
            </div>

            {/* Team PIN */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Team ID</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-2.5">
                  <span className="font-mono text-2xl font-bold tracking-[0.25em] text-foreground">
                    {watchData.teamPin}
                  </span>
                  <button
                    onClick={() => copyToClipboard(watchData.teamPin, "pin")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy"
                  >
                    {copiedPin ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {isTeamAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regeneratePin}
                    disabled={regenerating}
                    className="gap-1.5 text-xs"
                  >
                    <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
                    Regenerate
                  </Button>
                )}
              </div>
            </div>

            {/* User codes */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Personal codes</p>
              <div className="space-y-1.5">
                {watchData.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                        {m.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <span className="text-sm font-medium truncate">{m.name}</span>
                      {m.isTeamAdmin && (
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 shrink-0">TA</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm font-bold tracking-widest text-foreground">{m.watchCode}</span>
                      <button
                        onClick={() => copyToClipboard(m.watchCode, m.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy"
                      >
                        {copiedCode === m.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
