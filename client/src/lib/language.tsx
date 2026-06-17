import { createContext, useContext, useState, useEffect } from "react";

export type Lang = "en" | "no";

interface LanguageCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LanguageContext = createContext<LanguageCtx>({ lang: "en", setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem("glidr-lang") as Lang | null;
      return stored === "no" ? "no" : "en";
    } catch {
      return "en";
    }
  });

  // Keep <html lang> in sync with the chosen language so the browser doesn't flag
  // the page as foreign and offer auto-translation (which crashes React).
  useEffect(() => {
    try { document.documentElement.lang = lang; } catch {}
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem("glidr-lang", l); } catch {}
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
