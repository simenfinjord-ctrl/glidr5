// "Add as app" banner — shown on mobile browsers (not in the installed PWA),
// in the DEVICE language, dismissible. iOS gets the Share→Add to Home Screen
// walkthrough; Android/Chrome uses the native install prompt when available.
import { useEffect, useState } from "react";
import { X, Share, PlusSquare } from "lucide-react";

const KEY = "glidr-a2hs-dismissed";

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as any).standalone === true;
}

export function AddToHomeBanner() {
  const [visible, setVisible] = useState(false);
  const [installEvt, setInstallEvt] = useState<any>(null);

  const deviceNo = (navigator.language || "").toLowerCase().startsWith("n");
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isMobile = isIOS || /android/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isMobile || isStandalone()) return;
    try { if (localStorage.getItem(KEY)) return; } catch { /* show */ }
    setVisible(true);
    const onPrompt = (e: any) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ok */ }
  };

  return (
    <div className="fixed inset-x-3 z-50 rounded-2xl border border-border bg-card shadow-lg p-3 flex items-start gap-3"
      style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      data-testid="add-to-home-banner">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <PlusSquare className="h-6 w-6 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{deviceNo ? "Legg til som app" : "Add as an app"}</p>
        {installEvt ? (
          <button
            type="button"
            className="mt-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            onClick={async () => { installEvt.prompt(); dismiss(); }}
          >
            {deviceNo ? "Installer Glidr" : "Install Glidr"}
          </button>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isIOS
              ? (deviceNo
                ? <>Trykk <Share className="inline h-3.5 w-3.5 mx-0.5" /> <strong>Del</strong> nederst i Safari, og velg «Legg til på Hjem-skjerm».</>
                : <>Tap <Share className="inline h-3.5 w-3.5 mx-0.5" /> <strong>Share</strong> in Safari, then choose "Add to Home Screen".</>)
              : (deviceNo
                ? <>Åpne menyen (⋮) i nettleseren og velg «Legg til på startsiden».</>
                : <>Open the browser menu (⋮) and choose "Add to Home screen".</>)}
          </p>
        )}
      </div>
      <button type="button" onClick={dismiss} className="shrink-0 p-1 text-muted-foreground" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
