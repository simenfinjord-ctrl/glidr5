import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, testSkiSeries, products, dailyWeather, tests, testEntries,
  type User, type InsertUser,
  type Series, type InsertSeries,
  type Product, type InsertProduct,
  type Weather, type InsertWeather,
  type Test, type InsertTest,
  type TestEntry, type InsertEntry,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>;

  listSeries(groupScope: string, isAdmin: boolean): Promise<Series[]>;
  getSeries(id: number): Promise<Series | undefined>;
  createSeries(s: InsertSeries): Promise<Series>;
  updateSeries(id: number, s: Partial<InsertSeries>): Promise<Series | undefined>;

  listProducts(groupScope: string, isAdmin: boolean): Promise<Product[]>;
  createProduct(p: InsertProduct): Promise<Product>;

  listWeather(groupScope: string, isAdmin: boolean): Promise<Weather[]>;
  getWeather(id: number): Promise<Weather | undefined>;
  createWeather(w: InsertWeather): Promise<Weather>;
  updateWeather(id: number, w: Partial<InsertWeather>): Promise<Weather | undefined>;
  findWeather(date: string, location: string, groupScope: string): Promise<Weather | undefined>;

  listTests(groupScope: string, isAdmin: boolean): Promise<Test[]>;
  createTest(t: InsertTest): Promise<Test>;
  listEntries(testId: number): Promise<TestEntry[]>;
  createEntry(e: InsertEntry): Promise<TestEntry>;
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

  async listUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  private scopeFilter(groupScope: string, isAdmin: boolean, table: any) {
    if (isAdmin) return undefined;
    return eq(table.groupScope, groupScope);
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
    const [w] = await db.select().from(dailyWeather).where(
      and(
        eq(dailyWeather.date, date),
        sql`lower(${dailyWeather.location}) = lower(${location})`,
        eq(dailyWeather.groupScope, groupScope),
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

  async createTest(t: InsertTest): Promise<Test> {
    const [created] = await db.insert(tests).values(t).returning();
    return created!;
  }

  async listEntries(testId: number): Promise<TestEntry[]> {
    return db.select().from(testEntries).where(eq(testEntries.testId, testId));
  }

  async createEntry(e: InsertEntry): Promise<TestEntry> {
    const [created] = await db.insert(testEntries).values(e).returning();
    return created!;
  }
}

export const storage = new DatabaseStorage();
