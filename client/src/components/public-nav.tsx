import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Zap } from "lucide-react";
import { useLanguage, type Lang } from "@/lib/language";

export function PublicNav() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { lang, setLang } = useLanguage();

  const links = [
    { href: "/demo", label: "Demo" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact", label: "Contact" },
    { href: "/legal", label: "Legal" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="font-bold text-lg tracking-tight text-foreground flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-green-500" />
          Glidr
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`text-sm font-medium transition-colors ${location === l.href ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-1.5">
            Log in
          </Link>
          <Link href="/get-started" className="text-sm font-semibold bg-foreground text-background px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
            Get started
          </Link>
          <button
            onClick={() => setLang(lang === "en" ? "no" : "en")}
            className="text-xs font-semibold px-2 py-1 rounded border border-border hover:bg-muted transition-colors text-muted-foreground"
          >
            {lang === "en" ? "NO" : "EN"}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-1.5 rounded-md hover:bg-muted" onClick={() => setOpen(o => !o)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border/40 bg-background px-4 py-3 flex flex-col gap-2">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className="text-sm font-medium py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2 border-t border-border/40">
            <button
              onClick={() => setLang(lang === "en" ? "no" : "en")}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:bg-muted"
            >
              {lang === "en" ? "Norsk" : "English"}
            </button>
            <Link href="/login" className="flex-1 text-center text-sm font-medium border border-border rounded-lg py-2 hover:bg-muted" onClick={() => setOpen(false)}>
              Log in
            </Link>
            <Link href="/get-started" className="flex-1 text-center text-sm font-semibold bg-foreground text-background rounded-lg py-2 hover:opacity-90" onClick={() => setOpen(false)}>
              Get started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
