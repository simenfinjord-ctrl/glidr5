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
// Matching signature: brand+name tokenized with separators stripped
// ("Ski-Go" == "Skigo") and TYPE WORDS removed wherever they sit in the name
// ("Jet Powder Top Finish Black" == "Jet Top Finish Black" + Powder). The
// removed type words double as category evidence, which beats the stored
// category (legacy data often mislabels everything as Paraffin).
const TYPE_WORDS = new Set(["powder", "paraffin", "block", "liquid", "pulver", "blokk"]);
export function productSig(brand: any, name: any): { sig: string; removed: Set<string> } {
  const removed = new Set<string>();
  const core = String(`${brand ?? ""} ${name ?? ""}`).toLowerCase().split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => {
      if (!t) return false;
      if (TYPE_WORDS.has(t)) { removed.add(t); return false; }
      return true;
    });
  return { sig: core.join(" "), removed };
}

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
  /** Reconciliation: explains any difference between sheet rows and products. */
  report?: {
    matchedProducts: number;
    blankRows: number;
    /** Sheet rows that resolved to a product ANOTHER row already claimed. */
    collisions: { row: number; label: string; withProductId: number }[];
    /** Glidr products no sheet row claimed (mixes/archived flagged). */
    notInSheet: { id: number; label: string; archived: boolean; isMix: boolean }[];
  };
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
    `SELECT id, brand, name, category, stock_quantity, order_quantity, created_by_name, archived_at, is_mix FROM products WHERE team_id = $1`, [teamId]
  );
  type Entry = { id: number; brand: string; name: string; category: string; stock: number; order: number; createdByName?: string; deleted?: boolean; removed: Set<string>; archived?: boolean; isMix?: boolean };
  // ONE index: the type-word-free signature. Lists, because the same core
  // name legitimately exists in several types (Toko Jet Top Finish Warm as
  // Powder AND Liquid; Skigo Yellow as Powder AND Paraffin).
  const bySig = new Map<string, Entry[]>();
  const addToIndex = (entry: Entry) => {
    const { sig, removed } = productSig(entry.brand, entry.name);
    entry.removed = removed;
    if (!bySig.has(sig)) bySig.set(sig, []);
    if (!bySig.get(sig)!.includes(entry)) bySig.get(sig)!.push(entry);
  };
  for (const p of existingRes.rows) {
    addToIndex({ id: p.id, brand: p.brand, name: p.name, category: p.category, stock: p.stock_quantity ?? 0, order: p.order_quantity ?? 0, createdByName: p.created_by_name, removed: new Set(), archived: !!p.archived_at, isMix: !!p.is_mix });
  }
  // Rows per signature: when a signature appears in several sheet rows the
  // types differ, and only type evidence may disambiguate.
  const sheetSigCounts = new Map<string, number>();
  for (const row of values.slice(1)) {
    const b = norm(row[colOf.brand!]); const n = norm(row[colOf.name!]);
    if (!b || !n) continue;
    const { sig } = productSig(b, n);
    sheetSigCounts.set(sig, (sheetSigCounts.get(sig) ?? 0) + 1);
  }

  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let blankRows = 0;
  const matchedIds = new Map<number, number>(); // productId -> first claiming row#
  const collisions: { row: number; label: string; withProductId: number }[] = [];
  const dataRows = values.slice(1);
  let rowNo = 1;

  for (const row of dataRows) {
    rowNo++;
    const brand = norm(row[colOf.brand!]);
    const name = norm(row[colOf.name!]);
    if (!brand || !name) { skipped++; blankRows++; continue; }
    const category = normalizeCategory(colOf.category !== undefined ? norm(row[colOf.category!]) : "");
    const catK = key(category).replace(/[^a-z0-9]/g, "");
    const { sig, removed: rowRemoved } = productSig(brand, name);
    // Everything that names this row's type: the category column plus any
    // type word written inside the sheet name itself.
    const catToks = new Set<string>([catK, ...rowRemoved].filter(Boolean));
    const cands = (bySig.get(sig) ?? []).filter((e) => !e.deleted);
    // Type-compatible candidates: products whose NAME carries a matching type
    // word (authoritative — legacy categories are often wrong), or whose
    // stored category matches when the name carries no type word.
    const strong = cands.filter((e) =>
      e.removed.size > 0 ? [...e.removed].some((t) => catToks.has(t)) : key(e.category).replace(/[^a-z0-9]/g, "") === catK);
    // Loose fallback only when this signature is unique in the sheet — then
    // there is exactly one possible identity regardless of type labels.
    const loose = (sheetSigCounts.get(sig) ?? 0) <= 1 ? cands : [];
    // Exact brand+name equality outranks everything — keeps "Blue" and
    // "Blue Block" (same signature) glued to their own rows.
    const exact = cands.filter((e) => key(`${e.brand} ${e.name}`) === key(`${brand} ${name}`));
    const candidates = [...exact, ...strong, ...loose].filter((e, i, arr) => arr.indexOf(e) === i);
    // Prefer a product with human history over a sync-created copy — the copy
    // is the duplicate, the legacy product owns the test references.
    let found = candidates.find((e) => e.createdByName !== "Google Sheet sync") ?? candidates[0];
    // Heal duplicates the old sync created: if the strongest match is a LEGACY
    // product and a sync-created twin also answers to this row, delete the
    // unreferenced twin.
    if (found) {
      const twins = candidates.filter((e) => e.id !== found!.id && e.createdByName === "Google Sheet sync");
      for (const twin of twins) {
        const refs = await (pool as any).query(
          `SELECT (SELECT COUNT(*) FROM test_entries WHERE product_id = $1)
                + (SELECT COUNT(*) FROM race_preps WHERE product_ids LIKE '%' || $1 || '%'
                     OR structure_ids LIKE '%' || $1 || '%' OR kick_product_ids LIKE '%' || $1 || '%') AS c`,
          [twin.id]).catch(() => ({ rows: [{ c: 1 }] }));
        if (parseInt(refs.rows[0]?.c ?? "1") === 0) {
          await (pool as any).query(`DELETE FROM products WHERE id = $1`, [twin.id]).catch(() => {});
          twin.deleted = true;
          console.log(`[ProductSync] Removed sync-created duplicate #${twin.id} (${brand} ${name}) — kept #${found.id}`);
        }
      }
    }

    if (found) {
      // Already imported — correct the tag, and pull Count/Order values from
      // the sheet so edits made THERE land in Glidr too. (Glidr-side changes
      // push back within seconds, so the sheet is normally already current.)
      let changed = false;
      try {
        // Sheet is master for naming too: a legacy "FF1 Blue powder" matched
        // via name+type is renamed to the sheet's "FF1 Blue" + type Powder.
        if (norm(found.brand) !== brand || norm(found.name) !== name) {
          await (pool as any).query(`UPDATE products SET brand = $1, name = $2 WHERE id = $3`, [brand, name, found.id]);
          found.brand = brand; found.name = name;
          addToIndex(found); // reachable under the new keys for later rows
          changed = true;
        }
        if (norm(found.category) !== category) {
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
      if (matchedIds.has(found.id)) {
        collisions.push({ row: rowNo, label: `${brand} ${name} ${category}`.trim(), withProductId: found.id });
      } else {
        matchedIds.set(found.id, rowNo);
      }
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
      addToIndex({ id: (created as any).id, brand, name, category, stock: stockQuantity, order: orderQuantity, createdByName: "Google Sheet sync", removed: new Set() });
      matchedIds.set((created as any).id, rowNo);
      added++;
    } catch {
      skipped++;
    }
  }

  await storage.updateTeam(teamId, { lastProductSyncAt: now } as any);
  const notInSheet: { id: number; label: string; archived: boolean; isMix: boolean }[] = [];
  for (const list of bySig.values()) {
    for (const e of list) {
      if (e.deleted || matchedIds.has(e.id)) continue;
      if (notInSheet.some((x) => x.id === e.id)) continue;
      notInSheet.push({ id: e.id, label: `${e.brand} ${e.name} ${e.category ?? ""}`.trim(), archived: !!e.archived, isMix: !!e.isMix });
    }
  }
  return {
    success: true, added, updated, skipped, rows: dataRows.length,
    report: { matchedProducts: matchedIds.size, blankRows, collisions, notInSheet },
  };
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

  const prod = productSig(product.brand, product.name);
  const prodCat = String(product.category ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const prodTypeToks = new Set<string>([prodCat, ...prod.removed].filter(Boolean));
  const sigMatches = (row: any[]) => productSig(row[colOf.brand!], row[colOf.name!]).sig === prod.sig;
  const typeMatches = (row: any[]) => {
    const r = productSig(row[colOf.brand!], row[colOf.name!]);
    const rowCat = colOf.category !== undefined ? String(row[colOf.category!] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") : "";
    const rowToks = new Set<string>([rowCat, ...r.removed].filter(Boolean));
    if (rowToks.size === 0 || prodTypeToks.size === 0) return true;
    return [...rowToks].some((t) => prodTypeToks.has(t));
  };
  // Same core signature, preferring the row whose type agrees — the same
  // name can exist as Powder AND Liquid in the sheet.
  let rowIdx = values.findIndex((row, i) => i > 0 && sigMatches(row) && typeMatches(row));
  if (rowIdx < 0) rowIdx = values.findIndex((row, i) => i > 0 && sigMatches(row));

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
