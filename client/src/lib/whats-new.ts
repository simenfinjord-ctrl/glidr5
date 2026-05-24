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
  date: string; // "DD. MMM YYYY" display format
  title: { no: string; en: string };
  items: { emoji: string; no: string; en: string }[];
}

export const RELEASES: Release[] = [
  {
    version: "2026-05",
    date: "Mai 2026",
    title: { no: "Felles PDF-design + ny presentasjon", en: "Unified PDF layout + new presentation" },
    items: [
      { emoji: "📄", no: "Alle PDF-eksporter — per test, utøver og analyse — bruker nå samme layout med Glidr-logo og konsistent formattering.", en: "All PDF exports — per test, athlete and analytics — now share the same branded layout." },
      { emoji: "🎨", no: "Presentasjonen er oppdatert med skarpere norsk tekst og rettede formuleringer.", en: "The pitch presentation has been updated with sharper copy and corrected language." },
      { emoji: "🌈", no: "Fargetemavekreren er nå tilgjengelig under Min konto → Preferanser.", en: "The accent colour picker is now available under My Account → Preferences." },
    ],
  },
  {
    version: "2026-04",
    date: "April 2026",
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
    date: "Mars 2026",
    title: { no: "AI-anbefalinger, CSV-import og offline-forbedringer", en: "AI recommendations, CSV import and offline improvements" },
    items: [
      { emoji: "🤖", no: "AI-anbefalinger gir produktforslag basert på dine egne testdata og de aktuelle forholdene.", en: "AI recommendations suggest products based on your own test data and current conditions." },
      { emoji: "📤", no: "CSV-import: last opp skier i bulk fra en regnearkfil.", en: "CSV import: bulk-upload skis from a spreadsheet file." },
      { emoji: "📴", no: "Offline-modus pre-buffer nå kritiske data automatisk slik at appens viktigste sider er tilgjengelige uten nett.", en: "Offline mode now pre-caches critical data automatically so key pages work without signal." },
    ],
  },
  {
    version: "2026-02",
    date: "Februar 2026",
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
