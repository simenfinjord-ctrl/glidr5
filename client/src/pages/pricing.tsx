import { Check } from "lucide-react";

const tiers = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "For small teams getting started with structured ski testing.",
    color: "border-border",
    badge: null,
    features: [
      "1 team, up to 3 users",
      "Glide & Structure test types",
      "Up to 50 tests",
      "Basic test results table",
      "Weather logging",
      "Product catalog (up to 20)",
      "PDF export",
      "Dark mode",
    ],
    limits: [
      "No analytics",
      "No race ski module",
      "No runsheet brackets",
      "No offline mode",
      "Community support",
    ],
    cta: "Get started",
    ctaStyle: "bg-muted text-foreground hover:bg-muted/80",
  },
  {
    name: "Team",
    price: "$49",
    period: "/month per team",
    description: "For competitive teams that need full testing capabilities.",
    color: "border-blue-500 ring-2 ring-blue-500/20",
    badge: "Most popular",
    features: [
      "1 team, up to 10 users",
      "All 6 test types",
      "Unlimited tests",
      "Complete Runsheet brackets",
      "Garmin smartwatch integration",
      "Mobile runsheet mode",
      "Full analytics & product comparison",
      "Weather auto-linking & suggestions",
      "Product inventory & stock tracking",
      "Test ski series management",
      "Grinding records",
      "PDF & Excel export",
      "Offline mode with auto-sync",
      "Google Sheets backup",
      "Blind tester mode",
      "Email support",
    ],
    limits: [],
    cta: "Start free trial",
    ctaStyle: "bg-blue-600 text-white hover:bg-blue-700",
  },
  {
    name: "Pro",
    price: "$89",
    period: "/month per team",
    description: "For national teams and organizations with athlete management needs.",
    color: "border-border",
    badge: null,
    features: [
      "1 team, up to 25 users",
      "Everything in Team, plus:",
      "Race ski & athlete management",
      "Ski inventory with regrind tracking",
      "Athlete access control & sharing",
      "Race ski testing workflows",
      "Live runsheet monitoring",
      "Activity logging & audit trail",
      "Configurable column visibility",
      "Priority support",
    ],
    limits: [],
    cta: "Start free trial",
    ctaStyle: "bg-foreground text-background hover:opacity-90",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For multi-team organizations and ski industry brands.",
    color: "border-border",
    badge: null,
    features: [
      "Unlimited teams & users",
      "Everything in Pro, plus:",
      "Multi-team data isolation",
      "Super Admin cross-team access",
      "Per-team feature control",
      "Team Admin role management",
      "Custom group structures",
      "Bulk data export (PDF, Excel)",
      "Admin danger zone tools",
      "SSO integration (roadmap)",
      "Dedicated support & onboarding",
      "Custom SLA",
    ],
    limits: [],
    cta: "Contact sales",
    ctaStyle: "bg-muted text-foreground hover:bg-muted/80",
  },
];

