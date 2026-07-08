/**
 * In-app changelog — "Hva er nytt i Glidr?"
 *
 * IMPORTANT: Update this on every redeploy. Add a new entry at the top of the
 * RELEASES array describing what shipped, and bump LATEST_VERSION to the new
 * entry's `version`. Each item should be tagged with a `kind` (new/updated/
 * fixed/removed) AND an `audience` (member/teamAdmin/superAdmin) so it only
 * reaches the accounts it's relevant to — a member never sees admin-only news,
 * while an admin sees everything at or below their level. The `version` string
 * is stored in localStorage so users see the dot/badge exactly once per release.
 *
 * Convention: version = "YYYY-MM" (add a suffix letter for multiple releases in
 * the same month, e.g. "2026-07b").
 */

// nytt / oppdatert / rettet / slettet
export type ReleaseKind = "new" | "updated" | "fixed" | "removed";

export const KIND_LABEL: Record<ReleaseKind, { no: string; en: string }> = {
  new: { no: "Nytt", en: "New" },
  updated: { no: "Oppdatert", en: "Updated" },
  fixed: { no: "Rettet", en: "Fixed" },
  removed: { no: "Slettet", en: "Removed" },
};

// Who a change is relevant to. It's a hierarchy: a super admin sees everything,
// a team admin sees team-admin + member items, a member sees only member items.
export type Audience = "member" | "teamAdmin" | "superAdmin";
const AUDIENCE_RANK: Record<Audience, number> = { member: 0, teamAdmin: 1, superAdmin: 2 };

export const AUDIENCE_LABEL: Record<Audience, { no: string; en: string }> = {
  member: { no: "Medlem", en: "Member" },
  teamAdmin: { no: "Lagadmin", en: "Team admin" },
  superAdmin: { no: "Admin", en: "Admin" },
};

export interface ReleaseItem {
  emoji: string;
  no: string;
  en: string;
  kind?: ReleaseKind; // defaults to "new" when omitted
  audience?: Audience; // who it applies to; defaults to "member" (everyone)
}

/** Rank of the current user's role — higher sees more. */
export function roleRank(opts: { isSuperAdmin?: boolean; isTeamAdmin?: boolean }): number {
  if (opts.isSuperAdmin) return AUDIENCE_RANK.superAdmin;
  if (opts.isTeamAdmin) return AUDIENCE_RANK.teamAdmin;
  return AUDIENCE_RANK.member;
}

function itemVisibleTo(item: ReleaseItem, rank: number): boolean {
  return AUDIENCE_RANK[item.audience ?? "member"] <= rank;
}

/** Releases with only the items visible to a role; empty releases dropped. */
export function releasesForRank(rank: number): Release[] {
  return RELEASES
    .map((r) => ({ ...r, items: r.items.filter((it) => itemVisibleTo(it, rank)) }))
    .filter((r) => r.items.length > 0);
}

/** The newest release version this role can actually see (or null). */
export function latestVersionForRank(rank: number): string | null {
  const visible = releasesForRank(rank);
  return visible.length > 0 ? visible[0].version : null;
}

export function hasUnseenReleaseForRank(rank: number): boolean {
  const latest = latestVersionForRank(rank);
  if (!latest) return false;
  return getSeenVersion() !== latest;
}

export interface Release {
  version: string;
  date: { no: string; en: string };
  title: { no: string; en: string };
  items: ReleaseItem[];
}

