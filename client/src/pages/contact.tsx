import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { AppLink } from "@/components/app-link";
import { useSearch } from "wouter";

const PLAN_LABELS: Record<string, { name: string; price: string; color: string }> = {
  starter: { name: "Starter", price: "€25/mnd", color: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300" },
  team:    { name: "Team",    price: "€79/mnd", color: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300" },
  pro:     { name: "Pro",     price: "€149/mnd", color: "bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-900/20 dark:border-violet-700 dark:text-violet-300" },
  federation: { name: "Federation", price: "Tilpasset pris", color: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300" },
};

export default function Contact() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const planId = params.get("plan");
  const plan = planId ? PLAN_LABELS[planId] : null;

  const emailSubject = plan
    ? `Glidr ${plan.name}-abonnement`
    : "Spørsmål om Glidr";

  const emailBody = plan
    ? `Hei,\n\nJeg er interessert i Glidr ${plan.name}-planen (${plan.price}).\n\nOrganisasjon/lag:\nAntall brukere:\nKontaktperson:\n\nMvh`
    : `Hei,\n\nJeg har et spørsmål om Glidr.\n\nMvh`;

  const mailtoHref = `mailto:Simen.finjord@hotmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">

        <div className="text-center mb-10">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4"
            data-testid="heading-contact"
          >
            Kontakt oss
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Send oss en e-post eller ring, så setter vi opp kontoen din og sender faktura.
          </p>
        </div>

        {/* Plan badge — vises når de kommer fra prissiden */}
        {plan && (
          <div className={`mb-8 rounded-2xl border p-5 flex items-center gap-4 ${plan.color}`}>
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Valgt plan</div>
              <div className="text-xl font-bold">{plan.name} — {plan.price}</div>
              <div className="text-sm opacity-80 mt-1">
                Vi setter opp laget ditt og sender faktura. Ingen binding de første 14 dagene.
              </div>
            </div>
            <ArrowRight className="h-6 w-6 opacity-40 shrink-0" />
          </div>
        )}

        {/* Kontaktmetoder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <a
            href={mailtoHref}
            className="flex items-start gap-4 rounded-2xl border bg-card p-6 shadow-sm hover:border-emerald-300 hover:ring-1 hover:ring-emerald-300/30 transition-all group"
            data-testid="link-contact-email"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">E-post</div>
              <div className="text-sm text-muted-foreground break-all">Simen.finjord@hotmail.com</div>
              {plan && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                  Klikk for ferdigutfylt e-post →
                </div>
              )}
            </div>
          </a>

          <a
            href="tel:+4797540178"
            className="flex items-start gap-4 rounded-2xl border bg-card p-6 shadow-sm hover:border-blue-300 hover:ring-1 hover:ring-blue-300/30 transition-all group"
            data-testid="link-contact-phone"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:scale-105 transition-transform">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">Telefon</div>
              <div className="text-sm text-muted-foreground">+47 975 40 178</div>
              <div className="text-xs text-muted-foreground/60 mt-1">Man–fre, 08–20</div>
            </div>
          </a>
        </div>

        {/* Slik fungerer det */}
        <div className="rounded-2xl border bg-card p-6 mb-10">
          <h2 className="font-semibold text-foreground mb-4">Slik fungerer det</h2>
          <ol className="space-y-3">
            {[
              { n: "1", text: "Send oss en e-post eller ring med lagnavn og ønsket plan" },
              { n: "2", text: "Vi setter opp laget og sender deg innloggingsdetaljer" },
              { n: "3", text: "Du bruker Glidr gratis i 14 dager" },
              { n: "4", text: "Vi sender faktura med 30 dagers betalingsfrist" },
              { n: "5", text: "Vil du oppgradere eller endre planen? Send oss en melding" },
            ].map((s) => (
              <li key={s.n} className="flex items-start gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold mt-0.5">
                  {s.n}
                </span>
                <span className="text-foreground/80 leading-relaxed">{s.text}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border bg-muted/30 p-5 text-center mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mx-auto mb-3">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold text-foreground">Simen Finjord</div>
          <div className="text-sm text-muted-foreground">Norge</div>
        </div>

        <div className="text-center border-t border-border pt-8">
          <div className="flex justify-center gap-6 text-xs text-muted-foreground">
            <AppLink href="/what-is-glidr" testId="link-features-from-contact" className="underline hover:text-foreground">
              Hva er Glidr?
            </AppLink>
            <AppLink href="/pricing" testId="link-pricing-from-contact" className="underline hover:text-foreground">
              Priser
            </AppLink>
            <AppLink href="/legal" testId="link-legal-from-contact" className="underline hover:text-foreground">
              Vilkår og personvern
            </AppLink>
          </div>
        </div>
      </div>
    </div>
  );
}
