// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { pgTable, text, varchar, integer, real, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";

export const PERMISSION_AREAS = ["dashboard", "tests", "testskis", "products", "weather", "analytics", "grinding", "raceskis", "kick", "raceprep", "raceprepGlide", "suggestions", "liverunsheets"] as const;
export type PermissionArea = typeof PERMISSION_AREAS[number];
export type PermissionLevel = "none" | "view" | "edit";
export type UserPermissions = Record<PermissionArea, PermissionLevel>;

export const DEFAULT_PERMISSIONS: UserPermissions = {
  dashboard: "none",
  tests: "none",
  testskis: "none",
  products: "none",
  weather: "none",
  analytics: "none",
  grinding: "none",
  raceskis: "none",
  kick: "none",
  raceprep: "none",
  raceprepGlide: "none",
  suggestions: "none",
  liverunsheets: "none",
};

export const ADMIN_PERMISSIONS: UserPermissions = {
  dashboard: "edit",
  tests: "edit",
  testskis: "edit",
  products: "edit",
  weather: "edit",
  analytics: "edit",
  grinding: "edit",
  raceskis: "edit",
  kick: "edit",
  raceprep: "edit",
  raceprepGlide: "edit",
  suggestions: "edit",
  liverunsheets: "edit",
};

// ─── Team feature flags ────────────────────────────────────────────────────────
// These are stored in teams.enabledAreas (JSON array) and cover every
// toggleable capability a team can have, across all plans.

export const TEAM_FEATURES = [
  // Navigation areas (backend-enforced)
  "dashboard", "tests", "testskis", "products", "weather",
  "analytics", "grinding", "raceskis", "kick", "raceprep", "suggestions", "liverunsheets",
  // Field & runsheet tools
  "runsheet_brackets", "garmin_watch", "mobile_runsheet",
  // Export & backup
  "pdf_export", "excel_export", "google_sheets_backup", "offline_mode",
  // Team features
  "blind_tester", "activity_logging", "column_visibility",
  "test_ski_regrind", "race_ski_regrind", "product_stock", "athlete_management", "us_grind", "para_team",
  // Enterprise
  "multi_team", "bulk_export", "custom_groups",
] as const;

export type TeamFeature = typeof TEAM_FEATURES[number];

export const FEATURE_LABELS: Record<TeamFeature, string> = {
  dashboard: "Dashboard",
  tests: "Tests",
  testskis: "Test Ski Series",
  products: "Products & Storage",
  weather: "Weather Logging",
  analytics: "Analytics & Charts",
  grinding: "Grinding Records",
  raceskis: "Race Skis",
  kick: "Kick Testing",
  raceprep: "Race Prep Planning",
  suggestions: "Suggestions Engine",
  liverunsheets: "Live Runsheet Monitor",
  runsheet_brackets: "Runsheet Brackets",
  garmin_watch: "Garmin Watch Integration",
  mobile_runsheet: "Mobile Runsheet Mode",
  pdf_export: "PDF Export",
  excel_export: "Excel Export",
  google_sheets_backup: "Google Sheets Backup",
  offline_mode: "Offline Mode",
  blind_tester: "Blind Tester Mode",
  activity_logging: "Activity Logging & Audit Trail",
  column_visibility: "Column Visibility Control",
  test_ski_regrind: "Test Ski Regrind History",
  race_ski_regrind: "Race Ski Regrind History",
  product_stock: "Product Stock Tracking",
  athlete_management: "Athlete Profiles & Access Control",
  us_grind: "US-Grind tagging",
  para_team: "Para team",
  multi_team: "Multi-team Support",
  bulk_export: "Bulk Data Export",
  custom_groups: "Custom Group Structures",
};

