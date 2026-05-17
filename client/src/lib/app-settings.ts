import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

type AppSettings = {
  commercializationEnabled: boolean;
};

export function useAppSettings(): AppSettings {
  const { data } = useQuery<AppSettings>({
    queryKey: ["/api/settings/public"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 60_000,
  });
  return { commercializationEnabled: data?.commercializationEnabled ?? true };
}
