// © 2025 Glidr — Proprietary and confidential. All rights reserved.
//
// Single source of truth for Glidr's DATA AREAS: the named groups of tables
// used by selective export/import and the admin checkbox lists. When a new
// module (and its tables) is added to Glidr, add it HERE — the server export
// filter and the admin UI both derive from this list, so they cannot drift
// apart. Tables not claimed by any area are always included in exports
// (teams, settings, billing …) so a filtered export stays restorable.

export type DataAreaKey =
  | "tests" | "testfleets" | "products" | "weather" | "athletes"
  | "kick" | "raceprep" | "grinding" | "runsheets" | "people";

export type DataArea = {
  key: DataAreaKey;
  labelNo: string;
  labelEn: string;
  tables: string[];
  /** Areas that can be exported but are never imported (accounts, live state). */
  exportOnly?: boolean;
};

export const DATA_AREAS: DataArea[] = [
  { key: "tests",      labelNo: "Tester & resultater",           labelEn: "Tests & Results",
    tables: ["tests", "test_entries", "test_attachments", "test_comments"] },
  { key: "testfleets", labelNo: "Testfleets (serier + slip)",    labelEn: "Testfleets (series + regrinds)",
    tables: ["test_ski_series", "test_ski_regrinds"] },
  { key: "products",   labelNo: "Produkter",                     labelEn: "Products",
    tables: ["products"] },
  { key: "weather",    labelNo: "Vær",                           labelEn: "Weather",
    tables: ["daily_weather"] },
  { key: "athletes",   labelNo: "Utøvere & skipark",             labelEn: "Athletes & Race Skis",
    tables: ["athletes", "athlete_access", "race_skis", "race_ski_regrinds", "ski_race_usages", "athlete_race_calendar", "feedback_links"] },
  { key: "kick",       labelNo: "Kick",                          labelEn: "Kick",
    tables: ["kick_skis", "kick_tests", "kick_test_entries", "kick_mixes"] },
  { key: "raceprep",   labelNo: "Race Prep",                     labelEn: "Race Prep",
    tables: ["race_preps", "race_prep_entries", "race_prep_comments"] },
  { key: "grinding",   labelNo: "Grinding",                      labelEn: "Grinding",
    tables: ["grind_profiles", "grinding_records", "grinding_sheets"] },
  { key: "runsheets",  labelNo: "Runsheets & Watch",             labelEn: "Runsheets & Watch",
    tables: ["runsheets", "runsheet_progress", "watch_queue", "watch_sessions"] },
  { key: "people",     labelNo: "Brukere, grupper & logger",     labelEn: "Users, groups & logs",
    tables: ["users", "groups", "user_teams", "user_team_permissions", "activity_logs", "login_logs", "inbox_messages", "invitations"], exportOnly: true },
];

/** area key → tables, the shape the export filter consumes. */
export const EXPORT_AREA_TABLES: Record<string, string[]> = Object.fromEntries(
  DATA_AREAS.map((a) => [a.key, a.tables])
);
