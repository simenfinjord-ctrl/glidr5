import { useState } from "react";
import { Link } from "wouter";
import { PublicNav } from "@/components/public-nav";

const sections = [
  { id: "bruksvilkar", label: "Bruksvilkår" },
  { id: "personvern", label: "Personvernerklæring" },
  { id: "databehandler", label: "Databehandleravtale" },
  { id: "cookies", label: "Informasjonskapsler" },
  { id: "rettigheter", label: "Dine rettigheter" },
  { id: "kontakt", label: "Kontakt" },
];

export default function Legal() {
  const [lang, setLang] = useState<"no" | "en">("no");

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h1 className="text-3xl font-bold text-foreground" data-testid="heading-legal">
              {lang === "no" ? "Vilkår og personvern" : "Terms & Privacy"}
            </h1>
            <div className="flex gap-1 rounded-lg border p-0.5 bg-muted/40">
              {(["no", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${lang === l ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {l === "no" ? "Norsk" : "English"}
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {lang === "no"
              ? `Sist oppdatert: mai 2026 · Glidr drives av Simen Finjord, Norge`
              : `Last updated: May 2026 · Glidr is operated by Simen Finjord, Norway`}
          </p>

          {/* Nav */}
          <div className="flex flex-wrap gap-2 mt-4">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="text-xs rounded-full border px-3 py-1 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
                {s.label}
              </a>
            ))}
          </div>
        </div>

        {lang === "no" ? <NorwegianContent /> : <EnglishContent />}

        <div className="mt-12 pt-8 border-t text-center">
          <p className="text-xs text-muted-foreground mb-3">
            {lang === "no"
              ? "Spørsmål om personvern eller dine rettigheter?"
              : "Questions about privacy or your rights?"}
          </p>
          <Link href="/contact" className="text-sm font-medium text-foreground underline underline-offset-4 hover:opacity-70">
            {lang === "no" ? "Kontakt oss" : "Contact us"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function NorwegianContent() {
  return (
    <div className="space-y-12 text-sm text-foreground/80 leading-relaxed">

      {/* ── Bruksvilkår ───────────────────────────────────────────────────────── */}
      <section id="bruksvilkar">
        <h2 className="text-xl font-bold text-foreground mb-6">Bruksvilkår</h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-foreground mb-2">1. Avtalen</h3>
            <p>Ved å registrere deg og bruke Glidr («tjenesten») aksepterer du disse bruksvilkårene og personvernerklæringen. Avtalen gjelder mellom deg/din organisasjon («kunden») og Simen Finjord («Glidr», «vi»).</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">2. Eierskap til data</h3>
            <p className="mb-2">All data du legger inn i Glidr — testresultater, produkter, værmålinger, utøverprofiler, slipeposter og annet innhold — er og forblir din eiendom og/eller din organisasjons eiendom.</p>
            <p>Glidr hevder ingen eierskap, lisens eller bruksrettigheter over dataene dine. Dine data vil aldri selges, deles med tredjeparter eller brukes til andre formål enn å levere tjenesten.</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">3. Tjenestebeskrivelse</h3>
            <p>Glidr er en skybasert plattform for ski-testing og vakstyring. Tjenesten tilbyr funksjonalitet for testlogging, værtilknytning, produktanalyse, Garmin-integrasjon og rapportering, avhengig av valgt abonnement.</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">4. Abonnement og betaling</h3>
            <p className="mb-2"><strong>Gratis plan:</strong> Tilgjengelig uten betalingskort. Grenser gjelder (se prissiden).</p>
            <p className="mb-2"><strong>Betalte planer:</strong> Faktureres månedlig eller årlig via Stripe. Prøveperiode på 14 dager uten betaling. Betaling ved første fakturadato etter prøveperioden.</p>
            <p className="mb-2"><strong>Oppsigelse:</strong> Du kan si opp abonnementet ditt når som helst fra kontoinnstillingene. Tilgang opprettholdes til slutten av faktureringsperioden. Ingen refusjon for gjenværende periode.</p>
            <p><strong>Prisendringer:</strong> Vi varsler med minst 30 dagers varsel ved prisøkninger.</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">5. Dataisolasjon og flerbrukermiljø</h3>
            <p>Glidr er en flerbrukertjeneste. Hvert lag («team») er logisk isolert — ingen andre lag kan se, hente eller endre dine data. Tilgang styres via et granulert tillatelsessystem per funksjonalitet.</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">6. Akseptabel bruk</h3>
            <p>Du forplikter deg til ikke å: (a) bruke tjenesten til ulovlige formål, (b) forsøke å omgå sikkerhetssystemet, (c) selge tilgang til tjenesten til tredjeparter, eller (d) misbruke AI-funksjonalitet til uønskede formål.</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">7. Tilgjengelighet og ansvar</h3>
            <p className="mb-2">Vi tilstreber 99,5 % oppetid, men garanterer ikke uavbrutt tilgang. Glidr er ikke ansvarlig for tap som følge av nedetid, datafeil eller tjenesteforstyrrelser.</p>
            <p>Glidr er uansett ikke ansvarlig for indirekte tap, tap av fortjeneste, konkurranseresultater eller beslutninger tatt på grunnlag av analysene i plattformen.</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">8. Opphør</h3>
            <p>Du kan slette kontoen din og all tilhørende data når som helst (se «Dine rettigheter»). Vi forbeholder oss retten til å stenge kontoer ved alvorlig misbruk, etter skriftlig varsel der det er praktisk mulig.</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">9. Lovvalg</h3>
            <p>Disse vilkårene reguleres av norsk lov. Eventuelle tvister behandles ved Oslo tingrett.</p>
          </div>
        </div>
      </section>

      {/* ── Personvernerklæring ────────────────────────────────────────────────── */}
      <section id="personvern">
        <h2 className="text-xl font-bold text-foreground mb-6">Personvernerklæring</h2>
        <p className="mb-4">Denne erklæringen beskriver hvordan Glidr behandler personopplysninger i samsvar med EUs personvernforordning (GDPR) og norsk personopplysningslov.</p>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-foreground mb-2">Behandlingsansvarlig</h3>
            <p>Simen Finjord, Norge · <a href="mailto:Simen.finjord@hotmail.com" className="underline underline-offset-2">Simen.finjord@hotmail.com</a></p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">Data vi samler inn</h3>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Kategori</th>
                    <th className="text-left px-3 py-2 font-semibold">Eksempler</th>
                    <th className="text-left px-3 py-2 font-semibold">Grunnlag</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Kontaktdata", "E-post, navn", "Avtale"],
                    ["Kontodata", "Passord (kryptert), tillatelser, lagtilknytning", "Avtale"],
                    ["Testdata", "Skiresultater, produkter, værlogg, slipeposter", "Avtale / Berettiget interesse"],
                    ["Bruksdata", "Innloggingstidspunkt, IP-adresse, nettlesertype", "Berettiget interesse (sikkerhet)"],
                    ["Garmin-data", "Øktskoder og testresultater fra klokkeapp", "Samtykke / Avtale"],
                  ].map(([cat, ex, gr]) => (
                    <tr key={cat} className="border-t">
                      <td className="px-3 py-2 font-medium">{cat}</td>
                      <td className="px-3 py-2 text-muted-foreground">{ex}</td>
                      <td className="px-3 py-2 text-muted-foreground">{gr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">Formål med behandlingen</h3>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>Levere og drifte tjenesten</li>
              <li>Autentisering og tilgangskontroll</li>
              <li>Fakturering og betalingshåndtering (via Stripe)</li>
              <li>Sikkerhetshendelser og misbruksforebygging</li>
              <li>Produktforbedring (anonymisert/aggregert bruksdata)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">Tredjeparter</h3>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Tjenesteleverandør</th>
                    <th className="text-left px-3 py-2 font-semibold">Formål</th>
                    <th className="text-left px-3 py-2 font-semibold">Overføring</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Stripe Inc. (USA)", "Betalingshåndtering", "EU-US Data Privacy Framework"],
                    ["OpenAI (USA)", "AI-analyse av testbilder", "Standard kontraktsklausuler (SCC)"],
                    ["Railway / Fly.io", "Serverinfrastruktur", "Innen EU/EØS der mulig"],
                    ["Garmin International", "Klokkeapp-integrasjon", "Brukerens samtykke"],
                    ["Google (Workspace API)", "Sheets backup (valgfritt)", "EU-US Data Privacy Framework"],
                  ].map(([vendor, purpose, transfer]) => (
                    <tr key={vendor} className="border-t">
                      <td className="px-3 py-2 font-medium">{vendor}</td>
                      <td className="px-3 py-2 text-muted-foreground">{purpose}</td>
                      <td className="px-3 py-2 text-muted-foreground">{transfer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Testdata som analyseres av OpenAI er kun bilder av manuelle testskjemaer. Ingen personopplysninger om utøvere eller brukere sendes til OpenAI.</p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">Lagringstid</h3>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>Kontodata: til kontoen slettes + 30 dagers karantene</li>
              <li>Testdata og annet innhold: til teamet slettes</li>
              <li>Innloggingslogger: 90 dager av sikkerhetshensyn</li>
              <li>Faktureringsinformasjon: 5 år (norsk regnskapslov)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Databehandleravtale ───────────────────────────────────────────────── */}
      <section id="databehandler">
        <h2 className="text-xl font-bold text-foreground mb-6">Databehandleravtale (DPA)</h2>
        <p className="mb-4">Denne databehandleravtalen gjelder der kunden er en bedrift eller organisasjon og Glidr behandler personopplysninger på vegne av kunden. Den er i samsvar med GDPR artikkel 28.</p>

        <div className="space-y-4 bg-muted/30 rounded-xl p-5 border">
          <p><strong>Partene:</strong> Kunden (behandlingsansvarlig) og Glidr v/ Simen Finjord (databehandler).</p>
          <p><strong>Formål:</strong> Levere Glidr-tjenesten, herunder lagring og bearbeiding av personopplysninger kunden legger inn.</p>
          <p><strong>Instrukser:</strong> Glidr behandler kun data etter kundens instrukser, slik definert i bruksvilkårene og denne DPA-en.</p>
          <p><strong>Konfidensialitet:</strong> Alle ansatte og underleverandører er bundet av taushetsplikt.</p>
          <p><strong>Sikkerhet:</strong> Glidr implementerer tekniske og organisatoriske tiltak inkludert kryptering (TLS/HTTPS), krypterte passord (bcrypt), tilgangskontroll og sessionsikkerhet.</p>
          <p><strong>Underdatabehandlere:</strong> Se tredjepartslisten ovenfor. Glidr varsler om nye underdatabehandlere med minst 14 dagers varsel.</p>
          <p><strong>Den registrertes rettigheter:</strong> Glidr bistår kunden med å oppfylle forespørsler om innsyn, retting, sletting og dataportabilitet.</p>
          <p><strong>Avslutning:</strong> Ved kontraktsopphør sletter Glidr all data innen 30 dager, med mindre lovpålagte oppbevaringsregler krever lengre lagring.</p>
          <p className="text-xs text-muted-foreground mt-4">Bedrifts- og fedrasjonskunder kan be om en separat signert DPA. Kontakt oss på <a href="mailto:Simen.finjord@hotmail.com" className="underline">Simen.finjord@hotmail.com</a>.</p>
        </div>
      </section>

      {/* ── Cookies ───────────────────────────────────────────────────────────── */}
      <section id="cookies">
        <h2 className="text-xl font-bold text-foreground mb-6">Informasjonskapsler (cookies)</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Navn</th>
                <th className="text-left px-3 py-2 font-semibold">Type</th>
                <th className="text-left px-3 py-2 font-semibold">Formål</th>
                <th className="text-left px-3 py-2 font-semibold">Varighet</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["glidr.sid", "Nødvendig", "Innloggingssesjon", "Inntil 30 dager (husk meg) / nettleserøkt"],
                ["__stripe_mid", "Nødvendig (betaling)", "Stripe betalingssikkerhet", "1 år"],
                ["__stripe_sid", "Nødvendig (betaling)", "Stripe betalingssesjon", "30 minutter"],
              ].map(([name, type, purpose, duration]) => (
                <tr key={name} className="border-t">
                  <td className="px-3 py-2 font-mono font-medium">{name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{type}</td>
                  <td className="px-3 py-2 text-muted-foreground">{purpose}</td>
                  <td className="px-3 py-2 text-muted-foreground">{duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Glidr bruker kun funksjonelle informasjonskapsler som er nødvendige for å drive tjenesten. Vi bruker ingen sporings- eller markedsføringskapsler.</p>
      </section>

      {/* ── Dine rettigheter ──────────────────────────────────────────────────── */}
      <section id="rettigheter">
        <h2 className="text-xl font-bold text-foreground mb-6">Dine rettigheter (GDPR)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: "Rett til innsyn", desc: "Du kan be om en kopi av alle personopplysninger vi har om deg." },
            { title: "Rett til retting", desc: "Du kan be oss rette uriktige eller ufullstendige opplysninger." },
            { title: "Rett til sletting", desc: "Du kan be om at kontoen og alle data slettes. Dette gjøres fra kontoinnstillingene eller via kontaktskjemaet." },
            { title: "Rett til dataportabilitet", desc: "Du kan be om en eksport av alle dine data i et maskinlesbart format (JSON/CSV)." },
            { title: "Rett til begrensning", desc: "Du kan be oss begrense behandlingen av dine data i visse tilfeller." },
            { title: "Rett til å klage", desc: "Du kan klage til Datatilsynet (datatilsynet.no) hvis du mener vi behandler opplysninger ulovlig." },
          ].map((r) => (
            <div key={r.title} className="rounded-xl border bg-card p-4">
              <div className="font-semibold text-foreground mb-1 text-sm">{r.title}</div>
              <div className="text-xs text-muted-foreground">{r.desc}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm">For å utøve rettighetene dine, kontakt oss på <a href="mailto:Simen.finjord@hotmail.com" className="underline underline-offset-2 font-medium">Simen.finjord@hotmail.com</a>. Vi svarer innen 30 dager.</p>
      </section>

      {/* ── Kontakt ───────────────────────────────────────────────────────────── */}
      <section id="kontakt">
        <h2 className="text-xl font-bold text-foreground mb-4">Kontakt og personvernombud</h2>
        <div className="rounded-xl border bg-card p-5 text-sm space-y-2">
          <p><strong>Behandlingsansvarlig:</strong> Simen Finjord</p>
          <p><strong>E-post:</strong> <a href="mailto:Simen.finjord@hotmail.com" className="underline underline-offset-2">Simen.finjord@hotmail.com</a></p>
          <p><strong>Telefon:</strong> +47 975 40 178</p>
          <p><strong>Land:</strong> Norge</p>
          <p className="text-xs text-muted-foreground pt-2">Som en liten tjeneste er vi ikke pålagt å utpeke et formelt personvernombud (DPO), men du kan alltid kontakte oss direkte med personvernspørsmål.</p>
        </div>
      </section>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-12 text-sm text-foreground/80 leading-relaxed">

      <section id="bruksvilkar">
        <h2 className="text-xl font-bold text-foreground mb-6">Terms of Service</h2>
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold text-foreground mb-2">1. The Agreement</h3>
            <p>By registering and using Glidr ("the Service") you accept these Terms and the Privacy Policy. The agreement is between you/your organisation ("Customer") and Simen Finjord ("Glidr", "we", "us").</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">2. Data Ownership</h3>
            <p className="mb-2">All data you enter into Glidr — test results, products, weather logs, athlete profiles, grinding records and other content — is and remains your exclusive property.</p>
            <p>Glidr claims no ownership, license, or usage rights over your data. Your data will never be sold, shared with third parties, or used for purposes other than providing the Service.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">3. Subscriptions & Billing</h3>
            <p className="mb-1"><strong>Free plan:</strong> No payment details required. Usage limits apply (see pricing page).</p>
            <p className="mb-1"><strong>Paid plans:</strong> Billed monthly or annually via Stripe. 14-day free trial; payment begins at the first invoice date after the trial.</p>
            <p><strong>Cancellation:</strong> Cancel anytime from account settings. Access continues until end of billing period. No refunds for unused time.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">4. Limitation of Liability</h3>
            <p>Glidr is not liable for indirect damages, lost profits, competition outcomes, or decisions made based on platform analytics.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">5. Governing Law</h3>
            <p>These Terms are governed by Norwegian law. Disputes shall be resolved by Oslo District Court.</p>
          </div>
        </div>
      </section>

      <section id="personvern">
        <h2 className="text-xl font-bold text-foreground mb-6">Privacy Policy</h2>
        <p className="mb-4">This policy describes how Glidr processes personal data in accordance with the EU General Data Protection Regulation (GDPR).</p>
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold text-foreground mb-2">Data Controller</h3>
            <p>Simen Finjord, Norway · <a href="mailto:Simen.finjord@hotmail.com" className="underline">Simen.finjord@hotmail.com</a></p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Data We Collect</h3>
            <p>Contact data (name, email), account credentials (hashed passwords, permissions), test and product data you enter, login logs (IP address, timestamp), and optional Garmin watch session data.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Third Parties</h3>
            <p>Stripe (billing), OpenAI (AI image analysis of test sheets — no personal data about athletes is sent), Railway/Fly.io (hosting), Garmin (watch integration), Google (optional Sheets backup). All third-party transfers are covered by EU Standard Contractual Clauses or the EU-US Data Privacy Framework.</p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Retention</h3>
            <p>Account data is retained until deletion + 30 days. Test data until team deletion. Login logs: 90 days. Billing records: 5 years (Norwegian accounting law).</p>
          </div>
        </div>
      </section>

      <section id="rettigheter">
        <h2 className="text-xl font-bold text-foreground mb-6">Your Rights (GDPR)</h2>
        <p className="mb-4">You have the right to access, rectify, delete, or port your data. You may also restrict processing or lodge a complaint with your national data protection authority. Contact us at <a href="mailto:Simen.finjord@hotmail.com" className="underline">Simen.finjord@hotmail.com</a> — we respond within 30 days.</p>
        <p>You can delete your account and all associated data at any time from <strong>My Account → Danger Zone</strong>.</p>
      </section>

      <section id="kontakt">
        <h2 className="text-xl font-bold text-foreground mb-4">Contact</h2>
        <div className="rounded-xl border bg-card p-5 text-sm space-y-1">
          <p><strong>Controller:</strong> Simen Finjord</p>
          <p><strong>Email:</strong> <a href="mailto:Simen.finjord@hotmail.com" className="underline">Simen.finjord@hotmail.com</a></p>
          <p><strong>Phone:</strong> +47 975 40 178</p>
          <p><strong>Country:</strong> Norway</p>
        </div>
      </section>
    </div>
  );
}
