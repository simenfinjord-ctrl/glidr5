import { Check, Watch, Zap, Users, Trophy, Building2, ArrowRight, X } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { PublicNav } from "@/components/public-nav";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    period: "",
    tagline: "For the enthusiastic home wax technician.",
    color: "border-border",
    badge: null,
    icon: <Zap className="h-5 w-5 text-muted-foreground" />,
    features: [
      "1 user",
      "Core tests (Glide & Structure)",
      "Product catalog",
      "Weather logging",
      "Test history",
    ],
    limits: [
      "Up to 30 tests",
      "No analytics",
      "No export",
      "No Garmin integration",
    ],
    cta: "Get started free",
    ctaStyle: "bg-muted text-foreground hover:bg-muted/80",
    stripeId: null,
  },
  {
    id: "starter",
    name: "Starter",
    price: "€25",
    period: "/month",
    tagline: "For a club team getting started with structured testing.",
    color: "border-border",
    badge: null,
    icon: <Users className="h-5 w-5 text-blue-500" />,
    features: [
      "Up to 3 users",
      "Unlimited tests",
      "Product catalog & stock tracking",
      "Weather logging",
      "PDF export",
      "Dark mode",
    ],
    limits: [
      "No analytics",
      "No Garmin integration",
      "No race ski module",
    ],
    cta: "Start 14-day trial",
    ctaStyle: "bg-muted text-foreground hover:bg-muted/80",
    stripeId: "starter",
  },
  {
    id: "team",
    name: "Team",
    price: "€79",
    period: "/month",
    tagline: "For competitive teams that need the full picture.",
    color: "border-emerald-500 ring-2 ring-emerald-500/20",
    badge: "Most popular",
    icon: <Trophy className="h-5 w-5 text-emerald-500" />,
    features: [
      "Up to 10 users",
      "Everything in Starter, plus:",
      "Full analytics & product comparison",
      "Grinding records",
      "AI test entry (photo)",
      "Garmin watch integration",
      "Mobile runsheet mode",
      "Runsheet brackets",
      "PDF & Excel export",
      "Offline mode with auto-sync",
      "Google Sheets backup",
      "Blind tester mode",
      "Suggestions engine",
    ],
    limits: [],
    cta: "Start 14-day trial",
    ctaStyle: "bg-emerald-600 text-white hover:bg-emerald-700",
    stripeId: "team",
  },
  {
    id: "pro",
    name: "Pro",
    price: "€149",
    period: "/month",
    tagline: "For national teams and organizations with athletes.",
    color: "border-border",
    badge: null,
    icon: <Trophy className="h-5 w-5 text-violet-500" />,
    features: [
      "Up to 25 users",
      "Everything in Team, plus:",
      "Race ski & athlete management",
      "Ski inventory with regrind tracking",
      "Athlete access control & sharing",
      "Live runsheet monitoring",
      "Activity logging & audit trail",
      "Column visibility control",
      "Priority support",
    ],
    limits: [],
    cta: "Start 14-day trial",
    ctaStyle: "bg-foreground text-background hover:opacity-90",
    stripeId: "pro",
  },
  {
    id: "federation",
    name: "Federation",
    price: "Custom",
    period: "",
    tagline: "For multi-team organizations and ski industry brands.",
    color: "border-border",
    badge: null,
    icon: <Building2 className="h-5 w-5 text-amber-500" />,
    features: [
      "Unlimited teams & users",
      "Everything in Pro, plus:",
      "Multi-team data isolation",
      "Custom group structures",
      "Bulk data export",
      "Custom SLA & support",
      "Dedicated onboarding",
    ],
    limits: [],
    cta: "Contact us",
    ctaStyle: "bg-muted text-foreground hover:bg-muted/80",
    stripeId: null,
  },
];

const COMPARISON = [
  { feature: "Users", free: "1", starter: "3", team: "10", pro: "25", federation: "Unlimited" },
  { feature: "Tests", free: "30", starter: "Unlimited", team: "Unlimited", pro: "Unlimited", federation: "Unlimited" },
  { feature: "Products & weather", free: "✓", starter: "✓", team: "✓", pro: "✓", federation: "✓" },
  { feature: "Analytics", free: "—", starter: "—", team: "✓", pro: "✓", federation: "✓" },
  { feature: "PDF export", free: "—", starter: "✓", team: "✓", pro: "✓", federation: "✓" },
  { feature: "Excel export", free: "—", starter: "—", team: "✓", pro: "✓", federation: "✓" },
  { feature: "Grinding records", free: "—", starter: "—", team: "✓", pro: "✓", federation: "✓" },
  { feature: "AI photo entry", free: "—", starter: "—", team: "✓", pro: "✓", federation: "✓" },
  { feature: "Garmin watch", free: "—", starter: "—", team: "✓", pro: "✓", federation: "✓" },
  { feature: "Blind tester mode", free: "—", starter: "—", team: "✓", pro: "✓", federation: "✓" },
  { feature: "Race ski management", free: "—", starter: "—", team: "—", pro: "✓", federation: "✓" },
  { feature: "Live runsheet monitor", free: "—", starter: "—", team: "—", pro: "✓", federation: "✓" },
  { feature: "Athlete management", free: "—", starter: "—", team: "—", pro: "✓", federation: "✓" },
  { feature: "Multi-team support", free: "—", starter: "—", team: "—", pro: "—", federation: "✓" },
];

