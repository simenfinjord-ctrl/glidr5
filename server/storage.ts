import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users, groups, testSkiSeries, products, dailyWeather, tests, testEntries,
  type User, type InsertUser,
  type Group, type InsertGroup,
  type Series, type InsertSeries,
  type Product, type InsertProduct,
  type Weather, type InsertWeather,
  type Test, type InsertTest,
  type TestEntry, type InsertEntry,
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
  listUsers(): Promise<User[]>;

  listGroups(): Promise<Group[]>;
  createGroup(g: InsertGroup): Promise<Group>;
  updateGroup(id: number, data: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: number): Promise<boolean>;

  listSeries(groupScope: string, isAdmin: boolean): Promise<Series[]>;
  getSeries(id: number): Promise<Series | undefined>;
  createSeries(s: InsertSeries): Promise<Series>;
  updateSeries(id: number, s: Partial<InsertSeries>): Promise<Series | undefined>;

  listProducts(groupScope: string, isAdmin: boolean): Promise<Product[]>;
  createProduct(p: InsertProduct): Promise<Product>;
  updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined>;

  listWeather(groupScope: string, isAdmin: boolean): Promise<Weather[]>;
  getWeather(id: number): Promise<Weather | undefined>;
  createWeather(w: InsertWeather): Promise<Weather>;
  updateWeather(id: number, w: Partial<InsertWeather>): Promise<Weather | undefined>;
  findWeather(date: string, location: string, groupScope: string): Promise<Weather | undefined>;

  listTests(groupScope: string, isAdmin: boolean): Promise<Test[]>;
  getTest(id: number): Promise<Test | undefined>;
  createTest(t: InsertTest): Promise<Test>;
  updateTest(id: number, data: Partial<InsertTest>): Promise<Test | undefined>;
  deleteTest(id: number): Promise<boolean>;
  listEntries(testId: number): Promise<TestEntry[]>;
  createEntry(e: InsertEntry): Promise<TestEntry>;
  deleteEntriesByTestId(testId: number): Promise<void>;
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

  async listUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async listGroups(): Promise<Group[]> {
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

  private scopeFilter(groupScope: string, isAdmin: boolean, table: any) {
    if (isAdmin) return undefined;
    const scopes = parseGroupScopes(groupScope);
    if (scopes.length <= 1) {
      return eq(table.groupScope, scopes[0] || groupScope);
    }
    return inArray(table.groupScope, scopes);
  }

  async listSeries(groupScope: string, isAdmin: boolean): Promise<Series[]> {
    const filter = this.scopeFilter(groupScope, isAdmin, testSkiSeries);
    if (filter) {
      return db.select().from(testSkiSeries).where(filter);
    }
    return db.select().from(testSkiSeries);
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

  async listProducts(groupScope: string, isAdmin: boolean): Promise<Product[]> {
    const filter = this.scopeFilter(groupScope, isAdmin, products);
    if (filter) {
      return db.select().from(products).where(filter);
    }
    return db.select().from(products);
  }

  async createProduct(p: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(p).returning();
    return created!;
  }

  async updateProduct(id: number, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(data).where(eq(products.id, id)).returning();
    return updated;
  }

  async listWeather(groupScope: string, isAdmin: boolean): Promise<Weather[]> {
    const filter = this.scopeFilter(groupScope, isAdmin, dailyWeather);
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

  async findWeather(date: string, location: string, groupScope: string): Promise<Weather | undefined> {
    const scopes = parseGroupScopes(groupScope);
    const [w] = await db.select().from(dailyWeather).where(
      and(
        eq(dailyWeather.date, date),
        sql`lower(${dailyWeather.location}) = lower(${location})`,
        scopes.length > 1
          ? inArray(dailyWeather.groupScope, scopes)
          : eq(dailyWeather.groupScope, scopes[0] || groupScope),
      )
    );
    return w;
  }

  async listTests(groupScope: string, isAdmin: boolean): Promise<Test[]> {
    const filter = this.scopeFilter(groupScope, isAdmin, tests);
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
}

export const storage = new DatabaseStorage();
