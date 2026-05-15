import { useState } from "react";
import { X, ChevronRight, ChevronLeft, Zap, ClipboardList, Thermometer, BarChart3, Watch, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

const STEPS = [
  {
    id: "welcome",
    icon: <Zap className="h-8 w-8 text-emerald-500" />,
    title: "Velkommen til Glidr!",
    subtitle: "Ski-testing gjort enkelt.",
    body: "Glidr hjelper deg med å logge ski-tester, knytte resultater til vær og føre, og forstå hva som fungerer — og når.",
    visual: (
      <div className="grid grid-cols-3 gap-2 w-full">
        {[
          { label: "Tester", value: "0", icon: "🎿", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600" },
          { label: "Produkter", value: "0", icon: "📦", color: "bg-violet-50 dark:bg-violet-900/20 text-violet-600" },
          { label: "Sesonger", value: "0", icon: "🏔️", color: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl p-3 text-center ${c.color} border`}>
            <div className="text-xl mb-0.5">{c.icon}</div>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-[11px] font-medium opacity-70">{c.label}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "products",
    icon: <ClipboardList className="h-8 w-8 text-blue-500" />,
    title: "Legg til produkter",
    subtitle: "Voks, grinds, glider — alt du tester.",
    body: "Glidr lager en database over produktene ditt lag tester. Gå til «Produkter» og legg inn de du bruker oftest. Hvert produkt bygger opp sin egen prestasjonshistorikk over tid.",
    visual: (
      <div className="rounded-xl border bg-muted/30 p-3 text-xs space-y-1.5">
        {[
          { brand: "Swix", name: "LF7 Blue", cat: "Glide" },
          { brand: "Rode", name: "Moly Powder", cat: "Glide" },
          { brand: "Toko", name: "HF Red", cat: "Glide" },
        ].map((p) => (
          <div key={p.name} className="flex items-center gap-2 rounded-lg bg-background border px-3 py-2">
            <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-700">{p.brand[0]}</div>
            <span className="font-medium text-foreground flex-1">{p.brand} {p.name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{p.cat}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 px-3 py-2 text-muted-foreground/50">
          <span className="text-lg leading-none">+</span>
          <span>Legg til produkt…</span>
        </div>
      </div>
    ),
  },
  {
    id: "weather",
    icon: <Thermometer className="h-8 w-8 text-sky-500" />,
    title: "Logg vær og føre",
    subtitle: "Resultater uten kontekst betyr ingenting.",
    body: "Gå til «Vær» og logg forholdene før du tester. Snøtemperatur, lufttemperatur, fuktighetstype og sporhard er de viktigste feltene. Glidr kobler automatisk tester til riktig værmåling.",
    visual: (
      <div className="rounded-xl border bg-card p-3 text-xs">
        <div className="font-semibold text-foreground mb-2.5">Ny værmåling</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Snøtemp", placeholder: "−4°C", color: "border-sky-200 bg-sky-50 dark:bg-sky-900/20" },
            { label: "Lufttemp", placeholder: "−2°C", color: "border-blue-200 bg-blue-50 dark:bg-blue-900/20" },
            { label: "Fuktighet", placeholder: "Fuktig", color: "border-cyan-200 bg-cyan-50 dark:bg-cyan-900/20" },
            { label: "Sporhard", placeholder: "Medium", color: "border-amber-200 bg-amber-50 dark:bg-amber-900/20" },
          ].map((f) => (
            <div key={f.label} className={`rounded-lg border px-2.5 py-2 ${f.color}`}>
              <div className="text-[10px] text-muted-foreground mb-0.5">{f.label}</div>
              <div className="font-medium text-foreground/60">{f.placeholder}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "tests",
    icon: <ClipboardList className="h-8 w-8 text-violet-500" />,
    title: "Logg din første test",
    subtitle: "Velg ski-serie, rank resultatene, lagre.",
    body: "Gå til «Tester» → «Ny test». Velg test-ski-serien din, lenk til dagens værmåling og fyll inn resultatene. Glidr støtter glidetester, strukturtester og mer — med bracket-modus for store grupper.",
    visual: (
      <div className="rounded-xl border bg-card p-3 text-xs space-y-1.5">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-foreground">Glidetesting · 5km</span>
          <span className="ml-auto text-[10px] text-muted-foreground">Sjusjøen · 12. jan</span>
        </div>
        {[
          { n: 1, p: "Swix LF7", rank: 1, dist: "0 cm" },
          { n: 2, p: "Rode Moly", rank: 2, dist: "+3 cm" },
          { n: 3, p: "Toko HF Red", rank: 3, dist: "+7 cm" },
        ].map((r) => (
          <div key={r.n} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
            <span className={`font-bold w-4 text-center ${r.rank === 1 ? "text-amber-600" : "text-muted-foreground"}`}>{r.rank}</span>
            <span className="flex-1 text-foreground/80">{r.p}</span>
            <span className="font-mono text-muted-foreground">{r.dist}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "analytics",
    icon: <BarChart3 className="h-8 w-8 text-amber-500" />,
    title: "Utforsk Analytics",
    subtitle: "Finn mønsteret i dataene dine.",
    body: "Etter noen tester begynner Analytics å vise nyttige mønstre: hvilke produkter vinner i hvilke temperaturer, beste kombinasjoner, og konsistens over tid. Jo mer du logger, jo bedre blir svarene.",
    visual: (
      <div className="rounded-xl border bg-card p-3 text-xs">
        <div className="font-semibold text-foreground mb-3">Oversikt</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { label: "Tester", v: "0", icon: "📋" },
            { label: "Produkter", v: "0", icon: "📦" },
            { label: "Seire", v: "0", icon: "🏆" },
            { label: "Med værmåling", v: "0%", icon: "🌡️" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-muted/40 px-2.5 py-2 text-center">
              <div className="text-base mb-0.5">{s.icon}</div>
              <div className="font-bold text-foreground">{s.v}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 px-3 py-2 text-emerald-700 dark:text-emerald-400 text-[11px]">
          Logg 5+ tester med vær for å se de første mønstrene 🎿
        </div>
      </div>
    ),
  },
  {
    id: "done",
    icon: <Check className="h-8 w-8 text-emerald-500" />,
    title: "Du er klar!",
    subtitle: "Start testingen.",
    body: "Du har alt du trenger for å komme i gang. Glidr er best når du logger konsekvent — hver test gjør analysene bedre. Lykke til på sporet!",
    visual: (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Check className="h-10 w-10 text-emerald-600" />
        </div>
        <div className="text-sm font-semibold text-foreground">Oppsett fullført!</div>
        <div className="flex flex-col gap-2 w-full text-xs">
          {[
            { label: "Legg til produkter", href: "/products" },
            { label: "Logg vær og føre", href: "/weather" },
            { label: "Opprett ny test", href: "/tests/new" },
          ].map((a) => (
            <Link key={a.label} href={a.href} className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-2.5 font-medium text-foreground hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    ),
  },
];

export default function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  async function finish() {
    try {
      await apiRequest("PATCH", "/api/account/onboarding", {});
    } catch {}
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border bg-card shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Close */}
        <button
          onClick={finish}
          className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Lukk"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 pt-5">
          {/* Step counter */}
          <div className="flex items-center gap-1.5 mb-5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "flex-1 bg-emerald-500" : i < step ? "w-4 bg-emerald-300" : "w-4 bg-muted-foreground/20"}`}
              />
            ))}
          </div>

          {/* Icon + title */}
          <div className="flex items-center gap-3 mb-1">
            {current.icon}
            <div>
              <div className="font-bold text-foreground text-lg leading-tight">{current.title}</div>
              <div className="text-sm text-muted-foreground">{current.subtitle}</div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mt-3 mb-5">{current.body}</p>

          {/* Visual */}
          <div className="mb-6">{current.visual}</div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && !isLast && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1 rounded-xl border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Tilbake
              </button>
            )}
            {isLast ? (
              <button
                onClick={finish}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                <Zap className="h-4 w-4" />
                Kom i gang!
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-foreground text-background px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Neste
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {!isLast && (
            <button onClick={finish} className="w-full mt-2 text-xs text-center text-muted-foreground hover:text-foreground transition-colors py-1">
              Hopp over introduksjonen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