export const FEATURE_CATEGORIES: { label: string; features: readonly TeamFeature[] }[] = [
  {
    label: "Navigation Areas",
    features: ["dashboard", "tests", "testskis", "products", "weather", "analytics", "grinding", "raceskis", "kick", "raceprep", "suggestions", "liverunsheets"],
  },
  {
    label: "Field & Runsheet Tools",
    features: ["runsheet_brackets", "garmin_watch", "mobile_runsheet"],
  },
  {
    label: "Export & Backup",
    features: ["pdf_export", "excel_export", "google_sheets_backup", "offline_mode"],
  },
  {
    label: "Team Features",
    features: ["blind_tester", "activity_logging", "column_visibility", "test_ski_regrind", "race_ski_regrind", "product_stock", "athlete_management", "us_grind", "para_team"],
  },
  {
    label: "Enterprise",
    features: ["multi_team", "bulk_export", "custom_groups"],
  },
];

export const PLAN_FEATURE_PRESETS: Record<string, { label: string; color: string; features: readonly TeamFeature[] }> = {
  free: {
    label: "Free",
    color: "gray",
    features: ["dashboard", "tests", "products", "weather"],
  },
  starter: {
    label: "Starter",
    color: "gray",
    features: ["dashboard", "tests", "testskis", "products", "weather", "pdf_export", "product_stock"],
  },
  team: {
    label: "Team",
    color: "green",
    features: [
      "dashboard", "tests", "testskis", "products", "weather",
      "analytics", "grinding", "suggestions",
      "runsheet_brackets", "garmin_watch", "mobile_runsheet",
      "pdf_export", "excel_export", "google_sheets_backup", "offline_mode",
      "blind_tester", "test_ski_regrind", "product_stock",
    ],
  },
  pro: {
    label: "Pro",
    color: "blue",
    features: [
      "dashboard", "tests", "testskis", "products", "weather",
      "analytics", "grinding", "raceskis", "kick", "raceprep", "suggestions", "liverunsheets",
      "runsheet_brackets", "garmin_watch", "mobile_runsheet",
      "pdf_export", "excel_export", "google_sheets_backup", "offline_mode",
      "blind_tester", "activity_logging", "column_visibility",
      "test_ski_regrind", "race_ski_regrind", "product_stock", "athlete_management",
    ],
  },
  enterprise: {
    label: "Enterprise",
    color: "purple",
    features: [
      "dashboard", "tests", "testskis", "products", "weather",
      "analytics", "grinding", "raceskis", "kick", "raceprep", "suggestions", "liverunsheets",
      "runsheet_brackets", "garmin_watch", "mobile_runsheet",
      "pdf_export", "excel_export", "google_sheets_backup", "offline_mode",
      "blind_tester", "activity_logging", "column_visibility",
      "test_ski_regrind", "race_ski_regrind", "product_stock", "athlete_management",
      "multi_team", "bulk_export", "custom_groups",
    ],
  },
};
// ──────────────────────────────────────────────────────────────────────────────

