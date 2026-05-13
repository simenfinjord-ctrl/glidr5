import { useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";

export type PermissionLevel = "none" | "view" | "edit";
export type UserPermissions = {
  dashboard: PermissionLevel;
  tests: PermissionLevel;
  testskis: PermissionLevel;
  products: PermissionLevel;
  weather: PermissionLevel;
  analytics: PermissionLevel;
  grinding: PermissionLevel;
  raceskis: PermissionLevel;
  suggestions: PermissionLevel;
};

type User = {
  id: number;
  email: string;
  name: string;
  groupScope: string;
  isAdmin: number;
  isTeamAdmin: number;
  teamId: number;
  activeTeamId: number | null;
  permissions: string;
  parsedPermissions: UserPermissions;
  incognito?: boolean;
  stealth?: boolean;
  isBlindTester?: boolean;
  garminWatch?: boolean;
  teamEnabledAreas?: string[] | null;
};

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: userTeams = [], isLoading: userTeamsLoading } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/user/teams"],
    enabled: !!user,
  });

  const login = async (username: string, password: string, rememberMe?: boolean) => {
    const res = await apiRequest("POST", "/api/auth/login", { username, password, rememberMe });
    const data = await res.json();
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    return data;
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    window.location.href = "/login";
  };

  const switchTeam = async (teamId: number) => {
    await apiRequest("POST", "/api/teams/switch", { teamId });
    await queryClient.invalidateQueries();
  };

  const perms = user?.parsedPermissions;

  const can = (area: keyof UserPermissions | string, level: PermissionLevel = "view"): boolean => {
    if (!user) return false;
    if (user.isAdmin) return true;
    // garmin_watch: team feature + per-user flag required
    if (area === "garmin_watch") {
      if (user.teamEnabledAreas && !user.teamEnabledAreas.includes("garmin_watch")) return false;
      if (user.isTeamAdmin) return true;
      return !!user.garminWatch;
    }
    if (user.teamEnabledAreas && !user.teamEnabledAreas.includes(area)) return false;
    if (user.isTeamAdmin) return true;
    if (!perms) return false;
    const userLevel = perms[area as keyof UserPermissions];
    if (userLevel === "none") return false;
    return true;
  };

  const isSuperAdmin = !!user?.isAdmin;
  const isTeamAdmin = !!user?.isTeamAdmin;
  const canManage = isSuperAdmin || isTeamAdmin;
  const isBlindTester = !!user?.isBlindTester;

  const toggleIncognito = async (enabled: boolean) => {
    await apiRequest("POST", "/api/auth/incognito", { enabled });
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  const toggleStealth = async (enabled: boolean) => {
    await apiRequest("POST", "/api/auth/stealth", { enabled });
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  // "Other team" = a team the SA has NOT been explicitly added to via admin.
  // While userTeams is still loading, assume it's not "other team" to avoid false stealth activation.
  const isViewingOtherTeam = isSuperAdmin &&
    !userTeamsLoading &&
    user?.activeTeamId != null &&
    !userTeams.some(t => t.id === user?.activeTeamId);
  const isStealthActive = !!user?.stealth && isViewingOtherTeam;

  return {
    user: user ?? null,
    isLoading,
    login,
    logout,
    switchTeam,
    can,
    permissions: perms ?? null,
    isSuperAdmin,
    isTeamAdmin,
    canManage,
    isBlindTester,
    toggleIncognito,
    toggleStealth,
    isViewingOtherTeam,
    isStealthActive,
    userTeams,
    userTeamsLoading,
  };
}
