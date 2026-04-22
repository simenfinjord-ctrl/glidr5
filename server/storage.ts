import { eq, and, sql, inArray, isNull, isNotNull } from "drizzle-orm";
import { db } from "./db";
import {
  users, groups, testSkiSeries, products, dailyWeather, tests, testEntries, loginLogs,
  activityLogs, grindingRecords, grindingSheets,
  athletes, athleteAccess, raceSkis, raceSkiRegrinds, testSkiRegrinds,
  teams, runsheets, userTeams,
  type User, type InsertUser,
  type Group, type InsertGroup,
  type Series, type InsertSeries,
  type Product, type InsertProduct,
  type Weather, type InsertWeather,
  type Test, type InsertTest,
  type TestEntry, type InsertEntry,
  type LoginLog, type InsertLoginLog,
  type ActivityLog, type InsertActivityLog,
  type GrindingRecord, type InsertGrindingRecord,
  type GrindingSheet, type InsertGrindingSheet,
  type Athlete, type InsertAthlete,
  type AthleteAccess, type InsertAthleteAccess,
  type RaceSki, type InsertRaceSki,
  type RaceSkiRegrind, type InsertRaceSkiRegrind,
  type TestSkiRegrind, type InsertTestSkiRegrind,
  type Team, type InsertTeam,
  type Runsheet, type InsertRunsheet,
  type UserTeam,
} from "@shared/schema";

