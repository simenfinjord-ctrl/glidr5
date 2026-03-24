import { AppLink } from "@/components/app-link";

const sections = [
  {
    title: "Fast On-Snow Data Entry",
    description:
      "Table-first workflow designed for speed. Enter test results directly on the mountain with dynamic rounds, live ranking (competition rules: ties skip next numbers), and medal badges. Support for Glide, Structure, Classic, Skating, Double Poling, and Grind test types. Filter, sort, and compare instantly.",
    image: "/images/glidr-hero.png",
    alt: "Glidr dashboard showing test data tables and rankings",
  },
  {
    title: "Tournament Bracket Runsheets",
    description:
      "Single-elimination bracket system for head-to-head ski pair testing. Visual bracket display from Final down through Semi-Finals and Quarter-Finals. Enter distances, winners auto-advance, cascading diff calculations run automatically, and results feed straight back into your test entries.",
    image: "/images/glidr-runsheet.png",
    alt: "Tournament bracket system for ski testing",
  },
  {
    title: "Smartwatch & Mobile Integration",
    description:
      "Connect a Garmin smartwatch directly to a live runsheet session with a 6-digit code. Select winners and enter distances using physical buttons — results sync to the web bracket in real time. Mobile Mode provides a full-screen interface with large touch targets designed for glove use.",
    image: "/images/glidr-watch.png",
    alt: "Smartwatch syncing test data to Glidr",
  },
  {
    title: "Race Ski & Athlete Management",
    description:
      "Full athlete profiles with ski inventory tracking: serial numbers, brands, disciplines, construction, grinds, and more. Track regrind history with automatic grind field updates. Archive and restore skis. Control access per athlete — only authorized users see the data.",
    image: "/images/glidr-raceskis.png",
    alt: "Race ski inventory management system",
  },
  {
    title: "Analytics & Insights",
    description:
      "Interactive charts powered by your own data: product wins over time, average rank, tests per month, and temperature-vs-rank scatter plots. Compare products side-by-side with head-to-head stats. Search any product for detailed win rate, methodology breakdown, and performance history.",
    image: "/images/glidr-analytics.png",
    alt: "Analytics dashboard with performance charts",
  },
  {
    title: "Weather Documentation",
    description:
      "Log snow and air conditions — temperature, humidity, wind, precipitation, grain size, track hardness, and test quality. Weather records auto-link to tests by matching date, location, and group. The Suggestions engine uses your historical weather data to recommend products for any conditions.",
    image: "/images/glidr-weather.png",
    alt: "Weather logging and monitoring interface",
  },
  {
    title: "Multi-Team Security & Permissions",
    description:
      "Built for commercial SaaS: complete data isolation between teams, three role levels (Super Admin, Team Admin, Member), and granular permissions across 10 functional areas. Blind Tester mode hides product identities for unbiased testing. Incognito mode, activity logging, and per-team feature control.",
    image: "/images/glidr-security.png",
    alt: "Security and permission management",
  },
  {
    title: "Works Offline",
    description:
      "Enter data without internet — on the mountain, in the wax cabin, wherever you are. Service workers cache the app, IndexedDB queues your changes, and everything syncs automatically when you're back online. A status indicator and pending count keep you informed.",
    image: "/images/glidr-offline.png",
    alt: "Offline mode with data syncing",
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
            The ski testing and documentation platform that streamlines product development
            for competitive teams.
          </p>
        </div>

        <div className="space-y-20">
          {sections.map((s, i) => {
            const reversed = i % 2 === 1;
            return (
              <div
                key={i}
                className={`flex flex-col ${reversed ? "md:flex-row-reverse" : "md:flex-row"} gap-8 items-center`}
                data-testid={`section-feature-${i}`}
              >
                <div className="md:w-1/2">
                  <img
                    src={s.image}
                    alt={s.alt}
                    className="w-full rounded-xl shadow-lg border border-border"
                    loading={i < 2 ? "eager" : "lazy"}
                  />
                </div>
                <div className="md:w-1/2">
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

        <div className="mt-20 text-center border-t border-border pt-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Plus everything else you need
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-sm text-muted-foreground">
            {[
              "Test Ski Series",
              "Product Inventory",
              "Stock Management",
              "Grinding Records",
              "Google Sheets Backup",
              "PDF & Excel Export",
              "Dark Mode",
              "Duplicate Tests",
              "Feeling & Kick Rank",
              "Multiple Products/Line",
              "Date & Sort Filters",
              "Live Runsheet Monitor",
              "Dashboard Widgets",
              "Group Management",
              "Activity Logging",
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

        <div className="mt-16 text-center">
          <p className="text-xs text-muted-foreground">
            <AppLink href="/legal" testId="link-legal-from-features" className="underline hover:text-foreground">
              Terms of Service & Privacy Policy
            </AppLink>
          </p>
        </div>
      </div>
    </div>
  );
}
