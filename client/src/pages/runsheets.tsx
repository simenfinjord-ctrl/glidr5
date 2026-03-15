import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ClipboardList, Trash2, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RunsheetDialog, type BracketResult } from "@/components/runsheet-dialog";
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
  const [activeRunsheet, setActiveRunsheet] = useState<RunsheetItem | null>(null);
  const [showRunsheetDialog, setShowRunsheetDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RunsheetItem | null>(null);

  const { data: items = [], isLoading } = useQuery<RunsheetItem[]>({
    queryKey: ["/api/runsheets"],
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery<TestEntry[]>({
    queryKey: [`/api/tests/${activeRunsheet?.testId}/entries`],
    enabled: !!activeRunsheet,
  });

  const skiPairsReady = !entriesLoading && entries.length >= 2;

  const applyMutation = useMutation({
    mutationFn: async (results: BracketResult[]) => {
      await apiRequest("PATCH", `/api/tests/${activeRunsheet!.testId}/runsheet-results`, { results });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tests/${activeRunsheet!.testId}/entries`] });
      toast({ title: "Results applied" });
      setShowRunsheetDialog(false);
      setActiveRunsheet(null);
    },
    onError: (e) => {
      toast({
        title: "Could not apply results",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/runsheets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/runsheets"] });
      toast({ title: "Removed from runsheets" });
      setDeleteTarget(null);
    },
  });

  const handleOpenRunsheet = (item: RunsheetItem) => {
    setActiveRunsheet(item);
  };

  const skiPairs = entries.map((e) => e.skiNumber).sort((a, b) => a - b);

  useEffect(() => {
    if (activeRunsheet && skiPairsReady && !showRunsheetDialog) {
      setShowRunsheetDialog(true);
    }
  }, [activeRunsheet, skiPairsReady, showRunsheetDialog]);

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl sm:text-3xl flex items-center gap-3" data-testid="text-runsheets-title">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
              <ClipboardList className="h-5 w-5 text-teal-600" />
            </div>
            Runsheets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick access to test runsheets. Tap a card to start the bracket.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground" data-testid="loading-runsheets">
            Loading…
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <Card className="fs-card rounded-2xl p-8 text-center" data-testid="empty-runsheets">
            <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No runsheets yet.</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Go to a test and tap "Add to Runsheets" to add one here.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className={cn(
                "fs-card rounded-2xl p-5 cursor-pointer hover:ring-2 hover:ring-teal-500/30 transition-all active:scale-[0.98]",
                activeRunsheet?.id === item.id && entriesLoading && "ring-2 ring-teal-500/50 animate-pulse"
              )}
              data-testid={`card-runsheet-${item.id}`}
              onClick={() => handleOpenRunsheet(item)}
              style={{ touchAction: "manipulation" }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
                    {activeRunsheet?.id === item.id && entriesLoading ? (
                      <div className="w-5 h-5 border-2 border-teal-300 border-t-teal-600 rounded-full animate-spin" />
                    ) : (
                      <Trophy className="h-5 w-5 text-teal-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-base" data-testid={`text-runsheet-label-${item.id}`}>
                      {item.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Added {new Date(item.createdAt).toLocaleDateString()}
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

      {activeRunsheet && skiPairs.length >= 2 && (
        <RunsheetDialog
          open={showRunsheetDialog}
          onOpenChange={(open) => {
            setShowRunsheetDialog(open);
            if (!open) setActiveRunsheet(null);
          }}
          skiPairs={skiPairs}
          onApplyResults={(results) => applyMutation.mutate(results)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from runsheets?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes "{deleteTarget?.label}" from your runsheets list. The test data is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
