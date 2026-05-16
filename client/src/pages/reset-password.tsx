import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { PublicNav } from "@/components/public-nav";
import { KeyRound, Check, X, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/language";

const T = {
  en: {
    title: "Set new password",
    sub: "Choose a strong password for your Glidr account.",
    newPw: "New password",
    confirmPw: "Confirm password",
    cta: "Set new password",
    saving: "Saving...",
    successTitle: "Password updated",
    successSub: "Your password has been reset. You can now log in with your new password.",
    goLogin: "Go to login",
    invalidTitle: "Invalid or expired link",
    invalidSub: "This password reset link is invalid or has expired. Please request a new one.",
    requestNew: "Request new link",
    mismatch: "Passwords do not match.",
    back: "Back to login",
  },
  no: {
    title: "Angi nytt passord",
    sub: "Velg et sterkt passord for Glidr-kontoen din.",
    newPw: "Nytt passord",
    confirmPw: "Bekreft passord",
    cta: "Sett nytt passord",
    saving: "Lagrer...",
    successTitle: "Passord oppdatert",
    successSub: "Passordet ditt er tilbakestilt. Du kan nå logge inn med det nye passordet.",
    goLogin: "Gå til innlogging",
    invalidTitle: "Ugyldig eller utløpt lenke",
    invalidSub: "Denne tilbakestillingslenken er ugyldig eller utløpt. Vennligst be om en ny.",
    requestNew: "Be om ny lenke",
    mismatch: "Passordene stemmer ikke overens.",
    back: "Tilbake til innlogging",
  },
};

export default function ResetPassword() {
  const { lang } = useLanguage();
  const t = T[lang];
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setValidating(false); return; }
    fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => setTokenValid(data.valid))
      .catch(() => setTokenValid(false))
      .finally(() => setValidating(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError(t.mismatch); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Error"); return; }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <div className="w-full max-w-sm space-y-6">
          {validating && (
            <div className="text-center text-sm text-muted-foreground">Validating link…</div>
          )}

          {!validating && !tokenValid && (
            <div className="text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <X className="h-7 w-7 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold">{t.invalidTitle}</h2>
              <p className="text-sm text-muted-foreground">{t.invalidSub}</p>
              <Link href="/forgot-password" className="inline-block rounded-xl bg-foreground text-background px-6 py-2.5 text-sm font-semibold hover:opacity-90">
                {t.requestNew}
              </Link>
            </div>
          )}

          {!validating && tokenValid && !done && (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <KeyRound className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-bold">{t.title}</h1>
                <p className="text-sm text-muted-foreground">{t.sub}</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t.newPw}</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    placeholder="Min. 7 chars, 1 number, 1 symbol"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t.confirmPw}</label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-foreground text-background py-2.5 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? t.saving : t.cta}
                </button>
              </form>
              <div className="text-center">
                <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t.back}
                </Link>
              </div>
            </>
          )}

          {done && (
            <div className="text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">{t.successTitle}</h2>
              <p className="text-sm text-muted-foreground">{t.successSub}</p>
              <Link href="/login" className="inline-block rounded-xl bg-foreground text-background px-6 py-2.5 text-sm font-semibold hover:opacity-90">
                {t.goLogin}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
