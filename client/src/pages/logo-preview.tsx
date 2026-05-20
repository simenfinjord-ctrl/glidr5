// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { GlidrIcon, GlidrIconCircle, GlidrMark, GlidrWordmark, GlidrLogo } from "@/components/glidr-logo";

const SIZES = [20, 28, 36, 48, 64];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">{label}</p>
      <div className="flex flex-wrap items-end gap-6">{children}</div>
    </div>
  );
}

function Tile({ bg = "bg-white", children, label }: { bg?: string; children: React.ReactNode; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${bg} rounded-xl p-5 flex items-center justify-center border border-border`}>
        {children}
      </div>
      {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
    </div>
  );
}

export default function LogoPreview() {
  return (
    <div className="min-h-screen bg-background p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Glidr — Logo variants</h1>
      <p className="text-sm text-muted-foreground mb-10">Interne utkast. Velg variant i app-shell.tsx.</p>

      {/* ── Variant A: Rounded square badge ── */}
      <Row label="A — Rounded square (current)">
        {SIZES.map(s => (
          <Tile key={s} label={`${s}px`}>
            <GlidrIcon style={{ width: s, height: s }} />
          </Tile>
        ))}
      </Row>

      {/* ── Variant B: Circle badge ── */}
      <Row label="B — Circle badge">
        {SIZES.map(s => (
          <Tile key={s} label={`${s}px`}>
            <GlidrIconCircle style={{ width: s, height: s }} />
          </Tile>
        ))}
      </Row>

      {/* ── Variant C: Bare mark ── */}
      <Row label="C — Bare G mark (no background)">
        {SIZES.map(s => (
          <Tile key={s} label={`${s}px`}>
            <GlidrMark style={{ width: s, height: s }} />
          </Tile>
        ))}
        {SIZES.map(s => (
          <Tile key={`d-${s}`} bg="bg-zinc-900" label={`${s}px dark`}>
            <GlidrMark style={{ width: s, height: s }} color="white" />
          </Tile>
        ))}
      </Row>

      {/* ── Variant D: Text wordmark ── */}
      <Row label="D — Text wordmark only">
        <Tile label="light bg">
          <GlidrWordmark style={{ height: 32 }} />
        </Tile>
        <Tile bg="bg-zinc-900" label="dark bg">
          <GlidrWordmark style={{ height: 32 }} color="white" />
        </Tile>
      </Row>

      {/* ── Combined lockups ── */}
      <Row label="Lockups — square icon + text">
        <Tile label="light, 28px"><GlidrLogo iconSize={28} variant="dark" icon="square" /></Tile>
        <Tile bg="bg-zinc-900" label="dark, 28px"><GlidrLogo iconSize={28} variant="white" icon="square" /></Tile>
        <Tile label="light, 36px"><GlidrLogo iconSize={36} variant="dark" icon="square" /></Tile>
        <Tile bg="bg-zinc-900" label="dark, 36px"><GlidrLogo iconSize={36} variant="white" icon="square" /></Tile>
      </Row>

      <Row label="Lockups — circle icon + text">
        <Tile label="light, 28px"><GlidrLogo iconSize={28} variant="dark" icon="circle" /></Tile>
        <Tile bg="bg-zinc-900" label="dark, 28px"><GlidrLogo iconSize={28} variant="white" icon="circle" /></Tile>
      </Row>

      <Row label="Lockups — bare mark + text">
        <Tile label="light, 28px"><GlidrLogo iconSize={28} variant="dark" icon="mark" /></Tile>
        <Tile bg="bg-zinc-900" label="dark, 28px"><GlidrLogo iconSize={28} variant="white" icon="mark" /></Tile>
      </Row>

      {/* ── Header simulation ── */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Header simulation (as it appears in the nav)</p>
      {(["square", "circle", "mark"] as const).map(icon => (
        <div key={icon} className="mb-3 bg-card border border-border rounded-xl px-5 py-3 flex items-center gap-4">
          <GlidrLogo iconSize={24} variant="dark" icon={icon} />
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-1">
            {["Tests","Products","Analytics","Admin"].map(n => (
              <span key={n} className="text-xs text-muted-foreground px-2 py-1 rounded hover:bg-muted">{n}</span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-4 rounded bg-muted" />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground mt-2">
        Velg varianten du liker og si til meg — f.eks. "bruk B circle i headeren".
      </p>
    </div>
  );
}