const faqs = [
  {
    q: "What counts as a 'team'?",
    a: "A team is one organization with its own isolated data space. Each team has its own users, tests, products, weather logs, and settings. Data is never shared between teams.",
  },
  {
    q: "Can we try before we buy?",
    a: "Yes. Team and Pro plans include a 14-day free trial with full access to all features. No credit card required to start.",
  },
  {
    q: "Who owns the data?",
    a: "Your team owns all data entered into Glidr. We never sell, share, or use your data for any purpose other than providing the service. You can export everything at any time.",
  },
  {
    q: "Can we add more users later?",
    a: "Yes. You can upgrade plans or purchase additional user seats at any time. Contact us for custom user counts beyond the standard tiers.",
  },
  {
    q: "Does offline mode work on all plans?",
    a: "Offline mode is available on Team, Pro, and Enterprise plans. It caches the app and queues data entry for automatic sync when you're back online.",
  },
  {
    q: "What about annual billing?",
    a: "Annual billing is available at a 20% discount. Contact us for annual pricing on any plan.",
  },
  {
    q: "Can we switch plans?",
    a: "You can upgrade or downgrade at any time. Changes take effect at the start of your next billing cycle. Data is never lost when changing plans.",
  },
  {
    q: "Is our testing data safe?",
    a: "We treat ski testing data as trade secrets. All connections are encrypted (HTTPS/TLS), passwords are hashed, and data is isolated per team. Blind tester mode adds an extra layer of confidentiality.",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="text-center mb-16">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4"
            data-testid="heading-pricing"
          >
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From a single club team to a multi-brand organization. Pick the plan that fits your operation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm ${t.color}`}
              data-testid={`pricing-tier-${t.name.toLowerCase()}`}
            >
              {t.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white">
                  {t.badge}
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-foreground">{t.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">{t.price}</span>
                  {t.period && <span className="text-sm text-muted-foreground">{t.period}</span>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
              </div>

              <ul className="flex-1 space-y-2 mb-6">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                    <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                    <span>{f}</span>
                  </li>
                ))}
                {t.limits.map((l) => (
                  <li key={l} className="flex items-start gap-2 text-sm text-muted-foreground/60">
                    <span className="h-4 w-4 mt-0.5 flex-shrink-0 text-center">—</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${t.ctaStyle}`}
                data-testid={`button-${t.name.toLowerCase()}-cta`}
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-16">
          <h2 className="text-2xl font-bold text-foreground text-center mb-2" data-testid="heading-comparison">
            Plan comparison
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-8">All the details at a glance</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-comparison">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-4 font-medium text-foreground w-1/3">Feature</th>
                  <th className="text-center py-3 px-2 font-medium text-foreground">Starter</th>
                  <th className="text-center py-3 px-2 font-medium text-blue-600">Team</th>
                  <th className="text-center py-3 px-2 font-medium text-foreground">Pro</th>
                  <th className="text-center py-3 px-2 font-medium text-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["Users", "3", "10", "25", "Unlimited"],
                  ["Teams", "1", "1", "1", "Unlimited"],
                  ["Tests", "50", "Unlimited", "Unlimited", "Unlimited"],
                  ["Products", "20", "Unlimited", "Unlimited", "Unlimited"],
                  ["Test types", "Glide, Structure", "All 6", "All 6", "All 6"],
                  ["Runsheet brackets", "—", "✓", "✓", "✓"],
                  ["Smartwatch mode", "—", "✓", "✓", "✓"],
                  ["Analytics", "—", "✓", "✓", "✓"],
                  ["Offline mode", "—", "✓", "✓", "✓"],
                  ["Race ski management", "—", "—", "✓", "✓"],
                  ["Athlete profiles", "—", "—", "✓", "✓"],
                  ["Live runsheet monitor", "—", "—", "✓", "✓"],
                  ["Multi-team support", "—", "—", "—", "✓"],
                  ["Per-team feature control", "—", "—", "—", "✓"],
                  ["SSO", "—", "—", "—", "Roadmap"],
                  ["Support", "Community", "Email", "Priority", "Dedicated"],
                ].map(([feature, ...vals]) => (
                  <tr key={feature}>
                    <td className="py-2.5 pr-4 text-foreground/80">{feature}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`py-2.5 px-2 text-center ${v === "✓" ? "text-emerald-500 font-bold" : v === "—" ? "text-muted-foreground/40" : "text-foreground/70"}`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-border mt-16 pt-16">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8" data-testid="heading-faq">
            Frequently asked questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center border-t border-border pt-8">
          <p className="text-sm text-muted-foreground mb-4">
            All plans include encrypted connections, daily backups, and GDPR compliance.
          </p>
          <div className="flex justify-center gap-6 text-xs text-muted-foreground">
            <a href="/what-is-glidr" className="underline hover:text-foreground" data-testid="link-features-from-pricing">What is Glidr?</a>
            <a href="/legal" className="underline hover:text-foreground" data-testid="link-legal-from-pricing">Legal & Privacy</a>
          </div>
        </div>
      </div>
    </div>
  );
}
