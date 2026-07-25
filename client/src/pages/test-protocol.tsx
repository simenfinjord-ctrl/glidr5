// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// SA test protocol: a step-by-step verification checklist for the whole
// platform. Opened in its own tab from Admin → Documents; every step is
// confirmed OK or flagged with an issue note, persisted server-side.
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, AlertTriangle, RotateCcw, ClipboardList, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type StepState = { status: "ok" | "issue"; note?: string; at?: string; by?: string };

type Step = { id: string; t: string; how: string; expect: string };
type Section = { id: string; title: string; steps: Step[] };

const PROTOCOL: Section[] = [
  {
    id: "auth", title: "1 · Innlogging, vilkår og sikkerhet",
    steps: [
      { id: "auth-login", t: "Vanlig innlogging", how: "Logg inn med brukernavn + passord på PC og mobil.", expect: "Begge kommer rett til Dashboard uten feil." },
      { id: "auth-remember", t: "Husk meg i 3 dager", how: "Logg inn med «Husk meg» haket av (på konto med 2FA). Lukk nettleseren helt, åpne igjen neste dag.", expect: "Fortsatt innlogget. Uten haken: utlogget etter 24 t." },
      { id: "auth-lockout", t: "Kontolås ved feil passord", how: "Tast feil passord gjentatte ganger på en testkonto.", expect: "Kontoen låses med tydelig melding; TA/SA kan låse opp fra brukermenyen." },
      { id: "auth-terms-new", t: "Vilkårsgate for ny bruker", how: "Opprett en testbruker og logg inn første gang.", expect: "Vilkårsdialogen vises og MÅ aksepteres; ingen betalingsfokus i teksten; vises ikke igjen ved neste innlogging." },
      { id: "auth-terms-reset", t: "SA kan tilbakestille aksept", how: "Admin → Security → Vilkårsaksept: tilbakestill testbrukeren.", expect: "Brukeren får dialogen på nytt ved neste innlasting." },
      { id: "auth-terms-ta", t: "TA ser ALDRI vilkårsdata", how: "Logg inn som TA: sjekk dashbord, brukerliste og eksporter.", expect: "Ingen «Terms»-tall, kolonner eller varsler noe sted." },
      { id: "auth-2fa", t: "2FA-pålogging", how: "Logg inn på konto med 2FA aktivert.", expect: "Kodesteg vises; feil kode avvises; riktig kode logger inn." },
    ],
  },
  {
    id: "users", title: "2 · Brukere og tilganger",
    steps: [
      { id: "users-create", t: "Opprett bruker", how: "Admin → Users → New user med begrensede områder.", expect: "Brukeren kan logge inn og ser KUN de valgte områdene i menyen." },
      { id: "users-preview", t: "Forhåndsvis tilganger", how: "Options → Forhåndsvis tilganger på en bruker.", expect: "Viser rolle, alle områder med nivå, flagg, menyen slik brukeren ser den — og brukeren kan ikke spore det." },
      { id: "users-share", t: "Del bruker til annet lag", how: "Legg en eksisterende bruker til et annet lag; sett per-lag-tilganger fra det mottakende laget.", expect: "Brukeren kan bytte lag; «Administrer tilgang her»-dialogen virker og er avgrenset til laget." },
      { id: "users-delete", t: "Ekte brukersletting", how: "Slett en testbruker. Sjekk Login History, vilkårslisten og aktive sesjoner.", expect: "Alle spor av KONTOEN er borte (logges ut umiddelbart); data brukeren har laget står igjen med navn; slettingen ligger i papirkurven." },
      { id: "users-tester", t: "Testerrollen", how: "Sett «Tester» på en konto og logg inn med den.", expect: "Ser kun Watch Queue; alle andre områder/API-er avvises; kan se og kjøre køens tester." },
      { id: "users-blind", t: "Blind-tester", how: "Logg inn som blind-tester og åpne en test + live runsheet.", expect: "Produktnavn skjult overalt, inkl. produkt-toggle i live runsheet (finnes ikke)." },
    ],
  },
  {
    id: "tests", title: "3 · Tester og skigarasje",
    steps: [
      { id: "tests-new", t: "Ny glidtest ende-til-ende", how: "Ny test → velg produkter (sjekk typechips Paraffin/Liquid/Block) → kjør runsheet → lagre.", expect: "Typene vises i velgeren; resultater/rank riktig; testen åpnes pent i nytt design med vinnerchip." },
      { id: "tests-locations", t: "Stedsforslag", how: "Åpne stedsfeltet i testfilteret og i Ny test.", expect: "Kun steder som har synlige tester foreslås (grind-steder kun når grind-filteret er på)." },
      { id: "tests-entry-remove", t: "Fjern entry", how: "Åpne en test → fjern et skipar med X-knappen.", expect: "Bekreftelse, paret fjernes og numrene renummereres." },
      { id: "tests-mobile", t: "Garasjen på mobil", how: "Åpne en utøvers Ski Garage på telefonen; bytt Kort/Tabell; bruk Alle/Klassisk/Skøyte-chips; sorter via kolonnetrykk i tabell.", expect: "Tabellvisningen fungerer som på PC; chips filtrerer umiddelbart." },
      { id: "tests-live", t: "Live runsheet", how: "Start en runsheet og følg med fra en annen enhet under Live Runsheets; toggle «Produkter».", expect: "Oppdateres hvert par sekunder; produktnavn med type i lukene når på." },
      { id: "tests-waxer", t: "Hovedsmører", how: "Som TA: bytt hovedsmører på en utøver. Som vanlig smører: åpne samme dialog.", expect: "TA får velger med lagets smørere; gammel smører beholder delt tilgang; vanlig bruker ser kun navnet." },
      { id: "tests-suggestions", t: "Suggestions", how: "Åpne Suggestions med værdata som matcher gamle tester.", expect: "Anbefalinger med produktnavn · type; tall stemmer med analytics." },
    ],
  },
  {
    id: "parent", title: "4 · Moderlag / datterlag (Slovenia)",
    steps: [
      { id: "parent-setup", t: "Opprett relasjonen", how: "Teams → ⋯ på datterlaget → Moderlag/datterlag → velg moderlag + delte områder → Lagre.", expect: "Valget fester seg; delte områder-chips vises; Lagre bekrefter." },
      { id: "parent-view", t: "Datterlaget ser delt data", how: "Logg inn som datterlag-bruker: sjekk Tests, Products, Kick (og Vær/Grinding hvis delt).", expect: "Moderlagets data vises med fiolett lagchip, streng lesetilgang; egne data kan legges inn og skilles tydelig." },
      { id: "parent-gate", t: "Ikke-delte områder er tette", how: "Fjern en delehake (f.eks. Grinding) og sjekk datterlaget.", expect: "Grind-tester og området forsvinner umiddelbart." },
      { id: "parent-hide", t: "Kurartering med reberegning", how: "På en delt test: ⋯ → Synlighet for datterlag → skjul vinnerparet. Åpne testen som datterlag.", expect: "Paret er borte, NY vinner har 0 cm, alle diff/rank omregnet; runsheet-visning utilgjengelig." },
      { id: "parent-product", t: "Skjul produkt", how: "Produktside → «Skjult for datterlag».", expect: "Produktet OG alle skipar som brukte det forsvinner fra datterlagets visning overalt." },
      { id: "parent-access", t: "Moderlags-innsyn logges", how: "Som moderlag-TA: bytt til datterlaget via lagvelgeren.", expect: "Full admin-tilgang der; datterlagets aktivitetslogg får «(moderlag) accessed this team's workspace»; står ikke som medlem." },
      { id: "parent-emancipate", t: "Frigjøring", how: "Teams → dialogen → «Med kopi» på et TESTLAG (ikke Slovenia!).", expect: "Relasjonen kuttes; kopien ligger som lagets egne data (kuratert versjon); logget hos begge lag." },
    ],
  },
  {
    id: "billing", title: "5 · Fakturering og kommersialisering",
    steps: [
      { id: "bill-toggle", t: "Commercialization-bryteren", how: "Slå AV: sjekk forsiden, public-nav, demo og /get-started. Slå PÅ igjen.", expect: "AV: ingen «Get started»-innganger eller Pricing; TA-fanen «Lagets plan» borte. PÅ: alt tilbake." },
      { id: "bill-signup", t: "Selvbetjent lagopprettelse", how: "Utlogget: «Get started with your team» → bygg plan → aksepter fakturering → opprett lag.", expect: "Live prisutregning stemmer med prislisten; laget opprettes med TA/kontaktperson; du får innboksvarsel + rad i Registreringer." },
      { id: "bill-prices", t: "Dynamiske priser", how: "Accounting → endre en funksjonspris i prislisten.", expect: "Alle custom-lags summer endres umiddelbart i billing-kortene og fakturagrunnlaget." },
      { id: "bill-discount", t: "Rabatt", how: "Sett 20 % rabatt på et lag i plan-dialogen.", expect: "Beregnet pris, CSV og plan-PDF viser rabattert sum." },
      { id: "bill-pdf", t: "Plan-spesifikasjon (PDF)", how: "Dokumentikonet på en lagrad i faktureringsplanen.", expect: "PDF med hver funksjon + pris, grenser, rabatt og totaler — klar som fakturavedlegg." },
      { id: "bill-taplan", t: "TA endrer egen plan", how: "Som TA på custom-lag: Admin → Lagets plan → toggle en funksjon → bekreft.", expect: "Ny pris vises live; SA får innboksvarsel; endringen i planhistorikken." },
      { id: "bill-cycle", t: "Faktureringssyklus", how: "Marker en faktura sendt → betalt i Accounting.", expect: "Status flyter riktig; neste dato rykker frem; historikk + nøkkeltall oppdateres." },
    ],
  },
  {
    id: "backup", title: "6 · Backup og data",
    steps: [
      { id: "bk-sheets", t: "Sheets-backup manuelt", how: "Backup-fanen → kjør backup på et lag; åpne regnearket.", expect: "Grønn status med tidspunkt; alle faner (tester, utøvere, kick, fleets, produkter, vær) lesbare med formatering; ski-ID «003» forblir tekst." },
      { id: "bk-drive", t: "Drive-backup 23:59", how: "Sjekk Drive-mappen morgenen etter.", expect: "Fersk JSON + PDF fra i natt; status i Backup-fanen grønn." },
      { id: "bk-json-export", t: "JSON-eksport med områdevalg", how: "Data Management → fjern noen område-chips → Last ned JSON.", expect: "Filen inneholder kun valgte områder + kjernen; SA med «Alle lag» får systemeksport." },
      { id: "bk-json-import", t: "JSON-import v2", how: "Importer samme fil på nytt.", expect: "Alt rapporteres som duplikater — ingen dobbeltdata; import til testlag remapper ID-er riktig." },
      { id: "bk-recycle", t: "Papirkurv full runde", how: "Slett en test, kick-test, race prep og fleet-ski → gjenopprett alle fra Activity → Slettet.", expect: "Alle fire tilbake med underdata (entries/regrinds) intakt." },
      { id: "bk-quota", t: "Kvote-robusthet", how: "Kjør manuell backup rett etter en automatisk (eller to raskt etter hverandre).", expect: "Ingen «Quota exceeded»-feil til brukeren — den venter og fullfører." },
    ],
  },
  {
    id: "offline", title: "7 · Offline og mobil",
    steps: [
      { id: "off-write", t: "Offline-lagring", how: "Flymodus på telefonen → registrer en test → tilbake på nett.", expect: "Testen synkes automatisk; kø-indikator vises mens offline." },
      { id: "off-fail", t: "Avviste synkinger", how: "Provoser en 4xx (f.eks. slett testen fra PC før synk).", expect: "Havner i failed-listen med beskjed — forsvinner ikke i stillhet." },
      { id: "off-sw", t: "Oppdatering etter deploy", how: "Etter en deploy: last siden på nytt én gang.", expect: "Ny versjon aktiv (sjekk en fersk endring); ingen evig gammel cache." },
    ],
  },
  {
    id: "admin", title: "8 · Admin-flatene",
    steps: [
      { id: "adm-teams", t: "Teams-fanen", how: "Prøv alle handlingene i ⋯-menyen på et lag (plan, grenser, moderlag, historikk, notater, pause, slett på testlag).", expect: "Alle dialoger åpner og er fullt klikkbare (også nedtrekkslister i dem)." },
      { id: "adm-backup-ui", t: "Backup-radene", how: "Fold ut/inn lagrader i Sheets, Drive og Feedback.", expect: "Status synlig kollapset; redigering og hurtigknapper virker; ingenting mistet." },
      { id: "adm-activity", t: "Aktivitetslogg-chips", how: "Bruk Alle/Opprettet/Endret/Slettet/Innsyn-chipsene + finfilteret.", expect: "Filtrene kombineres riktig; «Slettet» viser papirkurven med Restore." },
      { id: "adm-logins", t: "Login History-sletting", how: "Slett en enkeltrad og «Tøm for laget» på et testlag.", expect: "Radene forsvinner med bekreftelse; slettingen ligger i SA-sporet." },
      { id: "adm-accounting", t: "Accounting-navigasjon", how: "Bruk hopp-chipsene Nøkkeltall/Fakturering/Priser/Historikk.", expect: "Scroller til riktig seksjon." },
    ],
  },
];

