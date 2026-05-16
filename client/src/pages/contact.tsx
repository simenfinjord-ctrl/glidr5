import { Mail, Phone } from "lucide-react";
import { useSearch } from "wouter";
import { PublicNav } from "@/components/public-nav";
import { useLanguage } from "@/lib/language";

const CONTENT = {
  en: {
    title: "Contact us",
    sub: "Send us an email or call, and we'll set up your account and send an invoice.",
    emailLabel: "Email",
    phoneLabel: "Phone",
    manualNote: "We set up all accounts manually and will get back to you within 1–2 business days.",
    orForm: "Prefer a form?",
    orFormLink: "Fill out the registration form",
    planBadge: "Enquiring about",
    planSubject: (name: string) => `Glidr ${name} subscription`,
    planBody: (name: string, price: string) => `Hi,\n\nI'm interested in the Glidr ${name} plan (${price}).\n\nOrganisation / team:\nNumber of users:\nContact person:\n\nBest regards`,
    defaultSubject: "Question about Glidr",
    defaultBody: "Hi,\n\nI have a question about Glidr.\n\nBest regards",
    emailCta: "Send email",
  },
  no: {
    title: "Kontakt oss",
    sub: "Send oss en e-post eller ring, så setter vi opp kontoen din og sender faktura.",
    emailLabel: "E-post",
    phoneLabel: "Telefon",
    manualNote: "Vi setter opp alle kontoer manuelt og tar kontakt innen 1–2 virkedager.",
    orForm: "Foretrekker du et skjema?",
    orFormLink: "Fyll ut registreringsskjemaet",
    planBadge: "Interessert i",
    planSubject: (name: string) => `Glidr ${name}-abonnement`,
    planBody: (name: string, price: string) => `Hei,\n\nJeg er interessert i Glidr ${name}-planen (${price}).\n\nOrganisasjon/lag:\nAntall brukere:\nKontaktperson:\n\nMvh`,
    defaultSubject: "Spørsmål om Glidr",
    defaultBody: "Hei,\n\nJeg har et spørsmål om Glidr.\n\nMvh",
    emailCta: "Send e-post",
  },
};

const PLAN_LABELS: Record<string, { name: string; price: string; priceNo: string }> = {
  starter:    { name: "Starter",    price: "€25/mo",   priceNo: "€25/mnd" },
  team:       { name: "Team",       price: "€79/mo",   priceNo: "€79/mnd" },
  pro:        { name: "Pro",        price: "€149/mo",  priceNo: "€149/mnd" },
  enterprise: { name: "Enterprise", price: "Custom",   priceNo: "Tilpasset" },
};

export default function Contact() {
  const { lang } = useLanguage();
  const t = CONTENT[lang];
  const search = useSearch();
  const params = new URLSearchParams(search);
  const planId = params.get("plan");
  const plan = planId ? PLAN_LABELS[planId] : null;

  const price = plan ? (lang === "no" ? plan.priceNo : plan.price) : "";
  const subject = plan ? t.planSubject(plan.name) : t.defaultSubject;
  const body = plan ? t.planBody(plan.name, price) : t.defaultBody;
  const mailtoHref = `mailto:hei@glidr.no?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4" data-testid="heading-contact">
            {t.title}
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">{t.sub}</p>
        </div>

        {plan && (
          <div className="mb-8 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-5 py-3 text-sm text-green-800 dark:text-green-300 text-center">
            {t.planBadge}: <strong>{plan.name}</strong> — {price}
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-2xl border border-border p-6 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-0.5">{t.emailLabel}</div>
              <a href={mailtoHref} className="font-semibold text-foreground hover:underline break-all">
                hei@glidr.no
              </a>
            </div>
            <a href={mailtoHref}
              className="flex-shrink-0 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity">
              {t.emailCta}
            </a>
          </div>

          <div className="rounded-2xl border border-border p-6 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">{t.phoneLabel}</div>
              <a href="tel:+4700000000" className="font-semibold text-foreground hover:underline">+47 000 00 000</a>
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm text-muted-foreground text-center">{t.manualNote}</p>
        <p className="mt-2 text-sm text-center text-muted-foreground">
          {t.orForm}{" "}
          <a href="/get-started" className="underline font-medium text-foreground hover:opacity-70">{t.orFormLink}</a>.
        </p>
      </div>
    </div>
  );
}