export const RELEASES: Release[] = [
  {
    version: "2026-07",
    date: { no: "Juli 2026", en: "July 2026" },
    title: { no: "Flere lag, arkivering, klokkeapp og sortering", en: "Multi-team, archiving, watch app & sorting" },
    items: [
      { kind: "new", emoji: "🎿", no: "Arkiver utøvere i Race skis og gjenopprett dem senere — arkiverte utøvere skjules fra velgere, men beholder alle skier og tester. Søk dekker både aktive og arkiverte.", en: "Archive athletes in Race skis and restore them later — archived athletes are hidden from pickers but keep all skis and tests. Search covers both active and archived." },
      { kind: "new", emoji: "🌐", no: "Alle lag – tester: søk og filtrer tester på tvers av alle lagene du har tilgang til, etter lag, snøtype og testtype.", en: "All teams – tests: search and filter tests across every team you can access, by team, snow type and test type." },
      { kind: "new", audience: "teamAdmin", emoji: "⌚", no: "Klokkeapp: Super Admin laster opp klokkeapp-filen; lagadmins med tilgang laster den ned under Admin → Klokkeapp for å legge den på utøvernes klokker. Inkluderer oppskrift og nedlastingsoversikt.", en: "Watch app: Super Admin uploads the watch-app file; team admins with permission download it under Admin → Watch app to sideload onto athletes' watches. Includes a how-to and a download overview." },
      { kind: "new", emoji: "📊", no: "Sorter testresultater der de står: trykk på en kolonneoverskrift (Ski-ID, Slip, Resultat/diff, Rank, Følelse …) på Athlete skis og i dagsvisningen — uten å åpne testen. I dagsvisning påvirker valget alle testene for dagen.", en: "Sort test results in place: click a column header (Ski ID, Grind, Result/diff, Rank, Feeling …) on Athlete skis and in the day view — without opening the test. In the day view the choice affects every test for that day." },
      { kind: "new", audience: "teamAdmin", emoji: "🔐", no: "Flere lag per bruker med egne rettigheter per lag. Meny og «Mitt lag» følger det aktive laget.", en: "Users can belong to several teams with their own permissions per team. The menu and My Team reflect the active team." },
      { kind: "new", audience: "superAdmin", emoji: "🔑", no: "Aktive økter ligger nå under Innloggingshistorikk med utlogging per økt. En ny/ukjent IP vises i rødt i 24 timer.", en: "Active sessions now live under Login history with per-session logout. A new/unfamiliar IP is shown in red for 24 hours." },
      { kind: "new", audience: "teamAdmin", emoji: "☁️", no: "Daglig backup til Google Drive (JSON + PDF) — lim inn en Drive-mappelenke, så er det nok.", en: "Daily Google Drive backup (JSON + PDF) — just paste a Drive folder link." },
      { kind: "updated", audience: "teamAdmin", emoji: "📱", no: "Admin → Brukere fungerer nå ordentlig på mobil.", en: "Admin → Users now works properly on mobile." },
      { kind: "updated", emoji: "🗓️", no: "Hurtigvalg av dag viser bare datoer som faktisk har tester.", en: "Quick day select only shows dates that actually have tests." },
      { kind: "updated", emoji: "⚖️", no: "Vilkår og retningslinjer følger nå appspråket, med klausuler om nedstenging og prisendring.", en: "Terms & Policy now follow the app language, with take-down and pricing clauses." },
      { kind: "updated", emoji: "🧴", no: "Glide-tester viser alle glide-produkter, og fritekstprodukter vises nå i resultatlisten.", en: "Glide tests show all glide products, and free-text products now appear in the result list." },
      { kind: "fixed", emoji: "🧭", no: "Mobil: lagbytteren er ikke lenger skjult bak «notchen».", en: "Mobile: the team switcher is no longer hidden behind the notch." },
      { kind: "fixed", emoji: "🧩", no: "Å åpne en arkivert utøvers profil sier ikke lenger «finner ikke utøveren».", en: "Opening an archived athlete's profile no longer says \"athlete not found\"." },
      { kind: "removed", emoji: "💳", no: "Fjernet alle Stripe-referanser fra Vilkår og retningslinjer.", en: "Removed all Stripe references from Terms & Policy." },
      { kind: "removed", audience: "superAdmin", emoji: "📧", no: "Registrerings-e-posten nevner ikke lenger pris/prøveperiode med mindre kommersialisering er på.", en: "The signup email no longer mentions pricing/trial unless commercialization is on." },
    ],
  },
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

export const LATEST_VERSION = "2026-07";
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
