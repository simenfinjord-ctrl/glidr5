import { pgTable, text, varchar, integer, real, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  groupScope: text("group_scope").notNull().default("U23"),
  isAdmin: integer("is_admin").notNull().default(0),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const insertGroupSchema = createInsertSchema(groups).omit({ id: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;

export const testSkiSeries = pgTable("test_ski_series", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  grind: text("grind"),
  numberOfSkis: integer("number_of_skis").notNull().default(8),
  lastRegrind: text("last_regrind"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  groupScope: text("group_scope").notNull(),
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
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const dailyWeather = pgTable("daily_weather", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  location: text("location").notNull(),
  airTemperatureC: real("air_temperature_c").notNull(),
  airHumidityPct: real("air_humidity_pct").notNull(),
  snowTemperatureC: real("snow_temperature_c").notNull(),
  snowHumidityPct: real("snow_humidity_pct").notNull(),
  snowType: text("snow_type").notNull(),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  groupScope: text("group_scope").notNull(),
});

export const insertWeatherSchema = createInsertSchema(dailyWeather).omit({ id: true });
export type InsertWeather = z.infer<typeof insertWeatherSchema>;
export type Weather = typeof dailyWeather.$inferSelect;

export const tests = pgTable("tests", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  location: text("location").notNull(),
  weatherId: integer("weather_id"),
  testType: text("test_type").notNull(),
  seriesId: integer("series_id").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  groupScope: text("group_scope").notNull(),
});

export const insertTestSchema = createInsertSchema(tests).omit({ id: true });
export type InsertTest = z.infer<typeof insertTestSchema>;
export type Test = typeof tests.$inferSelect;

export const testEntries = pgTable("test_entries", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull(),
  skiNumber: integer("ski_number").notNull(),
  productId: integer("product_id"),
  freeTextProduct: text("free_text_product"),
  methodology: text("methodology").notNull().default(""),
  result0kmCmBehind: real("result_0km_cm_behind"),
  rank0km: integer("rank_0km"),
  resultXkmCmBehind: real("result_xkm_cm_behind"),
  rankXkm: integer("rank_xkm"),
  createdAt: text("created_at").notNull(),
  createdById: integer("created_by_id").notNull(),
  createdByName: text("created_by_name").notNull(),
  groupScope: text("group_scope").notNull(),
});

export const insertEntrySchema = createInsertSchema(testEntries).omit({ id: true });
export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type TestEntry = typeof testEntries.$inferSelect;
