import { useState } from "react";
import { Link } from "wouter";
import { PublicNav } from "@/components/public-nav";
import { useLanguage } from "@/lib/language";
import { Mail, ArrowLeft, Check, ShieldCheck } from "lucide-react";

const T = {
  en: {
    title: "Forgot your password?",
    sub: "Enter your email address. Your administrator will receive a notification and reset your password.",
    label: "Email address",
    placeholder: "your@email.com",
    cta: "Request password reset",
    sending: "Sending...",
    successTitle: "Request sent",
    successSub: "Your administrator has been notified. They will contact you with a new temporary password.",
    note: "This usually takes a few minutes during working hours.",
    back: "Back to login",
  },
  no: {
    title: "Glemt passordet?",
    sub: "Skriv inn e-postadressen din. Administratoren din vil få et varsel og tilbakestille passordet ditt.",
    label: "E-postadresse",
    placeholder: "din@epost.no",
    cta: "Be om tilbakestilling",
    sending: "Sender...",
    successTitle: "Forespørsel sendt",
    successSub: "Administratoren din er varslet. De vil ta kontakt med et nytt midlertidig passord.",
    note: "Dette tar vanligvis noen minutter i arbeidstiden.",
    back: "Tilbake til innlogging",
  },
};

export default function ForgotPassword() {
  const { lang } = useLanguage();
  const t = T[lang];
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setSent(true);
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <div className="w-full max-w-sm space-y-6">
          {!sent ? (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-bold">{t.title}</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.sub}</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t.label}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.placeholder}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-foreground text-background py-2.5 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? t.sending : t.cta}
                </button>
              </form>
              <div className="text-center">
                <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t.back}
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">{t.successTitle}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.successSub}</p>
              <div className="rounded-xl bg-muted p-4 flex items-start gap-3 text-left">
                <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">{t.note}</p>
              </div>
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mt-2">
                <ArrowLeft className="h-3.5 w-3.5" />
                {t.back}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