export const ROLE_PRESETS: Record<string, { label: string; permissions: UserPermissions; blindTester?: boolean }> = {
  skitester: {
    label: "Skitester",
    blindTester: true,
    permissions: {
      ...DEFAULT_PERMISSIONS,
      dashboard: "edit",
      tests: "edit",
      testskis: "edit",
      weather: "edit",
    },
  },
  member: {
    label: "Member",
    permissions: { ...DEFAULT_PERMISSIONS },
  },
};

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  isDefault: integer("is_default").notNull().default(0),
  enabledAreas: text("enabled_areas"),
  superAdminAccess: integer("super_admin_access").notNull().default(1),
  backupSheetUrl: text("backup_sheet_url"),
  lastBackupAt: text("last_backup_at"),
  productSheetUrl: text("product_sheet_url"),
  productSheetGroup: text("product_sheet_group"),
  lastProductSyncAt: text("last_product_sync_at"),
  feedbackSheetUrl: text("feedback_sheet_url"),
  feedbackEnabled: integer("feedback_enabled").notNull().default(0),
  watchPin: text("watch_pin"),
  // Whether this team's admins may download the sideloadable watch-app file.
  watchAppDownload: integer("watch_app_download").notNull().default(0),
  isPaused: integer("is_paused").notNull().default(0),
  // Billing / subscription
  planName: text("plan_name").default("free"),
  subscriptionStatus: text("subscription_status").default("active"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: text("current_period_end"),
  trialEndsAt: text("trial_ends_at"),
  // Custom billing fields (set by SA)
  customPrice: real("custom_price"),
  billingPeriod: text("billing_period").default("monthly"),
  nextBillingDate: text("next_billing_date"),
  maxUsers: integer("max_users"),
  maxGroups: integer("max_groups"),
  maxTests: integer("max_tests"),
  maxProducts: integer("max_products"),
  notes: text("notes"),
  weatherStationType: text("weather_station_type"),
  weatherStationConfig: text("weather_station_config"), // JSON string
  teamLogo: text("team_logo"),
  // Google Drive backup
  driveFolderId: text("drive_folder_id"),
  driveJsonFileId: text("drive_json_file_id"),
  drivePdfFileId: text("drive_pdf_file_id"),
});

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  groupScope: text("group_scope").notNull().default(""),
  isAdmin: integer("is_admin").notNull().default(0),
  isTeamAdmin: integer("is_team_admin").notNull().default(0),
  teamId: integer("team_id").notNull().default(1),
  activeTeamId: integer("active_team_id"),
  permissions: text("permissions").notNull().default(JSON.stringify(DEFAULT_PERMISSIONS)),
  isActive: integer("is_active").notNull().default(1),
  isBlindTester: integer("is_blind_tester").notNull().default(0),
  garminWatch: integer("garmin_watch").notNull().default(0),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  loginLocked: integer("login_locked").notNull().default(0),
  watchCode: text("watch_code"),
  onboardingCompleted: integer("onboarding_completed").notNull().default(0),
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled").notNull().default(0),
  totpBackupCodes: text("totp_backup_codes"),
  language: text("language").notNull().default("no"),
  username: text("username"),
  incognito: integer("incognito").notNull().default(0),
  stealth: integer("stealth").notNull().default(0),
  avatarUrl: text("avatar_url"),
  isAthleteAccess: integer("is_athlete_access").notNull().default(0),
  linkedAthleteId: integer("linked_athlete_id"),
  // Granted by a Team Admin: lets a multi-team user open the "All teams" glide
  // test view (also requires belonging to more than one team).
  canViewAllTeams: integer("can_view_all_teams").notNull().default(0),
  createdAt: text("created_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  teamId: integer("team_id").notNull().default(1),
});

