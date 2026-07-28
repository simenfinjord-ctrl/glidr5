// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Standalone, printable Data Processing Agreement (databehandleravtale) —
// the document a federation's lawyer asks for before signing. Print to PDF
// via the browser; the operator fills in the customer fields by hand or in
// the printed copy.
import { PublicNav } from "@/components/public-nav";
import { useLanguage } from "@/lib/language";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function Dpa() {
  const { lang } = useLanguage();
  const no = lang === "no";

  const S = ({ n, no: tNo, en, children }: { n: string; no: string; en: string; children: React.ReactNode }) => (
    <section className="mb-6">
      <h2 className="text-base font-semibold mb-2">{n}. {no ? tNo : en}</h2>
      <div className="text-sm leading-relaxed text-foreground/90 space-y-2">{children}</div>
    </section>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden"><PublicNav /></div>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 print:py-0">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-dpa">
              {no ? "Databehandleravtale (DPA)" : "Data Processing Agreement (DPA)"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {no ? "I henhold til personvernforordningen (GDPR) artikkel 28 · Sist oppdatert juli 2026"
                  : "Pursuant to GDPR Article 28 · Last updated July 2026"}
            </p>
          </div>
          <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />{no ? "Skriv ut / lagre som PDF" : "Print / save as PDF"}
          </Button>
        </div>

        <div className="mb-8 rounded-xl border border-border p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{no ? "Behandlingsansvarlig (Kunden)" : "Data Controller (the Customer)"}</div>
              <div className="mt-1 border-b border-dashed border-border pb-1 text-muted-foreground">{no ? "Organisasjon: ____________________" : "Organisation: ____________________"}</div>
              <div className="mt-2 border-b border-dashed border-border pb-1 text-muted-foreground">{no ? "Org.nr / adresse: ____________________" : "Reg. no / address: ____________________"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{no ? "Databehandler (Leverandøren)" : "Data Processor (the Supplier)"}</div>
              <div className="mt-1">Glidr v/ Simen Finjord</div>
              <div className="text-muted-foreground">hei@glidr.no · glidr.no · {no ? "Norge" : "Norway"}</div>
            </div>
          </div>
        </div>

        <S n="1" no="Formål og omfang" en="Purpose and scope">
          <p>{no
            ? "Denne avtalen regulerer Leverandørens behandling av personopplysninger på vegne av Kunden gjennom tjenesten Glidr — et system for skitesting, smøring og utstyrsforvaltning. Avtalen gjelder så lenge Kunden har en aktiv konto."
            : "This agreement governs the Supplier's processing of personal data on behalf of the Customer through the Glidr service — a system for ski testing, waxing and equipment management. It applies for as long as the Customer holds an active account."}</p>
        </S>

        <S n="2" no="Opplysninger som behandles" en="Data processed">
          <p>{no ? "Følgende kategorier behandles:" : "The following categories are processed:"}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{no ? "Brukere: navn, e-postadresse, telefonnummer (valgfritt), innloggingshistorikk" : "Users: name, email address, phone number (optional), login history"}</li>
            <li>{no ? "Utøvere: navn, klubb/lag, fysiske mål relevante for skitilpasning (høyde, vekt, stavlengder), utstyr- og testhistorikk, samtykkeregistrering" : "Athletes: name, club/team, physical measurements relevant to ski fitting (height, weight, pole lengths), equipment and test history, consent records"}</li>
            <li>{no ? "Ingen særlige kategorier (sensitive opplysninger) behandles. For mindreårige utøvere er Kunden ansvarlig for å innhente foresattes samtykke; Glidr tilbyr samtykkeregistrering på utøverprofilen." : "No special categories (sensitive data) are processed. For minor athletes the Customer is responsible for obtaining guardian consent; Glidr provides consent registration on the athlete profile."}</li>
          </ul>
        </S>

        <S n="3" no="Leverandørens plikter" en="Supplier's obligations">
          <ul className="list-disc pl-5 space-y-1">
            <li>{no ? "Behandler kun opplysninger etter dokumenterte instrukser fra Kunden (bruken av tjenesten)." : "Processes data only on the Customer's documented instructions (use of the service)."}</li>
            <li>{no ? "Sikrer konfidensialitet: tilgang er rollestyrt per lag, gruppe og utøver; all administratortilgang logges." : "Ensures confidentiality: access is role-scoped per team, group and athlete; all administrator access is logged."}</li>
            <li>{no ? "Tekniske tiltak: kryptert transport (TLS), hashede passord, tofaktorautentisering tilgjengelig, daglige sikkerhetskopier med vern mot utilsiktet sletting." : "Technical measures: encrypted transport (TLS), hashed passwords, two-factor authentication available, daily backups with data-loss protection."}</li>
            <li>{no ? "Varsler Kunden uten ugrunnet opphold ved brudd på personopplysningssikkerheten." : "Notifies the Customer without undue delay in the event of a personal data breach."}</li>
            <li>{no ? "Bistår Kunden med å svare på de registrertes rettigheter (innsyn, retting, sletting, dataportabilitet — JSON-eksport er innebygd)." : "Assists the Customer in answering data subjects' rights requests (access, rectification, erasure, portability — JSON export is built in)."}</li>
          </ul>
        </S>

        <S n="4" no="Underdatabehandlere" en="Sub-processors">
          <p>{no ? "Kunden godkjenner følgende underdatabehandlere. Endringer varsles med 30 dagers frist:" : "The Customer approves the following sub-processors. Changes are notified with 30 days' notice:"}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Render (Render Services, Inc.) — {no ? "drift og database (EU-region)" : "hosting and database (EU region)"}</li>
            <li>Google LLC — {no ? "sikkerhetskopier til Kundens egen Google Disk/Sheets (styrt av Kunden)" : "backups to the Customer's own Google Drive/Sheets (controlled by the Customer)"}</li>
            <li>Resend — {no ? "utsending av transaksjonelle e-poster" : "transactional email delivery"}</li>
            <li>Cloudflare, Inc. — {no ? "fillagring (vedlegg)" : "file storage (attachments)"}</li>
          </ul>
          <p>{no ? "Overføring utenfor EØS skjer i henhold til EU-kommisjonens standardkontrakter (SCC)." : "Transfers outside the EEA rely on the EU Commission's Standard Contractual Clauses (SCC)."}</p>
        </S>

        <S n="5" no="Sletting og tilbakelevering" en="Deletion and return">
          <p>{no
            ? "Ved avtalens opphør slettes Kundens data fullstendig fra tjenesten etter skriftlig anmodning (innebygget kaskadesletting per lag), alternativt utleveres en komplett JSON-eksport først. Sikkerhetskopier hos Kunden (egen Google Disk) berøres ikke av Leverandøren."
            : "On termination the Customer's data is deleted in full from the service upon written request (built-in per-team cascade deletion), optionally preceded by a complete JSON export. Backups held by the Customer (their own Google Drive) are not touched by the Supplier."}</p>
        </S>

        <S n="6" no="Revisjon og lovvalg" en="Audit and governing law">
          <p>{no
            ? "Kunden kan be om dokumentasjon på etterlevelse én gang per år. Avtalen er underlagt norsk rett med verneting i Norge."
            : "The Customer may request compliance documentation once per year. The agreement is governed by Norwegian law with legal venue in Norway."}</p>
        </S>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 text-sm">
          <div>
            <div className="border-b border-foreground/50 pb-8">{no ? "Sted/dato:" : "Place/date:"}</div>
            <div className="mt-2 text-xs text-muted-foreground">{no ? "For Kunden (behandlingsansvarlig)" : "For the Customer (controller)"}</div>
          </div>
          <div>
            <div className="border-b border-foreground/50 pb-8">{no ? "Sted/dato:" : "Place/date:"}</div>
            <div className="mt-2 text-xs text-muted-foreground">{no ? "For Glidr (databehandler)" : "For Glidr (processor)"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
