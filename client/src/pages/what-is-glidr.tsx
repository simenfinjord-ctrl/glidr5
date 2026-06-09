import { AppLink } from "@/components/app-link";
import { useLanguage } from "@/lib/language";
import {
  DashboardAnim,
  TestsAnim,
  RunsheetAnim,
  AnalyticsAnim,
  WeatherAnim,
  TestSkisAnim,
  ProductsAnim,
  RaceSkisAnim,
  AdminAnim,
  MobileAnim,
  GarminAnim,
} from "@/components/feature-animations";

const sections = [
  {
    title: "Dashboard & Live Results",
    description:
      "Your team's testing hub at a glance. Recent results auto-refresh every 10 seconds with winner highlights and medal badges. Instantly see which products are performing — gold, silver, and bronze rank badges make it clear who's on top.",
    anim: DashboardAnim,
  },
  {
    title: "Test Management",
    description:
      "Table-first workflow designed for speed on snow. Dynamic rounds, live ranking with competition rules (ties skip next numbers: 1-1-3), and support for Glide, Structure, Classic, Skating, Double Poling, and Grind test types. Filter by date, product, snow type, location, and temperature.",
    anim: TestsAnim,
  },
  {
    title: "Complete Runsheet",
    description:
      "Single-elimination tournament bracket for head-to-head ski pair testing. Enter distances, winners auto-advance, and cascading diff calculations show exactly how much each pair lost by. Mobile mode with large touch targets for glove use on snow.",
    anim: RunsheetAnim,
  },
  {
    title: "Garmin Watch Control",
    description:
      "The only ski testing platform with native Garmin watch support. Generate a 4-digit session code from your runsheet, enter it on your Forerunner or Fenix, and run your entire bracket hands-free — no phone, no tablet, no fumbling in the cold. Select the winner with UP or DOWN, dial in the gap in centimeters, and confirm. Results sync instantly to the live bracket. When all heats are done, apply the final standings directly from your wrist with a single button press.",
    anim: GarminAnim,
  },
  {
    title: "Analytics & Product Comparison",
    description:
      "Interactive charts powered by your data: product wins over time, average rank, tests per month, and temperature-vs-rank scatter. Compare products side-by-side with head-to-head stats, win rates, and methodology breakdowns.",
    anim: AnalyticsAnim,
  },
  {
    title: "Weather Documentation",
    description:
      "Log snow and air conditions — temperature, humidity, wind, precipitation, grain size, track hardness, and test quality. Weather auto-links to tests by matching date, location, and group. The Suggestions engine uses your historical data to recommend products for any conditions.",
    anim: WeatherAnim,
  },
  {
    title: "Test Ski Series",
    description:
      "Organize testing around ski series with brand, ski type, and pair labels. Track regrind history per series. Series filter by test type so you always work with the right set. Click into any series to see all associated tests and results.",
    anim: TestSkisAnim,
  },
  {
    title: "Product Inventory & Stock",
    description:
      "Centralized product catalog with stock tracking. Quick +/− buttons for inventory, color-coded stock levels (red/amber/green), change audit log, and group filtering. Switch between list and storage view to manage your wax room.",
    anim: ProductsAnim,
  },
  {
    title: "Race Ski & Athlete Management",
    description:
      "Full athlete profiles with ski inventory: serial numbers, brands, disciplines, construction, grinds, and more. Track regrind history with automatic updates. Archive/restore skis. Access control per athlete — only authorized users see the data.",
    anim: RaceSkisAnim,
  },
  {
    title: "Admin & Team Security",
    description:
      "Built for commercial multi-team SaaS: complete data isolation, three role levels (Super Admin, Team Admin, Member), and granular permissions across 10 areas. Blind Tester mode, activity logging, and per-team feature control.",
    anim: AdminAnim,
  },
  {
    title: "Mobile & Offline Ready",
    description:
      "Responsive design works on any device. Enter data without internet — on the mountain, in the wax cabin, wherever you are. Changes queue locally and sync automatically when you're back online.",
    anim: MobileAnim,
  },
];

