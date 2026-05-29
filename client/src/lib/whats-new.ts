/**
 * In-app changelog — "Hva er nytt i Glidr?"
 *
 * Add a new entry at the top of the RELEASES array each time something
 * significant ships. The `version` string is stored in localStorage so
 * users see the dot/badge exactly once per release.
 *
 * Convention: version = "YYYY-MM" or a semver string.
 */

export interface Release {
  version: string;
  date: { no: string; en: string };
  title: { no: string; en: string };
  items: { emoji: string; no: string; en: string }[];
}

export const RELEASES: Release[] = [
  {
    version: "2026-05d",
    date: { no: "Mai 2026", en: "May 2026" },
    title: { no: "Værstasjon, backup-oppdatering og funksjonsguide", en: "Weather station, backup overhaul & feature guide" },
    items: [
      { emoji: "🌡️", no: "Koble til din fysiske værstasjon (Netatmo, Davis, Ambient, Ecowitt, WUnderground, Open-Meteo, eller egendefinert HTTP) — data fylles inn automatisk når du legger inn dato og klokkeslett.", en: "Connect your physical weather station (Netatmo, Davis, Ambient, Ecowitt, WUnderground, Open-Meteo, or custom HTTP) — data fills in automatically when you set date and time." },
      { emoji: "📊", no: "Google Sheets-backup: egne ark for Product Tests, Structure Tests, Grind Tests og per-utøver Race Ski Tests. Hver test er tydelig markert med fet header og alle 15 vær-/førefelter.", en: "Google Sheets backup: dedicated sheets for Product Tests, Structure Tests, Grind Tests and per-athlete Race Ski Tests. Each test has a bold header row and all 15 weather/conditions fields." },
      { emoji: "🏁", no: "Backup: Race Preps viser nå produktnavn (ikke bare ID-er) og applikasjonsmetode.", en: "Backup: Race Preps now show product names (not just IDs) and application method." },
      { emoji: "🔍", no: "Kombinasjonssøk støtter nå N produkter — trykk + for å legge til så mange du vil.", en: "Combination search now supports N products — tap + to add as many as you like." },
      { emoji: "📄", no: "Ny funksjonsguide-PDF tilgjengelig på SA-admin-siden med animert forside, UI-skisseer og juridisk konkurransereservasjon.", en: "New Feature Guide PDF available on the SA admin page with animated cover, UI mockups and legal competitive reservation." },
    ],
  },
  {
    version: "2026-05c",
    date: { no: "Mai 2026", en: "May 2026" },
    title: { no: "Raceprep-oppdatering, analyse-forbedringer og prisside", en: "Race Prep updates, analytics improvements and pricing page" },
    items: [
      { emoji: "🏁", no: "Raceprep: Kick-feltet er nå fritekst — skriv inn produkter og behandling fritt.", en: "Race Prep: Kick field is now free text — describe products and application freely." },
      { emoji: "🌨️", no: "Raceprep: Koble en værobservasjon til en raceprep for å lagre alle værdataene automatisk.", en: "Race Prep: Link a weather record to a race prep to store all weather data automatically." },
      { emoji: "🔍", no: "Raceprep: Klikk på forstørrelsesikonet ved siden av Ski-ID for å se full skiinformasjon.", en: "Race Prep: Click the magnifying glass next to Ski-ID to view full ski details." },
      { emoji: "📋", no: "Raceprep: Søk og filtrer etter stilart og dato — siden er nå full bredde.", en: "Race Prep: Search and filter by discipline and date — the page is now full width." },
      { emoji: "📊", no: "Analyse: Fjernet Classic, Skating og Grind fra testtype-filteret. Slipemønstre-fanen er flyttet til Slipe-siden.", en: "Analytics: Removed Classic, Skating and Grind from the test type filter. Grind Patterns tab moved to the Grinding page." },
      { emoji: "💰", no: "Prissiden: Tydelig NOK-merking og Race Prep lagt til i funksjonssammenligning.", en: "Pricing: Clear NOK labelling and Race Prep added to feature comparison." },
    ],
  },
  {
    version: "2026-05b",
    date: { no: "Mai 2026", en: "May 2026" },
    title: { no: "Raceprep, slipeanalyse og datofilter", en: "Race Prep, grind analytics and date filter" },
    items: [
      { emoji: "🏁", no: "Ny Raceprep-side: planlegg renn med startliste, Ski-ID per løper og informasjon om produkt, metode og struktur.", en: "New Race Prep page: plan races with a start list, per-athlete Ski-ID, and product/method/structure info." },
      { emoji: "⚙️", no: "Ny Slipemønstre-fane i Analyse — vinnerate per stein og mønster for alle med slipetilgang.", en: "New Grind Patterns tab in Analytics — win rate by stone and pattern for users with grinding access." },
      { emoji: "📅", no: "Løpskalender på utøverprofilen er nå lagret på serveren og synkroniseres på tvers av enheter.", en: "The race calendar on athlete profiles is now server-side and syncs across all devices." },
      { emoji: "🔍", no: "Datofilter i Tester er oppgradert til et fra/til-område — filtrer tester over en hvilken som helst periode.", en: "The date filter in Tests is now a from/to range — filter tests across any time period." },
    ],
  },
  {
    version: "2026-05",
    date: { no: "Mai 2026", en: "May 2026" },
    title: { no: "Felles PDF-design, innboks-fix og accentfarger", en: "Unified PDF layout, inbox fix and accent colours" },
    items: [
      { emoji: "📄", no: "Alle PDF-eksporter — per test, utøver og analyse — bruker nå samme layout med konsistent formattering.", en: "All PDF exports — per test, athlete and analytics — now share the same branded layout." },
      { emoji: "✅", no: "Innboksen markerer nå meldinger som lest korrekt, og ulesttelleren oppdateres umiddelbart.", en: "The inbox now correctly marks messages as read and updates the unread count instantly." },
      { emoji: "🎨", no: "Faner i analyse og Watch-kø følger nå valgt accentfarge med en lett tintbakgrunn.", en: "Analytics and Watch Queue tabs now reflect your chosen accent colour with a subtle tinted background." },
      { emoji: "🌈", no: "Fargevelgeren er tilgjengelig under Min konto → Preferanser.", en: "The accent colour picker is available under My Account → Preferences." },
    ],
  },
  {
    version: "2026-04",
    date: { no: "April 2026", en: "April 2026" },
    title: { no: "Løpskalender, revisjonslogg og rekkefølge for Watch", en: "Race calendar, audit log and Watch order" },
    items: [
      { emoji: "📅", no: "Løpskalender lagt til på utøversiden — planlegg og følg opp kommende renn.", en: "Race calendar added to athlete page — plan and track upcoming races." },
      { emoji: "🔍", no: "Revisjonslogg viser hvem som endret hva og når — viktig for team med sporbarhetskrav.", en: "Audit log shows who changed what and when — essential for teams needing traceability." },
      { emoji: "⌚", no: "Rekkefølgen på skiene i en test kan nå justeres. Den siste rekkefølgen brukes av Watch-funksjonen.", en: "Ski order in a test can now be adjusted. The latest order is used by the Watch function." },
      { emoji: "🔔", no: "Varslingsbjella er erstattet av en ekte innboks for meldinger fra systemet.", en: "The notification bell now opens a real inbox for system messages." },
    ],
  },
  {
    version: "2026-03",
    date: { no: "Mars 2026", en: "March 2026" },
    title: { no: "AI-anbefalinger, CSV-import og offline-forbedringer", en: "AI recommendations, CSV import and offline improvements" },
    items: [
      { emoji: "🤖", no: "AI-anbefalinger gir produktforslag basert på dine egne testdata og de aktuelle forholdene.", en: "AI recommendations suggest products based on your own test data and current conditions." },
      { emoji: "📤", no: "CSV-import: last opp skier i bulk fra en regnearkfil.", en: "CSV import: bulk-upload skis from a spreadsheet file." },
      { emoji: "📴", no: "Offline-modus pre-buffer nå kritiske data automatisk slik at appens viktigste sider er tilgjengelige uten nett.", en: "Offline mode now pre-caches critical data automatically so key pages work without signal." },
    ],
  },
  {
    version: "2026-02",
    date: { no: "Februar 2026", en: "February 2026" },
    title: { no: "Race Ski, utøverstyring og kommentarer", en: "Race Ski, athlete management and comments" },
    items: [
      { emoji: "🎿", no: "Race Ski-modulen lar deg administrere skibehold, grindlogg og testtilordning per utøver.", en: "The Race Ski module lets you manage ski inventory, grind logs and test assignment per athlete." },
      { emoji: "👤", no: "Utøverprofiler med løpskalender, skihistorikk og PDF-eksport.", en: "Athlete profiles with race calendar, ski history and PDF export." },
      { emoji: "💬", no: "Kommentarer på enkeltresultater — legg inn notater direkte på testoppføringer.", en: "Comments on individual results — add notes directly to test entries." },
    ],
  },
];

export const LATEST_VERSION = "2026-05d";
const STORAGE_KEY = "glidr-whats-new-seen";

export function getSeenVersion(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function markAsSeen(version: string): void {
  try { localStorage.setItem(STORAGE_KEY, version); } catch {}
}

export function hasUnseenRelease(): boolean {
  return getSeenVersion() !== LATEST_VERSION;
}