export const insertGroupSchema = createInsertSchema(groups).omit({ id: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;

export const testSkiSeries = pgTable("test_ski_series", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  brand: text("brand"),
  skiType: text("ski_type"),
  grind: text("grind"),
  numberOfSkis: integer("number_of_skis").notNull().default(8),
  lastRegrind: text("last_regrind"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  groupScope: text("group_scope").notNull(),
  teamId: integer("team_id").notNull().default(1),
  pairLabels: text("pair_labels"),
  archivedAt: text("archived_at"),
  actionStatus: text("action_status"),       // Need regrind / In for regrind / Grinded / In use
  actionLocation: text("action_location"),   // where it's in for regrind
});

export const insertSeriesSchema = createInsertSchema(testSkiSeries).omit({ id: true });
export type InsertSeries = z.infer<typeof insertSeriesSchema>;
export type Series = typeof testSkiSeries.$inferSelect;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  brand: text("brand").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  groupScope: text("group_scope").notNull(),
  teamId: integer("team_id").notNull().default(1),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  archivedAt: text("archived_at"),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const dailyWeather = pgTable("daily_weather", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  location: text("location").notNull(),
  snowTemperatureC: real("snow_temperature_c").notNull(),
  airTemperatureC: real("air_temperature_c").notNull(),
  snowHumidityPct: real("snow_humidity_pct").notNull(),
  airHumidityPct: real("air_humidity_pct").notNull(),
  clouds: integer("clouds"),
  visibility: text("visibility"),
  wind: text("wind"),
  precipitation: text("precipitation"),
  artificialSnow: text("artificial_snow"),
  naturalSnow: text("natural_snow"),
  grainSize: text("grain_size"),
  snowHumidityType: text("snow_humidity_type"),
  trackHardness: text("track_hardness"),
  testQuality: integer("test_quality"),
  snowType: text("snow_type"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  groupScope: text("group_scope").notNull(),
  teamId: integer("team_id").notNull().default(1),
});

export const insertWeatherSchema = createInsertSchema(dailyWeather).omit({ id: true });
export type InsertWeather = z.infer<typeof insertWeatherSchema>;
export type Weather = typeof dailyWeather.$inferSelect;

export const tests = pgTable("tests", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  location: text("location").notNull(),
  testName: text("test_name"),
  weatherId: integer("weather_id"),
  testType: text("test_type").notNull(),
  testSkiSource: text("test_ski_source").notNull().default("series"),
  seriesId: integer("series_id"),
  athleteId: integer("athlete_id"),
  notes: text("notes"),
  grindParameters: text("grind_parameters"),
  distanceLabel0km: text("distance_label_0km"),
  distanceLabelXkm: text("distance_label_xkm"),
  distanceLabels: text("distance_labels"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  groupScope: text("group_scope").notNull(),
  teamId: integer("team_id").notNull().default(1),
  runsheetBracket: text("runsheet_bracket"),
  noWeather: integer("no_weather").notNull().default(0), // "Do not add weather" — excluded from missing-weather counts
  watchOperatorName: text("watch_operator_name"), // name of person who ran the test on watch
  startTime: text("start_time"), // HH:MM format
});

export const insertTestSchema = createInsertSchema(tests).omit({ id: true, runsheetBracket: true });
export type InsertTest = z.infer<typeof insertTestSchema>;
export type Test = typeof tests.$inferSelect;

export const testEntries = pgTable("test_entries", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull(),
  skiNumber: integer("ski_number").notNull(),
  productId: integer("product_id"),
  additionalProductIds: text("additional_product_ids"),
  freeTextProduct: text("free_text_product"),
  methodology: text("methodology").notNull().default(""),
  result0kmCmBehind: real("result_0km_cm_behind"),
  rank0km: integer("rank_0km"),
  resultXkmCmBehind: real("result_xkm_cm_behind"),
  rankXkm: integer("rank_xkm"),
  results: text("results"),
  feelingRank: integer("feeling_rank"),
  feelingNote: text("feeling_note"),
  kickRank: integer("kick_rank"),
  kickSolution: text("kick_solution"),
  grindType: text("grind_type"),
  grindStone: text("grind_stone"),
  grindPattern: text("grind_pattern"),
  grindExtraParams: text("grind_extra_params"),
  grindProfileId: integer("grind_profile_id"), // FK to grind_profiles.id
  raceSkiId: integer("race_ski_id"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  groupScope: text("group_scope").notNull(),
  teamId: integer("team_id").notNull().default(1),
});

export const insertEntrySchema = createInsertSchema(testEntries).omit({ id: true });
export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type TestEntry = typeof testEntries.$inferSelect;

export const runsheets = pgTable("runsheets", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull(),
  label: text("label").notNull(),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  teamId: integer("team_id").notNull().default(1),
});

export const insertRunsheetSchema = createInsertSchema(runsheets).omit({ id: true });
export type InsertRunsheet = z.infer<typeof insertRunsheetSchema>;
export type Runsheet = typeof runsheets.$inferSelect;

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  details: text("details"),
  // JSON snapshot of the affected record at delete time — the "chain of custody"
  // so you can see exactly what was removed if data disappears.
  snapshot: text("snapshot"),
  createdAt: text("created_at").notNull(),
  groupScope: text("group_scope"),
  teamId: integer("team_id").notNull().default(1),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export const grindingRecords = pgTable("grinding_records", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id"),
  date: text("date").notNull(),
  grindType: text("grind_type").notNull(),
  stone: text("stone"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  groupScope: text("group_scope").notNull(),
  teamId: integer("team_id").notNull().default(1),
});

export const insertGrindingRecordSchema = createInsertSchema(grindingRecords).omit({ id: true });
export type InsertGrindingRecord = z.infer<typeof insertGrindingRecordSchema>;
export type GrindingRecord = typeof grindingRecords.$inferSelect;

export const grindingSheets = pgTable("grinding_sheets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  groupScope: text("group_scope").notNull(),
  teamId: integer("team_id").notNull().default(1),
});

export const insertGrindingSheetSchema = createInsertSchema(grindingSheets).omit({ id: true });
export type InsertGrindingSheet = z.infer<typeof insertGrindingSheetSchema>;
export type GrindingSheet = typeof grindingSheets.$inferSelect;

