import { useMemo, useState } from "react";
import { Link } from "wouter";
import { PublicNav } from "@/components/public-nav";
import { useLanguage } from "@/lib/language";
import { useAppSettings } from "@/lib/app-settings";
import { FEATURE_CATEGORIES, FEATURE_LABELS, type TeamFeature } from "@shared/schema";
import { CORE_FEATURES, FEATURE_PRICES, LIMIT_PRICING, computeCustomPrice } from "@shared/pricing";
import { Check, Mail, Phone, FileText, ArrowRight, ArrowLeft, ChevronRight, Sparkles, Users, Layers, Receipt } from "lucide-react";

const CONTENT = {
  en: {
    hero: {
      title: "Get started with Glidr",
      sub: "Create your team yourself in minutes — or get in touch and we'll set it up for you.",
      subManual: "We set up your account manually and get back to you within 1–2 business days. Choose how you'd like to start.",
    },
    modeBuild: { title: "Create your team now", sub: "Compose your own plan — ready in minutes" },
    modeForm: { title: "Fill out form", sub: "We'll reach out within 1–2 business days" },
    modeContact: { title: "Contact us directly", sub: "Email or phone" },
    builder: {
      step1Title: "1. Compose your plan",
      step1Sub: "Pick exactly the features you need. Core features are always included, free.",
      included: "Included",
      free: "Free",
      perMonth: "/mo",
      limitsTitle: "Limits",
      usersLabel: "Users",
      groupsLabel: "Groups",
      includedInBase: (n: number) => `${n} included`,
      perExtra: (p: number) => `then ${p} NOK/mo each`,
      billingTitle: "Billing period",
      monthly: "Monthly",
      annual: "Annual (2 months free)",
      summaryTitle: "Your plan",
      summaryCore: "Core platform (tests, products, weather, dashboard)",
      summaryTotalMonthly: "Total per month",
      summaryTotalAnnual: "Billed annually",
      summaryTotalMonthlyBill: "Billed monthly",
      vat: "All prices in NOK incl. VAT.",
      next: "Continue",
      step2Title: "2. Accept billing",
      step2Sub: "Review your plan and confirm that usage will be invoiced.",
      acceptLabel: "I accept that my team will be invoiced for the plan composed above, until the plan is changed or cancelled.",
      acceptHint: "You can change features, limits and billing period later by contacting us. Cancellation applies from the next billing period.",
      back: "Back",
      step3Title: "3. Create your team",
      step3Sub: "The first user becomes Team Admin and the team's contact person.",
      teamName: "Team name *",
      teamPlaceholder: "e.g. Oslo Ski Club",
      contactName: "Your name *",
      namePlaceholder: "First and last name",
      email: "Email *",
      emailPlaceholder: "your@email.com",
      phone: "Phone",
      password: "Password *",
      passwordHint: "Min. 8 characters, with at least one number and one special character.",
      invoiceAddress: "Invoice address",
      invoicePlaceholder: "Street, postcode, city, org. no. (optional for now)",
      taNote: "You will be Team Admin and listed as the team's contact person.",
      submit: "Create team",
      submitting: "Creating team…",
      errorRequired: "Fill in team name, your name, email and password.",
      errorServer: "Something went wrong. Try again or email us at hei@glidr.no",
      successTitle: "Your team is ready!",
      successDesc: (team: string) => `The team «${team}» has been created and you are its Team Admin.`,
      successUsername: "Your username",
      successLogin: "Log in now",
    },
    contact: {
      title: "Get in touch",
      desc: "We set up accounts manually and get back to you within 1–2 business days.",
      emailLabel: "Email",
      phoneLabel: "Phone",
      switchPrompt: "You can also",
      switchLink: "fill out the form",
      switchSuffix: "and we'll get back to you quickly.",
    },
    form: {
      title: "Registration form",
      name: "Name *",
      email: "Email *",
      phone: "Phone",
      teamName: "Team / organisation *",
      plan: "Desired plan",
      planOptions: [
        { value: "free", label: "Free — 0 NOK" },
        { value: "starter", label: "Starter — 490 NOK/mo incl. VAT" },
        { value: "team", label: "Team — 790 NOK/mo incl. VAT" },
        { value: "pro", label: "Pro — 1 490 NOK/mo incl. VAT" },
        { value: "enterprise", label: "Federation / Enterprise — contact us" },
      ],
      users: "Number of users",
      groups: "Number of groups",
      usersPlaceholder: "e.g. 5",
      groupsPlaceholder: "e.g. 2",
      billing: "Billing",
      monthly: "Monthly",
      annual: "Annual (2 months free)",
      invoiceAddress: "Invoice address",
      invoicePlaceholder: "Street, postcode, city, org. no. (optional for now)",
      notes: "Other info / questions",
      notesPlaceholder: "Anything special we should know?",
      namePlaceholder: "Your name",
      emailPlaceholder: "your@email.com",
      teamPlaceholder: "e.g. Oslo Ski Club",
      errorRequired: "Please fill in name, email, and team name.",
      errorServer: "Something went wrong. Try again or email us at hei@glidr.no",
      submitting: "Sending...",
      submit: "Submit registration",
      privacy: "We'll get back to you within 1–2 business days. See our",
      privacyLink: "privacy policy",
      privacySuffix: "for details on data handling.",
    },
    success: {
      title: "Thanks for registering!",
      desc: "We've received your request and will get back to you within 1–2 business days at",
      demo: "Watch the demo while you wait",
    },
    footer: { pricing: "Pricing", demo: "Demo", legal: "Legal & Privacy", contact: "Contact" },
  },
  no: {
    hero: {
      title: "Kom i gang med Glidr",
      sub: "Opprett laget ditt selv på noen minutter — eller ta kontakt, så setter vi det opp for deg.",
      subManual: "Vi setter opp kontoen din manuelt og tar kontakt innen 1–2 virkedager. Velg hvordan du vil starte.",
    },
    modeBuild: { title: "Opprett laget nå", sub: "Sett sammen din egen plan — klart på minutter" },
    modeForm: { title: "Fyll ut skjema", sub: "Vi kontakter deg innen 1–2 virkedager" },
    modeContact: { title: "Ta kontakt direkte", sub: "E-post eller telefon" },
    builder: {
      step1Title: "1. Sett sammen planen din",
      step1Sub: "Velg nøyaktig de funksjonene dere trenger. Kjernefunksjonene er alltid inkludert, gratis.",
      included: "Inkludert",
      free: "Gratis",
      perMonth: "/mnd",
      limitsTitle: "Grenser",
      usersLabel: "Brukere",
      groupsLabel: "Grupper",
      includedInBase: (n: number) => `${n} inkludert`,
      perExtra: (p: number) => `deretter ${p} kr/mnd per stk`,
      billingTitle: "Faktureringsperiode",
      monthly: "Månedlig",
      annual: "Årlig (2 måneder gratis)",
      summaryTitle: "Planen din",
      summaryCore: "Kjerneplattform (tester, produkter, vær, dashboard)",
      summaryTotalMonthly: "Totalt per måned",
      summaryTotalAnnual: "Faktureres årlig",
      summaryTotalMonthlyBill: "Faktureres månedlig",
      vat: "Alle priser i NOK inkl. mva.",
      next: "Fortsett",
      step2Title: "2. Aksepter fakturering",
      step2Sub: "Se over planen og bekreft at bruken faktureres.",
      acceptLabel: "Jeg aksepterer at laget mitt faktureres for planen satt sammen over, frem til planen endres eller sies opp.",
      acceptHint: "Funksjoner, grenser og periode kan endres senere ved å kontakte oss. Oppsigelse gjelder fra neste faktureringsperiode.",
      back: "Tilbake",
      step3Title: "3. Opprett laget",
      step3Sub: "Den første brukeren blir Team Admin og lagets kontaktperson.",
      teamName: "Lagnavn *",
      teamPlaceholder: "f.eks. Oslo Skiklubb",
      contactName: "Ditt navn *",
      namePlaceholder: "Fornavn og etternavn",
      email: "E-post *",
      emailPlaceholder: "din@epost.no",
      phone: "Telefon",
      password: "Passord *",
      passwordHint: "Minst 8 tegn, med minst ett tall og ett spesialtegn.",
      invoiceAddress: "Fakturaadresse",
      invoicePlaceholder: "Gate, postnummer, sted, org.nr. (valgfritt nå)",
      taNote: "Du blir Team Admin og står som lagets kontaktperson.",
      submit: "Opprett lag",
      submitting: "Oppretter lag…",
      errorRequired: "Fyll inn lagnavn, navnet ditt, e-post og passord.",
      errorServer: "Noe gikk galt. Prøv igjen eller kontakt oss på hei@glidr.no",
      successTitle: "Laget ditt er klart!",
      successDesc: (team: string) => `Laget «${team}» er opprettet, og du er Team Admin.`,
      successUsername: "Brukernavnet ditt",
      successLogin: "Logg inn nå",
    },
    contact: {
      title: "Ta kontakt",
      desc: "Vi setter opp kontoen manuelt og tar kontakt innen 1–2 virkedager.",
      emailLabel: "E-post",
      phoneLabel: "Telefon",
      switchPrompt: "Du kan også",
      switchLink: "fylle ut skjemaet",
      switchSuffix: "så hører vi fra oss raskt.",
    },
    form: {
      title: "Registreringsskjema",
      name: "Navn *",
      email: "E-post *",
      phone: "Telefon",
      teamName: "Teamnavn / organisasjon *",
      plan: "Ønsket plan",
      planOptions: [
        { value: "free", label: "Free — 0 NOK" },
        { value: "starter", label: "Starter — 490 NOK/mnd inkl. mva" },
        { value: "team", label: "Team — 790 NOK/mnd inkl. mva" },
        { value: "pro", label: "Pro — 1 490 NOK/mnd inkl. mva" },
        { value: "enterprise", label: "Forbund / Enterprise — kontakt oss" },
      ],
      users: "Antall brukere",
      groups: "Antall grupper",
      usersPlaceholder: "f.eks. 5",
      groupsPlaceholder: "f.eks. 2",
      billing: "Fakturering",
      monthly: "Månedlig",
      annual: "Årlig (2 måneder gratis)",
      invoiceAddress: "Fakturaadresse",
      invoicePlaceholder: "Gate, postnummer, sted, org.nr. (valgfritt nå)",
      notes: "Annen info / spørsmål",
      notesPlaceholder: "Noe spesielt vi bør vite?",
      namePlaceholder: "Ditt navn",
      emailPlaceholder: "din@epost.no",
      teamPlaceholder: "f.eks. Oslo Skiklubb",
      errorRequired: "Fyll inn navn, e-post og teamnavn.",
      errorServer: "Noe gikk galt. Prøv igjen eller kontakt oss på hei@glidr.no",
      submitting: "Sender...",
      submit: "Send registrering",
      privacy: "Vi tar kontakt innen 1–2 virkedager. Se",
      privacyLink: "personvernerklæringen",
      privacySuffix: "for info om databehandling.",
    },
    success: {
      title: "Takk for registreringen!",
      desc: "Vi har mottatt din forespørsel og tar kontakt innen 1–2 virkedager på",
      demo: "Se demoen mens du venter",
    },
    footer: { pricing: "Priser", demo: "Demo", legal: "Vilkår & Personvern", contact: "Kontakt" },
  },
};