const SECTIONS_NO: { title: string; description: string }[] = [
  { title: "Dashbord og live-resultater", description: "Lagets testnav på ett blikk. Nylige resultater oppdateres automatisk hvert 10. sekund med vinnermarkering og medaljemerker. Se umiddelbart hvilke produkter som presterer — gull-, sølv- og bronserangmerker gjør det tydelig hvem som er på topp." },
  { title: "Testadministrasjon", description: "Tabellbasert arbeidsflyt designet for fart på snøen. Dynamiske runder, live rangering med konkurranseregler (likt hopper over neste nummer: 1-1-3), og støtte for testtypene Glid, Struktur, Klassisk, Skøyting, Staking og Slip. Filtrer på dato, produkt, snøtype, sted og temperatur." },
  { title: "Komplett kjøreark", description: "Cup-oppsett med enkel utslagning for head-to-head-testing av skipar. Legg inn avstander, vinnere går automatisk videre, og kaskaderende differanseberegninger viser nøyaktig hvor mye hvert par tapte med. Mobilmodus med store trykkflater for bruk med votter på snøen." },
  { title: "Garmin-klokkestyring", description: "Den eneste skitestplattformen med innebygd Garmin-klokkestøtte. Generer en 4-sifret øktkode fra kjørearket, legg den inn på Forerunner eller Fenix, og kjør hele heatet håndfritt — ingen telefon, ingen nettbrett, ingen fomling i kulda. Velg vinneren med OPP eller NED, still inn gapet i centimeter, og bekreft. Resultatene synkroniseres umiddelbart til live-heatet. Når alle heat er ferdige, bruker du sluttstillingen direkte fra håndleddet med ett knappetrykk." },
  { title: "Analyse og produktsammenligning", description: "Interaktive diagrammer drevet av dine data: produktseire over tid, snittrang, tester per måned, og temperatur-vs-rang-spredning. Sammenlign produkter side om side med head-to-head-statistikk, seiersrater og metodikkfordelinger." },
  { title: "Værdokumentasjon", description: "Loggfør snø- og luftforhold — temperatur, fuktighet, vind, nedbør, kornstørrelse, sporhardhet og testkvalitet. Været kobles automatisk til tester ved å matche dato, sted og gruppe. Forslagsmotoren bruker dine historiske data til å anbefale produkter for ethvert føre." },
  { title: "Testskiserier", description: "Organiser testing rundt skiserier med merke, skitype og par-etiketter. Spor reslip-historikk per serie. Serier filtreres etter testtype så du alltid jobber med riktig sett. Klikk inn på en serie for å se alle tilknyttede tester og resultater." },
  { title: "Produktbeholdning og lager", description: "Sentralisert produktkatalog med lagersporing. Hurtige +/−-knapper for beholdning, fargekodede lagernivåer (rød/gul/grønn), endringslogg og gruppefiltrering. Bytt mellom liste- og lagervisning for å styre voksrommet." },
  { title: "Løpsski- og utøveradministrasjon", description: "Fulle utøverprofiler med skibeholdning: serienummer, merker, stilarter, konstruksjon, slip og mer. Spor reslip-historikk med automatiske oppdateringer. Arkiver/gjenopprett ski. Tilgangskontroll per utøver — bare autoriserte brukere ser dataene." },
  { title: "Admin og lagsikkerhet", description: "Bygd for kommersiell SaaS med flere lag: full dataisolasjon, tre rollenivåer (Superadmin, Lagadmin, Medlem), og granulære tilganger på tvers av 10 områder. Blindtestermodus, aktivitetslogging og funksjonsstyring per lag." },
  { title: "Mobil og offline-klar", description: "Responsivt design som fungerer på enhver enhet. Legg inn data uten internett — på fjellet, i voksbua, hvor du enn er. Endringer settes i kø lokalt og synkroniseres automatisk når du er tilbake på nett." },
];

