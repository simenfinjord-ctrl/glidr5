import { pgTable, text, varchar, integer, real, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/chat";

export const PERMISSION_AREAS = ["dashboard", "tests", "testskis", "products", "weather", "analytics", "grinding", "raceskis", "suggestions", "liverunsheets"] as const;
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
  suggestions: "edit",
  liverunsheets: "edit",
};

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
  kickRank: integer("kick_rank"),
  grindType: text("grind_type"),
  grindStone: text("grind_stone"),
  grindPattern: text("grind_pattern"),
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
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  teamId: integer("team_id").notNull().default(1),
});

export const insertAthleteSchema = createInsertSchema(athletes).omit({ id: true });
export type InsertAthlete = z.infer<typeof insertAthleteSchema>;
export type Athlete = typeof athletes.$inferSelect;

export const athleteAccess = pgTable("athlete_access", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id").notNull(),
  userId: integer("user_id").notNull(),
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
  customParams: text("custom_params"),
  archivedAt: text("archived_at"),
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

// --- Watch sessions (persisted so Render restarts don't lose them) ---
export const watchSessions = pgTable("watch_sessions", {
  code: varchar("code", { length: 4 }).primaryKey(),
  skiPairs: text("ski_pairs").notNull(), // JSON array
  bracket: text("bracket").notNull(),    // JSON array
  testId: integer("test_id"),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
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