const FAQS = [
  {
    q: "Can I start for free without a credit card?",
    a: "Yes. The Free plan requires no payment details. Sign up, log in, and start testing immediately.",
  },
  {
    q: "What happens after my 14-day trial?",
    a: "You'll be asked to enter payment details. If you don't, your account reverts to the Free plan — your data is never deleted.",
  },
  {
    q: "Can I change plans at any time?",
    a: "Yes. Upgrades take effect immediately. Downgrades apply at the end of your billing cycle. Data is never lost when changing plans.",
  },
  {
    q: "Who owns my data?",
    a: "You do. Every byte of data you enter in Glidr belongs to your team. You can export everything at any time. We never sell, share, or use your data.",
  },
  {
    q: "How does the Garmin watch integration work?",
    a: "Generate a 4-digit session code in any active runsheet, enter it on your Garmin Forerunner 945/970 or Fenix 7/8, and run brackets hands-free on the hill.",
  },
  {
    q: "Is annual billing available?",
    a: "Yes — 20% discount on all paid plans. Contact us to switch to annual billing.",
  },
  {
    q: "What is a 'team'?",
    a: "A team is one organization with its own isolated data space — users, tests, products, weather, and settings. Teams never share data with each other.",
  },
  {
    q: "Can I delete my account and all data?",
    a: "Yes. You can request full deletion from your account settings at any time. We delete all personal data within 30 days, in accordance with GDPR.",
  },
];

function PlanCard({ plan }: { plan: typeof PLANS[0] }) {
  const href = plan.id === "free"
    ? "/get-started"
    : `/contact?plan=${plan.id}`;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm ${plan.color}`}
      data-testid={`pricing-tier-${plan.id}`}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-medium text-white whitespace-nowrap">
          {plan.badge}
        </div>
      )}

      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          {plan.icon}
          <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
        </div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-3xl font-bold text-foreground">{plan.price}</span>
          {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{plan.tagline}</p>
      </div>

      <ul className="flex-1 space-y-2 mb-6 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500" />
            <span className="text-foreground/80">{f}</span>
          </li>
        ))}
        {plan.limits.map((l) => (
          <li key={l} className="flex items-start gap-2">
            <X className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground/40" />
            <span className="text-muted-foreground/50">{l}</span>
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-center transition-all flex items-center justify-center gap-2 ${plan.ctaStyle}`}
        data-testid={`button-${plan.id}-cta`}
      >
        {plan.cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-4">
            <Zap className="h-3.5 w-3.5" />
            Free forever for individuals
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4" data-testid="heading-pricing">
            Pricing for everyone
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From a parent waxing their kid's skis to a national federation managing dozens of teams.
            Start free, scale when you're ready.
          </p>
        </div>

        {/* Garmin callout */}
        <div className="mb-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 ring-1 ring-emerald-500/10">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Watch className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <span className="font-bold text-foreground text-sm">Garmin Watch Integration</span>
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">Exclusive</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                The only ski testing platform with native Garmin support. Run your entire bracket hands-free on the hill from your wrist. Included on Team & above.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["Forerunner 945", "Forerunner 970", "Fenix 7 Pro", "Fenix 8", "Epix 2 Pro"].map((d) => (
                  <span key={d} className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">{d}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-20">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        {/* Comparison table */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-foreground text-center mb-2" data-testid="heading-comparison">
            Plan comparison
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-8">All the details at a glance</p>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className="text-center px-3 py-3 font-semibold text-foreground">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="px-4 py-2.5 font-medium text-foreground/80">{row.feature}</td>
                    {(["free", "starter", "team", "pro", "federation"] as const).map((plan) => (
                      <td key={plan} className="px-3 py-2.5 text-center">
                        {row[plan] === "✓" ? (
                          <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                        ) : row[plan] === "—" ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          <span className="text-foreground/70 font-medium text-xs">{row[plan]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mb-20">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl border bg-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-medium text-sm hover:bg-muted/30 transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="text-muted-foreground shrink-0">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="rounded-2xl bg-foreground text-background p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to get started?</h2>
          <p className="text-background/70 mb-8 max-w-md mx-auto text-sm">
            Free forever for individuals. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/get-started"
              className="rounded-xl bg-background text-foreground px-8 py-3 font-semibold text-sm hover:bg-background/90 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Start for free
            </Link>
            <Link
              href="/demo"
              className="rounded-xl border border-background/30 text-background px-8 py-3 font-semibold text-sm hover:bg-background/10 transition-colors flex items-center justify-center gap-2"
            >
              Watch the demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
