import { useState, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { PublicNav } from "@/components/public-nav";
import { useLanguage } from "@/lib/language";
import { ArrowLeft, Check, UserPlus } from "lucide-react";

const T = {
  en: {
    title: "Accept invitation",
    teamLabel: "You're joining",
    invitedBy: "Invited by",
    nameLabel: "Your name",
    passwordLabel: "Password",
    passwordHint: "Minimum 8 characters",
    cta: "Create account",
    creating: "Creating account...",
    successTitle: "Account created!",
    successSub: "You can now log in to Glidr.",
    errorExpired: "This invitation has expired.",
    errorUsed: "This invitation has already been used.",
    errorNotFound: "Invitation not found.",
    backToLogin: "Go to login",
  },
  no: {
    title: "Godta invitasjon",
    teamLabel: "Du blir med i",
    invitedBy: "Invitert av",
    nameLabel: "Ditt navn",
    passwordLabel: "Passord",
    passwordHint: "Minimum 8 tegn",
    cta: "Opprett konto",
    creating: "Oppretter konto...",
    successTitle: "Konto opprettet!",
    successSub: "Du kan nå logge inn på Glidr.",
    errorExpired: "Denne invitasjonen har utløpt.",
    errorUsed: "Denne invitasjonen er allerede brukt.",
    errorNotFound: "Invitasjon ikke funnet.",
    backToLogin: "Gå til innlogging",
  },
};

type InvitationInfo = {
  email: string;
  teamId: number;
  teamName: string;
  invitedByName: string;
};

export default function AcceptInvite() {
  const { lang } = useLanguage();
  const t = T[lang as keyof typeof T] ?? T.no;
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<InvitationInfo | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t.errorNotFound);
      setLoading(false);
      return;
    }
    fetch(`/api/invitations/verify/${token}`)
      .then(async (res) => {
        if (res.status === 404) { setError(t.errorNotFound); return; }
        if (res.status === 410) { setError(t.errorExpired); return; }
        if (res.status === 409) { setError(t.errorUsed); return; }
        if (!res.ok) { setError(t.errorNotFound); return; }
        const data = await res.json();
        setInviteInfo(data);
      })
      .catch(() => setError(t.errorNotFound))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invitations/accept/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.message || "Something went wrong.");
        return;
      }
      setSuccess(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <div className="w-full max-w-sm space-y-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="h-8 w-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto" />
            </div>
          ) : error ? (
            <div className="text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <span className="text-red-600 text-xl">!</span>
              </div>
              <h1 className="text-xl font-bold">{error}</h1>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" />
                {t.backToLogin}
              </Link>
            </div>
          ) : success ? (
            <div className="text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">{t.successTitle}</h2>
              <p className="text-sm text-muted-foreground">{t.successSub}</p>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mt-2">
                <ArrowLeft className="h-3.5 w-3.5" />
                {t.backToLogin}
              </Link>
            </div>
          ) : inviteInfo ? (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <UserPlus className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-bold">{t.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {t.teamLabel}: <strong className="text-foreground">{inviteInfo.teamName}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.invitedBy}: <strong className="text-foreground">{inviteInfo.invitedByName}</strong>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t.nameLabel}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.nameLabel}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t.passwordLabel}</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.passwordHint}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  <p className="text-xs text-muted-foreground">{t.passwordHint}</p>
                </div>
                {submitError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-foreground text-background py-2.5 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? t.creating : t.cta}
                </button>
              </form>
              <div className="text-center">
                <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t.backToLogin}
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
