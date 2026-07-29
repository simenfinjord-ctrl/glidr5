// Display label for a product — always includes the product form
// (Paraffin / Liquid / Block) so waxers can tell types apart everywhere.
// Structure tools skip the suffix (the context already implies it).
export function productLabel(p: { brand?: string | null; name: string; category?: string | null } | null | undefined): string {
  if (!p) return "—";
  const base = `${p.brand ? p.brand + " " : ""}${p.name}`.trim();
  const cat = p.category && !/structure|struktur|\btool\b|verkt|rille/i.test(p.category) ? ` ${p.category}` : "";
  return base + cat;
}
