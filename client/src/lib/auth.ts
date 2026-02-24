import { useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";

type User = {
  id: number;
  email: string;
  name: string;
  groupScope: string;
  isAdmin: number;
  canAccessGrinding: number;
  canAccessRaceSkis: number;
  language: string;
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

  return { user: user ?? null, isLoading, login, logout };
}