export const grindProfiles = pgTable("grind_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  grindType: text("grind_type").notNull(),
  stone: text("stone").notNull(),
  pattern: text("pattern").notNull(),
  extraParams: text("extra_params"), // JSON: Record<string, string>
  grindId: text("grind_id"), // e.g. "001", "002" — team-scoped sequential
  notes: text("notes"),
  isUsGrind: integer("is_us_grind").notNull().default(0),
  createdByName: text("created_by_name").notNull(),
  teamId: integer("team_id").notNull().default(1),
  createdAt: text("created_at").notNull(),
  archived: integer("archived").notNull().default(0),
});

export const insertGrindProfileSchema = createInsertSchema(grindProfiles).omit({ id: true });
export type InsertGrindProfile = z.infer<typeof insertGrindProfileSchema>;
export type GrindProfile = typeof grindProfiles.$inferSelect;

export const loginLogs = pgTable("login_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  loginAt: text("login_at").notNull(),
  ipAddress: text("ip_address"),
  action: text("action").notNull().default("login"),
  details: text("details"),
});

export const insertLoginLogSchema = createInsertSchema(loginLogs).omit({ id: true });
export type InsertLoginLog = z.infer<typeof insertLoginLogSchema>;
export type LoginLog = typeof loginLogs.$inferSelect;

// --- Race Skis Module ---

export const athletes = pgTable("athletes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  team: text("team"),
  defaultSkiBrand: text("default_ski_brand"),
  heightCm: text("height_cm"),
  weightKg: text("weight_kg"),
  poleHeight: text("pole_height"),               // legacy single pole height (= classic)
  poleHeightSkate: text("pole_height_skate"),     // skating pole height
  bindingPosition: text("binding_position"),
  skiServicePreferences: text("ski_service_preferences"),
  // Free-text sport class (e.g. Para classification) — shown when the team has
  // the "para_team" feature enabled by a Super Admin.
  sportClass: text("sport_class"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  teamId: integer("team_id").notNull().default(1),
  // Archived athletes are hidden from the default Race skis list but kept
  // (with all their skis/tests) so they can be restored later.
  archived: integer("archived").notNull().default(0),
});

export const insertAthleteSchema = createInsertSchema(athletes).omit({ id: true });
export type InsertAthlete = z.infer<typeof insertAthleteSchema>;
export type Athlete = typeof athletes.$inferSelect;

export const athleteAccess = pgTable("athlete_access", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id").notNull(),
  userId: integer("user_id").notNull(),
  // Share-view accounts are read-only by default; canEdit=1 lets the account
  // edit this specific athlete. (Ignored for regular users, who always edit.)
  canEdit: integer("can_edit").notNull().default(0),
});

export const insertAthleteAccessSchema = createInsertSchema(athleteAccess).omit({ id: true });
export type InsertAthleteAccess = z.infer<typeof insertAthleteAccessSchema>;
export type AthleteAccess = typeof athleteAccess.$inferSelect;

export const raceSkis = pgTable("race_skis", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id").notNull(),
  serialNumber: text("serial_number"),
  skiId: text("ski_id").notNull(),
  brand: text("brand"),
  discipline: text("discipline").notNull(),
  construction: text("construction"),
  mold: text("mold"),
  base: text("base"),
  grind: text("grind"),
  heights: text("heights"),
  year: text("year"),
  length: text("length"),
  typeOfSki: text("type_of_ski"), // e.g. Klister/Cover, Zero
  whereReceived: text("where_received"),
  notes: text("notes"),
  isTrainingSki: integer("is_training_ski").notNull().default(0),
  customParams: text("custom_params"),
  archivedAt: text("archived_at"),
  // Race-fleet skis belong to a team rather than an athlete (athleteId is null,
  // teamId is set). isSitski flags a sit-ski (para sledge ski).
  teamId: integer("team_id"),
  isSitski: integer("is_sitski").notNull().default(0),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
});