const TOTAL = PROTOCOL.reduce((s, sec) => s + sec.steps.length, 0);

export default function TestProtocol() {
  const { user, isSuperAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: state = {} } = useQuery<Record<string, StepState>>({
    queryKey: ["/api/admin/test-protocol"],
    enabled: isSuperAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async (body: any) => (await apiRequest("PUT", "/api/admin/test-protocol", body)).json(),
    onSuccess: (data) => queryClient.setQueryData(["/api/admin/test-protocol"], data),
  });

  if (!user) return null;
  if (!isSuperAdmin) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Super Admin only.</div>;
  }

  const okCount = Object.values(state).filter((s) => s.status === "ok").length;
  const issueCount = Object.values(state).filter((s) => s.status === "issue").length;
  const pct = Math.round(((okCount + issueCount) / TOTAL) * 100);

  const setStep = (stepId: string, status: "ok" | "issue" | null) => {
    saveMutation.mutate({ stepId, status, note: notes[stepId] ?? state[stepId]?.note ?? "" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky progress header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight">Glidr testprotokoll</h1>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap" data-testid="protocol-progress">
                {okCount + issueCount}/{TOTAL} · <span className="text-emerald-600">{okCount} OK</span>{issueCount > 0 && <> · <span className="text-amber-600">{issueCount} mangler</span></>}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" data-testid="button-reset-protocol"
            onClick={() => { if (confirm("Nullstille hele protokollen?")) saveMutation.mutate({ reset: true }); }}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Nullstill
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Gå gjennom stegene i rekkefølge. Bekreft <strong>OK</strong> når steget fungerer, eller marker
          <strong> Mangler</strong> med et notat om hva som sviktet — så fikses de samlet. Fremdriften lagres automatisk.
        </p>

        {PROTOCOL.map((sec) => {
          const secDone = sec.steps.filter((st) => state[st.id]).length;
          const isCollapsed = collapsed[sec.id] ?? secDone === sec.steps.length;
          return (
            <div key={sec.id} className="rounded-2xl border border-border bg-card shadow-sm" data-testid={`protocol-section-${sec.id}`}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
                onClick={() => setCollapsed((c) => ({ ...c, [sec.id]: !isCollapsed }))}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className="font-semibold text-sm flex-1">{sec.title}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                  secDone === sec.steps.length ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                  {secDone}/{sec.steps.length}
                </span>
              </button>
              {!isCollapsed && (
                <div className="border-t border-border">
                  {sec.steps.map((st, i) => {
                    const s = state[st.id];
                    return (
                      <div key={st.id} className={cn("px-4 py-3", i > 0 && "border-t border-border/60")} data-testid={`protocol-step-${st.id}`}>
                        <div className="flex items-start gap-3">
                          <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            s?.status === "ok" ? "bg-emerald-500 text-white" : s?.status === "issue" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground")}>
                            {s?.status === "ok" ? <Check className="h-3.5 w-3.5" /> : s?.status === "issue" ? <AlertTriangle className="h-3.5 w-3.5" /> : i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{st.t}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground"><strong>Slik:</strong> {st.how}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground"><strong>Forventet:</strong> {st.expect}</div>
                            {(s?.status === "issue" || notes[st.id] !== undefined) && (
                              <textarea
                                className="mt-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                                rows={2}
                                placeholder="Hva mangler / hva sviktet?"
                                value={notes[st.id] ?? s?.note ?? ""}
                                onChange={(e) => setNotes((n) => ({ ...n, [st.id]: e.target.value }))}
                                onBlur={() => { if (s) setStep(st.id, s.status); }}
                                data-testid={`protocol-note-${st.id}`}
                              />
                            )}
                            {s && (
                              <div className="mt-1 text-[10px] text-muted-foreground/70">
                                {s.status === "ok" ? "Bekreftet" : "Markert mangler"} {s.at ? new Date(s.at).toLocaleString("no-NO") : ""} {s.by ? `av ${s.by}` : ""}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                            <Button size="sm" variant={s?.status === "ok" ? "default" : "outline"}
                              className={cn("h-7 px-2.5 text-xs", s?.status === "ok" && "bg-emerald-600 hover:bg-emerald-700")}
                              data-testid={`protocol-ok-${st.id}`}
                              onClick={() => setStep(st.id, s?.status === "ok" ? null : "ok")}>
                              <Check className="h-3.5 w-3.5 mr-1" />OK
                            </Button>
                            <Button size="sm" variant={s?.status === "issue" ? "default" : "outline"}
                              className={cn("h-7 px-2.5 text-xs", s?.status === "issue" && "bg-amber-500 hover:bg-amber-600")}
                              data-testid={`protocol-issue-${st.id}`}
                              onClick={() => { setNotes((n) => ({ ...n, [st.id]: n[st.id] ?? s?.note ?? "" })); setStep(st.id, s?.status === "issue" ? null : "issue"); }}>
                              <AlertTriangle className="h-3.5 w-3.5 mr-1" />Mangler
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <p className="pb-8 text-center text-xs text-muted-foreground">
          {issueCount > 0
            ? `${issueCount} steg markert med mangler — send listen til utvikling, så fikses de samlet.`
            : okCount === TOTAL
            ? "Alle steg bekreftet — Glidr er verifisert klar. 🎿"
            : "Fremdriften lagres automatisk — du kan lukke fanen og fortsette senere."}
        </p>
      </div>
    </div>
  );
}
