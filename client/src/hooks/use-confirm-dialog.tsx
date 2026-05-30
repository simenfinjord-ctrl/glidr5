// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Custom confirm dialog — replaces browser confirm() with a proper modal
import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type ConfirmState = {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((v: boolean) => void) | null;
};

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    options: {},
    resolve: null,
  });

  const confirm = useCallback(
    (options: ConfirmOptions = {}): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({ open: true, options, resolve });
      });
    },
    []
  );

  function handleClose(confirmed: boolean) {
    state.resolve?.(confirmed);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }

  const ConfirmDialog = (
    <Dialog open={state.open} onOpenChange={(v) => { if (!v) handleClose(false); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{state.options.title ?? "Are you sure?"}</DialogTitle>
          {state.options.description && (
            <DialogDescription>{state.options.description}</DialogDescription>
          )}
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
            {state.options.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            size="sm"
            variant={state.options.variant ?? "default"}
            onClick={() => handleClose(true)}
          >
            {state.options.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { confirm, ConfirmDialog };
}