export const insertRaceSkiSchema = createInsertSchema(raceSkis).omit({ id: true });
export type InsertRaceSki = z.infer<typeof insertRaceSkiSchema>;
export type RaceSki = typeof raceSkis.$inferSelect;

export const raceSkiRegrinds = pgTable("race_ski_regrinds", {
  id: serial("id").primaryKey(),
  raceSkiId: integer("race_ski_id").notNull(),
  date: text("date").notNull(),
  grindType: text("grind_type").notNull(),
  stone: text("stone"),
  pattern: text("pattern"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
});

export const insertRaceSkiRegrindSchema = createInsertSchema(raceSkiRegrinds).omit({ id: true });
export type InsertRaceSkiRegrind = z.infer<typeof insertRaceSkiRegrindSchema>;
export type RaceSkiRegrind = typeof raceSkiRegrinds.$inferSelect;

// --- Kick (#9): classic kick-testing skis, tests, and per-ski entries ---
// A pool of test skis used to evaluate kick (festesmøring). Distinct from
// race skis (per athlete) and test fleets (glide). Brand / grind / heights /
// ski-type mirror the Athlete-skis ski choices.
export const kickSkis = pgTable("kick_skis", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  groupScope: text("group_scope"),
  name: text("name"),            // optional short label/Ski ID
  brand: text("brand"),
  grind: text("grind"),
  heights: text("heights"),
  typeOfSki: text("type_of_ski"), // Klister/Cover, Zero, Hardwax, …
  color: text("color"),           // SKI_COLORS id (none/emerald/sky/…)
  notes: text("notes"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
});
export const insertKickSkiSchema = createInsertSchema(kickSkis).omit({ id: true });
export type InsertKickSki = z.infer<typeof insertKickSkiSchema>;
export type KickSki = typeof kickSkis.$inferSelect;

export const kickTests = pgTable("kick_tests", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  groupScope: text("group_scope"),
  date: text("date").notNull(),
  location: text("location"),
  weatherId: integer("weather_id"),
  noWeather: integer("no_weather").notNull().default(0),
  testPersons: text("test_persons"),
  notes: text("notes"),
  report: text("report"),        // generated interpreted report (analytics)
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
});
export const insertKickTestSchema = createInsertSchema(kickTests).omit({ id: true });
export type InsertKickTest = z.infer<typeof insertKickTestSchema>;
export type KickTest = typeof kickTests.$inferSelect;

export const kickTestEntries = pgTable("kick_test_entries", {
  id: serial("id").primaryKey(),
  kickTestId: integer("kick_test_id").notNull(),
  kickSkiId: integer("kick_ski_id").notNull(),
  binder: text("binder"),
  kickSolution: text("kick_solution"),
  feelingRank: integer("feeling_rank"),
  feelingNotes: text("feeling_notes"),
});
export const insertKickTestEntrySchema = createInsertSchema(kickTestEntries).omit({ id: true });
export type InsertKickTestEntry = z.infer<typeof insertKickTestEntrySchema>;
export type KickTestEntry = typeof kickTestEntries.$inferSelect;

// Kick mixes (#9 follow-up): recipes for blended kick products. `products` is a
// JSON array of { name, parts } — parts drive the mixing-ratio display.
// `mixType` is "hardwax" | "klister"; klister mixes carry a roller temperature.
export const kickMixes = pgTable("kick_mixes", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  groupScope: text("group_scope"),
  name: text("name").notNull(),
  mixType: text("mix_type").notNull().default("hardwax"),
  rollerTemperature: text("roller_temperature"),
  products: text("products"), // JSON: [{ name: string, parts: number }]
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
});
export const insertKickMixSchema = createInsertSchema(kickMixes).omit({ id: true });
export type InsertKickMix = z.infer<typeof insertKickMixSchema>;
export type KickMix = typeof kickMixes.$inferSelect;

// --- Test Ski Regrind History ---

export const testSkiRegrinds = pgTable("test_ski_regrinds", {
  id: serial("id").primaryKey(),
  seriesId: integer("series_id").notNull(),
  date: text("date").notNull(),
  grindType: text("grind_type").notNull(),
  stone: text("stone"),
  pattern: text("pattern"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
});

export const insertTestSkiRegrindSchema = createInsertSchema(testSkiRegrinds).omit({ id: true });
export type InsertTestSkiRegrind = z.infer<typeof insertTestSkiRegrindSchema>;
export type TestSkiRegrind = typeof testSkiRegrinds.$inferSelect;

// --- User-Team membership (many-to-many) ---

export const userTeams = pgTable("user_teams", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  teamId: integer("team_id").notNull(),
});

