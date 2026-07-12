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

/**
 * SA-editable overrides, stored in app_settings under 'plan_builder_pricing'.
 * Anything not overridden falls back to the defaults in this file.
 */
export type PricingOverrides = {
  featurePrices?: Partial<Record<TeamFeature, number>>;
  users?: { included?: number; perExtra?: number };
  groups?: { included?: number; perExtra?: number };
};

export type EffectivePricing = {
  featurePrices: Partial<Record<TeamFeature, number>>;
  users: { included: number; perExtra: number; min: number; max: number };
  groups: { included: number; perExtra: number; min: number; max: number };
};

export function resolvePricing(overrides?: PricingOverrides | null): EffectivePricing {
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && !isNaN(v) && v >= 0 ? v : fallback;
  const featurePrices: Partial<Record<TeamFeature, number>> = { ...FEATURE_PRICES };
  if (overrides?.featurePrices) {
    for (const [k, v] of Object.entries(overrides.featurePrices)) {
      featurePrices[k as TeamFeature] = num(v, FEATURE_PRICES[k as TeamFeature] ?? 0);
    }
  }
  return {
    featurePrices,
    users: {
      included: num(overrides?.users?.included, LIMIT_PRICING.users.included),
      perExtra: num(overrides?.users?.perExtra, LIMIT_PRICING.users.perExtra),
      min: LIMIT_PRICING.users.min, max: LIMIT_PRICING.users.max,
    },
    groups: {
      included: num(overrides?.groups?.included, LIMIT_PRICING.groups.included),
      perExtra: num(overrides?.groups?.perExtra, LIMIT_PRICING.groups.perExtra),
      min: LIMIT_PRICING.groups.min, max: LIMIT_PRICING.groups.max,
    },
  };
}

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

export function computeCustomPrice(config: CustomPlanConfig, overrides?: PricingOverrides | null): PriceBreakdown {
  const pricing = resolvePricing(overrides);
  const features = sanitizeFeatureSelection(config.features);
  const maxUsers = clampLimit("users", config.maxUsers);
  const maxGroups = clampLimit("groups", config.maxGroups);

  const featureLines: PriceLine[] = features
    // Core features are always included free — never billed, even if a price
    // override accidentally names one of them.
    .filter((f) => !(CORE_FEATURES as readonly string[]).includes(f))
    .map((f) => ({ label: f, amount: pricing.featurePrices[f] ?? 0 }))
    .filter((l) => l.amount > 0);

  const extraUsers = Math.max(0, maxUsers - pricing.users.included);
  const extraGroups = Math.max(0, maxGroups - pricing.groups.included);
  const userLine: PriceLine | null = extraUsers > 0
    ? { label: `+${extraUsers} users`, amount: extraUsers * pricing.users.perExtra }
    : null;
  const groupLine: PriceLine | null = extraGroups > 0
    ? { label: `+${extraGroups} groups`, amount: extraGroups * pricing.groups.perExtra }
    : null;

  const monthlyTotal =
    featureLines.reduce((s, l) => s + l.amount, 0) +
    (userLine?.amount ?? 0) +
    (groupLine?.amount ?? 0);

  const billingPeriod = config.billingPeriod === "annual" ? "annual" : "monthly";
  const periodTotal = billingPeriod === "annual" ? monthlyTotal * ANNUAL_MONTHS : monthlyTotal;

  return { featureLines, userLine, groupLine, monthlyTotal, periodTotal, billingPeriod };
}

// ── Dynamic team pricing ─────────────────────────────────────────────────────
// Existing teams follow the CURRENT price list: a team on the "custom" plan is
// priced live from its enabled features + limits, so changing the price list
// (or the team's features) automatically changes what the team is billed.
// Fixed-plan teams keep their plan/custom price. A per-team percent discount
// applies on top in both models.

export type TeamPriceInput = {
  planName?: string | null;
  enabledAreas?: string | null;      // JSON array string, as stored on teams
  maxUsers?: number | null;
  maxGroups?: number | null;
  billingPeriod?: string | null;
  customPrice?: number | null;
  discountPercent?: number | null;
};

export type TeamPrice = {
  /** Monthly price before discount, or null when unknown (e.g. enterprise "contact us"). */
  baseMonthly: number | null;
  discountPercent: number;
  /** Monthly price after discount (rounded to whole NOK). */
  monthly: number | null;
  /** Amount billed per period after discount (annual = 10 months). */
  period: number | null;
  billingPeriod: "monthly" | "annual";
  /** True when priced live from features (custom plan) rather than a fixed number. */
  dynamic: boolean;
  breakdown: PriceBreakdown | null;
};

export function computeTeamPrice(
  team: TeamPriceInput,
  overrides?: PricingOverrides | null,
  planPrices?: Record<string, number | null> | null
): TeamPrice {
  const billingPeriod = team.billingPeriod === "annual" ? "annual" as const : "monthly" as const;
  const discountPercent = Math.min(100, Math.max(0, Number(team.discountPercent) || 0));
  const plan = (team.planName ?? "free").toLowerCase();

  let baseMonthly: number | null = null;
  let dynamic = false;
  let breakdown: PriceBreakdown | null = null;

  if (plan === "custom") {
    let features: TeamFeature[] = [];
    try { features = JSON.parse(team.enabledAreas || "[]"); } catch {}
    breakdown = computeCustomPrice({
      features,
      maxUsers: team.maxUsers ?? LIMIT_PRICING.users.included,
      maxGroups: team.maxGroups ?? LIMIT_PRICING.groups.included,
      billingPeriod,
    }, overrides);
    baseMonthly = breakdown.monthlyTotal;
    dynamic = true;
  } else if (team.customPrice != null) {
    baseMonthly = team.customPrice;
  } else if (planPrices && planPrices[plan] !== undefined) {
    baseMonthly = planPrices[plan];
  }

  const monthly = baseMonthly == null ? null : Math.round(baseMonthly * (1 - discountPercent / 100));
  const period = monthly == null ? null : (billingPeriod === "annual" ? monthly * ANNUAL_MONTHS : monthly);
  return { baseMonthly, discountPercent, monthly, period, billingPeriod, dynamic, breakdown };
}
