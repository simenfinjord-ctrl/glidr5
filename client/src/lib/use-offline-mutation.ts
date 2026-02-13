import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useOffline } from "./offline-context";
import { OfflineError, apiRequest } from "./queryClient";
import { useToast } from "@/hooks/use-toast";

export function useOfflineMutation<TData = unknown, TVariables = unknown>(
  options: {
    method: string;
    url: string | ((variables: TVariables) => string);
    body?: (variables: TVariables) => unknown;
    description?: string | ((variables: TVariables) => string);
  } & Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn">,
) {
  const { queueMutation } = useOffline();
  const { toast } = useToast();

  return useMutation<TData, Error, TVariables>({
    ...options,
    mutationFn: async (variables: TVariables) => {
      const resolvedUrl = typeof options.url === "function" ? options.url(variables) : options.url;
      const resolvedBody = options.body ? options.body(variables) : variables;

      try {
        const res = await apiRequest(options.method, resolvedUrl, resolvedBody);
        return res.json() as Promise<TData>;
      } catch (err) {
        if (err instanceof OfflineError) {
          const desc = typeof options.description === "function"
            ? options.description(variables)
            : options.description || `${options.method} ${resolvedUrl}`;
          await queueMutation(options.method, resolvedUrl, resolvedBody, desc);
          toast({
            title: "Saved offline",
            description: "This change will sync automatically when you reconnect.",
          });
          return {} as TData;
        }
        throw err;
      }
    },
  });
}