// NO labels for feature category headings (FEATURE_CATEGORIES labels are EN).
const CATEGORY_LABELS_NO: Record<string, string> = {
  "Navigation Areas": "Områder",
  "Field & Runsheet Tools": "Felt- og runsheet-verktøy",
  "Export & Backup": "Eksport og backup",
  "Team Features": "Lagfunksjoner",
  "Enterprise": "Enterprise",
};

const INITIAL = {
  contactName: "", email: "", phone: "", teamName: "",
  planName: "team", userCount: "", groupCount: "",
  billingPeriod: "monthly", invoiceAddress: "", notes: "",
};

const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20";

function PlanBuilder({ lang }: { lang: "en" | "no" }) {
  const t = CONTENT[lang].builder;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<Set<TeamFeature>>(() => new Set(CORE_FEATURES));
  const [maxUsers, setMaxUsers] = useState(LIMIT_PRICING.users.included);
  const [maxGroups, setMaxGroups] = useState(LIMIT_PRICING.groups.included);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [accepted, setAccepted] = useState(false);
  const [fields, setFields] = useState({ teamName: "", contactName: "", email: "", phone: "", password: "", invoiceAddress: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ username: string } | null>(null);

  const price = useMemo(
    () => computeCustomPrice({ features: [...selected], maxUsers, maxGroups, billingPeriod }),
    [selected, maxUsers, maxGroups, billingPeriod]
  );

  function toggle(f: TeamFeature) {
    if ((CORE_FEATURES as readonly string[]).includes(f)) return;
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fields.teamName.trim() || !fields.contactName.trim() || !fields.email.trim() || !fields.password) {
      setError(t.errorRequired);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/signup/self-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: fields.teamName,
          contactName: fields.contactName,
          email: fields.email,
          phone: fields.phone || null,
          password: fields.password,
          invoiceAddress: fields.invoiceAddress || null,
          features: [...selected],
          maxUsers, maxGroups, billingPeriod,
          acceptBilling: accepted,
          language: lang,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "");
      setDone({ username: body.username });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.errorServer);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border p-12 text-center space-y-4" data-testid="signup-success">
        <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">{t.successTitle}</h2>
        <p className="text-muted-foreground max-w-md mx-auto">{t.successDesc(fields.teamName)}</p>
        <p className="text-sm text-muted-foreground">
          {t.successUsername}: <strong className="text-foreground">{done.username}</strong>
        </p>
        <Link href="/login" className="inline-flex items-center gap-2 mt-4 rounded-xl bg-foreground text-background px-6 py-3 font-semibold text-sm hover:opacity-90">
          {t.successLogin} <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const summary = (
    <div className="rounded-2xl border border-border p-5 space-y-3 bg-muted/30">
      <div className="flex items-center gap-2 font-semibold text-sm"><Receipt className="h-4 w-4" />{t.summaryTitle}</div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-3 text-muted-foreground">
          <span>{t.summaryCore}</span><span className="shrink-0">{t.free}</span>
        </div>
        {price.featureLines.map((l) => (
          <div key={l.label} className="flex justify-between gap-3">
            <span>{FEATURE_LABELS[l.label as TeamFeature] ?? l.label}</span>
            <span className="shrink-0 tabular-nums">{l.amount} kr{t.perMonth}</span>
          </div>
        ))}
        {price.userLine && (
          <div className="flex justify-between gap-3">
            <span>{t.usersLabel}: {maxUsers} ({t.includedInBase(LIMIT_PRICING.users.included)})</span>
            <span className="shrink-0 tabular-nums">{price.userLine.amount} kr{t.perMonth}</span>
          </div>
        )}
        {price.groupLine && (
          <div className="flex justify-between gap-3">
            <span>{t.groupsLabel}: {maxGroups} ({t.includedInBase(LIMIT_PRICING.groups.included)})</span>
            <span className="shrink-0 tabular-nums">{price.groupLine.amount} kr{t.perMonth}</span>
          </div>
        )}
      </div>
      <div className="border-t border-border pt-3 space-y-1">
        <div className="flex justify-between font-bold">
          <span>{t.summaryTotalMonthly}</span>
          <span className="tabular-nums" data-testid="text-plan-total">{price.monthlyTotal} kr</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{billingPeriod === "annual" ? t.summaryTotalAnnual : t.summaryTotalMonthlyBill}</span>
          <span className="tabular-nums">{price.periodTotal} kr</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{t.vat}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-6 items-start">
          <div className="rounded-2xl border border-border p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-semibold">{t.step1Title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t.step1Sub}</p>
            </div>

            {FEATURE_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {lang === "no" ? CATEGORY_LABELS_NO[cat.label] ?? cat.label : cat.label}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cat.features.map((f) => {
                    const isCore = (CORE_FEATURES as readonly string[]).includes(f);
                    const priceMo = FEATURE_PRICES[f] ?? 0;
                    const on = selected.has(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggle(f)}
                        disabled={isCore}
                        data-testid={`feature-${f}`}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                          isCore ? "border-border bg-muted/50 cursor-default"
                          : on ? "border-primary bg-primary/10"
                          : "border-border hover:border-foreground/30"
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on || isCore ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                            {(on || isCore) && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate">{FEATURE_LABELS[f]}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {isCore ? t.included : priceMo === 0 ? t.free : `${priceMo} kr${t.perMonth}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t.limitsTitle}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border p-3">
                  <label className="flex items-center gap-1.5 text-sm font-medium"><Users className="h-3.5 w-3.5" />{t.usersLabel}</label>
                  <input type="number" min={LIMIT_PRICING.users.min} max={LIMIT_PRICING.users.max}
                    className={`${inputCls} mt-2`} value={maxUsers}
                    onChange={(e) => setMaxUsers(Math.min(LIMIT_PRICING.users.max, Math.max(LIMIT_PRICING.users.min, parseInt(e.target.value) || LIMIT_PRICING.users.min)))}
                    data-testid="input-plan-users" />
                  <p className="mt-1 text-[11px] text-muted-foreground">{t.includedInBase(LIMIT_PRICING.users.included)}, {t.perExtra(LIMIT_PRICING.users.perExtra)}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <label className="flex items-center gap-1.5 text-sm font-medium"><Layers className="h-3.5 w-3.5" />{t.groupsLabel}</label>
                  <input type="number" min={LIMIT_PRICING.groups.min} max={LIMIT_PRICING.groups.max}
                    className={`${inputCls} mt-2`} value={maxGroups}
                    onChange={(e) => setMaxGroups(Math.min(LIMIT_PRICING.groups.max, Math.max(LIMIT_PRICING.groups.min, parseInt(e.target.value) || LIMIT_PRICING.groups.min)))}
                    data-testid="input-plan-groups" />
                  <p className="mt-1 text-[11px] text-muted-foreground">{t.includedInBase(LIMIT_PRICING.groups.included)}, {t.perExtra(LIMIT_PRICING.groups.perExtra)}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t.billingTitle}</h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="builderBilling" checked={billingPeriod === "monthly"} onChange={() => setBillingPeriod("monthly")} className="accent-foreground" />
                  {t.monthly}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="builderBilling" checked={billingPeriod === "annual"} onChange={() => setBillingPeriod("annual")} className="accent-foreground" />
                  {t.annual}
                </label>
              </div>
            </div>

            <button type="button" onClick={() => setStep(2)} data-testid="button-builder-next"
              className="w-full rounded-xl bg-foreground text-background py-3 font-semibold text-sm hover:opacity-90 flex items-center justify-center gap-2">
              {t.next} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="lg:sticky lg:top-6">{summary}</div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-6 items-start">
          <div className="rounded-2xl border border-border p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-semibold">{t.step2Title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t.step2Sub}</p>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-border p-4 cursor-pointer">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 accent-foreground" data-testid="checkbox-accept-billing" />
              <span className="text-sm">{t.acceptLabel}</span>
            </label>
            <p className="text-xs text-muted-foreground">{t.acceptHint}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)}
                className="rounded-xl border border-border px-5 py-3 font-semibold text-sm hover:bg-muted flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> {t.back}
              </button>
              <button type="button" disabled={!accepted} onClick={() => setStep(3)} data-testid="button-billing-next"
                className="flex-1 rounded-xl bg-foreground text-background py-3 font-semibold text-sm hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2">
                {t.next} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="lg:sticky lg:top-6">{summary}</div>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-6 items-start">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-border p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="text-xl font-semibold">{t.step3Title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t.step3Sub}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.teamName}</label>
              <input className={inputCls} value={fields.teamName} onChange={(e) => setFields((f) => ({ ...f, teamName: e.target.value }))}
                placeholder={t.teamPlaceholder} data-testid="input-signup-team" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.contactName}</label>
                <input className={inputCls} value={fields.contactName} onChange={(e) => setFields((f) => ({ ...f, contactName: e.target.value }))}
                  placeholder={t.namePlaceholder} data-testid="input-signup-name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.email}</label>
                <input type="email" className={inputCls} value={fields.email} onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
                  placeholder={t.emailPlaceholder} data-testid="input-signup-email" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.phone}</label>
                <input type="tel" className={inputCls} value={fields.phone} onChange={(e) => setFields((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+47 975 40 178" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.password}</label>
                <input type="password" className={inputCls} value={fields.password} onChange={(e) => setFields((f) => ({ ...f, password: e.target.value }))}
                  data-testid="input-signup-password" />
                <p className="text-[11px] text-muted-foreground">{t.passwordHint}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.invoiceAddress}</label>
              <textarea className={`${inputCls} resize-none`} rows={2} value={fields.invoiceAddress}
                onChange={(e) => setFields((f) => ({ ...f, invoiceAddress: e.target.value }))} placeholder={t.invoicePlaceholder} />
            </div>
            <div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0" /> {t.taNote}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)}
                className="rounded-xl border border-border px-5 py-3 font-semibold text-sm hover:bg-muted flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> {t.back}
              </button>
              <button type="submit" disabled={submitting} data-testid="button-signup-submit"
                className="flex-1 rounded-xl bg-foreground text-background py-3 font-semibold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? t.submitting : <><span>{t.submit}</span><ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          </form>
          <div className="lg:sticky lg:top-6">{summary}</div>
        </div>
      )}
    </div>
  );
}

