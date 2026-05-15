/**
 * Stripe billing integration.
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY      – secret key from Stripe dashboard
 *   STRIPE_WEBHOOK_SECRET  – webhook signing secret (stripe listen --forward-to ...)
 *   STRIPE_PRICE_STARTER   – monthly price ID for Starter plan
 *   STRIPE_PRICE_TEAM      – monthly price ID for Team plan
 *   STRIPE_PRICE_PRO       – monthly price ID for Pro plan
 *   APP_URL                – e.g. https://app.glidr.io (for redirect URLs)
 */

import Stripe from "stripe";
import { Request, Response } from "express";
import { db } from "./db";
import { teams } from "../shared/schema";
import { eq } from "drizzle-orm";
import { PLAN_FEATURE_PRESETS, TeamFeature } from "../shared/schema";

const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;

export const stripe = stripeEnabled
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" })
  : null;

// Map Stripe price IDs → plan names
const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER ?? ""]: "starter",
  [process.env.STRIPE_PRICE_TEAM ?? ""]: "team",
  [process.env.STRIPE_PRICE_PRO ?? ""]: "pro",
};

// Map plan name → Stripe price ID
export const PLAN_TO_PRICE: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  team: process.env.STRIPE_PRICE_TEAM,
  pro: process.env.STRIPE_PRICE_PRO,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function applyPlanToTeam(teamId: number, planName: string, subscriptionStatus: string, currentPeriodEnd?: string) {
  const preset = PLAN_FEATURE_PRESETS[planName];
  const features: TeamFeature[] = preset ? [...preset.features] : [];
  await db
    .update(teams)
    .set({
      planName,
      subscriptionStatus,
      enabledAreas: JSON.stringify(features),
      currentPeriodEnd: currentPeriodEnd ?? null,
    })
    .where(eq(teams.id, teamId));
}

async function getOrCreateStripeCustomer(teamId: number, email: string, teamName: string): Promise<string> {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (team?.stripeCustomerId) return team.stripeCustomerId;

  const customer = await stripe!.customers.create({
    email,
    name: teamName,
    metadata: { teamId: String(teamId) },
  });

  await db.update(teams).set({ stripeCustomerId: customer.id }).where(eq(teams.id, teamId));
  return customer.id;
}

// ── Route handlers ─────────────────────────────────────────────────────────────

/** POST /api/billing/checkout — create a Stripe Checkout session */
export async function createCheckout(req: Request, res: Response) {
  if (!stripe) return res.status(503).json({ message: "Billing not configured" });

  const { plan } = req.body as { plan: string };
  const priceId = PLAN_TO_PRICE[plan];
  if (!priceId) return res.status(400).json({ message: "Unknown plan" });

  const user = req.user as any;
  const teamId = user.teamId as number;
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) return res.status(404).json({ message: "Team not found" });

  const customerId = await getOrCreateStripeCustomer(teamId, user.email, team.name);
  const appUrl = process.env.APP_URL ?? "http://localhost:5000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { teamId: String(teamId) },
    },
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { teamId: String(teamId), plan },
  });

  res.json({ url: session.url });
}

/** POST /api/billing/portal — redirect to Stripe billing portal */
export async function createPortalSession(req: Request, res: Response) {
  if (!stripe) return res.status(503).json({ message: "Billing not configured" });

  const user = req.user as any;
  const teamId = user.teamId as number;
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team?.stripeCustomerId) return res.status(400).json({ message: "No billing account found" });

  const appUrl = process.env.APP_URL ?? "http://localhost:5000";
  const session = await stripe.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${appUrl}/my-account`,
  });

  res.json({ url: session.url });
}

/** GET /api/billing/status — current team plan + subscription info */
export async function getBillingStatus(req: Request, res: Response) {
  const user = req.user as any;
  const teamId = user.teamId as number;
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) return res.status(404).json({ message: "Team not found" });

  res.json({
    planName: team.planName ?? "free",
    subscriptionStatus: team.subscriptionStatus ?? "active",
    currentPeriodEnd: team.currentPeriodEnd ?? null,
    trialEndsAt: team.trialEndsAt ?? null,
    stripeEnabled,
  });
}

/** POST /api/billing/webhook — Stripe webhook receiver */
export async function handleWebhook(req: Request, res: Response) {
  if (!stripe) return res.status(503).send("Billing not configured");

  const sig = req.headers["stripe-signature"] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const rawBody = (req as any).rawBody ?? req.body;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const getTeamId = (obj: any): number | null => {
    const id = obj?.metadata?.teamId;
    return id ? parseInt(id, 10) : null;
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const teamId = getTeamId(session);
        const plan = session.metadata?.plan ?? "starter";
        if (teamId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await db.update(teams).set({ stripeSubscriptionId: sub.id }).where(eq(teams.id, teamId));
          await applyPlanToTeam(teamId, plan, "active", new Date((sub as any).current_period_end * 1000).toISOString());
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const teamId = getTeamId(sub);
        if (teamId) {
          const priceId = (sub.items.data[0]?.price?.id) ?? "";
          const plan = PRICE_TO_PLAN[priceId] ?? "starter";
          const status = sub.status === "active" || sub.status === "trialing" ? "active" : sub.status;
          await applyPlanToTeam(teamId, plan, status, new Date((sub as any).current_period_end * 1000).toISOString());
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const teamId = getTeamId(sub);
        if (teamId) {
          await applyPlanToTeam(teamId, "free", "canceled");
          await db.update(teams).set({ stripeSubscriptionId: null }).where(eq(teams.id, teamId));
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = (invoice as any).subscription;
        if (sub) {
          const subscription = await stripe.subscriptions.retrieve(sub);
          const teamId = getTeamId(subscription);
          if (teamId) await db.update(teams).set({ subscriptionStatus: "past_due" }).where(eq(teams.id, teamId));
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
  }

  res.json({ received: true });
}
