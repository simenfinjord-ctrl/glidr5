import { Mail, Phone, MapPin } from "lucide-react";
import { AppLink } from "@/components/app-link";

export default function Contact() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4"
            data-testid="heading-contact"
          >
            Contact us
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Questions about Glidr, pricing, or partnerships? Get in touch — we're happy to help.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mx-auto mb-16">
          <a
            href="mailto:Simen.finjord@hotmail.com"
            className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-blue-300 hover:ring-1 hover:ring-blue-300/30 transition-all"
            data-testid="link-contact-email"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">Email</div>
              <div className="text-sm text-muted-foreground break-all">Simen.finjord@hotmail.com</div>
            </div>
          </a>

          <a
            href="tel:+4797540178"
            className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-emerald-300 hover:ring-1 hover:ring-emerald-300/30 transition-all"
            data-testid="link-contact-phone"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">Phone</div>
              <div className="text-sm text-muted-foreground">+47 975 40 178</div>
            </div>
          </a>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-lg mx-auto mb-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600 mx-auto mb-4 dark:bg-violet-900/30 dark:text-violet-400">
            <MapPin className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Simen Finjord</h2>
          <p className="text-sm text-muted-foreground">Norway</p>
        </div>

        <div className="text-center border-t border-border pt-8">
          <div className="flex justify-center gap-6 text-xs text-muted-foreground">
            <AppLink href="/what-is-glidr" testId="link-features-from-contact" className="underline hover:text-foreground">
              What is Glidr?
            </AppLink>
            <AppLink href="/pricing" testId="link-pricing-from-contact" className="underline hover:text-foreground">
              Pricing
            </AppLink>
            <AppLink href="/legal" testId="link-legal-from-contact" className="underline hover:text-foreground">
              Legal & Privacy
            </AppLink>
          </div>
        </div>
      </div>
    </div>
  );
}
