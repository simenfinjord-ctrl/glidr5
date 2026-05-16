import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ClipboardList, Trash2, Trophy, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RunsheetDialog, type BracketResult } from "@/components/runsheet-dialog";
import { useI18n } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type RunsheetItem = {
  id: number;
  testId: number;
  label: string;
  createdAt: string;
  createdById: number;
  teamId: number;
};

type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  additionalProductIds: string | null;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  results: string | null;
};

export default function Runsheets() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [activeRunsheet, setActiveRunsheet] = useState<RunsheetItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RunsheetItem | null>(null);
  const [applyingForTestId, setApplyingForTestId] = useState<number | null>(null);

  const dialogOpen = !!activeRunsheet;
  const currentTestId = activeRunsheet?.testId ?? applyingForTestId;

  const { data: items = [], isLoading } = useQuery<RunsheetItem[]>({
    queryKey: ["/api/runsheets"],
  });

  const { data: entries = [], isLoading: entriesLoading, isError: entriesError } = useQuery<TestEntry[]>({
    queryKey: [`/api/tests/${activeRunsheet?.testId}/entries`],
    enabled: !!activeRunsheet,
    retry: 1,
  });

  const skiPairs = entries.map((e) => e.skiNumber).sort((a, b) => a - b);
  const skiPairsReady = !entriesLoading && !entriesError && skiPairs.length >= 2;

  const applyMutation = useMutation({
    mutationFn: async ({ testId, results, bracket }: { testId: number; results: BracketResult[]; bracket?: any[][] }) => {
      const resp = await apiRequest("PATCH", `/api/tests/${testId}/runsheet-results`, { results, bracket });
      return { testId, resp };
    },
    onSuccess: ({ testId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${testId}/entries`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      toast({ title: t("runsheets.resultsApplied") });
      setActiveRunsheet(null);
      setApplyingForTestId(null);
    },
    onError: (e) => {
      toast({
        title: t("runsheets.couldNotApply"),
        description: e instanceof Error ? e.message : t("common.error"),
        variant: "destructive",
      });
      setApplyingForTestId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/runsheets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/runsheets"] });
      toast({ title: t("runsheets.removed") });
      setDeleteTarget(null);
    },
  });

  const handleApplyResults = (results: BracketResult[], bracket?: any[][]) => {
    const testId = activeRunsheet?.testId;
    if (!testId) return;
    setApplyingForTestId(testId);
    applyMutation.mutate({ testId, results, bracket });
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl sm:text-3xl flex items-center gap-3" data-testid="text-runsheets-title">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
              <ClipboardList className="h-5 w-5 text-teal-600" />
            </div>
            {t("runsheets.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("runsheets.subtitle")}
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground" data-testid="loading-runsheets">
            {t("runsheets.loading")}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <Card className="fs-card rounded-2xl p-8 text-center" data-testid="empty-runsheets">
            <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("runsheets.noRunsheets")}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {t("runsheets.addHint")}
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className={cn(
                "fs-card rounded-2xl p-5 cursor-pointer hover:ring-2 hover:ring-teal-500/30 transition-all active:scale-[0.98]",
                activeRunsheet?.id === item.id && entriesLoading && "ring-2 ring-teal-500/50"
              )}
              data-testid={`card-runsheet-${item.id}`}
              onClick={() => setActiveRunsheet(item)}
              style={{ touchAction: "manipulation" }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
                    {activeRunsheet?.id === item.id && entriesLoading ? (
                      <Loader2 className="h-5 w-5 text-teal-600 animate-spin" />
                    ) : (
                      <Trophy className="h-5 w-5 text-teal-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-base" data-testid={`text-runsheet-label-${item.id}`}>
                      {item.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t("runsheets.added")} {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(item);
                  }}
                  data-testid={`button-delete-runsheet-${item.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <RunsheetDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !applyMutation.isPending) {
            setActiveRunsheet(null);
            setApplyingForTestId(null);
          }
        }}
        skiPairs={skiPairsReady ? skiPairs : []}
        loading={dialogOpen && entriesLoading}
        error={entriesError ? t("runsheets.entriesError") : undefined}
        onApplyResults={handleApplyResults}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("runsheets.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("runsheets.removeDesc", { label: deleteTarget?.label ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {t("runsheets.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
