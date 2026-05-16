import { useState } from "react";
import { Link } from "wouter";
import { PublicNav } from "@/components/public-nav";
import { useLanguage } from "@/lib/language";
import { Check, Mail, Phone, FileText, ArrowRight, ChevronRight } from "lucide-react";

const CONTENT = {
  en: {
    hero: {
      title: "Get started with Glidr",
      sub: "We set up your account manually and get back to you within 1–2 business days. Choose how you'd like to start.",
    },
    modeForm: { title: "Fill out form", sub: "We'll reach out within 1–2 business days" },
    modeContact: { title: "Contact us directly", sub: "Email or phone" },
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
        { value: "free", label: "Free — €0" },
        { value: "starter", label: "Starter — €25/mo" },
        { value: "team", label: "Team — €79/mo" },
        { value: "pro", label: "Pro — €149/mo" },
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
      sub: "Vi setter opp kontoen din manuelt og tar kontakt innen 1–2 virkedager. Velg hvordan du vil starte.",
    },
    modeForm: { title: "Fyll ut skjema", sub: "Vi kontakter deg innen 1–2 virkedager" },
    modeContact: { title: "Ta kontakt direkte", sub: "E-post eller telefon" },
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
        { value: "free", label: "Free — €0" },
        { value: "starter", label: "Starter — €25/mnd" },
        { value: "team", label: "Team — €79/mnd" },
        { value: "pro", label: "Pro — €149/mnd" },
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

const INITIAL = {
  contactName: "", email: "", phone: "", teamName: "",
  planName: "team", userCount: "", groupCount: "",
  billingPeriod: "monthly", invoiceAddress: "", notes: "",
};

export default function GetStarted() {
  const { lang } = useLanguage();
  const t = CONTENT[lang];
  const [mode, setMode] = useState<"form" | "contact">("form");
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

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* Hero */}
      <div className="bg-foreground text-background py-14 px-4 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-bold mb-3">{t.hero.title}</h1>
          <p className="text-background/70 text-lg">{t.hero.sub}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-8">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button onClick={() => setMode("form")}
            className={`rounded-xl border-2 p-4 text-left transition-all ${mode === "form" ? "border-foreground bg-muted" : "border-border hover:border-foreground/30"}`}>
            <FileText className={`h-5 w-5 mb-2 ${mode === "form" ? "text-foreground" : "text-muted-foreground"}`} />
            <div className="font-semibold text-sm">{t.modeForm.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t.modeForm.sub}</div>
          </button>
          <button onClick={() => setMode("contact")}
            className={`rounded-xl border-2 p-4 text-left transition-all ${mode === "contact" ? "border-foreground bg-muted" : "border-border hover:border-foreground/30"}`}>
            <Mail className={`h-5 w-5 mb-2 ${mode === "contact" ? "text-foreground" : "text-muted-foreground"}`} />
            <div className="font-semibold text-sm">{t.modeContact.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t.modeContact.sub}</div>
          </button>
        </div>

        {/* Contact card */}
        {mode === "contact" && (
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
                  <a href="tel:+4700000000" className="font-medium hover:underline">+47 000 00 000</a>
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
        {mode === "form" && !submitted && (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-border p-8 space-y-6">
            <h2 className="text-xl font-semibold">{t.form.title}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.name}</label>
                <input className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  value={fields.contactName} onChange={e => set("contactName", e.target.value)} placeholder={t.form.namePlaceholder} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.email}</label>
                <input type="email" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  value={fields.email} onChange={e => set("email", e.target.value)} placeholder={t.form.emailPlaceholder} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.phone}</label>
                <input type="tel" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  value={fields.phone} onChange={e => set("phone", e.target.value)} placeholder="+47 000 00 000" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.teamName}</label>
                <input className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  value={fields.teamName} onChange={e => set("teamName", e.target.value)} placeholder={t.form.teamPlaceholder} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.form.plan}</label>
              <select className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                value={fields.planName} onChange={e => set("planName", e.target.value)}>
                {t.form.planOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.users}</label>
                <input type="number" min="1" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  value={fields.userCount} onChange={e => set("userCount", e.target.value)} placeholder={t.form.usersPlaceholder} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.form.groups}</label>
                <input type="number" min="0" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
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
              <textarea className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                rows={3} value={fields.invoiceAddress} onChange={e => set("invoiceAddress", e.target.value)}
                placeholder={t.form.invoicePlaceholder} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.form.notes}</label>
              <textarea className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
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
        {mode === "form" && submitted && (
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
