// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// One-time blocking Terms & Policy acceptance. Every user (existing and new)
// must accept once before continuing; acceptance is recorded server-side with
// timestamp + version as legal evidence. Bump TERMS_VERSION if the terms change
// materially and users must re-accept.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, ExternalLink } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";

export const TERMS_VERSION = "2026-07";

export function TermsGate() {
  const { user } = useAuth();
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [checked, setChecked] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/accept-terms", { version: TERMS_VERSION });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
  });

  // Only gate logged-in users who have never accepted.
  if (!user || user.termsAcceptedAt) return null;

  return (
    <Dialog open>
      {/* Non-dismissible: no onOpenChange, hide the built-in close button. */}
      <DialogContent
        className="max-w-md [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-testid="terms-gate"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/30 p-2.5 shrink-0">
            <FileText className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {L("Vilkår og retningslinjer", "Terms & Policy")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {L(
                "Ved å gå videre aksepterer du Glidrs vilkår og retningslinjer. Dette inkluderer at tjenesten kan bli betalingsbelagt, og at priser kan innføres eller endres med varsel. Fortsatt bruk etter en slik endring regnes som aksept.",
                "By continuing you accept Glidr's Terms & Policy. This includes that the service may become subject to payment, and that pricing may be introduced or changed with notice. Continued use after such a change constitutes acceptance.",
              )}
            </p>
            <a
              href="/legal"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline"
              data-testid="terms-gate-read"
            >
              {L("Les vilkårene", "Read the terms")} <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <label className="mt-4 flex items-start gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                data-testid="terms-gate-checkbox"
              />
              <span>
                {L(
                  "Jeg har lest og aksepterer vilkårene, inkludert at tjenesten kan bli betalingsbelagt.",
                  "I have read and accept the terms, including that the service may be charged for.",
                )}
              </span>
            </label>
            <Button
              className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!checked || acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
              data-testid="terms-gate-accept"
            >
              {acceptMutation.isPending ? L("Lagrer…", "Saving…") : L("Aksepter og fortsett", "Accept & continue")}
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {L("Aksepten lagres med tidspunkt på kontoen din.", "Your acceptance is recorded on your account with a timestamp.")}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