export default function GetStarted() {
  const { lang } = useLanguage();
  const { commercializationEnabled } = useAppSettings();
  const t = CONTENT[lang];
  const [mode, setMode] = useState<"build" | "form" | "contact" | null>(null);
  // Self-service is the default entry when commercialization is on.
  const activeMode = mode ?? (commercializationEnabled ? "build" : "form");
  const [fields, setFields] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof typeof INITIAL, v: string) {
    setFields(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fields.contactName || !fields.email || !fields.teamName) {
      setError(t.form.errorRequired);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          userCount: fields.userCount ? parseInt(fields.userCount) : null,
          groupCount: fields.groupCount ? parseInt(fields.groupCount) : null,
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError(t.form.errorServer);
    } finally {
      setSubmitting(false);
    }
  }

  const modeBtn = (id: "build" | "form" | "contact", icon: React.ReactNode, title: string, sub: string) => (
    <button onClick={() => setMode(id)}
      data-testid={`mode-${id}`}
      className={`rounded-xl border-2 p-4 text-left transition-all ${activeMode === id ? "border-foreground bg-muted" : "border-border hover:border-foreground/30"}`}>
      {icon}
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* Hero */}
      <div className="bg-foreground text-background py-14 px-4 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-bold mb-3">{t.hero.title}</h1>
          <p className="text-background/70 text-lg">{commercializationEnabled ? t.hero.sub : t.hero.subManual}</p>
        </div>
      </div>

      <div className={`mx-auto px-4 pt-8 ${activeMode === "build" ? "max-w-5xl" : "max-w-3xl"}`}>
        {/* Mode toggle */}
        <div className={`grid gap-3 mb-8 ${commercializationEnabled ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
          {commercializationEnabled && modeBtn("build",
            <Sparkles className={`h-5 w-5 mb-2 ${activeMode === "build" ? "text-foreground" : "text-muted-foreground"}`} />,
            t.modeBuild.title, t.modeBuild.sub)}
          {modeBtn("form",
            <FileText className={`h-5 w-5 mb-2 ${activeMode === "form" ? "text-foreground" : "text-muted-foreground"}`} />,
            t.modeForm.title, t.modeForm.sub)}
          {modeBtn("contact",
            <Mail className={`h-5 w-5 mb-2 ${activeMode === "contact" ? "text-foreground" : "text-muted-foreground"}`} />,
            t.modeContact.title, t.modeContact.sub)}
        </div>

        {/* Self-service plan builder */}
        {activeMode === "build" && commercializationEnabled && <PlanBuilder lang={lang} />}

        {/* Contact card */}
        {activeMode === "contact" && (
          <div className="rounded-2xl border border-border p-8 space-y-6">
            <h2 className="text-xl font-semibold">{t.contact.title}</h2>
            <p className="text-muted-foreground text-sm">{t.contact.desc}</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t.contact.emailLabel}</div>
                  <a href="mailto:hei@glidr.no" className="font-medium hover:underline">hei@glidr.no</a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t.contact.phoneLabel}</div>
                  <a href="tel:+4797540178" className="font-medium hover:underline">+47 975 40 178</a>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              {t.contact.switchPrompt}{" "}
              <button onClick={() => setMode("form")} className="underline font-medium text-foreground">
                {t.contact.switchLink}
              </button>{" "}
              {t.contact.switchSuffix}
            </div>
          </div>
        )}

        {/* Form */}
        {activeMode === "form" && !submitted && (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-border p-8 space-y-6">
            <h2 className="text-xl font-semibold">{t.form.title}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.name}</label>
                <input className={inputCls}
                  value={fields.contactName} onChange={e => set("contactName", e.target.value)} placeholder={t.form.namePlaceholder} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.email}</label>
                <input type="email" className={inputCls}
                  value={fields.email} onChange={e => set("email", e.target.value)} placeholder={t.form.emailPlaceholder} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.phone}</label>
                <input type="tel" className={inputCls}
                  value={fields.phone} onChange={e => set("phone", e.target.value)} placeholder="+47 975 40 178" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.teamName}</label>
                <input className={inputCls}
                  value={fields.teamName} onChange={e => set("teamName", e.target.value)} placeholder={t.form.teamPlaceholder} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.form.plan}</label>
              <select className={inputCls}
                value={fields.planName} onChange={e => set("planName", e.target.value)}>
                {t.form.planOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.users}</label>
                <input type="number" min="1" className={inputCls}
                  value={fields.userCount} onChange={e => set("userCount", e.target.value)} placeholder={t.form.usersPlaceholder} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.groups}</label>
                <input type="number" min="0" className={inputCls}
                  value={fields.groupCount} onChange={e => set("groupCount", e.target.value)} placeholder={t.form.groupsPlaceholder} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t.form.billing}</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="billingPeriod" value="monthly" checked={fields.billingPeriod === "monthly"}
                    onChange={() => set("billingPeriod", "monthly")} className="accent-foreground" />
                  {t.form.monthly}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="billingPeriod" value="annual" checked={fields.billingPeriod === "annual"}
                    onChange={() => set("billingPeriod", "annual")} className="accent-foreground" />
                  {t.form.annual}
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.form.invoiceAddress}</label>
              <textarea className={`${inputCls} resize-none`}
                rows={3} value={fields.invoiceAddress} onChange={e => set("invoiceAddress", e.target.value)}
                placeholder={t.form.invoicePlaceholder} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.form.notes}</label>
              <textarea className={`${inputCls} resize-none`}
                rows={3} value={fields.notes} onChange={e => set("notes", e.target.value)}
                placeholder={t.form.notesPlaceholder} />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={submitting}
              className="w-full rounded-xl bg-foreground text-background py-3 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? t.form.submitting : <><span>{t.form.submit}</span><ArrowRight className="h-4 w-4" /></>}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              {t.form.privacy}{" "}
              <Link href="/legal" className="underline">{t.form.privacyLink}</Link>{" "}
              {t.form.privacySuffix}
            </p>
          </form>
        )}

        {/* Success */}
        {activeMode === "form" && submitted && (
          <div className="rounded-2xl border border-border p-12 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">{t.success.title}</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {t.success.desc} <strong>{fields.email}</strong>.
            </p>
            <Link href="/demo" className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-foreground hover:underline">
              {t.success.demo} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-4 py-12 mt-8 border-t border-border text-center text-xs text-muted-foreground space-x-4">
        <Link href="/pricing" className="hover:text-foreground">{t.footer.pricing}</Link>
        <Link href="/demo" className="hover:text-foreground">{t.footer.demo}</Link>
        <Link href="/legal" className="hover:text-foreground">{t.footer.legal}</Link>
        <Link href="/contact" className="hover:text-foreground">{t.footer.contact}</Link>
      </div>
    </div>
  );
}