export function parseGroupScopes(groupScope: string): string[] {
  return groupScope.split(",").map((s) => s.trim()).filter(Boolean);
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  listUsers(teamId?: number): Promise<User[]>;

  listTeams(): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  createTeam(t: InsertTeam): Promise<Team>;
  updateTeam(id: number, data: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<boolean>;
  setDefaultTeam(id: number): Promise<void>;

  listGroups(teamId?: number): Promise<Group[]>;
  createGroup(g: InsertGroup): Promise<Group>;
  updateGroup(id: number, data: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: number): Promise<boolean>;

  listSeries(groupScope: string, isAdmin: boolean, teamId?: number): Promise<Series[]>;
  listArchivedSeries(groupScope: string, isAdmin: boolean, teamId?: number): Promise<Series[]>;
  getSeries(id: number): Promise<Series | undefined>;
  createSeries(s: InsertSeries): Promise<Series>;
  updateSeries(id: number, s: Partial<InsertSeries>): Promise<Series | undefined>;
  archiveSeries(id: number): Promise<Series | undefined>;
  restoreSeries(id: number): Promise<Series | undefined>;
  deleteSeries(id: number): Promise<boolean>;

  listProducts(groupScope: string, isAdmin: boolean, teamId?: number): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(p: InsertProduct): Promise<Product>;
  updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  listWeather(groupScope: string, isAdmin: boolean, teamId?: number): Promise<Weather[]>;
  getWeather(id: number): Promise<Weather | undefined>;
  createWeather(w: InsertWeather): Promise<Weather>;
  updateWeather(id: number, w: Partial<InsertWeather>): Promise<Weather | undefined>;
  deleteWeather(id: number): Promise<boolean>;
  findWeather(date: string, location: string, groupScope: string, teamId?: number): Promise<Weather | undefined>;

  listTests(groupScope: string, isAdmin: boolean, teamId?: number): Promise<Test[]>;
  getTest(id: number): Promise<Test | undefined>;
  createTest(t: InsertTest): Promise<Test>;
  updateTest(id: number, data: Partial<InsertTest>): Promise<Test | undefined>;
  deleteTest(id: number): Promise<boolean>;
  listEntries(testId: number): Promise<TestEntry[]>;
  createEntry(e: InsertEntry): Promise<TestEntry>;
  deleteEntriesByTestId(testId: number): Promise<void>;
  updateEntryResults(entryId: number, result0kmCmBehind: number | null, rank0km: number | null): Promise<void>;

  createLoginLog(log: InsertLoginLog): Promise<LoginLog>;
  listLoginLogs(teamId?: number): Promise<LoginLog[]>;

  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  listActivityLogs(limit?: number, teamId?: number): Promise<ActivityLog[]>;
  listStockChanges(limit?: number, teamId?: number): Promise<ActivityLog[]>;

  listGrindingRecords(groupScope: string, isAdmin: boolean, teamId?: number): Promise<GrindingRecord[]>;
  createGrindingRecord(r: InsertGrindingRecord): Promise<GrindingRecord>;
  updateGrindingRecord(id: number, data: Partial<InsertGrindingRecord>): Promise<GrindingRecord | undefined>;
  deleteGrindingRecord(id: number): Promise<boolean>;

  listGrindingSheets(groupScope: string, isAdmin: boolean, teamId?: number): Promise<GrindingSheet[]>;
  getGrindingSheet(id: number): Promise<GrindingSheet | undefined>;
  createGrindingSheet(s: InsertGrindingSheet): Promise<GrindingSheet>;
  updateGrindingSheet(id: number, data: Partial<InsertGrindingSheet>): Promise<GrindingSheet | undefined>;
  deleteGrindingSheet(id: number): Promise<boolean>;

  listAthletes(userId: number, isAdmin: boolean, teamId?: number): Promise<Athlete[]>;
  getAthlete(id: number): Promise<Athlete | undefined>;
  createAthlete(a: InsertAthlete): Promise<Athlete>;
  updateAthlete(id: number, data: Partial<InsertAthlete>): Promise<Athlete | undefined>;
  deleteAthlete(id: number): Promise<boolean>;

  listAthleteAccess(athleteId: number): Promise<AthleteAccess[]>;
  setAthleteAccess(athleteId: number, userIds: number[]): Promise<void>;
  hasAthleteAccess(athleteId: number, userId: number, isAdmin: boolean): Promise<boolean>;

  listRaceSkis(athleteId: number): Promise<RaceSki[]>;
  listArchivedRaceSkis(athleteId: number): Promise<RaceSki[]>;
  listAllRaceSkisIncludingArchived(athleteId: number): Promise<RaceSki[]>;
  archiveRaceSki(id: number): Promise<RaceSki | undefined>;
  restoreRaceSki(id: number): Promise<RaceSki | undefined>;
  getRaceSki(id: number): Promise<RaceSki | undefined>;
  createRaceSki(s: InsertRaceSki): Promise<RaceSki>;
  updateRaceSki(id: number, data: Partial<InsertRaceSki>): Promise<RaceSki | undefined>;
  deleteRaceSki(id: number): Promise<boolean>;
  listAllRaceSkisForUser(userId: number, isAdmin: boolean): Promise<RaceSki[]>;

  listRaceSkiRegrinds(raceSkiId: number): Promise<RaceSkiRegrind[]>;
  createRaceSkiRegrind(r: InsertRaceSkiRegrind): Promise<RaceSkiRegrind>;
  getRaceSkiRegrind(id: number): Promise<RaceSkiRegrind | undefined>;
  deleteRaceSkiRegrind(id: number): Promise<boolean>;

  listTestSkiRegrinds(seriesId: number): Promise<TestSkiRegrind[]>;
  createTestSkiRegrind(r: InsertTestSkiRegrind): Promise<TestSkiRegrind>;
  deleteTestSkiRegrind(id: number): Promise<boolean>;

  listRunsheets(teamId: number): Promise<Runsheet[]>;
  getRunsheet(id: number): Promise<Runsheet | undefined>;
  getRunsheetByTestId(testId: number, teamId: number): Promise<Runsheet | undefined>;
  createRunsheet(r: InsertRunsheet): Promise<Runsheet>;
  deleteRunsheet(id: number): Promise<boolean>;
  deleteRunsheetsByTestId(testId: number): Promise<void>;

  getUserTeams(userId: number): Promise<UserTeam[]>;
  addUserToTeam(userId: number, teamId: number): Promise<void>;
  removeUserFromTeam(userId: number, teamId: number): Promise<void>;

  countTable(tableName: string, teamId?: number): Promise<number>;
  listAllTestsForTeam(teamId: number): Promise<Test[]>;
  listAllEntriesForTests(testIds: number[]): Promise<TestEntry[]>;
  listAllWeatherForTeam(teamId: number): Promise<any[]>;
  listAthleteIdsForUser(userId: number): Promise<number[]>;
  purgeOldActivityLogs(beforeDate: string): Promise<number>;
  purgeOldLoginLogs(beforeDate: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      sql`lower(${users.email}) = lower(${email})`
    );
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created!;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async listUsers(teamId?: number): Promise<User[]> {
    if (teamId) {
      return db.select().from(users).where(eq(users.teamId, teamId));
    }
    return db.select().from(users);
  }

  // --- Teams ---

  async listTeams(): Promise<Team[]> {
    return db.select().from(teams);
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async createTeam(t: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(t).returning();
    return created!;
  }

  async updateTeam(id: number, data: Partial<InsertTeam>): Promise<Team | undefined> {
    const [updated] = await db.update(teams).set(data).where(eq(teams.id, id)).returning();
    return updated;
  }

  async deleteTeam(id: number): Promise<boolean> {
    const result = await db.delete(teams).where(eq(teams.id, id)).returning();
    return result.length > 0;
  }

  async setDefaultTeam(id: number): Promise<void> {
    await db.update(teams).set({ isDefault: 0 }).where(eq(teams.isDefault, 1));
    await db.update(teams).set({ isDefault: 1 }).where(eq(teams.id, id));
  }

  async listGroups(teamId?: number): Promise<Group[]> {
    if (teamId) {
      return db.select().from(groups).where(eq(groups.teamId, teamId));
    }
    return db.select().from(groups);
  }

  async createGroup(g: InsertGroup): Promise<Group> {
    const [created] = await db.insert(groups).values(g).returning();
    return created!;
  }

  async updateGroup(id: number, data: Partial<InsertGroup>): Promise<Group | undefined> {
    const [updated] = await db.update(groups).set(data).where(eq(groups.id, id)).returning();
    return updated;
  }

  async deleteGroup(id: number): Promise<boolean> {
    const result = await db.delete(groups).where(eq(groups.id, id)).returning();
    return result.length > 0;
  }

  private scopeFilter(groupScope: string, isAdmin: boolean, table: any, teamId?: number) {
    const conditions: any[] = [];
    if (isAdmin) {
      if (teamId) conditions.push(eq(table.teamId, teamId));
    } else {
      if (teamId) conditions.push(eq(table.teamId, teamId));
      const scopes = parseGroupScopes(groupScope);
      if (scopes.length <= 1) {
        conditions.push(eq(table.groupScope, scopes[0] || groupScope));
      } else {
        conditions.push(inArray(table.groupScope, scopes));
      }
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async listSeries(groupScope: string, isAdmin: boolean, teamId?: number): Promise<Series[]> {
    const scopeFilter = this.scopeFilter(groupScope, isAdmin, testSkiSeries, teamId);
    const notArchived = isNull(testSkiSeries.archivedAt);
    if (scopeFilter) {
      return db.select().from(testSkiSeries).where(and(scopeFilter, notArchived));
    }
    return db.select().from(testSkiSeries).where(notArchived);
  }

  async listArchivedSeries(groupScope: string, isAdmin: boolean, teamId?: number): Promise<Series[]> {
    const scopeFilter = this.scopeFilter(groupScope, isAdmin, testSkiSeries, teamId);
    const archived = isNotNull(testSkiSeries.archivedAt);
    if (scopeFilter) {
      return db.select().from(testSkiSeries).where(and(scopeFilter, archived));
    }
    return db.select().from(testSkiSeries).where(archived);
  }

  async getSeries(id: number): Promise<Series | undefined> {
    const [s] = await db.select().from(testSkiSeries).where(eq(testSkiSeries.id, id));
    return s;
  }

  async createSeries(s: InsertSeries): Promise<Series> {
    const [created] = await db.insert(testSkiSeries).values(s).returning();
    return created!;
  }

  async updateSeries(id: number, s: Partial<InsertSeries>): Promise<Series | undefined> {
    const [updated] = await db.update(testSkiSeries).set(s).where(eq(testSkiSeries.id, id)).returning();
    return updated;
  }

  async archiveSeries(id: number): Promise<Series | undefined> {
    const [updated] = await db.update(testSkiSeries)
      .set({ archivedAt: new Date().toISOString() })
      .where(eq(testSkiSeries.id, id))
      .returning();
    return updated;
  }

  async restoreSeries(id: number): Promise<Series | undefined> {
    const [updated] = await db.update(testSkiSeries)
      .set({ archivedAt: null })
      .where(eq(testSkiSeries.id, id))
      .returning();
    return updated;
  }

  async deleteSeries(id: number): Promise<boolean> {
    const result = await db.delete(testSkiSeries).where(eq(testSkiSeries.id, id));
    return (result as any).rowCount > 0;
  }

  async listProducts(groupScope: string, isAdmin: boolean, teamId?: number): Promise<Product[]> {
    const filter = this.scopeFilter(groupScope, isAdmin, products, teamId);
    if (filter) {
      return db.select().from(products).where(filter);
    }
    return db.select().from(products);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [found] = await db.select().from(products).where(eq(products.id, id));
    return found;
  }

  async createProduct(p: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(p).returning();
    return created!;
  }

  async updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return (result as any).rowCount > 0;
  }

  async listWeather(groupScope: string, isAdmin: boolean, teamId?: number): Promise<Weather[]> {
    const filter = this.scopeFilter(groupScope, isAdmin, dailyWeather, teamId);
    if (filter) {
      return db.select().from(dailyWeather).where(filter);
    }
    return db.select().from(dailyWeather);
  }

  async getWeather(id: number): Promise<Weather | undefined> {
    const [w] = await db.select().from(dailyWeather).where(eq(dailyWeather.id, id));
    return w;
  }

  async createWeather(w: InsertWeather): Promise<Weather> {
    const [created] = await db.insert(dailyWeather).values(w).returning();
    return created!;
  }

  async updateWeather(id: number, w: Partial<InsertWeather>): Promise<Weather | undefined> {
    const [updated] = await db.update(dailyWeather).set(w).where(eq(dailyWeather.id, id)).returning();
    return updated;
  }

  async deleteWeather(id: number): Promise<boolean> {
    const result = await db.delete(dailyWeather).where(eq(dailyWeather.id, id));
    return (result as any).rowCount > 0;
  }

  async findWeather(date: string, location: string, groupScope: string, teamId?: number): Promise<Weather | undefined> {
    const scopes = parseGroupScopes(groupScope);
    const conditions = [
      eq(dailyWeather.date, date),
      sql`lower(${dailyWeather.location}) = lower(${location})`,
      scopes.length > 1
        ? inArray(dailyWeather.groupScope, scopes)
        : eq(dailyWeather.groupScope, scopes[0] || groupScope),
    ];
    if (teamId) {
      conditions.push(eq(dailyWeather.teamId, teamId));
    }
    const [w] = await db.select().from(dailyWeather).where(and(...conditions));
    return w;
  }

  async listTests(groupScope: string, isAdmin: boolean, teamId?: number): Promise<Test[]> {
    const filter = this.scopeFilter(groupScope, isAdmin, tests, teamId);
    if (filter) {
      return db.select().from(tests).where(filter);
    }
    return db.select().from(tests);
  }

  async getTest(id: number): Promise<Test | undefined> {
    const [t] = await db.select().from(tests).where(eq(tests.id, id));
    return t;
  }

  async createTest(t: InsertTest): Promise<Test> {
    const [created] = await db.insert(tests).values(t).returning();
    return created!;
  }

  async updateTest(id: number, data: Partial<InsertTest>): Promise<Test | undefined> {
    const [updated] = await db.update(tests).set(data).where(eq(tests.id, id)).returning();
    return updated;
  }

  async deleteTest(id: number): Promise<boolean> {
    await db.delete(testEntries).where(eq(testEntries.testId, id));
    const result = await db.delete(tests).where(eq(tests.id, id)).returning();
    return result.length > 0;
  }

  async listEntries(testId: number): Promise<TestEntry[]> {
    return db.select().from(testEntries).where(eq(testEntries.testId, testId));
  }

  async createEntry(e: InsertEntry): Promise<TestEntry> {
    const [created] = await db.insert(testEntries).values(e).returning();
    return created!;
  }

  async deleteEntriesByTestId(testId: number): Promise<void> {
    await db.delete(testEntries).where(eq(testEntries.testId, testId));
  }

  async updateEntryResults(entryId: number, result0kmCmBehind: number | null, rank0km: number | null): Promise<void> {
    const [existing] = await db.select().from(testEntries).where(eq(testEntries.id, entryId));
    let updatedResults: string | null = null;
    if (existing?.results) {
      try {
        const parsed = JSON.parse(existing.results);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed[0] = { result: result0kmCmBehind, rank: rank0km };
          updatedResults = JSON.stringify(parsed);
        }
      } catch {}
    }
    if (!updatedResults) {
      updatedResults = JSON.stringify([{ result: result0kmCmBehind, rank: rank0km }]);
    }
    await db.update(testEntries)
      .set({ result0kmCmBehind, rank0km, results: updatedResults })
      .where(eq(testEntries.id, entryId));
  }

  async listRunsheets(teamId: number): Promise<Runsheet[]> {
    return db.select().from(runsheets).where(eq(runsheets.teamId, teamId));
  }

  async getRunsheet(id: number): Promise<Runsheet | undefined> {
    const [r] = await db.select().from(runsheets).where(eq(runsheets.id, id));
    return r;
  }

  async getRunsheetByTestId(testId: number, teamId: number): Promise<Runsheet | undefined> {
    const [r] = await db.select().from(runsheets).where(and(eq(runsheets.testId, testId), eq(runsheets.teamId, teamId)));
    return r;
  }

  async createRunsheet(r: InsertRunsheet): Promise<Runsheet> {
    const [created] = await db.insert(runsheets).values(r).returning();
    return created!;
  }

  async deleteRunsheet(id: number): Promise<boolean> {
    const result = await db.delete(runsheets).where(eq(runsheets.id, id));
    return (result as any).rowCount > 0;
  }

  async deleteRunsheetsByTestId(testId: number): Promise<void> {
    await db.delete(runsheets).where(eq(runsheets.testId, testId));
  }

  async createLoginLog(log: InsertLoginLog): Promise<LoginLog> {
    const [created] = await db.insert(loginLogs).values(log).returning();
    return created!;
  }

  async listLoginLogs(teamId?: number): Promise<LoginLog[]> {
    if (teamId) {
      const teamUsers = await db.select({ id: users.id }).from(users).where(eq(users.teamId, teamId));
      const userIds = teamUsers.map((u) => u.id);
      if (userIds.length === 0) return [];
      return db.select().from(loginLogs).where(inArray(loginLogs.userId, userIds)).orderBy(sql`${loginLogs.id} desc`);
    }
    return db.select().from(loginLogs).orderBy(sql`${loginLogs.id} desc`);
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created!;
  }

  async listActivityLogs(limit = 50, teamId?: number): Promise<ActivityLog[]> {
    if (teamId) {
      return db.select().from(activityLogs).where(eq(activityLogs.teamId, teamId)).orderBy(sql`${activityLogs.id} desc`).limit(limit);
    }
    return db.select().from(activityLogs).orderBy(sql`${activityLogs.id} desc`).limit(limit);
  }

  async listStockChanges(limit = 500, teamId?: number): Promise<ActivityLog[]> {
    const stockActions = sql`${activityLogs.action} IN ('stock_added', 'stock_removed', 'stock_set')`;
    if (teamId) {
      return db.select().from(activityLogs).where(sql`${stockActions} AND ${activityLogs.teamId} = ${teamId}`).orderBy(sql`${activityLogs.id} desc`).limit(limit);
    }
    return db.select().from(activityLogs).where(stockActions).orderBy(sql`${activityLogs.id} desc`).limit(limit);
  }

  async listGrindingRecords(groupScope: string, isAdmin: boolean, teamId?: number): Promise<GrindingRecord[]> {
    const filter = this.scopeFilter(groupScope, isAdmin, grindingRecords, teamId);
    if (filter) {
      return db.select().from(grindingRecords).where(filter).orderBy(sql`${grindingRecords.id} desc`);
    }
    return db.select().from(grindingRecords).orderBy(sql`${grindingRecords.id} desc`);
  }

  async getGrindingRecord(id: number): Promise<GrindingRecord | undefined> {
    const [record] = await db.select().from(grindingRecords).where(eq(grindingRecords.id, id));
    return record;
  }

  async createGrindingRecord(r: InsertGrindingRecord): Promise<GrindingRecord> {
    const [created] = await db.insert(grindingRecords).values(r).returning();
    return created!;
  }

  async updateGrindingRecord(id: number, data: Partial<InsertGrindingRecord>): Promise<GrindingRecord | undefined> {
    const [updated] = await db.update(grindingRecords).set(data).where(eq(grindingRecords.id, id)).returning();
    return updated;
  }

  async deleteGrindingRecord(id: number): Promise<boolean> {
    const result = await db.delete(grindingRecords).where(eq(grindingRecords.id, id)).returning();
    return result.length > 0;
  }

  async listGrindingSheets(groupScope: string, isAdmin: boolean, teamId?: number): Promise<GrindingSheet[]> {
    if (isAdmin && !teamId) return db.select().from(grindingSheets);
    const conditions: any[] = [];
    if (teamId) {
      conditions.push(eq(grindingSheets.teamId, teamId));
    }
    if (!isAdmin) {
      const scopes = parseGroupScopes(groupScope);
      conditions.push(inArray(grindingSheets.groupScope, scopes));
    }
    if (conditions.length > 0) {
      return db.select().from(grindingSheets).where(and(...conditions));
    }
    return db.select().from(grindingSheets);
  }

  async getGrindingSheet(id: number): Promise<GrindingSheet | undefined> {
    const [sheet] = await db.select().from(grindingSheets).where(eq(grindingSheets.id, id));
    return sheet;
  }

  async createGrindingSheet(s: InsertGrindingSheet): Promise<GrindingSheet> {
    const [created] = await db.insert(grindingSheets).values(s).returning();
    return created;
  }

  async updateGrindingSheet(id: number, data: Partial<InsertGrindingSheet>): Promise<GrindingSheet | undefined> {
    const [updated] = await db.update(grindingSheets).set(data).where(eq(grindingSheets.id, id)).returning();
    return updated;
  }

  async deleteGrindingSheet(id: number): Promise<boolean> {
    const result = await db.delete(grindingSheets).where(eq(grindingSheets.id, id)).returning();
    return result.length > 0;
  }

  // --- Athletes ---

  async listAthletes(userId: number, isAdmin: boolean, teamId?: number): Promise<Athlete[]> {
    if (isAdmin) {
      if (teamId) {
        return db.select().from(athletes).where(eq(athletes.teamId, teamId)).orderBy(sql`${athletes.name} asc`);
      }
      return db.select().from(athletes).orderBy(sql`${athletes.name} asc`);
    }
    const accessRows = await db.select().from(athleteAccess).where(eq(athleteAccess.userId, userId));
    const accessAthleteIds = accessRows.map((r) => r.athleteId);
    const createdByMe = await db.select().from(athletes).where(eq(athletes.createdById, userId));
    const createdByMeIds = createdByMe.map((a) => a.id);
    const allIds = Array.from(new Set([...accessAthleteIds, ...createdByMeIds]));
    if (allIds.length === 0) return [];
    const conditions: any[] = [inArray(athletes.id, allIds)];
    if (teamId) {
      conditions.push(eq(athletes.teamId, teamId));
    }
    return db.select().from(athletes).where(and(...conditions)).orderBy(sql`${athletes.name} asc`);
  }

  async getAthlete(id: number): Promise<Athlete | undefined> {
    const [a] = await db.select().from(athletes).where(eq(athletes.id, id));
    return a;
  }

  async createAthlete(a: InsertAthlete): Promise<Athlete> {
    const [created] = await db.insert(athletes).values(a).returning();
    return created!;
  }

  async updateAthlete(id: number, data: Partial<InsertAthlete>): Promise<Athlete | undefined> {
    const [updated] = await db.update(athletes).set(data).where(eq(athletes.id, id)).returning();
    return updated;
  }

  async deleteAthlete(id: number): Promise<boolean> {
    await db.delete(athleteAccess).where(eq(athleteAccess.athleteId, id));
    await db.delete(raceSkiRegrinds).where(
      inArray(raceSkiRegrinds.raceSkiId,
        db.select({ id: raceSkis.id }).from(raceSkis).where(eq(raceSkis.athleteId, id))
      )
    );
    await db.delete(raceSkis).where(eq(raceSkis.athleteId, id));
    const result = await db.delete(athletes).where(eq(athletes.id, id)).returning();
    return result.length > 0;
  }

  // --- Athlete Access ---

  async listAthleteAccess(athleteId: number): Promise<AthleteAccess[]> {
    return db.select().from(athleteAccess).where(eq(athleteAccess.athleteId, athleteId));
  }

  async setAthleteAccess(athleteId: number, userIds: number[]): Promise<void> {
    await db.delete(athleteAccess).where(eq(athleteAccess.athleteId, athleteId));
    if (userIds.length > 0) {
      await db.insert(athleteAccess).values(
        userIds.map((userId) => ({ athleteId, userId }))
      );
    }
  }

  async hasAthleteAccess(athleteId: number, userId: number, isAdmin: boolean, teamId?: number): Promise<boolean> {
    const athlete = await this.getAthlete(athleteId);
    if (!athlete) return false;
    if (isAdmin) {
      if (teamId && athlete.teamId && athlete.teamId !== teamId) return false;
      return true;
    }
    if (athlete.createdById === userId) return true;
    const [access] = await db.select().from(athleteAccess).where(
      and(eq(athleteAccess.athleteId, athleteId), eq(athleteAccess.userId, userId))
    );
    return !!access;
  }

  // --- Race Skis ---

  async listRaceSkis(athleteId: number): Promise<RaceSki[]> {
    return db.select().from(raceSkis).where(and(eq(raceSkis.athleteId, athleteId), isNull(raceSkis.archivedAt))).orderBy(sql`${raceSkis.skiId} asc`);
  }

  async listArchivedRaceSkis(athleteId: number): Promise<RaceSki[]> {
    return db.select().from(raceSkis).where(and(eq(raceSkis.athleteId, athleteId), isNotNull(raceSkis.archivedAt))).orderBy(sql`${raceSkis.skiId} asc`);
  }

  async listAllRaceSkisIncludingArchived(athleteId: number): Promise<RaceSki[]> {
    return db.select().from(raceSkis).where(eq(raceSkis.athleteId, athleteId)).orderBy(sql`${raceSkis.skiId} asc`);
  }

  async archiveRaceSki(id: number): Promise<RaceSki | undefined> {
    const [updated] = await db.update(raceSkis).set({ archivedAt: new Date().toISOString() }).where(eq(raceSkis.id, id)).returning();
    return updated;
  }

  async restoreRaceSki(id: number): Promise<RaceSki | undefined> {
    const [updated] = await db.update(raceSkis).set({ archivedAt: null }).where(eq(raceSkis.id, id)).returning();
    return updated;
  }

  async getRaceSki(id: number): Promise<RaceSki | undefined> {
    const [s] = await db.select().from(raceSkis).where(eq(raceSkis.id, id));
    return s;
  }

  async createRaceSki(s: InsertRaceSki): Promise<RaceSki> {
    const [created] = await db.insert(raceSkis).values(s).returning();
    return created!;
  }

  async updateRaceSki(id: number, data: Partial<InsertRaceSki>): Promise<RaceSki | undefined> {
    const [updated] = await db.update(raceSkis).set(data).where(eq(raceSkis.id, id)).returning();
    return updated;
  }

  async deleteRaceSki(id: number): Promise<boolean> {
    await db.delete(raceSkiRegrinds).where(eq(raceSkiRegrinds.raceSkiId, id));
    const result = await db.delete(raceSkis).where(eq(raceSkis.id, id)).returning();
    return result.length > 0;
  }

  async listAllRaceSkisForUser(userId: number, isAdmin: boolean): Promise<RaceSki[]> {
    const athleteList = await this.listAthletes(userId, isAdmin);
    if (athleteList.length === 0) return [];
    const athleteIds = athleteList.map((a) => a.id);
    return db.select().from(raceSkis).where(and(inArray(raceSkis.athleteId, athleteIds), isNull(raceSkis.archivedAt))).orderBy(sql`${raceSkis.skiId} asc`);
  }

  // --- Race Ski Regrinds ---

  async listRaceSkiRegrinds(raceSkiId: number): Promise<RaceSkiRegrind[]> {
    return db.select().from(raceSkiRegrinds).where(eq(raceSkiRegrinds.raceSkiId, raceSkiId)).orderBy(sql`${raceSkiRegrinds.id} desc`);
  }

  async createRaceSkiRegrind(r: InsertRaceSkiRegrind): Promise<RaceSkiRegrind> {
    const [created] = await db.insert(raceSkiRegrinds).values(r).returning();
    return created!;
  }

  async getRaceSkiRegrind(id: number): Promise<RaceSkiRegrind | undefined> {
    const [r] = await db.select().from(raceSkiRegrinds).where(eq(raceSkiRegrinds.id, id));
    return r;
  }

  async deleteRaceSkiRegrind(id: number): Promise<boolean> {
    const result = await db.delete(raceSkiRegrinds).where(eq(raceSkiRegrinds.id, id)).returning();
    return result.length > 0;
  }

  // --- Test Ski Regrinds ---

  async listTestSkiRegrinds(seriesId: number): Promise<TestSkiRegrind[]> {
    return db.select().from(testSkiRegrinds).where(eq(testSkiRegrinds.seriesId, seriesId)).orderBy(sql`${testSkiRegrinds.id} desc`);
  }

  async createTestSkiRegrind(r: InsertTestSkiRegrind): Promise<TestSkiRegrind> {
    const [created] = await db.insert(testSkiRegrinds).values(r).returning();
    return created!;
  }

  async deleteTestSkiRegrind(id: number): Promise<boolean> {
    const result = await db.delete(testSkiRegrinds).where(eq(testSkiRegrinds.id, id)).returning();
    return result.length > 0;
  }

  async getUserTeams(userId: number): Promise<UserTeam[]> {
    return db.select().from(userTeams).where(eq(userTeams.userId, userId));
  }

  async addUserToTeam(userId: number, teamId: number): Promise<void> {
    const existing = await db.select().from(userTeams).where(
      and(eq(userTeams.userId, userId), eq(userTeams.teamId, teamId))
    );
    if (existing.length === 0) {
      await db.insert(userTeams).values({ userId, teamId });
    }
  }

  async removeUserFromTeam(userId: number, teamId: number): Promise<void> {
    await db.delete(userTeams).where(
      and(eq(userTeams.userId, userId), eq(userTeams.teamId, teamId))
    );
  }

  async countTable(tableName: string, teamId?: number): Promise<number> {
    const tableMap: Record<string, any> = { users, tests, products, testSkiSeries, dailyWeather, grindingRecords, loginLogs, activityLogs, athletes, raceSkis };
    const table = tableMap[tableName];
    if (!table) return 0;
    if (teamId && tableName === "loginLogs") {
      const teamUsers = await db.select({ id: users.id }).from(users).where(eq(users.teamId, teamId));
      const userIds = teamUsers.map((u) => u.id);
      if (userIds.length === 0) return 0;
      const result = await db.select({ count: sql<number>`count(*)` }).from(loginLogs).where(inArray(loginLogs.userId, userIds));
      return Number(result[0]?.count ?? 0);
    }
    const hasTeamId = table.teamId !== undefined;
    if (teamId && hasTeamId) {
      const result = await db.select({ count: sql<number>`count(*)` }).from(table).where(eq(table.teamId, teamId));
      return Number(result[0]?.count ?? 0);
    }
    const result = await db.select({ count: sql<number>`count(*)` }).from(table);
    return Number(result[0]?.count ?? 0);
  }

  async listAllTestsForTeam(teamId: number): Promise<Test[]> {
    return db.select().from(tests).where(eq(tests.teamId, teamId));
  }

  async listAllEntriesForTests(testIds: number[]): Promise<TestEntry[]> {
    if (testIds.length === 0) return [];
    return db.select().from(testEntries).where(inArray(testEntries.testId, testIds));
  }

  async listAllWeatherForTeam(teamId: number): Promise<any[]> {
    return db.select().from(dailyWeather).where(eq(dailyWeather.teamId, teamId));
  }

  async listAthleteIdsForUser(userId: number): Promise<number[]> {
    const accessRows = await db.select().from(athleteAccess).where(eq(athleteAccess.userId, userId));
    const createdByMe = await db.select({ id: athletes.id }).from(athletes).where(eq(athletes.createdById, userId));
    return Array.from(new Set([...accessRows.map((r) => r.athleteId), ...createdByMe.map((a) => a.id)]));
  }

  async purgeOldActivityLogs(beforeDate: string): Promise<number> {
    const result = await db.delete(activityLogs).where(sql`${activityLogs.createdAt} < ${beforeDate}`).returning();
    return result.length;
  }

  async purgeOldLoginLogs(beforeDate: string): Promise<number> {
    const result = await db.delete(loginLogs).where(sql`${loginLogs.loginAt} < ${beforeDate}`).returning();
    return result.length;
  }

}

export const storage = new DatabaseStorage();
