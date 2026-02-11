import { GroupScope, MockUser, getCurrentUser } from "@/lib/mock-auth";

export type BaseRecord = {
  id: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  groupScope: GroupScope;
};

export type TestSkiType = "Structure" | "Glide" | "Grind";
export type ProductCategory = "Glide product" | "Topping product" | "Structure tool";
export type TestType = "Glide" | "Structure";

export type TestSkiSeries = BaseRecord & {
  name: string;
  type: TestSkiType;
  grind?: string;
  numberOfSkis: number;
  lastRegrind?: string;
};

export type Product = BaseRecord & {
  category: ProductCategory;
  brand: string;
  name: string;
};

export type DailyWeather = BaseRecord & {
  date: string; // yyyy-mm-dd
  time: string; // hh:mm
  location: string;
  airTemperatureC: number;
  airHumidityPct: number;
  snowTemperatureC: number;
  snowHumidityPct: number;
  snowType: string;
};

export type Lane = string;

export type Test = BaseRecord & {
  date: string;
  location: string;
  weatherId?: string;
  testType: TestType;
  seriesId: string;
  lane: Lane;
  notes?: string;
};

export type TestEntry = BaseRecord & {
  testId: string;
  skiNumber: number;
  productId?: string;
  freeTextProduct?: string;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  resultXkmCmBehind?: number | null;
  rankXkm?: number | null;
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function mustUser(): MockUser {
  const u = getCurrentUser();
  if (!u) {
    throw new Error("Not logged in");
  }
  return u;
}

function withinScope(rec: BaseRecord, user: MockUser) {
  return user.isAdmin || rec.groupScope === user.groupScope;
}

type Store = {
  series: TestSkiSeries[];
  products: Product[];
  weather: DailyWeather[];
  tests: Test[];
  entries: TestEntry[];
  lanes: Lane[];
};

const store: Store = {
  series: [],
  products: [],
  weather: [],
  tests: [],
  entries: [],
  lanes: ["Blue 1"],
};

// seed minimal data for demo
(function seed() {
  const u = {
    id: "user-admin-1",
    name: "Admin",
    groupScope: "Admin" as GroupScope,
    isAdmin: true,
    email: "admin@fastski.local",
  };

  const createdAt = nowIso();
  const base = {
    createdAt,
    createdBy: { id: u.id, name: u.name },
    groupScope: u.groupScope,
  };

  const s1: TestSkiSeries = {
    id: "series_blue_1",
    ...base,
    name: "Testskis Blue 1",
    type: "Glide",
    numberOfSkis: 8,
  };

  const p1: Product = {
    id: "prod_swix_hs10",
    ...base,
    category: "Glide product",
    brand: "Swix",
    name: "HS10",
  };
  const p2: Product = {
    id: "prod_tokos_topfinish",
    ...base,
    category: "Topping product",
    brand: "Toko",
    name: "Top Finish",
  };
  const p3: Product = {
    id: "prod_struct_1mm",
    ...base,
    category: "Structure tool",
    brand: "SVST",
    name: "1.0 mm linear",
  };

  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  const w1: DailyWeather = {
    id: "wx_today_parkcity",
    ...base,
    date,
    time: "09:30",
    location: "Park City",
    airTemperatureC: -6,
    airHumidityPct: 55,
    snowTemperatureC: -9,
    snowHumidityPct: 40,
    snowType: "New snow",
  };

  store.series.push(s1);
  store.products.push(p1, p2, p3);
  store.weather.push(w1);
})();

export function listSeries(user = mustUser()) {
  return store.series.filter((s) => withinScope(s, user));
}

export function upsertSeries(input: Omit<TestSkiSeries, keyof BaseRecord> & { id?: string }, user = mustUser()) {
  const isUpdate = Boolean(input.id);
  if (isUpdate) {
    const existing = store.series.find((s) => s.id === input.id);
    if (!existing) throw new Error("Series not found");
    if (!withinScope(existing, user)) throw new Error("Forbidden");
    Object.assign(existing, {
      ...input,
    });
    return existing;
  }

  const rec: TestSkiSeries = {
    id: makeId("series"),
    createdAt: nowIso(),
    createdBy: { id: user.id, name: user.name },
    groupScope: user.groupScope,
    name: input.name,
    type: input.type,
    grind: input.grind,
    numberOfSkis: input.numberOfSkis,
    lastRegrind: input.lastRegrind,
  };
  store.series.unshift(rec);
  return rec;
}

export function listProducts(user = mustUser()) {
  return store.products.filter((p) => withinScope(p, user));
}

export function createProduct(input: { category: ProductCategory; brand: string; name: string }, user = mustUser()) {
  const brand = input.brand.trim();
  const name = input.name.trim();
  const dup = store.products.find(
    (p) =>
      p.groupScope === user.groupScope &&
      p.category === input.category &&
      p.brand.toLowerCase() === brand.toLowerCase() &&
      p.name.toLowerCase() === name.toLowerCase(),
  );
  if (dup) {
    throw new Error("This product already exists in your group.");
  }

  const rec: Product = {
    id: makeId("product"),
    createdAt: nowIso(),
    createdBy: { id: user.id, name: user.name },
    groupScope: user.groupScope,
    category: input.category,
    brand,
    name,
  };
  store.products.unshift(rec);
  return rec;
}

export function listWeather(user = mustUser()) {
  return store.weather.filter((w) => withinScope(w, user));
}

export function upsertWeather(input: Omit<DailyWeather, keyof BaseRecord> & { id?: string }, user = mustUser()) {
  const isUpdate = Boolean(input.id);

  if (!user.isAdmin) {
    const existingForKey = store.weather.find(
      (w) =>
        w.groupScope === user.groupScope &&
        w.date === input.date &&
        w.location.toLowerCase() === input.location.trim().toLowerCase(),
    );
    if (existingForKey && (!isUpdate || existingForKey.id !== input.id)) {
      throw new Error("Weather already exists for this date and location.");
    }
  }

  if (isUpdate) {
    const existing = store.weather.find((w) => w.id === input.id);
    if (!existing) throw new Error("Weather not found");
    if (!withinScope(existing, user)) throw new Error("Forbidden");
    Object.assign(existing, {
      ...input,
      location: input.location.trim(),
      snowType: input.snowType.trim(),
    });
    return existing;
  }

  const rec: DailyWeather = {
    id: makeId("weather"),
    createdAt: nowIso(),
    createdBy: { id: user.id, name: user.name },
    groupScope: user.groupScope,
    ...input,
    location: input.location.trim(),
    snowType: input.snowType.trim(),
  };
  store.weather.unshift(rec);
  return rec;
}

export function listTests(user = mustUser()) {
  return store.tests.filter((t) => withinScope(t, user));
}

export function createTestWithEntries(input: {
  date: string;
  location: string;
  weatherId?: string;
  testType: TestType;
  seriesId: string;
  lane: Lane;
  notes?: string;
  entries: Array<{
    skiNumber: number;
    productId?: string;
    freeTextProduct?: string;
    methodology: string;
    result0kmCmBehind: number | null;
    resultXkmCmBehind?: number | null;
  }>;
}, user = mustUser()) {
  const test: Test = {
    id: makeId("test"),
    createdAt: nowIso(),
    createdBy: { id: user.id, name: user.name },
    groupScope: user.groupScope,
    date: input.date,
    location: input.location.trim(),
    weatherId: input.weatherId,
    testType: input.testType,
    seriesId: input.seriesId,
    lane: input.lane,
    notes: input.notes?.trim() || "",
  };

  store.tests.unshift(test);

  input.entries.forEach((e) => {
    const entry: TestEntry = {
      id: makeId("entry"),
      createdAt: nowIso(),
      createdBy: { id: user.id, name: user.name },
      groupScope: user.groupScope,
      testId: test.id,
      skiNumber: e.skiNumber,
      productId: e.productId,
      freeTextProduct: e.freeTextProduct,
      methodology: e.methodology,
      result0kmCmBehind: e.result0kmCmBehind,
      rank0km: null,
      resultXkmCmBehind: e.resultXkmCmBehind ?? null,
      rankXkm: null,
    };
    store.entries.push(entry);
  });

  return test;
}

export function listEntriesByTest(testId: string, user = mustUser()) {
  return store.entries.filter((e) => e.testId === testId && withinScope(e, user));
}

export function getWeatherFor(date: string, location: string, user = mustUser()) {
  return store.weather.find(
    (w) =>
      withinScope(w, user) &&
      w.date === date &&
      w.location.toLowerCase() === location.trim().toLowerCase(),
  );
}

export function listLanes() {
  return [...store.lanes];
}
