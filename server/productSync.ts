// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Import products from a team's Google Sheet into the Products table.
//
// Design contract (per product owner):
//   • ADDITIVE ONLY — products that appear in the sheet but not in Glidr are
//     created. Products removed from the sheet are NEVER deleted from Glidr.
//   • Columns are interpreted leniently: header names are matched case-
//     insensitively against a set of Norwegian/English synonyms, so the team
//     can keep their own column titles.
//
// Auth: uses the same service-account Google Sheets client as the backup
// feature. The team must share their product sheet with the service-account
// email (Settings → Backup shows it).
import { storage } from "./storage";
import { pool } from "./db";
import { getUncachableGoogleSheetClient } from "./googleSheets";

export function extractSpreadsheetId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// Header synonyms → canonical field. All lowercased, trimmed.
const HEADER_SYNONYMS: Record<string, "category" | "brand" | "name" | "stock"> = {
  // category (a.k.a. the product tag/etikett)
  "category": "category", "kategori": "category", "type": "category", "produkttype": "category",
  "product category": "category", "kategorier": "category",
  "product type": "category", "producttype": "category", "produkt type": "category",
  "type of product": "category", "type produkt": "category", "etikett": "category", "tag": "category",
  // brand
  "brand": "brand", "merke": "brand", "produsent": "brand", "manufacturer": "brand", "make": "brand",
  // name
  "name": "name", "navn": "name", "product": "name", "produkt": "name", "produktnavn": "name",
  "product name": "name", "model": "name", "modell": "name",
  // stock
  "stock": "stock", "lager": "stock", "antall": "stock", "quantity": "stock", "qty": "stock",
  "lagerbeholdning": "stock", "stock quantity": "stock", "beholdning": "stock",
};

const norm = (s: any) => String(s ?? "").trim();
const key = (s: any) => norm(s).toLowerCase();

// Canonical product tags. The sheet's category/type value is interpreted into
// exactly one of these so every imported product is correctly tagged.
export const PRODUCT_TAGS = ["Paraffin", "Liquid", "Block", "Structure Tool"] as const;
function normalizeCategory(raw: string): string {
  const v = norm(raw).toLowerCase();
  if (!v) return "Paraffin";
  if (/(struktur|structure|\btool\b|rille|verkt)/.test(v)) return "Structure Tool";
  if (/(liquid|flytende|spray|væske|veske|fluid|gel)/.test(v)) return "Liquid";
  if (/(block|blokk|hard\s*wax|hardvoks|stick|crayon)/.test(v)) return "Block";
  if (/(paraf|paraffin|voks|\bwax\b|glider|glid|pulver|powder|hot\s*wax|solid)/.test(v)) return "Paraffin";
  // Direct match against a canonical tag (case-insensitive).
  const direct = PRODUCT_TAGS.find((t) => t.toLowerCase() === v);
  if (direct) return direct;
  return "Paraffin";
}

type SyncResult = {
  success: boolean;
  added: number;
  updated?: number;
  skipped: number;
  rows: number;
  error?: string;
};

