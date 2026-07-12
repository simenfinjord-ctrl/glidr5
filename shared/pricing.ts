import { TEAM_FEATURES, type TeamFeature } from "./schema";

/**
 * Self-service plan builder pricing (NOK per month, incl. VAT).
 *
 * The catalog is shared: the client uses it to render the builder and show a
 * live price, the server recomputes the SAME numbers at signup so a tampered
 * client can never buy features cheaper than listed.
 */

// Core features included in every plan at no cost.
export const CORE_FEATURES: readonly TeamFeature[] = ["dashboard", "tests", "products", "weather"];

// Monthly price per optional feature. Features not listed here (i.e. core) cost 0.
export const FEATURE_PRICES: Partial<Record<TeamFeature, number>> = {
  // Areas
  testskis: 49,
  analytics: 99,
  grinding: 99,
  raceskis: 149,
  kick: 149,
  raceprep: 149,
  suggestions: 99,
  liverunsheets: 149,
  // Field & runsheet tools
  runsheet_brackets: 49,
  garmin_watch: 149,
  mobile_runsheet: 49,
  // Export & backup
  pdf_export: 49,
  excel_export: 49,
  google_sheets_backup: 99,
  offline_mode: 99,
  // Team features
  blind_tester: 49,
  activity_logging: 99,
  column_visibility: 0,
  test_ski_regrind: 49,
  race_ski_regrind: 49,
  product_stock: 49,
  athlete_management: 99,
  us_grind: 0,
  para_team: 0,
  // Enterprise
  multi_team: 249,
  bulk_export: 149,
  custom_groups: 99,
};

// Limits: what the base includes and what extra capacity costs per month.
export const LIMIT_PRICING = {
  users:  { included: 3, perExtra: 29, min: 1,  max: 100 },
  groups: { included: 1, perExtra: 49, min: 1,  max: 20 },
} as const;

// Annual billing pays for 10 months (2 free).
export const ANNUAL_MONTHS = 10;

export type CustomPlanConfig = {
  features: TeamFeature[];
  maxUsers: number;
  maxGroups: number;
  billingPeriod: "monthly" | "annual";
};

export type PriceLine = { label: string; amount: number };

export type PriceBreakdown = {
  featureLines: PriceLine[];
  userLine: PriceLine | null;
  groupLine: PriceLine | null;
  monthlyTotal: number;
  /** What will actually be billed per period (== monthlyTotal, or 10x for annual). */
  periodTotal: number;
  billingPeriod: "monthly" | "annual";
};

/** Drop unknown keys and always include the free core. */
export function sanitizeFeatureSelection(features: unknown): TeamFeature[] {
  const valid = Array.isArray(features)
    ? features.filter((f): f is TeamFeature => (TEAM_FEATURES as readonly string[]).includes(f))
    : [];
  return [...new Set([...CORE_FEATURES, ...valid])];
}

export function clampLimit(kind: "users" | "groups", value: unknown): number {
  const cfg = LIMIT_PRICING[kind];
  const n = typeof value === "number" && !isNaN(value) ? Math.floor(value) : cfg.included;
  return Math.min(cfg.max, Math.max(cfg.min, n));
}

export function computeCustomPrice(config: CustomPlanConfig): PriceBreakdown {
  const features = sanitizeFeatureSelection(config.features);
  const maxUsers = clampLimit("users", config.maxUsers);
  const maxGroups = clampLimit("groups", config.maxGroups);

  const featureLines: PriceLine[] = features
    .map((f) => ({ label: f, amount: FEATURE_PRICES[f] ?? 0 }))
    .filter((l) => l.amount > 0);

  const extraUsers = Math.max(0, maxUsers - LIMIT_PRICING.users.included);
  const extraGroups = Math.max(0, maxGroups - LIMIT_PRICING.groups.included);
  const userLine: PriceLine | null = extraUsers > 0
    ? { label: `+${extraUsers} users`, amount: extraUsers * LIMIT_PRICING.users.perExtra }
    : null;
  const groupLine: PriceLine | null = extraGroups > 0
    ? { label: `+${extraGroups} groups`, amount: extraGroups * LIMIT_PRICING.groups.perExtra }
    : null;

  const monthlyTotal =
    featureLines.reduce((s, l) => s + l.amount, 0) +
    (userLine?.amount ?? 0) +
    (groupLine?.amount ?? 0);

  const billingPeriod = config.billingPeriod === "annual" ? "annual" : "monthly";
  const periodTotal = billingPeriod === "annual" ? monthlyTotal * ANNUAL_MONTHS : monthlyTotal;

  return { featureLines, userLine, groupLine, monthlyTotal, periodTotal, billingPeriod };
}