export const insertUserTeamSchema = createInsertSchema(userTeams).omit({ id: true });
export type InsertUserTeam = z.infer<typeof insertUserTeamSchema>;
export type UserTeam = typeof userTeams.$inferSelect;

// --- Per-team permissions for multi-team users ---
export const userTeamPermissions = pgTable("user_team_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  teamId: integer("team_id").notNull(),
  permissions: text("permissions").notNull(),
});

export const insertUserTeamPermissionSchema = createInsertSchema(userTeamPermissions).omit({ id: true });
export type InsertUserTeamPermission = z.infer<typeof insertUserTeamPermissionSchema>;
export type UserTeamPermission = typeof userTeamPermissions.$inferSelect;

// --- Watch sessions (persisted so Render restarts don't lose them) ---
export const watchSessions = pgTable("watch_sessions", {
  code: varchar("code", { length: 4 }).primaryKey(),
  skiPairs: text("ski_pairs").notNull(), // JSON array
  skiLabels: text("ski_labels"),         // JSON object: { skiNumber: "product name" }
  bracket: text("bracket").notNull(),    // JSON array
  testId: integer("test_id"),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  operatorName: text("operator_name"),   // Person logged in on the watch device
  teamId: integer("team_id"),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const runsheetProgress = pgTable("runsheet_progress", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull(),
  userId: integer("user_id").notNull(),
  bracket: text("bracket").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
});

// --- Watch Queue: tests queued for the Garmin watch app ---
export const watchQueue = pgTable("watch_queue", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  testId: integer("test_id"),
  seriesId: integer("series_id"),
  testName: text("test_name"),      // e.g. "Oslo · 2025-03-01"
  seriesName: text("series_name"),  // fallback display name
  addedByName: text("added_by_name").notNull().default(""),
  addedAt: text("added_at").notNull(),
  status: text("status").notNull().default("active"), // 'active' | 'completed'
  completedAt: text("completed_at"),
  sessionCode: text("session_code"), // auto-created watch session code
});

// Inbox messages (used for SA notifications from "Report a Problem")
export const inboxMessages = pgTable("inbox_messages", {
  id: serial("id").primaryKey(),
  toUserId: integer("to_user_id").notNull(),      // recipient (SA user)
  fromUserId: integer("from_user_id"),             // sender (may be null for system msgs)
  fromName: text("from_name"),                      // display name of sender
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isRead: integer("is_read").notNull().default(0),
  createdAt: text("created_at").notNull(),
  teamName: text("team_name"),                      // sender's team name for context
});

export const interestRegistrations = pgTable("interest_registrations", {
  id: serial("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  teamName: text("team_name").notNull(),
  planName: text("plan_name").notNull().default("team"),
  userCount: integer("user_count"),
  groupCount: integer("group_count"),
  billingPeriod: text("billing_period").default("monthly"),
  invoiceAddress: text("invoice_address"),
  notes: text("notes"),
  status: text("status").notNull().default("new"),
  adminNotes: text("admin_notes"),
});
export type InterestRegistration = typeof interestRegistrations.$inferSelect;
export type InsertInterestRegistration = typeof interestRegistrations.$inferInsert;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  used: integer("used").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  invitedById: integer("invited_by_id").notNull(),
  invitedByName: text("invited_by_name").notNull(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  createdAt: text("created_at").notNull(),
});
export type Invitation = typeof invitations.$inferSelect;

export const billingRecords = pgTable("billing_records", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  teamName: text("team_name").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("NOK"),
  description: text("description"),
  periodStart: text("period_start"),
  periodEnd: text("period_end"),
  dueDate: text("due_date").notNull(),
  invoicedAt: text("invoiced_at"),
  paidAt: text("paid_at"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export type BillingRecord = typeof billingRecords.$inferSelect;

