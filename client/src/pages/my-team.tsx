import { useQuery } from "@tanstack/react-query";
import { Users, Shield, Mail, Calendar } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  isTeamAdmin: boolean;
  groupScope: string;
  createdAt: string;
  username: string | null;
  avatarUrl: string | null;
}

function MemberAvatar({ member }: { member: TeamMember }) {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt={member.name}
        className="h-9 w-9 rounded-full object-cover border border-border shrink-0"
      />
    );
  }

  return (
    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
      {initials}
    </div>
  );
}

export default function MyTeam() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isTeamAdmin = !!(user as any)?.isTeamAdmin || !!(user as any)?.isAdmin;

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members"],
    queryFn: async () => {
      const res = await fetch("/api/team/members", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team members");
      return res.json();
    },
    enabled: !!user,
  });

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl sm:text-3xl flex items-center gap-3">
          <Users className="h-7 w-7 text-green-500" />
          {t("team.title")}
        </h1>

        <Card className="rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              {t("team.noMembers")}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {members.map((member) => {
                const groups = member.groupScope
                  ? member.groupScope.split(",").map((g) => g.trim()).filter(Boolean)
                  : [];
                const joinDate = member.createdAt
                  ? new Date(member.createdAt).toLocaleDateString()
                  : "—";

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <MemberAvatar member={member} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{member.name}</span>
                        {member.isTeamAdmin && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                            <Shield className="h-2.5 w-2.5" />
                            {t("team.admin")}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {member.email}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {joinDate}
                        </span>
                      </div>

                      {groups.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {groups.map((g) => (
                            <span
                              key={g}
                              className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-green-200 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-800"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {isTeamAdmin && member.id !== user?.id && (
                      <a
                        href={`/admin`}
                        className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        {t("team.manage")}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
