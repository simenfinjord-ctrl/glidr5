import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { PublicNav } from "@/components/public-nav";
import {
  ClipboardList, BarChart3, Thermometer, Package, Watch, Camera,
  ChevronRight, Play, Pause, ArrowRight, Check, Zap,
} from "lucide-react";

/* ── Feature scenes ─────────────────────────────────────────────────────────── */

const SCENES = [
  {
    id: "tests",
    icon: <ClipboardList className="h-6 w-6" />,
    color: "from-blue-500 to-blue-600",
    accent: "blue",
    title: "Log tests in seconds",
    subtitle: "Structure or Glide · Brackets · Rank every ski",
    description: "Enter your entire test bracket in one view. Rank skis, record distances, add notes — all from a single screen. Works offline on the hill.",
    bullets: ["Glide & Structure test types", "Bracket-style ranking", "Ski-by-ski distance recording", "Offline sync when back online"],
    mockup: <TestMockup />,
  },
  {
    id: "weather",
    icon: <Thermometer className="h-6 w-6" />,
    color: "from-sky-500 to-cyan-500",
    accent: "sky",
    title: "Tie tests to conditions",
    subtitle: "Snow temp · Humidity · Track hardness",
    description: "Every test links to a weather snapshot: snow temperature, air temperature, humidity type, track hardness, grain size, and more. Your analytics become meaningful.",
    bullets: ["Full weather snapshot per test", "Auto-suggested from recent logs", "Snow humidity: dry / moist / wet", "Linked to every ranking"],
    mockup: <WeatherMockup />,
  },
  {
    id: "analytics",
    icon: <BarChart3 className="h-6 w-6" />,
    color: "from-violet-500 to-purple-600",
    accent: "violet",
    title: "Analytics that actually help",
    subtitle: "Win rates · Weather breakdowns · Combinations",
    description: "See which products win in which conditions. Filter by snow temperature, air humidity, track hardness, or location. Find your best wax combination for next race.",
    bullets: ["Win rate by snow & air temperature", "Best product combinations", "Median rank & consistency (σ)", "Per-location performance"],
    mockup: <AnalyticsMockup />,
  },
  {
    id: "products",
    icon: <Package className="h-6 w-6" />,
    color: "from-emerald-500 to-green-600",
    accent: "emerald",
    title: "Your product database",
    subtitle: "Full test history · Combinations · Stock",
    description: "Every product builds its own performance profile over time. See full test history, best conditions, and how it performs when combined with other products.",
    bullets: ["Full test history per product", "Performance in every condition", "Combination analysis", "Stock tracking"],
    mockup: <ProductsMockup />,
  },
  {
    id: "ai",
    icon: <Camera className="h-6 w-6" />,
    color: "from-orange-500 to-amber-500",
    accent: "orange",
    title: "AI photo entry",
    subtitle: "Photograph handwritten sheets · Instant import",
    description: "Photograph a handwritten test sheet and Glidr's AI extracts ski numbers, product names, and results — then matches them against your product database automatically.",
    bullets: ["Photograph any handwritten sheet", "Auto-matches your products", "Review before confirming", "Handles multiple products per ski"],
    mockup: <AIMockup />,
  },
  {
    id: "garmin",
    icon: <Watch className="h-6 w-6" />,
    color: "from-green-600 to-teal-600",
    accent: "green",
    title: "Garmin watch control",
    subtitle: "Hands-free · On the hill · Live bracket",
    description: "Generate a 4-digit session code in any runsheet. Open the Glidr app on your Garmin Forerunner or Fenix — and run your entire bracket from your wrist.",
    bullets: ["Forerunner 945, 970, Fenix 7/8", "Select winners live on slope", "Enter cm-behind distances", "No phone needed on the hill"],
    mockup: <GarminMockup />,
  },
];

/* ── Mock UI components ─────────────────────────────────────────────────────── */

function TestMockup() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((n) => (n + 1) % 4), 900);
    return () => clearInterval(t);
  }, []);
  const skis = [
    { n: 1, product: "Swix LF7", dist: "0 cm", rank: 1 },
    { n: 2, product: "Rode Moly", dist: "+3 cm", rank: 2 },
    { n: 3, product: "Toko HF Red", dist: "+7 cm", rank: 3 },
    { n: 4, product: "Rex HF", dist: "+12 cm", rank: 4 },
  ];
  return (
    <div className="rounded-xl bg-card border shadow-lg p-3 text-xs space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-foreground">Glide Test · 5km</span>
        <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-medium">Live</span>
      </div>
      {skis.map((s, i) => (
        <div key={s.n} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${active === i ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200/60" : "bg-muted/40"}`}>
          <span className={`font-bold w-4 text-center ${s.rank === 1 ? "text-amber-600" : "text-muted-foreground"}`}>{s.rank}</span>
          <span className="flex-1 text-foreground/80 truncate">{s.product}</span>
          <span className="text-muted-foreground font-mono">{s.dist}</span>
        </div>
      ))}
    </div>
  );
}