export async function syncProductsFromSheet(teamId: number, groupScope?: string): Promise<SyncResult> {
  const team = await storage.getTeam(teamId);
  if (!team) return { success: false, added: 0, skipped: 0, rows: 0, error: "Team not found" };
  // Imported products go into the group the sheet was connected from (e.g. "A-Team"),
  // falling back to the stored group, then "All".
  const effectiveGroup = groupScope ?? (team as any).productSheetGroup ?? "All";
  const spreadsheetId = extractSpreadsheetId((team as any).productSheetUrl);
  if (!spreadsheetId) {
    return { success: false, added: 0, skipped: 0, rows: 0, error: "No product sheet configured" };
  }

  let values: any[][];
  try {
    const sheets = await getUncachableGoogleSheetClient();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "A1:Z100000",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    values = (resp.data.values as any[][]) || [];
  } catch (err: any) {
    const msg = err?.message || String(err);
    // The most common failure: sheet not shared with the service account.
    return { success: false, added: 0, skipped: 0, rows: 0, error: `Could not read sheet: ${msg}` };
  }

  if (values.length < 2) {
    return { success: false, added: 0, skipped: 0, rows: 0, error: "Sheet is empty or has no data rows" };
  }

  // Map header columns → canonical field.
  const header = values[0].map((h) => key(h));
  const colOf: Partial<Record<"category" | "brand" | "name" | "stock", number>> = {};
  header.forEach((h, i) => {
    const field = HEADER_SYNONYMS[h];
    if (field && colOf[field] === undefined) colOf[field] = i;
  });

  if (colOf.brand === undefined || colOf.name === undefined) {
    return {
      success: false, added: 0, skipped: 0, rows: 0,
      error: "Could not find a 'Brand'/'Merke' and 'Name'/'Navn' column in the sheet header",
    };
  }

  // Existing products in this team (incl. archived), keyed by brand+name so a
  // product's tag/category can be corrected on re-sync instead of duplicated.
  const existingRes = await (pool as any).query(
    `SELECT id, brand, name, category FROM products WHERE team_id = $1`, [teamId]
  );
  const existing = new Map<string, { id: number; category: string }>();
  for (const p of existingRes.rows) existing.set(`${key(p.brand)}|${key(p.name)}`, { id: p.id, category: p.category });

  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const dataRows = values.slice(1);

  for (const row of dataRows) {
    const brand = norm(row[colOf.brand!]);
    const name = norm(row[colOf.name!]);
    if (!brand || !name) { skipped++; continue; }
    const category = normalizeCategory(colOf.category !== undefined ? norm(row[colOf.category!]) : "");
    const matchKey = `${key(brand)}|${key(name)}`;
    const found = existing.get(matchKey);

    if (found) {
      // Already imported — only correct the category/tag if it changed.
      if (key(found.category) !== key(category)) {
        try {
          await (pool as any).query(`UPDATE products SET category = $1 WHERE id = $2`, [category, found.id]);
          found.category = category;
          updated++;
        } catch { skipped++; }
      } else {
        skipped++;
      }
      continue;
    }

    let stockQuantity = 0;
    if (colOf.stock !== undefined) {
      const n = parseInt(norm(row[colOf.stock!]), 10);
      if (!isNaN(n) && n >= 0) stockQuantity = n;
    }

    try {
      const created = await storage.createProduct({
        category,
        brand,
        name,
        stockQuantity,
        createdAt: now,
        createdById: 0,
        createdByName: "Google Sheet sync",
        groupScope: effectiveGroup,
        teamId,
      } as any);
      existing.set(matchKey, { id: (created as any).id, category });
      added++;
    } catch {
      skipped++;
    }
  }

  await storage.updateTeam(teamId, { lastProductSyncAt: now } as any);
  return { success: true, added, updated, skipped, rows: dataRows.length };
}

// ── Auto-sync scheduler (every 5 minutes per team with a sheet configured) ───
const productSyncIntervals: Record<number, NodeJS.Timeout> = {};

export function startAutoProductSync(teamId: number, intervalMs = 5 * 60 * 1000) {
  stopAutoProductSync(teamId);
  productSyncIntervals[teamId] = setInterval(async () => {
    try {
      const team = await storage.getTeam(teamId);
      if ((team as any)?.productSheetUrl) {
        const r = await syncProductsFromSheet(teamId);
        if (r.success && (r.added > 0 || (r.updated ?? 0) > 0)) console.log(`[ProductSync] Auto-sync team ${teamId}: +${r.added} new, ${r.updated ?? 0} re-tagged`);
        else if (!r.success) console.warn(`[ProductSync] Auto-sync team ${teamId} failed: ${r.error}`);
      } else {
        stopAutoProductSync(teamId);
      }
    } catch (err) {
      console.error(`[ProductSync] Auto-sync error for team ${teamId}:`, err);
    }
  }, intervalMs);
}

export function stopAutoProductSync(teamId: number) {
  if (productSyncIntervals[teamId]) {
    clearInterval(productSyncIntervals[teamId]);
    delete productSyncIntervals[teamId];
  }
}

export async function initAutoProductSync() {
  try {
    const teams = await storage.listTeams();
    for (const team of teams) {
      if ((team as any).productSheetUrl) {
        startAutoProductSync(team.id);
        console.log(`[ProductSync] Auto-sync enabled for team ${team.id} (${team.name})`);
      }
    }
  } catch (err) {
    console.error("[ProductSync] Failed to init auto-sync:", err);
  }
}
