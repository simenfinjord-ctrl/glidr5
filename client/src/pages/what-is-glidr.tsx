import { AppLink } from "@/components/app-link";
import {
  DashboardAnim,
  TestsAnim,
  RunsheetAnim,
  AnalyticsAnim,
  WeatherAnim,
  TestSkisAnim,
  ProductsAnim,
  RaceSkisAnim,
  AdminAnim,
  MobileAnim,
} from "@/components/feature-animations";

const sections = [
  {
    title: "Dashboard & Live Results",
    description:
      "Your team's testing hub at a glance. Recent results auto-refresh every 10 seconds with winner highlights and medal badges. Instantly see which products are performing — gold, silver, and bronze rank badges make it clear who's on top.",
    anim: DashboardAnim,
  },
  {
    title: "Test Management",
    description:
      "Table-first workflow designed for speed on snow. Dynamic rounds, live ranking with competition rules (ties skip next numbers: 1-1-3), and support for Glide, Structure, Classic, Skating, Double Poling, and Grind test types. Filter by date, product, snow type, location, and temperature.",
    anim: TestsAnim,
  },
  {
    title: "Complete Runsheet",
    description:
      "Single-elimination tournament bracket for head-to-head ski pair testing. Enter distances, winners auto-advance, and cascading diff calculations show exactly how much each pair lost by. Mobile mode with large touch targets for glove use on snow.",
    anim: RunsheetAnim,
  },
  {
    title: "Analytics & Product Comparison",
    description:
      "Interactive charts powered by your data: product wins over time, average rank, tests per month, and temperature-vs-rank scatter. Compare products side-by-side with head-to-head stats, win rates, and methodology breakdowns.",
    anim: AnalyticsAnim,
  },
  {
    title: "Weather Documentation",
    description:
      "Log snow and air conditions — temperature, humidity, wind, precipitation, grain size, track hardness, and test quality. Weather auto-links to tests by matching date, location, and group. The Suggestions engine uses your historical data to recommend products for any conditions.",
    anim: WeatherAnim,
  },
  {
    title: "Test Ski Series",
    description:
      "Organize testing around ski series with brand, ski type, and pair labels. Track regrind history per series. Series filter by test type so you always work with the right set. Click into any series to see all associated tests and results.",
    anim: TestSkisAnim,
  },
  {
    title: "Product Inventory & Stock",
    description:
      "Centralized product catalog with stock tracking. Quick +/− buttons for inventory, color-coded stock levels (red/amber/green), change audit log, and group filtering. Switch between list and storage view to manage your wax room.",
    anim: ProductsAnim,
  },
  {
    title: "Race Ski & Athlete Management",
    description:
      "Full athlete profiles with ski inventory: serial numbers, brands, disciplines, construction, grinds, and more. Track regrind history with automatic updates. Archive/restore skis. Access control per athlete — only authorized users see the data.",
    anim: RaceSkisAnim,
  },
  {
    title: "Admin & Team Security",
    description:
      "Built for commercial multi-team SaaS: complete data isolation, three role levels (Super Admin, Team Admin, Member), and granular permissions across 10 areas. Blind Tester mode, activity logging, and per-team feature control.",
    anim: AdminAnim,
  },
  {
    title: "Mobile & Offline Ready",
    description:
      "Responsive design works on any device. Enter data without internet — on the mountain, in the wax cabin, wherever you are. Changes queue locally and sync automatically when you're back online.",
    anim: MobileAnim,
  },
];

export default function WhatIsGlidr() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        <div className="text-center mb-16">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4"
            data-testid="heading-what-is-glidr"
          >
            What is Glidr?
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The ski testing and documentation platform that streamlines product development for competitive teams.
          </p>
        </div>

        <div className="space-y-24">
          {sections.map((s, i) => {
            const reversed = i % 2 === 1;
            const Anim = s.anim;
            const isMobile = i === sections.length - 1;
            return (
              <div
                key={i}
                className={`flex flex-col ${reversed ? "md:flex-row-reverse" : "md:flex-row"} gap-8 items-center`}
                data-testid={`section-feature-${i}`}
              >
                <div className={isMobile ? "md:w-1/3 flex justify-center" : "md:w-3/5"}>
                  <Anim />
                </div>
                <div className={isMobile ? "md:w-2/3" : "md:w-2/5"}>
                  <h2 className="text-2xl font-bold text-foreground mb-3">
                    {s.title}
                  </h2>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-24 text-center border-t border-border pt-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Plus everything else you need
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-sm text-muted-foreground">
            {[
              "Blind Tester Mode",
              "Google Sheets Backup",
              "PDF & Excel Export",
              "Dark Mode",
              "Duplicate Tests",
              "Feeling & Kick Rank",
              "Multiple Products/Line",
              "Live Runsheet Monitor",
              "Grinding Records",
              "Stock Management",
              "Group Management",
              "Activity Logging",
              "Suggestions Engine",
              "Complete Runsheet Bracket",
              "Date & Sort Filters",
              "Admin Data Tools",
            ].map((f) => (
              <div
                key={f}
                className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 text-center font-medium"
              >
                {f}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex justify-center gap-6 text-xs text-muted-foreground">
          <AppLink href="/pricing" testId="link-pricing-from-features" className="underline hover:text-foreground">
            Pricing
          </AppLink>
          <AppLink href="/legal" testId="link-legal-from-features" className="underline hover:text-foreground">
            Terms of Service & Privacy Policy
          </AppLink>
        </div>
      </div>
    </div>
  );
}
