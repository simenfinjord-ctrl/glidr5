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

export const LATEST_VERSION = RELEASES[0].version;
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
