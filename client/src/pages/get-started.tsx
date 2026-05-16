import { useState } from "react";
import { Link } from "wouter";
import { PublicNav } from "@/components/public-nav";
import { Check, Mail, Phone, FileText, ArrowRight, ChevronRight } from "lucide-react";

const PLANS = [
  { value: "free", label: "Free — €0" },
  { value: "starter", label: "Starter — €25/mnd" },
  { value: "team", label: "Team — €79/mnd" },
  { value: "pro", label: "Pro — €149/mnd" },
  { value: "enterprise", label: "Forbund / Enterprise — kontakt oss" },
];

const INITIAL = {
  contactName: "",
  email: "",
  phone: "",
  teamName: "",
  planName: "team",
  userCount: "",
  groupCount: "",
  billingPeriod: "monthly",
  invoiceAddress: "",
  notes: "",
};

export default function GetStarted() {
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
      setError("Fyll inn navn, e-post og teamnavn.");
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
      if (!res.ok) throw new Error("Server error");
      setSubmitted(true);
    } catch {
      setError("Noe gikk galt. Prøv igjen eller kontakt oss på hei@glidr.no");
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
          <h1 className="text-4xl font-bold mb-3">Kom i gang med Glidr</h1>
          <p className="text-background/70 text-lg">
            Vi setter opp kontoen din manuelt og tar kontakt innen 1–2 virkedager. Velg hvordan du vil starte.
          </p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="max-w-3xl mx-auto px-4 pt-8">
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => setMode("form")}
            className={`rounded-xl border-2 p-4 text-left transition-all ${mode === "form" ? "border-foreground bg-muted" : "border-border hover:border-foreground/30"}`}
          >
            <FileText className={`h-5 w-5 mb-2 ${mode === "form" ? "text-foreground" : "text-muted-foreground"}`} />
            <div className="font-semibold text-sm">Fyll ut skjema</div>
            <div className="text-xs text-muted-foreground mt-0.5">Vi kontakter deg innen 1–2 virkedager</div>
          </button>
          <button
            onClick={() => setMode("contact")}
            className={`rounded-xl border-2 p-4 text-left transition-all ${mode === "contact" ? "border-foreground bg-muted" : "border-border hover:border-foreground/30"}`}
          >
            <Mail className={`h-5 w-5 mb-2 ${mode === "contact" ? "text-foreground" : "text-muted-foreground"}`} />
            <div className="font-semibold text-sm">Ta kontakt direkte</div>
            <div className="text-xs text-muted-foreground mt-0.5">E-post eller telefon</div>
          </button>
        </div>

        {/* Contact card */}
        {mode === "contact" && (
          <div className="rounded-2xl border border-border p-8 space-y-6">
            <h2 className="text-xl font-semibold">Ta kontakt</h2>
            <p className="text-muted-foreground text-sm">Vi setter opp kontoen manuelt og tar kontakt innen 1–2 virkedager.</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">E-post</div>
                  <a href="mailto:hei@glidr.no" className="font-medium hover:underline">hei@glidr.no</a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Telefon</div>
                  <a href="tel:+4700000000" className="font-medium hover:underline">+47 000 00 000</a>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              Du kan også <button onClick={() => setMode("form")} className="underline font-medium text-foreground">fylle ut skjemaet</button> så hører vi fra oss raskt.
            </div>
          </div>
        )}

        {/* Form */}
        {mode === "form" && !submitted && (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-border p-8 space-y-6">
            <h2 className="text-xl font-semibold">Registreringsskjema</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Navn *</label>
                <input className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  value={fields.contactName} onChange={e => set("contactName", e.target.value)} placeholder="Ditt navn" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">E-post *</label>
                <input type="email" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  value={fields.email} onChange={e => set("email", e.target.value)} placeholder="din@epost.no" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Telefon</label>
                <input type="tel" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  value={fields.phone} onChange={e => set("phone", e.target.value)} placeholder="+47 000 00 000" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Teamnavn / organisasjon *</label>
                <input className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  value={fields.teamName} onChange={e => set("teamName", e.target.value)} placeholder="f.eks. Oslo Skiklubb" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ønsket plan</label>
              <select className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                value={fields.planName} onChange={e => set("planName", e.target.value)}>
                {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Antall brukere</label>
                <input type="number" min="1" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  value={fields.userCount} onChange={e => set("userCount", e.target.value)} placeholder="f.eks. 5" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Antall grupper</label>
                <input type="number" min="0" className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  value={fields.groupCount} onChange={e => set("groupCount", e.target.value)} placeholder="f.eks. 2" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fakturering</label>
              <div className="flex gap-4">
                {[{ value: "monthly", label: "Månedlig" }, { value: "annual", label: "Årlig (2 måneder gratis)" }].map(o => (
                  <label key={o.value} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="billingPeriod" value={o.value} checked={fields.billingPeriod === o.value}
                      onChange={() => set("billingPeriod", o.value)} className="accent-foreground" />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fakturaadresse</label>
              <textarea className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                rows={3} value={fields.invoiceAddress} onChange={e => set("invoiceAddress", e.target.value)}
                placeholder="Gate, postnummer, sted, org.nr. (valgfritt nå)" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Annen info / spørsmål</label>
              <textarea className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                rows={3} value={fields.notes} onChange={e => set("notes", e.target.value)}
                placeholder="Noe spesielt vi bør vite?" />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={submitting}
              className="w-full rounded-xl bg-foreground text-background py-3 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? "Sender..." : <><span>Send registrering</span><ArrowRight className="h-4 w-4" /></>}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Vi tar kontakt innen 1–2 virkedager. Se <Link href="/legal" className="underline">personvernerklæringen</Link> for info om databehandling.
            </p>
          </form>
        )}

        {/* Success */}
        {mode === "form" && submitted && (
          <div className="rounded-2xl border border-border p-12 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Takk for registreringen!</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Vi har mottatt din forespørsel og tar kontakt innen 1–2 virkedager på <strong>{fields.email}</strong>.
            </p>
            <Link href="/demo" className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-foreground hover:underline">
              Se demoen mens du venter <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-4 py-12 mt-8 border-t border-border text-center text-xs text-muted-foreground space-x-4">
        <Link href="/pricing" className="hover:text-foreground">Priser</Link>
        <Link href="/demo" className="hover:text-foreground">Demo</Link>
        <Link href="/legal" className="hover:text-foreground">Vilkår & Personvern</Link>
        <Link href="/contact" className="hover:text-foreground">Kontakt</Link>
      </div>
    </div>
  );
}