const FEAT_NO: Record<string, string> = {
  "⌚ Garmin Watch Control": "⌚ Garmin-klokkestyring", "Apply Results from Watch": "Bruk resultater fra klokke",
  "Blind Tester Mode": "Blindtestermodus", "Google Sheets Backup": "Google Sheets-sikkerhetskopi",
  "PDF & Excel Export": "PDF- og Excel-eksport", "Dark Mode": "Mørk modus", "Duplicate Tests": "Dupliser tester",
  "Feeling & Kick Rank": "Følelses- og festrang", "Multiple Products/Line": "Flere produkter per linje",
  "Live Runsheet Monitor": "Live kjøreark-skjerm", "Grinding Records": "Slip-historikk", "Stock Management": "Lagerstyring",
  "Group Management": "Gruppeadministrasjon", "Activity Logging": "Aktivitetslogging", "Suggestions Engine": "Forslagsmotor",
  "Complete Runsheet Bracket": "Komplett kjøreark-heat", "Date & Sort Filters": "Dato- og sorteringsfiltre", "Admin Data Tools": "Admin-dataverktøy",
};


export default function WhatIsGlidr() {
  const { lang } = useLanguage();
  const L = (no: string, en: string) => (lang === "no" ? no : en);
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        <div className="text-center mb-16">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4"
            data-testid="heading-what-is-glidr"
          >
            {L("Hva er Glidr?", "What is Glidr?")}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {L("Plattformen for skitesting og dokumentasjon som effektiviserer produktutvikling for konkurranselag.", "The ski testing and documentation platform that streamlines product development for competitive teams.")}
          </p>
        </div>

        <div className="space-y-24">
          {sections.map((s, i) => {
            const reversed = i % 2 === 1;
            const Anim = s.anim;
            const isMobile = i === sections.length - 1;
            return (
              <div
                key={i}
                className={`flex flex-col ${reversed ? "md:flex-row-reverse" : "md:flex-row"} gap-8 items-center`}
                data-testid={`section-feature-${i}`}
              >
                <div className={isMobile ? "md:w-1/3 flex justify-center" : "md:w-3/5"}>
                  <Anim />
                </div>
                <div className={isMobile ? "md:w-2/3" : "md:w-2/5"}>
                  <h2 className="text-2xl font-bold text-foreground mb-3">
                    {lang === "no" ? SECTIONS_NO[i].title : s.title}
                  </h2>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {lang === "no" ? SECTIONS_NO[i].description : s.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-24 text-center border-t border-border pt-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            {L("Pluss alt det andre du trenger", "Plus everything else you need")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-sm text-muted-foreground">
            {[
              "⌚ Garmin Watch Control",
              "Apply Results from Watch",
              "Blind Tester Mode",
              "Google Sheets Backup",
              "PDF & Excel Export",
              "Dark Mode",
              "Duplicate Tests",
              "Feeling & Kick Rank",
              "Multiple Products/Line",
              "Live Runsheet Monitor",
              "Grinding Records",
              "Stock Management",
              "Group Management",
              "Activity Logging",
              "Suggestions Engine",
              "Complete Runsheet Bracket",
              "Date & Sort Filters",
              "Admin Data Tools",
            ].map((f) => (
              <div
                key={f}
                className={`rounded-lg border px-3 py-2.5 text-center font-medium transition-colors ${
                  f.startsWith("⌚") || f === "Apply Results from Watch"
                    ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                    : "bg-muted/50 border-border"
                }`}
              >
                {lang === "no" ? (FEAT_NO[f] ?? f) : f}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center gap-6">
          <AppLink href="/login" testId="link-login-from-features">
            <button className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow hover:opacity-90 transition-opacity">
              {L("Logg inn på Glidr", "Sign in to Glidr")}
            </button>
          </AppLink>
          <div className="flex justify-center gap-6 text-xs text-muted-foreground">
            <AppLink href="/pricing" testId="link-pricing-from-features" className="underline hover:text-foreground">
              {L("Priser", "Pricing")}
            </AppLink>
            <AppLink href="/contact" testId="link-contact-from-features" className="underline hover:text-foreground">
              {L("Kontakt", "Contact")}
            </AppLink>
            <AppLink href="/legal" testId="link-legal-from-features" className="underline hover:text-foreground">
              {L("Vilkår og personvern", "Terms of Service & Privacy Policy")}
            </AppLink>
          </div>
        </div>
      </div>
    </div>
  );
}
