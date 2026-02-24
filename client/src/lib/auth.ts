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
  permissions: string;
  parsedPermissions: UserPermissions;
};

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password, rememberMe });
    const data = await res.json();
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    return data;
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    window.location.href = "/login";
  };

  const perms = user?.parsedPermissions;

  const can = (area: keyof UserPermissions, level: PermissionLevel = "view"): boolean => {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (!perms) return false;
    const userLevel = perms[area];
    if (userLevel === "none") return false;
    if (level === "edit") return userLevel === "edit";
    return true;
  };

  return { user: user ?? null, isLoading, login, logout, can, permissions: perms ?? null };
}