function WeatherMockup() {
  return (
    <div className="rounded-xl bg-card border shadow-lg p-3 text-xs">
      <div className="font-semibold text-foreground mb-3">Weather snapshot</div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Snow temp", value: "−4°C", color: "text-sky-600" },
          { label: "Air temp", value: "−2°C", color: "text-blue-600" },
          { label: "Humidity", value: "Moist", color: "text-cyan-600" },
          { label: "Track", value: "Medium", color: "text-amber-600" },
          { label: "Snow type", value: "Fine crystal", color: "text-indigo-600" },
          { label: "Wind", value: "Light NW", color: "text-teal-600" },
        ].map((w) => (
          <div key={w.label} className="rounded-lg bg-muted/40 px-2.5 py-2">
            <div className="text-muted-foreground text-[10px]">{w.label}</div>
            <div className={`font-semibold ${w.color}`}>{w.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsMockup() {
  const bars = [
    { label: "< −10°C", rank: 1.2, color: "bg-sky-500", win: true },
    { label: "−10−5°C", rank: 1.8, color: "bg-blue-500", win: false },
    { label: "−5−0°C", rank: 2.4, color: "bg-violet-400", win: false },
    { label: "> 0°C", rank: 3.1, color: "bg-purple-400", win: false },
  ];
  const max = 4;
  return (
    <div className="rounded-xl bg-card border shadow-lg p-3 text-xs">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-semibold text-foreground">Swix LF7 · Snow temp</span>
        <span className="ml-auto rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-medium">Best: &lt; −10°C</span>
      </div>
      <div className="space-y-1.5">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="w-16 text-muted-foreground text-[10px] shrink-0">{b.label}</span>
            <div className="flex-1 h-4 rounded bg-muted/40 overflow-hidden">
              <div
                className={`h-full rounded ${b.color} transition-all duration-700`}
                style={{ width: `${(b.rank / max) * 100}%` }}
              />
            </div>
            <span className={`w-8 text-right font-semibold ${b.win ? "text-amber-600" : "text-muted-foreground"}`}>{b.rank}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductsMockup() {
  const history = [
    { date: "12 Jan", loc: "Sjusjøen", rank: 1, snow: "−5°C", humid: "Dry" },
    { date: "8 Jan", loc: "Birkebeineren", rank: 2, snow: "−3°C", humid: "Moist" },
    { date: "3 Jan", loc: "Hafjell", rank: 1, snow: "−8°C", humid: "Dry" },
  ];
  return (
    <div className="rounded-xl bg-card border shadow-lg p-3 text-xs">
      <div className="font-semibold text-foreground mb-1">Swix LF7 · 12 tests</div>
      <div className="flex gap-3 mb-3 text-[10px]">
        <span className="text-emerald-600 font-semibold">Win rate 67%</span>
        <span className="text-muted-foreground">Avg rank 1.4</span>
      </div>
      <div className="space-y-1">
        {history.map((h) => (
          <div key={h.date} className="flex items-center gap-1.5 rounded-lg bg-muted/30 px-2 py-1.5">
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${h.rank === 1 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>{h.rank}</span>
            <span className="text-foreground/70 flex-1 truncate">{h.loc}</span>
            <span className="text-muted-foreground">{h.snow}</span>
            <span className="text-muted-foreground">{h.humid}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIMockup() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 3), 1400);
    return () => clearInterval(t);
  }, []);
  const steps = [
    <div key="photo" className="flex flex-col items-center justify-center gap-2 h-24 rounded-lg bg-muted/40 border-2 border-dashed border-muted-foreground/30">
      <Camera className="h-6 w-6 text-muted-foreground/50" />
      <span className="text-[10px] text-muted-foreground">Photograph sheet…</span>
    </div>,
    <div key="analyzing" className="flex flex-col items-center justify-center gap-2 h-24 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200/60">
      <div className="h-5 w-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      <span className="text-[10px] text-orange-700 dark:text-orange-400">AI analysing…</span>
    </div>,
    <div key="result" className="space-y-1.5">
      {[
        { ski: 1, product: "Swix LF7", rank: 1 },
        { ski: 2, product: "Rode Moly", rank: 2 },
        { ski: 3, product: "Toko HF Red", rank: 3 },
      ].map((r) => (
        <div key={r.ski} className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1.5 text-xs">
          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span className="font-medium text-foreground/80">Ski {r.ski}:</span>
          <span className="flex-1 text-muted-foreground truncate">{r.product}</span>
          <span className="text-amber-600 font-bold">#{r.rank}</span>
        </div>
      ))}
    </div>,
  ];
  return (
    <div className="rounded-xl bg-card border shadow-lg p-3 text-xs">
      <div className="font-semibold text-foreground mb-2">Add test from photo</div>
      <div className="min-h-[6.5rem]">{steps[step]}</div>
    </div>
  );
}

function GarminMockup() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const highlighted = tick % 4;
  return (
    <div className="flex gap-3 items-start">
      {/* Phone side */}
      <div className="flex-1 rounded-xl bg-card border shadow-lg p-3 text-xs">
        <div className="font-semibold text-foreground mb-2">Live runsheet</div>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 mb-1 transition-colors ${highlighted === n - 1 ? "bg-emerald-50 dark:bg-emerald-900/30 font-semibold" : "bg-muted/30"}`}>
            <span className="text-muted-foreground">Ski {n}</span>
            {highlighted === n - 1 && <span className="ml-auto rounded-full bg-emerald-600 text-white text-[9px] px-1.5 py-0.5">Active</span>}
          </div>
        ))}
      </div>
      {/* Watch */}
      <div className="w-20 shrink-0 rounded-2xl bg-zinc-900 border-2 border-zinc-700 shadow-xl p-2.5 text-center">
        <div className="text-[9px] text-zinc-400 mb-1.5">GLIDR</div>
        <div className="rounded-lg bg-zinc-800 p-2 mb-2">
          <div className="text-white text-[11px] font-bold">Ski {(highlighted % 4) + 1}</div>
          <div className="text-zinc-400 text-[9px]">Who won?</div>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <div className="rounded bg-emerald-600 text-white text-[9px] py-1 font-medium">✓ Win</div>
          <div className="rounded bg-zinc-700 text-zinc-300 text-[9px] py-1">Skip</div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────────── */

export default function Demo() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (!playing) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => setCurrent((n) => (n + 1) % SCENES.length), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  const scene = SCENES[current];

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* ── Hero ── */}
      <div className="bg-foreground text-background py-16 px-4 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/10 border border-background/20 px-4 py-1.5 text-xs font-medium mb-5">
            <Play className="h-3.5 w-3.5" />
            Interactive demo — no sign-up needed
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">See Glidr in action</h1>
          <p className="text-background/70 text-lg max-w-xl mx-auto mb-8">
            From logging a test on the hill to understanding which wax wins in which conditions — Glidr does it all.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/get-started" className="rounded-xl bg-background text-foreground px-8 py-3 font-semibold text-sm hover:bg-background/90 flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" />
              Start for free
            </Link>
            <Link href="/pricing" className="rounded-xl border border-background/30 text-background px-8 py-3 font-semibold text-sm hover:bg-background/10 flex items-center justify-center gap-2">
              View pricing
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Scene player ── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">

        {/* Tab strip */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-8 scrollbar-hide">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setCurrent(i); setPlaying(false); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all shrink-0 ${i === current ? `bg-gradient-to-r ${s.color} text-white shadow-md` : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {s.icon}
              <span className="hidden sm:inline">{s.title.split(" ").slice(0, 2).join(" ")}</span>
            </button>
          ))}
        </div>

        {/* Scene card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Text */}
          <div>
            <div className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${scene.color} text-white px-4 py-1.5 text-xs font-semibold mb-4`}>
              {scene.icon}
              {scene.subtitle}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{scene.title}</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">{scene.description}</p>
            <ul className="space-y-2">
              {scene.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm text-foreground/80">
                  <div className={`h-5 w-5 rounded-full bg-gradient-to-br ${scene.color} flex items-center justify-center shrink-0`}>
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Mockup */}
          <div className="rounded-2xl bg-muted/30 border p-6 shadow-inner">
            {scene.mockup}
          </div>
        </div>

        {/* Progress bar + controls */}
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex items-center justify-center h-9 w-9 rounded-full border bg-card hover:bg-muted transition-colors shrink-0"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="flex-1 flex gap-1.5">
            {SCENES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setCurrent(i); setPlaying(false); }}
                className={`flex-1 h-1.5 rounded-full transition-all ${i === current ? `bg-gradient-to-r ${s.color}` : "bg-muted-foreground/20"}`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{current + 1} / {SCENES.length}</span>
        </div>
      </div>

      {/* ── Feature grid ── */}
      <div className="bg-muted/30 py-16 px-4 border-y">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">Everything in one place</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { icon: "🎿", title: "Test ski series", desc: "Manage series of test skis with regrind history" },
              { icon: "🏔️", title: "Multiple locations", desc: "Log and compare across every venue" },
              { icon: "📊", title: "Head-to-head compare", desc: "Compare any two products over time" },
              { icon: "🔒", title: "Blind tester mode", desc: "Remove bias — testers don't see product names" },
              { icon: "📤", title: "Export", desc: "PDF, Excel, and Google Sheets backup" },
              { icon: "👤", title: "Team management", desc: "Add users with custom permissions per area" },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-4">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="font-semibold text-foreground text-sm mb-1">{f.title}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="py-20 px-4 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-8">Free forever for individuals. No credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login" className="rounded-xl bg-foreground text-background px-8 py-3 font-semibold text-sm hover:opacity-90 flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" />
              Create free account
            </Link>
            <Link href="/pricing" className="rounded-xl border px-8 py-3 font-semibold text-sm hover:bg-muted flex items-center justify-center gap-2 text-foreground">
              See pricing
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
