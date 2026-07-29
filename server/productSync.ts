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
const HEADER_SYNONYMS: Record<string, "category" | "brand" | "name" | "stock" | "order"> = {
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
  // stock (a.k.a. Amount)
  "stock": "stock", "lager": "stock", "antall": "stock", "quantity": "stock", "qty": "stock",
  "lagerbeholdning": "stock", "stock quantity": "stock", "beholdning": "stock", "amount": "stock",
  "count": "stock", "antal": "stock", "på lager": "stock", "in stock": "stock",
  // order (the to-order column)
  "order": "order", "bestilling": "order", "bestill": "order", "ordre": "order", "to order": "order",
};

const norm = (s: any) => String(s ?? "").trim();
const key = (s: any) => norm(s).toLowerCase();
/** First integer found in a cell — handles "4", 4 and "Order, total 4". */
const cellInt = (v: any): number | null => {
  const m = String(v ?? "").match(/-?\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return isNaN(n) || n < 0 ? null : n;
};

// Categories come from the sheet VERBATIM — the sheet is the source of truth
// for the team's own vocabulary (Powder, Paraffin, Block, Liquid, …). No
// translation into a canonical list.
function normalizeCategory(raw: string): string {
  const v = norm(raw);
  return v || "Paraffin"; // only when the sheet has no category column at all
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
      range: "A1:Z1000",
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
  const colOf: Partial<Record<"category" | "brand" | "name" | "stock" | "order", number>> = {};
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
    `SELECT id, brand, name, category, stock_quantity, order_quantity, created_by_name FROM products WHERE team_id = $1`, [teamId]
  );
  type Entry = { id: number; category: string; stock: number; order: number; createdByName?: string };
  const existing = new Map<string, Entry>();
  // Second index on the FULL "brand name" string: teams split brand/name
  // differently in Glidr vs the sheet ("Star"+"Cold" vs ""+"Star Cold"),
  // and counts must land regardless of where the split sits.
  const existingFull = new Map<string, Entry>();
  for (const p of existingRes.rows) {
    const entry: Entry = { id: p.id, category: p.category, stock: p.stock_quantity ?? 0, order: p.order_quantity ?? 0, createdByName: p.created_by_name };
    existing.set(`${key(p.brand)}|${key(p.name)}`, entry);
    existingFull.set(key(`${p.brand} ${p.name}`), entry);
  }

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
    // Legacy Glidr names often carry the type word ("FF1 Blue powder" vs the
    // sheet's "FF1 Blue" + type Powder) — match on that shape too.
    const pairHit = existing.get(matchKey);
    const suffixHit = existingFull.get(key(`${brand} ${name}`))
      ?? (category ? existingFull.get(key(`${brand} ${name} ${category}`)) : undefined);
    let found = pairHit ?? suffixHit;
    // Heal earlier duplicate creation: if BOTH shapes exist as different
    // products and the pair-shaped one was created by the sheet sync itself
    // (no human history), delete the sync duplicate and keep the legacy one.
    if (pairHit && suffixHit && pairHit.id !== suffixHit.id && pairHit.createdByName === "Google Sheet sync") {
      const refs = await (pool as any).query(
        `SELECT (SELECT COUNT(*) FROM test_entries WHERE product_id = $1)
              + (SELECT COUNT(*) FROM race_preps WHERE product_ids LIKE '%' || $1 || '%'
                   OR structure_ids LIKE '%' || $1 || '%' OR kick_product_ids LIKE '%' || $1 || '%') AS c`,
        [pairHit.id]).catch(() => ({ rows: [{ c: 1 }] }));
      if (parseInt(refs.rows[0]?.c ?? "1") === 0) {
        await (pool as any).query(`DELETE FROM products WHERE id = $1`, [pairHit.id]).catch(() => {});
        existing.delete(matchKey);
        console.log(`[ProductSync] Removed sync-created duplicate #${pairHit.id} (${brand} ${name}) — kept legacy #${suffixHit.id}`);
        found = suffixHit;
      }
    }

    if (found) {
      // Already imported — correct the tag, and pull Count/Order values from
      // the sheet so edits made THERE land in Glidr too. (Glidr-side changes
      // push back within seconds, so the sheet is normally already current.)
      let changed = false;
      try {
        if (key(found.category) !== key(category)) {
          await (pool as any).query(`UPDATE products SET category = $1 WHERE id = $2`, [category, found.id]);
          found.category = category;
          changed = true;
        }
        const sheetStock = colOf.stock !== undefined ? cellInt(row[colOf.stock!]) : null;
        if (sheetStock != null && sheetStock !== found.stock) {
          await (pool as any).query(`UPDATE products SET stock_quantity = $1 WHERE id = $2`, [sheetStock, found.id]);
          found.stock = sheetStock;
          changed = true;
        }
        const sheetOrder = colOf.order !== undefined ? cellInt(row[colOf.order!]) : null;
        if (sheetOrder != null && sheetOrder !== found.order) {
          await (pool as any).query(`UPDATE products SET order_quantity = $1 WHERE id = $2`, [sheetOrder, found.id]);
          found.order = sheetOrder;
          changed = true;
        }
      } catch { /* leave as-is */ }
      if (changed) updated++; else skipped++;
      continue;
    }

    const stockQuantity = (colOf.stock !== undefined ? cellInt(row[colOf.stock!]) : null) ?? 0;
    const orderQuantity = (colOf.order !== undefined ? cellInt(row[colOf.order!]) : null) ?? 0;

    try {
      const created = await storage.createProduct({
        category,
        brand,
        name,
        stockQuantity,
        orderQuantity,
        createdAt: now,
        createdById: 0,
        createdByName: "Google Sheet sync",
        groupScope: effectiveGroup,
        teamId,
      } as any);
      const newEntry = { id: (created as any).id, category, stock: stockQuantity, order: orderQuantity };
      existing.set(matchKey, newEntry);
      existingFull.set(key(`${brand} ${name}`), newEntry);
      added++;
    } catch {
      skipped++;
    }
  }

  await storage.updateTeam(teamId, { lastProductSyncAt: now } as any);
  return { success: true, added, updated, skipped, rows: dataRows.length };
}

