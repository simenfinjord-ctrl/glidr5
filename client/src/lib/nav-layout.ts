const KEY = "glidr-nav-layout";

export type NavLayout = "sidebar" | "top";

export function getNavLayout(): NavLayout {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "top" || v === "sidebar") return v;
  } catch {}
  return "sidebar"; // default
}

export function setNavLayout(layout: NavLayout) {
  try { localStorage.setItem(KEY, layout); } catch {}
}