// ── Push: Glidr -> sheet ─────────────────────────────────────────────────────
// Inventory (Amount) and Order changes made in Glidr write back to the linked
// sheet, and products created in Glidr are appended following the sheet's own
// column layout. Debounced per product so rapid +/- clicking becomes ONE write.

function colLetter(i: number): string {
  let n = i + 1, out = "";
  while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
  return out;
}

export async function pushProductToSheet(teamId: number, productId: number): Promise<void> {
  const team = await storage.getTeam(teamId);
  const spreadsheetId = extractSpreadsheetId((team as any)?.productSheetUrl);
  if (!spreadsheetId) return;
  const pr = await (pool as any).query(
    `SELECT brand, name, category, stock_quantity, order_quantity FROM products WHERE id = $1 AND team_id = $2`,
    [productId, teamId]);
  const product = pr.rows[0];
  if (!product) return;

  const sheets = await getUncachableGoogleSheetClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId, range: "A1:Z2000", valueRenderOption: "UNFORMATTED_VALUE",
  });
  const values: any[][] = (resp.data.values as any[][]) || [];
  if (values.length === 0) return;
  const header = values[0].map((h) => key(h));
  const colOf: Partial<Record<"category" | "brand" | "name" | "stock" | "order", number>> = {};
  header.forEach((h, i) => {
    const field = HEADER_SYNONYMS[h];
    if (field && colOf[field] === undefined) colOf[field] = i;
  });
  if (colOf.brand === undefined || colOf.name === undefined) return;

  const fullKey = key(`${product.brand} ${product.name}`);
  const rowIdx = values.findIndex((row, i) => {
    if (i === 0) return false;
    if (key(row[colOf.brand!]) === key(product.brand) && key(row[colOf.name!]) === key(product.name)) return true;
    const rowFull = key(`${row[colOf.brand!]} ${row[colOf.name!]}`);
    if (rowFull === fullKey) return true;
    // Sheet name + its type word == Glidr's legacy name-with-type.
    if (colOf.category !== undefined && key(`${rowFull} ${row[colOf.category!] ?? ""}`) === fullKey) return true;
    return false;
  });

  const data: { range: string; values: any[][] }[] = [];
  if (rowIdx > 0) {
    const rowNo = rowIdx + 1;
    if (colOf.stock !== undefined) data.push({ range: `${colLetter(colOf.stock)}${rowNo}`, values: [[product.stock_quantity ?? 0]] });
    if (colOf.order !== undefined) data.push({ range: `${colLetter(colOf.order)}${rowNo}`, values: [[product.order_quantity ?? 0]] });
    if (data.length === 0) return;
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
  } else {
    // Not in the sheet yet — append a row shaped by the sheet's own header.
    const row: any[] = new Array(header.length).fill("");
    if (colOf.category !== undefined) row[colOf.category] = product.category ?? "";
    row[colOf.brand] = product.brand;
    row[colOf.name] = product.name;
    if (colOf.stock !== undefined) row[colOf.stock] = product.stock_quantity ?? 0;
    if (colOf.order !== undefined) row[colOf.order] = product.order_quantity ?? 0;
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: "A1", valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
}

const pushTimers = new Map<string, NodeJS.Timeout>();

/** Debounced push: many rapid changes to one product become one write ~4 s later. */
export function schedulePushProductToSheet(teamId: number, productId: number): void {
  const k = `${teamId}:${productId}`;
  const t = pushTimers.get(k);
  if (t) clearTimeout(t);
  pushTimers.set(k, setTimeout(() => {
    pushTimers.delete(k);
    pushProductToSheet(teamId, productId).catch((e) =>
      console.warn(`[ProductSync] Push to sheet failed for product ${productId}:`, e?.message ?? e));
  }, 4000));
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
