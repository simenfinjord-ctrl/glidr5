// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { getUncachableGoogleSheetClient, getGoogleDriveClient } from './googleSheets';
import { storage } from './storage';
import { pool } from './db';

function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function sanitizeSheetTitle(name: string): string {
  return name.replace(/[:\\\/*?\[\]]/g, '_').substring(0, 95);
}

async function ensureSheet(sheets: any, spreadsheetId: string, title: string): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find((s: any) => s.properties?.title === title);
  if (existing) return existing.properties.sheetId;
  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  return resp.data.replies[0].addSheet.properties.sheetId;
}

async function clearAndWrite(sheets: any, spreadsheetId: string, sheetTitle: string, rows: any[][]) {
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${sheetTitle}'!A:ZZ` });
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetTitle}'!A1`,
      // RAW keeps values exactly as written — ski IDs like "003" stay text
      // instead of being parsed into the number 3.
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }
}

// Apply bold formatting to specific rows by index within a sheet
async function boldRows(sheets: any, spreadsheetId: string, sheetId: number, rowIndices: number[]) {
  const requests = rowIndices.map(rowIndex => ({
    repeatCell: {
      range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 30 },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: 'userEnteredFormat.textFormat.bold',
    },
  }));
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
}

// Rich formatting for the flat test sheets so tests are easy to tell apart:
//   • all stale formatting wiped first (values.clear leaves formats behind)
//   • frozen title/header rows + first 3 columns
//   • dark column-header band (weather segment tinted blue so the two column
//     groups read separately), white bold text
//   • each test's header row gets a green band in bold
//   • rank-1 (winning) entry rows get a soft amber highlight
//   • sensible column widths + wrapped Notes/Application columns
async function formatFlatTestSheet(sheets: any, spreadsheetId: string, sheetId: number, opts: {
  totalCols: number;
  headerRow: number;          // 0-based row index of the column-header row
  testHeaderRows: number[];   // 0-based row indices of the "▶ Test #x" rows
  winnerRows: number[];       // 0-based row indices of rank-1 entry rows
  weatherStartCol: number;    // first weather column (tints the header segment)
}) {
  const req: any[] = [];
  const { totalCols, headerRow, weatherStartCol } = opts;
  // Wipe every previous format so shrinking data never leaves ghost styling.
  req.push({ repeatCell: { range: { sheetId }, cell: { userEnteredFormat: {} }, fields: 'userEnteredFormat' } });
  // Freeze header rows + identifying columns.
  req.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: headerRow + 1, frozenColumnCount: 3 } }, fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount' } });
  // Title rows.
  req.push({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 2 }, cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } } }, fields: 'userEnteredFormat.textFormat' } });
  // Column header: dark slate with white bold text …
  req.push({ repeatCell: { range: { sheetId, startRowIndex: headerRow, endRowIndex: headerRow + 1, startColumnIndex: 0, endColumnIndex: totalCols }, cell: { userEnteredFormat: { backgroundColor: { red: 0.122, green: 0.161, blue: 0.216 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, wrapStrategy: 'CLIP', verticalAlignment: 'MIDDLE' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)' } });
  // … with the weather segment in blue so the groups are visually distinct.
  req.push({ repeatCell: { range: { sheetId, startRowIndex: headerRow, endRowIndex: headerRow + 1, startColumnIndex: weatherStartCol, endColumnIndex: totalCols }, cell: { userEnteredFormat: { backgroundColor: { red: 0.145, green: 0.278, blue: 0.47 } } }, fields: 'userEnteredFormat.backgroundColor' } });
  // Green band per test header row.
  for (const r of opts.testHeaderRows) {
    req.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: totalCols }, cell: { userEnteredFormat: { backgroundColor: { red: 0.82, green: 0.96, blue: 0.878 }, textFormat: { bold: true } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } });
  }
  // Soft amber for winning (rank 1) rows.
  for (const r of opts.winnerRows) {
    req.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: totalCols }, cell: { userEnteredFormat: { backgroundColor: { red: 0.996, green: 0.953, blue: 0.78 } } }, fields: 'userEnteredFormat.backgroundColor' } });
  }
  // Column widths: dates/ids narrow, text columns wide + wrapped.
  const widths: [number, number][] = [[0, 80], [1, 95], [2, 120], [3, 150], [4, 90], [5, 110], [6, 90], [7, 260], [8, 55], [9, 70], [10, 180], [11, 200], [12, 160], [13, 60], [14, 160], [15, 55], [16, 150], [17, 70], [18, 55], [19, 70], [20, 55]];
  for (const [col, px] of widths) {
    if (col >= totalCols) continue;
    req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: col, endIndex: col + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } });
  }
  for (const wrapCol of [7, 11, 14, 16]) { // Notes, Application, Feeling Note, Kick Solution
    req.push({ repeatCell: { range: { sheetId, startRowIndex: headerRow + 1, startColumnIndex: wrapCol, endColumnIndex: wrapCol + 1 }, cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat.wrapStrategy' } });
  }
  // Send in chunks — big teams can produce many per-row requests.
  for (let i = 0; i < req.length; i += 300) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: req.slice(i, i + 300) } });
  }
}

type RoundResult = { result: number | null; rank: number | null };

function parseResultsArray(resultsJson: string | null): RoundResult[] {
  if (!resultsJson) return [];
  try {
    const parsed = JSON.parse(resultsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function parseDistanceLabels(labelsJson: string | null): string[] {
  if (!labelsJson) return [];
  try {
    const parsed = JSON.parse(labelsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// Reorder sheets in the spreadsheet to match a desired logical sequence
async function reorderSheets(sheets: any, spreadsheetId: string, orderedTitles: string[]) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetMap = new Map<string, number>();
    for (const s of (meta.data.sheets || [])) {
      if (s.properties?.title) sheetMap.set(s.properties.title, s.properties.sheetId);
    }
    const requests: any[] = [];
    let index = 0;
    for (const title of orderedTitles) {
      const sheetId = sheetMap.get(title);
      if (sheetId !== undefined) {
        requests.push({ updateSheetProperties: { properties: { sheetId, index }, fields: 'index' } });
        index++;
      }
    }
    // Managed sheets that are no longer in the ordered list (deleted athletes,
    // removed groups, renamed tabs) are DELETED so the spreadsheet always
    // mirrors the current state of Glidr. Only our own emoji-prefixed tabs are
    // touched — any sheet the team created manually is left alone (moved last).
    const MANAGED_PREFIXES = ['📋', '👥', '🧪', '📐', '⛷️', '🏁', '🎽', '⚙️', '📦', '🦵', '🎿', '🧊', '🧴', '🌦', '📂', '🏃'];
    for (const [title, sheetId] of sheetMap.entries()) {
      if (!orderedTitles.includes(title)) {
        if (MANAGED_PREFIXES.some((pfx) => title.startsWith(pfx))) {
          requests.push({ deleteSheet: { sheetId } });
        } else {
          requests.push({ updateSheetProperties: { properties: { sheetId, index }, fields: 'index' } });
          index++;
        }
      }
    }
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    }
  } catch (err) {
    console.warn('[Backup] Could not reorder sheets:', err);
  }
}

export async function runBackupForTeam(teamId: number): Promise<{ success: boolean; error?: string }> {
  const team = await storage.getTeam(teamId);
  if (!team) return { success: false, error: 'Team not found' };
  if (!team.backupSheetUrl) return { success: false, error: 'No backup sheet URL configured' };

  const spreadsheetId = extractSpreadsheetId(team.backupSheetUrl);
  if (!spreadsheetId) return { success: false, error: 'Invalid Google Sheets URL' };

  try {
    const sheets = await getUncachableGoogleSheetClient();
    const now = new Date().toISOString();

    // ── Fetch all data ────────────────────────────────────────────────────────
    const [
      allGroups, allTests, allWeather, allSeries,
      allProducts, allArchivedProducts,
      allAthletes, allGrindProfiles, allGrindingRecords, allGrindingSheets,
      allTeamUsers, allStockChanges,
    ] = await Promise.all([
      storage.listGroups(teamId),
      storage.listAllTestsForTeam(teamId),
      storage.listAllWeatherForTeam(teamId),
      storage.listSeries('', true, teamId),
      storage.listProducts('', true, teamId),
      storage.listArchivedProducts('', true, teamId),
      storage.listAthletes(0, true, teamId),
      storage.listGrindProfiles(teamId),
      storage.listGrindingRecords('', true, teamId),
      storage.listGrindingSheets('', true, teamId),
      storage.listUsers(teamId),
      storage.listStockChanges(2000, teamId),
    ]);

    // Full race prep data with all columns
    const racePrepsResult = await (pool as any).query(
      `SELECT id, date, start_time, location, race_type, discipline,
              products, method, structure, notes, tette,
              product_ids, structure_ids, kick_product_ids, product_apps, structure_apps,
              weather_id, created_by_name, created_at
       FROM race_preps WHERE team_id = $1 ORDER BY date DESC`,
      [teamId]
    );
    const allRacePreps = racePrepsResult.rows;

    // Race prep entries per prep
    const racePrepEntriesResult = await (pool as any).query(
      `SELECT rpe.id, rpe.race_prep_id, rpe.athlete_name, rpe.ski_id,
              rpe.ski_id_classic, rpe.ski_id_skating,
              rpe.waxer_name, rpe.notes, rpe.athlete_rating, rpe.athlete_comment, rpe.created_at
       FROM race_prep_entries rpe
       JOIN race_preps rp ON rp.id = rpe.race_prep_id
       WHERE rp.team_id = $1 ORDER BY rpe.race_prep_id, rpe.athlete_name`,
      [teamId]
    );
    const racePrepEntriesByPrepId: Record<number, any[]> = {};
    for (const e of racePrepEntriesResult.rows) {
      if (!racePrepEntriesByPrepId[e.race_prep_id]) racePrepEntriesByPrepId[e.race_prep_id] = [];
      racePrepEntriesByPrepId[e.race_prep_id].push(e);
    }

    // Weather lookup
    const weatherById: Record<number, any> = {};
    for (const w of allWeather) weatherById[(w as any).id] = w;

    // Test entries
    const testIds = allTests.map((t: any) => t.id);
    const allEntries = await storage.listAllEntriesForTests(testIds);
    const entriesByTest: Record<number, any[]> = {};
    for (const e of allEntries) {
      if (!entriesByTest[e.testId]) entriesByTest[e.testId] = [];
      entriesByTest[e.testId].push(e);
    }

    const productsById: Record<number, any> = {};
    for (const p of allProducts) productsById[p.id] = p;
    for (const p of allArchivedProducts) productsById[p.id] = p;

    const seriesById: Record<number, any> = {};
    for (const s of allSeries) seriesById[s.id] = s;

    // Race skis + regrinds
    const allRaceSkis: any[] = [];
    for (const ath of allAthletes) {
      const skis = await storage.listAllRaceSkisIncludingArchived(ath.id);
      allRaceSkis.push(...skis.map(s => ({ ...s, athleteName: ath.name })));
    }
    const raceSkiRegrinds: Record<number, any[]> = {};
    for (const ski of allRaceSkis) {
      raceSkiRegrinds[ski.id] = await storage.listRaceSkiRegrinds(ski.id);
    }

    // ── Build group list ──────────────────────────────────────────────────────
    let groupNames = allGroups.map((g: any) => g.name);
    if (groupNames.length === 0) {
      const scopeSet = new Set<string>();
      for (const t of allTests) if ((t as any).groupScope) scopeSet.add((t as any).groupScope);
      for (const p of allProducts) if ((p as any).groupScope) scopeSet.add((p as any).groupScope);
      for (const w of allWeather) if ((w as any).groupScope) scopeSet.add((w as any).groupScope);
      for (const s of allSeries) if ((s as any).groupScope) scopeSet.add((s as any).groupScope);
      groupNames = scopeSet.size > 0 ? Array.from(scopeSet) : ['default'];
    }
    // Include any groupScopes present in data but missing from groups list
    const extraScopes = new Set<string>();
    for (const t of allTests) if ((t as any).groupScope && !groupNames.includes((t as any).groupScope)) extraScopes.add((t as any).groupScope);
    for (const p of allProducts) if ((p as any).groupScope && !groupNames.includes((p as any).groupScope)) extraScopes.add((p as any).groupScope);
    groupNames = [...groupNames.sort(), ...Array.from(extraScopes).sort()];

    // ── Sheet title constants ─────────────────────────────────────────────────
    const OVERVIEW_TITLE = '📋 Overview';
    const TEAM_TITLE = '👥 Team Members';
    const PRODUCT_TESTS_TITLE = '🧪 Product Tests';
    const STRUCTURE_TESTS_TITLE = '📐 Structure Tests';
    const GRIND_TESTS_TITLE = '⛷️ Grind Tests';
    const RACE_PREPS_TITLE = '🏁 Race Preps';
    const RACE_USAGE_TITLE = '🎽 Race Usage';
    const GRINDS_TITLE = '⚙️ Grinds';
    const STOCK_TITLE = '📦 Stock Changes';
    const KICK_TITLE = '🦵 Kick';
    const GARAGE_TITLE = '🎿 Ski Garage';
    const TESTFLEETS_TITLE = '🧊 Testfleets';
    const PRODUCTS_TITLE = '🧴 Products';
    const WEATHER_TITLE = '🌦 Weather';
    const groupSheetTitles = groupNames.map(g => `📂 ${sanitizeSheetTitle(g)}`);
    const athleteSheetTitles = allAthletes.map((a: any) => sanitizeSheetTitle(`🏃 ${a.name}`));

    // Logical sheet order
    // Logical order: overview & people first, then tests (product/structure/
    // grind/kick), race day, per-athlete sheets, equipment, and reference data.
    const orderedTitles = [
      OVERVIEW_TITLE,
      TEAM_TITLE,
      ...groupSheetTitles,
      PRODUCT_TESTS_TITLE,
      STRUCTURE_TESTS_TITLE,
      GRIND_TESTS_TITLE,
      KICK_TITLE,
      RACE_PREPS_TITLE,
      RACE_USAGE_TITLE,
      ...athleteSheetTitles,
      GARAGE_TITLE,
      TESTFLEETS_TITLE,
      GRINDS_TITLE,
      PRODUCTS_TITLE,
      STOCK_TITLE,
      WEATHER_TITLE,
    ];

    // Ensure all sheets exist
    for (const title of orderedTitles) {
      await ensureSheet(sheets, spreadsheetId, title);
    }

    // ── 1. GROUP SHEETS ───────────────────────────────────────────────────────
    for (let gi = 0; gi < groupNames.length; gi++) {
      const groupName = groupNames[gi];
      const sheetTitle = groupSheetTitles[gi];

      const groupTests = allTests.filter((t: any) => t.groupScope === groupName);
      const groupWeather = allWeather.filter((w: any) => w.groupScope === groupName);
      const groupSeries = allSeries.filter((s: any) => s.groupScope === groupName);
      const groupProducts = allProducts.filter((p: any) => p.groupScope === groupName);
      const groupArchivedProducts = allArchivedProducts.filter((p: any) => p.groupScope === groupName);

      const rows: any[][] = [];
      const boldRowIndices: number[] = [];

      const h = (label: string) => { boldRowIndices.push(rows.length); rows.push([label]); };
      const cols = (...headers: string[]) => { boldRowIndices.push(rows.length); rows.push(headers); };

      rows.push([`GLIDR BACKUP — ${team.name} — Group: ${groupName}`]);
      rows.push([`Generated: ${now}`]);
      rows.push([]);

      // Products
      h('=== PRODUCTS ===');
      cols('ID', 'Category', 'Brand', 'Name', 'Stock', 'Created By', 'Created At', 'Archived');
      for (const p of groupProducts) {
        rows.push([p.id, p.category, p.brand, p.name, p.stockQuantity ?? 0, p.createdByName || '', p.createdAt || '', '']);
      }
      for (const p of groupArchivedProducts) {
        rows.push([p.id, p.category, p.brand, p.name, p.stockQuantity ?? 0, p.createdByName || '', p.createdAt || '', 'Yes']);
      }
      rows.push([]);

      // Test ski series
      h('=== TEST SKI SERIES ===');
      cols('ID', 'Name', 'Type', 'Brand', 'Ski Type', 'Grind', 'Num Skis', 'Last Regrind', 'Archived');
      for (const s of groupSeries) {
        rows.push([s.id, s.name, s.type, s.brand || '', s.skiType || '', s.grind || '', s.numberOfSkis, s.lastRegrind || '', s.archivedAt ? 'Yes' : '']);
      }
      rows.push([]);

      // Weather logs
      h('=== WEATHER LOGS ===');
      cols('ID', 'Date', 'Time', 'Location', 'Snow Temp °C', 'Air Temp °C', 'Snow Humidity %', 'Air Humidity %',
        'Snow Type', 'Snow Humidity Type', 'Track Hardness', 'Artificial Snow', 'Natural Snow',
        'Grain Size', 'Clouds', 'Visibility', 'Wind', 'Precipitation', 'Test Quality');
      for (const w of groupWeather) {
        rows.push([
          w.id, w.date, w.time || '', w.location,
          w.snowTemperatureC ?? '', w.airTemperatureC ?? '',
          w.snowHumidityPct ?? '', w.airHumidityPct ?? '',
          w.snowType ?? '', w.snowHumidityType ?? '', w.trackHardness ?? '',
          w.artificialSnow ?? '', w.naturalSnow ?? '',
          w.grainSize ?? '', w.clouds ?? '', w.visibility ?? '',
          w.wind ?? '', w.precipitation ?? '', w.testQuality ?? '',
        ]);
      }
      rows.push([]);

      // Tests are now in dedicated type sheets — no tests in group sheets

      await clearAndWrite(sheets, spreadsheetId, sheetTitle, rows);
      const meta2 = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetId2 = meta2.data.sheets?.find((s: any) => s.properties?.title === sheetTitle)?.properties?.sheetId;
      if (sheetId2 !== undefined) {
        await boldRows(sheets, spreadsheetId, sheetId2, boldRowIndices).catch(() => {});
      }
    }

    // ── 2. TEAM MEMBERS SHEET ─────────────────────────────────────────────────
    await ensureSheet(sheets, spreadsheetId, TEAM_TITLE);
    const teamRows: any[][] = [
      [`TEAM MEMBERS — ${team.name}`],
      [`Generated: ${now}`],
      [],
      ['ID', 'Name', 'Email', 'Role', 'Group Scope', 'Is Active', 'Is Blind Tester', 'Garmin Watch', 'Created At'],
    ];
    for (const u of allTeamUsers) {
      const role = u.isAdmin ? 'Super Admin' : u.isTeamAdmin ? 'Team Admin' : 'Member';
      teamRows.push([
        u.id, u.name || '', u.email || '', role,
        u.groupScope || '', u.isActive ? 'Yes' : 'No',
        u.isBlindTester ? 'Yes' : 'No', u.garminWatch ? 'Yes' : 'No',
        u.createdAt || '',
      ]);
    }
    await clearAndWrite(sheets, spreadsheetId, TEAM_TITLE, teamRows);

    // ── 3. TEST TYPE SHEETS ───────────────────────────────────────────────────
    // Helper: resolve product IDs string/JSON to names
    const resolveProductIds = (raw: string | null | undefined): string => {
      if (!raw) return '';
      try {
        const ids: number[] = JSON.parse(raw);
        if (!Array.isArray(ids)) return raw;
        return ids.map(id => {
          const p = productsById[id];
          return p ? `${p.brand} ${p.name}` : `#${id}`;
        }).join(' + ');
      } catch {
        return raw;
      }
    };
    // Per-product application: "Brand Name (app) + ...". Falls back to comma-sep IDs.
    const resolveProductApps = (appsJson: string | null | undefined, idsFallback: string | null | undefined): string => {
      if (appsJson) {
        try {
          const arr = JSON.parse(appsJson);
          if (Array.isArray(arr)) {
            return arr.map((x: any) => {
              const p = productsById[x.productId];
              const nm = p ? `${p.brand} ${p.name}` : '';
              if (!nm) return '';
              return x.application ? `${nm} (${x.application})` : nm;
            }).filter(Boolean).join(' + ');
          }
        } catch {}
      }
      if (!idsFallback) return '';
      return String(idsFallback).split(',').map(s => {
        const p = productsById[parseInt(s.trim())];
        return p ? `${p.brand} ${p.name}` : '';
      }).filter(Boolean).join(' + ');
    };

    // Lookups so every test row can show the human ski ID and the grind used.
    const raceSkiByIdFlat: Record<number, any> = {};
    for (const rsk of allRaceSkis) raceSkiByIdFlat[rsk.id] = rsk;
    const grindProfileById: Record<number, any> = {};
    for (const gpf of allGrindProfiles as any[]) grindProfileById[gpf.id] = gpf;

    // Helper: build flat entry rows for a list of tests
    // Each test gets a bold header row, then one entry row per ski entry.
    // All 15 weather/conditions fields are included on every row.
    const FLAT_COL_HEADER = [
      // Test metadata
      'Test ID', 'Date', 'Location', 'Test Name', 'Group', 'Series', 'Type', 'Notes',
      // Entry data
      'Ski #', 'Ski ID', 'Product', 'Application / Method', 'Grind Used',
      'Feeling Rank', 'Feeling Note', 'Kick Rank', 'Kick Solution',
      'Result 1', 'Rank 1', 'Result 2', 'Rank 2',
      // Weather / conditions (all fields)
      'Snow Temp °C', 'Air Temp °C', 'Snow Humidity %', 'Air Humidity %',
      'Snow Type', 'Snow Humidity Type', 'Track Hardness',
      'Artificial Snow', 'Natural Snow', 'Grain Size',
      'Clouds (x/8)', 'Visibility', 'Wind', 'Precipitation', 'Test Quality',
    ];

    const buildFlatTestRows = (tests: any[]): { rows: any[][], boldIndices: number[], winnerIndices: number[] } => {
      const rows: any[][] = [];
      const boldIndices: number[] = [];
      const winnerIndices: number[] = [];

      // Global column header
      boldIndices.push(rows.length);
      rows.push(FLAT_COL_HEADER);

      const sortedTests = [...tests].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));

      for (const test of sortedTests) {
        const entries = entriesByTest[test.id] || [];
        const w = (test as any).weatherId ? weatherById[(test as any).weatherId] : null;
        const seriesName = (test as any).seriesId && seriesById[(test as any).seriesId] ? seriesById[(test as any).seriesId].name : '';
        const distLabels = parseDistanceLabels((test as any).distanceLabels);

        // Weather columns helper — same for all entries of this test
        const wCols = [
          w?.snowTemperatureC ?? '', w?.airTemperatureC ?? '',
          w?.snowHumidityPct ?? '', w?.airHumidityPct ?? '',
          w?.snowType ?? '', w?.snowHumidityType ?? '', w?.trackHardness ?? '',
          w?.artificialSnow ?? '', w?.naturalSnow ?? '', w?.grainSize ?? '',
          w?.clouds ?? '', w?.visibility ?? '', w?.wind ?? '', w?.precipitation ?? '', w?.testQuality ?? '',
        ];

        // Bold test header row
        boldIndices.push(rows.length);
        rows.push([
          `▶ Test #${test.id}`, test.date, test.location,
          (test as any).testName || '', (test as any).groupScope || '', seriesName, (test as any).testType,
          (test as any).notes || '',
          // Entry columns blank on header row
          '', '', '', '', '', '', '', '', '', '', '', '', '',
          ...wCols,
        ]);

        // Entry rows
        const writeEntry = (entry: any) => {
          let productName = '';
          if (entry.productId && productsById[entry.productId]) {
            const p = productsById[entry.productId];
            productName = `${p.brand} ${p.name}`;
          }
          if (entry.freeTextProduct) productName = entry.freeTextProduct;
          if (entry.additionalProductIds) {
            try {
              const addIds = JSON.parse(entry.additionalProductIds);
              for (const aid of addIds) {
                if (productsById[aid]) productName += ` + ${productsById[aid].brand} ${productsById[aid].name}`;
              }
            } catch {}
          }
          const rounds = parseResultsArray(entry.results);
          let res1: any = '', rank1: any = '', res2: any = '', rank2: any = '';
          if (distLabels.length > 0) {
            res1 = rounds[0]?.result ?? ''; rank1 = rounds[0]?.rank ?? '';
            res2 = rounds[1]?.result ?? ''; rank2 = rounds[1]?.rank ?? '';
          } else if (rounds.length > 0) {
            res1 = rounds[0]?.result ?? ''; rank1 = rounds[0]?.rank ?? '';
            res2 = rounds[1]?.result ?? ''; rank2 = rounds[1]?.rank ?? '';
          } else {
            res1 = entry.result0kmCmBehind ?? ''; rank1 = entry.rank0km ?? '';
            res2 = entry.resultXkmCmBehind ?? ''; rank2 = entry.rankXkm ?? '';
          }
          if (Number(rank1) === 1) winnerIndices.push(rows.length);
          const linkedSki = entry.raceSkiId ? raceSkiByIdFlat[entry.raceSkiId] : null;
          const skiIdStr = linkedSki ? `${linkedSki.skiId ?? ''}` : '';
          const gp = entry.grindProfileId ? grindProfileById[entry.grindProfileId] : null;
          const grindUsed = [gp?.name, entry.grindStone, entry.grindPattern, entry.grindType, entry.grindExtraParams]
            .filter(Boolean).join(' · ');
          rows.push([
            test.id, test.date, test.location,
            (test as any).testName || '', (test as any).groupScope || '', seriesName, (test as any).testType,
            (test as any).notes || '',
            entry.skiNumber, skiIdStr, productName, entry.methodology || '', grindUsed,
            entry.feelingRank ?? '', entry.feelingNote ?? '', entry.kickRank ?? '', entry.kickSolution ?? '',
            res1, rank1, res2, rank2,
            ...wCols,
          ]);
        };

        if (entries.length === 0) {
          // Test with no entries — still show the header row (already added above)
        } else {
          for (const entry of entries) writeEntry(entry);
        }

        // Blank separator between tests
        rows.push([]);
      }

      return { rows, boldIndices, winnerIndices };
    };

    // 🧪 Product Tests — all tests that are NOT Structure and NOT Grind.
    // Athlete race-ski tests are excluded here: they live on each athlete's
    // own 🏃 sheet (orphaned race-ski tests without an athlete are kept so
    // nothing is ever lost).
    const isAthleteRaceskiTest = (t: any) => t.testSkiSource === 'raceskis' && !!t.athleteId;
    const productTestsFiltered = allTests.filter((t: any) => !['Structure', 'Grind'].includes((t as any).testType) && !isAthleteRaceskiTest(t));
    await ensureSheet(sheets, spreadsheetId, PRODUCT_TESTS_TITLE);
    {
      const { rows: ptRows, boldIndices: ptBolds, winnerIndices: ptWins } = buildFlatTestRows(productTestsFiltered);
      const header: any[][] = [
        [`PRODUCT TESTS — ${team.name}`],
        [`Generated: ${now}  |  Total: ${productTestsFiltered.length} tests`],
        [],
        ...ptRows,
      ];
      const shiftedBolds = ptBolds.map(i => i + 3);
      await clearAndWrite(sheets, spreadsheetId, PRODUCT_TESTS_TITLE, header);
      const ptMeta = await sheets.spreadsheets.get({ spreadsheetId });
      const ptSheetId = ptMeta.data.sheets?.find((s: any) => s.properties?.title === PRODUCT_TESTS_TITLE)?.properties?.sheetId;
      if (ptSheetId !== undefined) await formatFlatTestSheet(sheets, spreadsheetId, ptSheetId, {
        totalCols: FLAT_COL_HEADER.length, headerRow: 3,
        testHeaderRows: shiftedBolds.filter(i => i !== 3),
        winnerRows: ptWins.map(i => i + 3), weatherStartCol: 21,
      }).catch((e) => console.warn('[Backup] format failed:', e));
    }

    // 📐 Structure Tests
    const structureTests = allTests.filter((t: any) => (t as any).testType === 'Structure' && !isAthleteRaceskiTest(t));
    await ensureSheet(sheets, spreadsheetId, STRUCTURE_TESTS_TITLE);
    {
      const { rows: stRows, boldIndices: stBolds, winnerIndices: stWins } = buildFlatTestRows(structureTests);
      const header: any[][] = [
        [`STRUCTURE TESTS — ${team.name}`],
        [`Generated: ${now}  |  Total: ${structureTests.length} tests`],
        [],
        ...stRows,
      ];
      const shiftedBolds = stBolds.map(i => i + 3);
      await clearAndWrite(sheets, spreadsheetId, STRUCTURE_TESTS_TITLE, header);
      const stMeta = await sheets.spreadsheets.get({ spreadsheetId });
      const stSheetId = stMeta.data.sheets?.find((s: any) => s.properties?.title === STRUCTURE_TESTS_TITLE)?.properties?.sheetId;
      if (stSheetId !== undefined) await formatFlatTestSheet(sheets, spreadsheetId, stSheetId, {
        totalCols: FLAT_COL_HEADER.length, headerRow: 3,
        testHeaderRows: shiftedBolds.filter(i => i !== 3),
        winnerRows: stWins.map(i => i + 3), weatherStartCol: 21,
      }).catch((e) => console.warn('[Backup] format failed:', e));
    }

    // ⛷️ Grind Tests
    const grindTestsList = allTests.filter((t: any) => (t as any).testType === 'Grind' && !isAthleteRaceskiTest(t));
    await ensureSheet(sheets, spreadsheetId, GRIND_TESTS_TITLE);
    {
      const { rows: gtRows, boldIndices: gtBolds, winnerIndices: gtWins } = buildFlatTestRows(grindTestsList);
      const header: any[][] = [
        [`GRIND TESTS — ${team.name}`],
        [`Generated: ${now}  |  Total: ${grindTestsList.length} tests`],
        [],
        ...gtRows,
      ];
      const shiftedBolds = gtBolds.map(i => i + 3);
      await clearAndWrite(sheets, spreadsheetId, GRIND_TESTS_TITLE, header);
      const gtMeta = await sheets.spreadsheets.get({ spreadsheetId });
      const gtSheetId = gtMeta.data.sheets?.find((s: any) => s.properties?.title === GRIND_TESTS_TITLE)?.properties?.sheetId;
      if (gtSheetId !== undefined) await formatFlatTestSheet(sheets, spreadsheetId, gtSheetId, {
        totalCols: FLAT_COL_HEADER.length, headerRow: 3,
        testHeaderRows: shiftedBolds.filter(i => i !== 3),
        winnerRows: gtWins.map(i => i + 3), weatherStartCol: 21,
      }).catch((e) => console.warn('[Backup] format failed:', e));
    }

    // ── 4. RACE PREPS SHEET ───────────────────────────────────────────────────
    await ensureSheet(sheets, spreadsheetId, RACE_PREPS_TITLE);
    const rpRows: any[][] = [
      [`RACE PREPS — ${team.name}`],
      [`Generated: ${now}`],
      [],
    ];
    const rpBoldRows: number[] = [0, 3];

    for (const rp of allRacePreps) {
      const w = rp.weather_id ? weatherById[rp.weather_id] : null;
      const entries = racePrepEntriesByPrepId[rp.id] || [];

      rpBoldRows.push(rpRows.length);
      rpRows.push([`─── Race Prep #${rp.id} ───`]);
      rpRows.push(['Date', rp.date || '', 'Start Time', rp.start_time || '', 'Location', rp.location || '']);
      rpRows.push(['Race Type', rp.race_type || '', 'Discipline', rp.discipline || '', 'Tette', rp.tette || '']);
      const glideNames = resolveProductApps(rp.product_apps, rp.product_ids) || rp.products || '';
      const structureNames = resolveProductApps(rp.structure_apps, rp.structure_ids) || rp.structure || '';
      const kickNames = resolveProductIds(rp.kick_product_ids) || '';
      rpRows.push(['Glide Products', glideNames, 'Structure', structureNames, 'Kick Products', kickNames]);
      rpRows.push(['Application / Method', rp.method || '']);
      if (w) {
        rpRows.push(['Snow Temp', w.snowTemperatureC != null ? `${w.snowTemperatureC}°C` : '',
          'Air Temp', w.airTemperatureC != null ? `${w.airTemperatureC}°C` : '',
          'Snow Humidity', w.snowHumidityPct != null ? `${w.snowHumidityPct}%` : '']);
        rpRows.push(['Snow Type', w.snowType || '', 'Track Hardness', w.trackHardness || '',
          'Snow Humidity Type', w.snowHumidityType || '']);
        if (w.wind || w.precipitation || w.artificialSnow) {
          rpRows.push(['Wind', w.wind || '', 'Precipitation', w.precipitation || '',
            'Artificial Snow', w.artificialSnow || '']);
        }
      }
      if (rp.notes) rpRows.push(['Notes', rp.notes]);
      rpRows.push(['Created By', rp.created_by_name || '', 'Created At', rp.created_at || '']);

      if (entries.length > 0) {
        rpBoldRows.push(rpRows.length);
        rpRows.push(['  Athlete', 'Ski ID (Glide)', 'Ski ID (Classic)', 'Ski ID (Skating)', 'Waxer', 'Notes', 'Athlete Rating', 'Athlete Comment']);
        for (const e of entries) {
          rpRows.push([`  ${e.athlete_name}`, e.ski_id || '', e.ski_id_classic || '', e.ski_id_skating || '', e.waxer_name || '', e.notes || '', e.athlete_rating || '', e.athlete_comment || '']);
        }
      }
      rpRows.push([]);
    }
    await clearAndWrite(sheets, spreadsheetId, RACE_PREPS_TITLE, rpRows);
    const rpMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const rpSheetId = rpMeta.data.sheets?.find((s: any) => s.properties?.title === RACE_PREPS_TITLE)?.properties?.sheetId;
    if (rpSheetId !== undefined) {
      await boldRows(sheets, spreadsheetId, rpSheetId, rpBoldRows).catch(() => {});
    }

    // ── 4b. RACE USAGE (waxer-logged race-use + athlete feedback) ──────────────
    await ensureSheet(sheets, spreadsheetId, RACE_USAGE_TITLE);
    const usageRows: any[][] = [
      [`RACE USAGE — ${team.name}`],
      [`Generated: ${now}`],
      [],
      ['Date', 'Athlete', 'Ski ID', 'Brand', 'Discipline', 'Location', 'Result', 'Athlete Rating', 'Athlete Comment', 'Notes', 'Logged By'],
    ];
    try {
      const usageRes = await (pool as any).query(
        `SELECT su.date, a.name AS athlete, rs.ski_id AS ski, rs.brand, su.discipline, su.location,
                su.result, su.athlete_rating, su.athlete_comment, su.notes, su.created_by_name
         FROM ski_race_usages su
         JOIN race_skis rs ON rs.id = su.ski_id
         JOIN athletes a ON a.id = su.athlete_id
         WHERE su.team_id = $1 ORDER BY su.date DESC NULLS LAST`,
        [teamId]
      );
      for (const u of usageRes.rows) {
        usageRows.push([u.date || '', u.athlete || '', u.ski || '', u.brand || '', u.discipline || '',
          u.location || '', u.result || '', u.athlete_rating || '', u.athlete_comment || '', u.notes || '', u.created_by_name || '']);
      }
    } catch (e) { /* table may not exist yet */ }
    await clearAndWrite(sheets, spreadsheetId, RACE_USAGE_TITLE, usageRows);
    const usageMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const usageSheetId = usageMeta.data.sheets?.find((s: any) => s.properties?.title === RACE_USAGE_TITLE)?.properties?.sheetId;
    if (usageSheetId !== undefined) await boldRows(sheets, spreadsheetId, usageSheetId, [0, 3]).catch(() => {});

    // ── 5. ATHLETE SHEETS ─────────────────────────────────────────────────────
    for (let ai = 0; ai < allAthletes.length; ai++) {
      const athlete = allAthletes[ai];
      const sheetTitle = athleteSheetTitles[ai];

      const athleteSkis = allRaceSkis.filter(s => s.athleteId === athlete.id);
      // Chronological order (oldest → newest) so each athlete's tests read as a timeline.
      const athleteTests = allTests
        .filter((t: any) => t.testSkiSource === 'raceskis' && t.athleteId === athlete.id)
        .sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));

      const rows: any[][] = [];
      const bolds: number[] = [];
      const h = (label: string) => { bolds.push(rows.length); rows.push([label]); };
      const cols = (...headers: string[]) => { bolds.push(rows.length); rows.push(headers); };

      rows.push([`ATHLETE: ${athlete.name}`]);
      rows.push(['Team', athlete.team || '', 'Created', athlete.createdAt || '']);
      rows.push([]);

      h('=== RACE SKIS ===');
      cols('ID', 'Ski ID', 'Serial', 'Brand', 'Discipline', 'Construction', 'Mold', 'Base', 'Grind', 'Heights', 'Year', 'Length', 'Type', 'Where received', 'Training', 'Notes', 'Archived');
      for (const ski of athleteSkis) {
        rows.push([ski.id, ski.skiId, ski.serialNumber || '', ski.brand || '', ski.discipline,
          ski.construction || '', ski.mold || '', ski.base || '', ski.grind || '',
          ski.heights || '', ski.year || '', ski.length || '', ski.typeOfSki || '',
          ski.whereReceived || '', ski.isTrainingSki ? 'Yes' : '', ski.notes || '',
          ski.archivedAt ? 'Yes' : '']);
      }
      rows.push([]);

      h('=== REGRIND HISTORY ===');
      cols('Ski ID', 'Date', 'Grind Type', 'Stone', 'Pattern', 'Notes');
      for (const ski of athleteSkis) {
        for (const r of raceSkiRegrinds[ski.id] || []) {
          rows.push([ski.skiId, r.date, r.grindType, r.stone || '', r.pattern || '', r.notes || '']);
        }
      }
      rows.push([]);

      h('=== RACE SKI TESTS ===');
      for (const test of athleteTests) {
        const entries = entriesByTest[test.id] || [];
        const distLabels = parseDistanceLabels((test as any).distanceLabels);
        const w = (test as any).weatherId ? weatherById[(test as any).weatherId] : null;

        bolds.push(rows.length);
        rows.push([`--- Test #${test.id}: ${(test as any).testName || test.location} ---`]);
        rows.push(['Date', test.date, 'Location', test.location, 'Type', (test as any).testType]);
        if (w) rows.push(['Weather', `Snow ${w.snowTemperatureC ?? '?'}°C`, `Air ${w.airTemperatureC ?? '?'}°C`, `Type: ${w.snowType || '—'}`, `Track: ${w.trackHardness || '—'}`]);
        if ((test as any).notes) rows.push(['Notes', (test as any).notes]);

        const headerRow = ['Ski #', 'Race Ski ID', 'Feeling Rank', 'Feeling Note'];
        if ((test as any).testType === 'Classic') headerRow.push('Kick Rank');
        if (distLabels.length > 0) {
          for (const label of distLabels) { headerRow.push(`Result ${label}`); headerRow.push(`Rank ${label}`); }
        } else {
          if ((test as any).distanceLabel0km) { headerRow.push(`Result ${(test as any).distanceLabel0km}`); headerRow.push(`Rank ${(test as any).distanceLabel0km}`); }
          if ((test as any).distanceLabelXkm) { headerRow.push(`Result ${(test as any).distanceLabelXkm}`); headerRow.push(`Rank ${(test as any).distanceLabelXkm}`); }
        }
        bolds.push(rows.length);
        rows.push(headerRow);

        for (const entry of entries) {
          let skiLabel = '';
          if (entry.raceSkiId) {
            const rs = allRaceSkis.find(s => s.id === entry.raceSkiId);
            if (rs) skiLabel = `${rs.skiId} (${rs.brand || ''} ${rs.grind || ''})`;
          }
          const row: any[] = [entry.skiNumber, skiLabel, entry.feelingRank ?? '', entry.feelingNote ?? ''];
          if ((test as any).testType === 'Classic') row.push(entry.kickRank ?? '');
          if (distLabels.length > 0) {
            const rounds = parseResultsArray(entry.results);
            for (let ri = 0; ri < distLabels.length; ri++) {
              const r = rounds[ri];
              row.push(r?.result ?? entry.result0kmCmBehind ?? '');
              row.push(r?.rank ?? entry.rank0km ?? '');
            }
          } else {
            const rounds = parseResultsArray(entry.results);
            if (rounds.length > 0) {
              row.push(rounds[0]?.result ?? ''); row.push(rounds[0]?.rank ?? '');
              if (rounds.length > 1) { row.push(rounds[1]?.result ?? ''); row.push(rounds[1]?.rank ?? ''); }
            } else {
              row.push(entry.result0kmCmBehind ?? ''); row.push(entry.rank0km ?? '');
              row.push(entry.resultXkmCmBehind ?? ''); row.push(entry.rankXkm ?? '');
            }
          }
          rows.push(row);
        }
        rows.push([]);
      }

      await clearAndWrite(sheets, spreadsheetId, sheetTitle, rows);
      const athMeta = await sheets.spreadsheets.get({ spreadsheetId });
      const athSheetId = athMeta.data.sheets?.find((s: any) => s.properties?.title === sheetTitle)?.properties?.sheetId;
      if (athSheetId !== undefined) await boldRows(sheets, spreadsheetId, athSheetId, bolds).catch(() => {});
    }

    // ── 6. GRINDS SHEET ───────────────────────────────────────────────────────
    await ensureSheet(sheets, spreadsheetId, GRINDS_TITLE);
    const grindRows: any[][] = [
      [`GRINDS — ${team.name}`],
      [`Generated: ${now}`],
      [],
      ['=== GRIND PROFILES ==='],
      ['ID', 'Name', 'Type', 'Stone', 'Pattern', 'Extra Params', 'Created By', 'Created At'],
    ];
    const grindBolds = [0, 3, 4];
    for (const gp of allGrindProfiles) {
      let extraStr = '';
      if (gp.extraParams) {
        try { extraStr = Object.entries(JSON.parse(gp.extraParams)).map(([k, v]) => `${k}: ${v}`).join(', '); }
        catch { extraStr = gp.extraParams; }
      }
      grindRows.push([gp.id, gp.name, gp.grindType, gp.stone || '', gp.pattern || '', extraStr, gp.createdByName || '', gp.createdAt || '']);
    }
    grindRows.push([]);
    grindBolds.push(grindRows.length);
    grindRows.push(['=== GRINDING RECORDS ===']);
    grindBolds.push(grindRows.length);
    grindRows.push(['ID', 'Date', 'Group/Series', 'Grind Type', 'Stone', 'Notes', 'Created By', 'Created At']);
    for (const gr of allGrindingRecords) {
      grindRows.push([gr.id, gr.date, gr.groupScope || '', gr.grindType, gr.stone || '', gr.notes || '', gr.createdByName || '', gr.createdAt || '']);
    }
    grindRows.push([]);
    grindBolds.push(grindRows.length);
    grindRows.push(['=== GRINDING SHEETS (LINKED) ===']);
    grindBolds.push(grindRows.length);
    grindRows.push(['ID', 'Name', 'URL', 'Group Scope', 'Created By', 'Created At']);
    for (const gs of allGrindingSheets) {
      grindRows.push([gs.id, gs.name, gs.url, gs.groupScope, gs.createdByName, gs.createdAt]);
    }
    await clearAndWrite(sheets, spreadsheetId, GRINDS_TITLE, grindRows);
    const grindMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const grindSheetId = grindMeta.data.sheets?.find((s: any) => s.properties?.title === GRINDS_TITLE)?.properties?.sheetId;
    if (grindSheetId !== undefined) await boldRows(sheets, spreadsheetId, grindSheetId, grindBolds).catch(() => {});

    // ── 7. STOCK CHANGES SHEET ────────────────────────────────────────────────
    await ensureSheet(sheets, spreadsheetId, STOCK_TITLE);
    const stockRows: any[][] = [
      [`STOCK CHANGES — ${team.name}`],
      [`Generated: ${now}`],
      [],
      ['ID', 'Date', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details', 'Group Scope'],
    ];
    for (const sc of allStockChanges) {
      stockRows.push([
        sc.id, sc.createdAt, sc.userName || '', sc.action, sc.entityType,
        sc.entityId ?? '', sc.details || '', (sc as any).groupScope || '',
      ]);
    }
    await clearAndWrite(sheets, spreadsheetId, STOCK_TITLE, stockRows);

    // ── Complete-coverage sheets: Kick, Ski Garage, Testfleets, Products, Weather ──
    // These make the spreadsheet a full reference of the system: every area is
    // present, so the backup can be used standalone if the app is unavailable.
    const fleetSkisRes = await (pool as any).query(`SELECT * FROM race_skis WHERE athlete_id IS NULL AND team_id = $1 ORDER BY ski_id`, [teamId]).catch(() => ({ rows: [] }));
    const kickSkisRes = await (pool as any).query(`SELECT * FROM kick_skis WHERE team_id = $1 ORDER BY name`, [teamId]).catch(() => ({ rows: [] }));
    const kickTestsRes = await (pool as any).query(`SELECT * FROM kick_tests WHERE team_id = $1 ORDER BY date DESC`, [teamId]).catch(() => ({ rows: [] }));
    const kickEntriesRes = await (pool as any).query(`SELECT * FROM kick_test_entries WHERE kick_test_id IN (SELECT id FROM kick_tests WHERE team_id = $1)`, [teamId]).catch(() => ({ rows: [] }));
    const kickMixesRes = await (pool as any).query(`SELECT * FROM kick_mixes WHERE team_id = $1 ORDER BY name`, [teamId]).catch(() => ({ rows: [] }));
    const kickSkiName = new Map<number, string>(kickSkisRes.rows.map((k: any) => [k.id, k.name]));

    const kickRows: any[][] = [['KICK SKIS'], ['Name', 'Brand', 'Grind', 'Heights', 'Type', 'Color', 'Notes', 'Archived']];
    for (const k of kickSkisRes.rows) kickRows.push([k.name ?? '', k.brand ?? '', k.grind ?? '', k.heights ?? '', k.type_of_ski ?? '', k.color ?? '', k.notes ?? '', k.archived_at ? 'yes' : '']);
    kickRows.push([], ['KICK TESTS']);
    for (const kt of kickTestsRes.rows) {
      const w = kt.weather_id ? weatherById[kt.weather_id] : null;
      kickRows.push([`${kt.date ?? ''} — ${kt.location ?? ''}`, kt.test_persons ?? '', w ? `Snow ${w.snowTemperatureC}°C / Air ${w.airTemperatureC}°C` : '', kt.notes ?? '']);
      kickRows.push(['', 'Ski', 'Binder', 'Kick solution', 'Feeling rank', 'Feeling notes']);
      for (const e of kickEntriesRes.rows.filter((x: any) => x.kick_test_id === kt.id)) {
        kickRows.push(['', kickSkiName.get(e.kick_ski_id) ?? e.kick_ski_id, e.binder ?? '', e.kick_solution ?? '', e.feeling_rank ?? '', e.feeling_notes ?? '']);
      }
      kickRows.push([]);
    }
    kickRows.push(['KICK MIXES'], ['Name', 'Type', 'Hardwax', 'Roller temp', 'Products', 'Notes']);
    for (const m of kickMixesRes.rows) kickRows.push([m.name ?? '', m.mix_type ?? '', m.hardwax ?? '', m.roller_temperature ?? '', m.products ?? '', m.notes ?? '']);
    await clearAndWrite(sheets, spreadsheetId, KICK_TITLE, kickRows);

    const garageRows: any[][] = [['Owner', 'Ski ID', 'Serial', 'Brand', 'Discipline', 'Construction', 'Mold', 'Base', 'Grind', 'Heights', 'Year', 'Length', 'Type', 'Training', 'Sitski', 'Archived', 'Notes']];
    for (const skl of allRaceSkis) garageRows.push([(skl as any).athleteName ?? '', skl.skiId ?? '', skl.serialNumber ?? '', skl.brand ?? '', skl.discipline ?? '', skl.construction ?? '', skl.mold ?? '', skl.base ?? '', skl.grind ?? '', skl.heights ?? '', skl.year ?? '', (skl as any).length ?? '', (skl as any).typeOfSki ?? '', (skl as any).isTrainingSki ? 'yes' : '', (skl as any).isSitski ? 'yes' : '', skl.archivedAt ? 'yes' : '', (skl as any).notes ?? '']);
    for (const r of fleetSkisRes.rows) garageRows.push(['TEAM FLEET', r.ski_id ?? '', r.serial_number ?? '', r.brand ?? '', r.discipline ?? '', r.construction ?? '', r.mold ?? '', r.base ?? '', r.grind ?? '', r.heights ?? '', r.year ?? '', r.length ?? '', r.type_of_ski ?? '', r.is_training_ski ? 'yes' : '', r.is_sitski ? 'yes' : '', r.archived_at ? 'yes' : '', r.notes ?? '']);
    await clearAndWrite(sheets, spreadsheetId, GARAGE_TITLE, garageRows);

    const testfleetRows: any[][] = [['Name', 'Discipline', 'Brand', 'Pairs', 'Group', 'Created', 'Notes']];
    for (const sr of allSeries as any[]) testfleetRows.push([sr.name ?? '', sr.discipline ?? '', sr.brand ?? '', sr.numberOfPairs ?? sr.pairCount ?? '', sr.groupScope ?? '', sr.createdAt ?? '', sr.notes ?? '']);
    await clearAndWrite(sheets, spreadsheetId, TESTFLEETS_TITLE, testfleetRows);

    const productCatalogRows: any[][] = [['Brand', 'Name', 'Category', 'Stock', 'Group', 'Archived', 'Created']];
    for (const pr of allProducts as any[]) productCatalogRows.push([pr.brand ?? '', pr.name ?? '', pr.category ?? '', pr.stockQuantity ?? '', pr.groupScope ?? '', '', pr.createdAt ?? '']);
    for (const pr of allArchivedProducts as any[]) productCatalogRows.push([pr.brand ?? '', pr.name ?? '', pr.category ?? '', pr.stockQuantity ?? '', pr.groupScope ?? '', 'YES', pr.createdAt ?? '']);
    await clearAndWrite(sheets, spreadsheetId, PRODUCTS_TITLE, productCatalogRows);

    const weatherSheetRows: any[][] = [['Date', 'Time', 'Location', 'Snow °C', 'Air °C', 'Snow hum %', 'Air hum %', 'Snow type', 'Artificial', 'Natural', 'Hum. type', 'Grain', 'Track', 'Precipitation', 'Wind', 'Visibility', 'Clouds %', 'Group']];
    for (const w of allWeather as any[]) weatherSheetRows.push([w.date ?? '', w.time ?? '', w.location ?? '', w.snowTemperatureC ?? '', w.airTemperatureC ?? '', w.snowHumidityPct ?? '', w.airHumidityPct ?? '', w.snowType ?? '', w.artificialSnow ?? '', w.naturalSnow ?? '', w.snowHumidityType ?? '', w.grainSize ?? '', w.trackHardness ?? '', w.precipitation ?? '', w.wind ?? '', w.visibility ?? '', w.clouds ?? '', w.groupScope ?? '']);
    await clearAndWrite(sheets, spreadsheetId, WEATHER_TITLE, weatherSheetRows);

    // ── 8. OVERVIEW SHEET ─────────────────────────────────────────────────────
    await ensureSheet(sheets, spreadsheetId, OVERVIEW_TITLE);
    const allTestEntries = allEntries.length;
    const overviewRows: any[][] = [
      ['GLIDR DATABASE BACKUP'],
      [`Team: ${team.name}`],
      [`Last backup: ${now}`],
      [],
      ['=== DATA SUMMARY ==='],
      ['Entity', 'Count'],
      ['Tests (all types)', allTests.length],
      ['  — Product tests', productTestsFiltered.length],
      ['  — Structure tests', structureTests.length],
      ['  — Grind tests', grindTestsList.length],
      ['Test entries', allTestEntries],
      ['Weather logs', allWeather.length],
      ['Products (active)', allProducts.length],
      ['Products (archived)', allArchivedProducts.length],
      ['Test ski series', allSeries.length],
      ['Athletes', allAthletes.length],
      ['Race skis', allRaceSkis.length],
      ['Race preps', allRacePreps.length],
      ['Race prep entries', racePrepEntriesResult.rows.length],
      ['Grind profiles', allGrindProfiles.length],
      ['Grinding records', allGrindingRecords.length],
      ['Grinding sheets (linked)', allGrindingSheets.length],
      ['Stock changes', allStockChanges.length],
      ['Team members', allTeamUsers.length],
      [],
      ['=== SHEET INDEX ==='],
      ['Sheet', 'Contents'],
      [OVERVIEW_TITLE, 'This summary page'],
      [TEAM_TITLE, 'All team members and roles'],
      ...groupSheetTitles.map((t, i) => [t, `Products, Test Ski Series, Weather for group "${groupNames[i]}"`]),
      [PRODUCT_TESTS_TITLE, `All product tests (Glide, Classic, Skating, Double Poling) — flat table, ${productTestsFiltered.length} tests. Athlete race-ski tests live on each athlete's 🏃 sheet`],
      [STRUCTURE_TESTS_TITLE, `All structure tests — flat table, ${structureTests.length} tests`],
      [GRIND_TESTS_TITLE, `All grind tests — flat table, ${grindTestsList.length} tests`],
      [RACE_PREPS_TITLE, 'All race preps with products, application, weather and per-athlete entries'],
      [RACE_USAGE_TITLE, 'Waxer-logged race usage per ski pair, with athlete rating/comment'],
      ...athleteSheetTitles.map((t, i) => [t, `Race skis, regrind history, race ski tests for ${(allAthletes[i] as any).name}`]),
      [GRINDS_TITLE, 'Grind profiles, grinding records, linked grinding sheets'],
      [STOCK_TITLE, 'Product stock change history'],
      [],
      ['=== GROUPS ==='],
      ['Group Name', 'Tests', 'Products', 'Weather', 'Series'],
      ...groupNames.map(g => [
        g,
        allTests.filter((t: any) => t.groupScope === g).length,
        allProducts.filter((p: any) => p.groupScope === g).length,
        allWeather.filter((w: any) => w.groupScope === g).length,
        allSeries.filter((s: any) => s.groupScope === g).length,
      ]),
    ];
    await clearAndWrite(sheets, spreadsheetId, OVERVIEW_TITLE, overviewRows);

    // ── Reorder sheets logically ──────────────────────────────────────────────
    await reorderSheets(sheets, spreadsheetId, orderedTitles);

    // Success clears any previous failure so the status card shows ✓ truthfully.
    await storage.updateTeam(teamId, { lastBackupAt: now, lastBackupError: null, lastBackupErrorAt: null } as any);
    return { success: true };

  } catch (err: any) {
    console.error('[Backup] Error for team', teamId, err);
    const msg = (err.message || 'Unknown error').slice(0, 300);
    const wasHealthy = !team.lastBackupError;
    await storage.updateTeam(teamId, { lastBackupError: msg, lastBackupErrorAt: new Date().toISOString() } as any).catch(() => {});
    if (wasHealthy) await notifyBackupFailure(teamId, team.name, msg);
    return { success: false, error: msg };
  }
}

// ── Google Drive backup ───────────────────────────────────────────────────────

// ── Shared JSON export engine (used by Drive backup + download routes) ──────
//
// FUTURE-PROOF BY DESIGN: instead of a hand-maintained list of tables (which
// silently rots as features are added), the engine discovers EVERY table in
// the database at runtime via information_schema:
//   • tables with a team_id column are included automatically, filtered per team
//   • known child tables without team_id are included via the parent joins below
//   • anything else is listed in meta.skippedTables with a reason — a gap is
//     always VISIBLE in the export itself, never silent
// New tables added later are therefore picked up automatically (or flagged).

// Never exported: live sessions and reset tokens.
const EXPORT_SYSTEM_TABLES = new Set(["user_sessions", "password_reset_tokens"]);
// Columns stripped for safety/size (documented in meta.sanitizedColumns).
const EXPORT_COLUMN_EXCLUDES: Record<string, string[]> = {
  users: ["password", "totp_secret", "totp_backup_codes"],
  test_attachments: ["data"], // binary blobs — metadata + url are kept
  watch_app: ["data"],        // binary blob — metadata is kept
};
// Team filters for child tables that have no team_id of their own.
const EXPORT_CHILD_JOINS: Record<string, string> = {
  race_skis: "(team_id = $1 OR athlete_id IN (SELECT id FROM athletes WHERE team_id = $1))",
  test_entries: "test_id IN (SELECT id FROM tests WHERE team_id = $1)",
  test_comments: "test_id IN (SELECT id FROM tests WHERE team_id = $1)",
  test_attachments: "test_id IN (SELECT id FROM tests WHERE team_id = $1)",
  runsheet_progress: "test_id IN (SELECT id FROM tests WHERE team_id = $1)",
  race_ski_regrinds: "race_ski_id IN (SELECT rs.id FROM race_skis rs LEFT JOIN athletes a ON a.id = rs.athlete_id WHERE rs.team_id = $1 OR a.team_id = $1)",
  test_ski_regrinds: "series_id IN (SELECT id FROM test_ski_series WHERE team_id = $1)",
  athlete_access: "athlete_id IN (SELECT id FROM athletes WHERE team_id = $1)",
  kick_test_entries: "kick_test_id IN (SELECT id FROM kick_tests WHERE team_id = $1)",
  race_prep_entries: "race_prep_id IN (SELECT id FROM race_preps WHERE team_id = $1)",
  user_teams: "team_id = $1",
};

async function dumpAllTables(teamId: number | null, includeOwnerCompliance: boolean): Promise<{ tables: Record<string, any[]>; counts: Record<string, number>; skipped: { table: string; reason: string }[] }> {
  const { pool } = await import('./db');
  const colRes = await (pool as any).query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`
  );
  const colsByTable = new Map<string, string[]>();
  for (const r of colRes.rows) {
    if (!colsByTable.has(r.table_name)) colsByTable.set(r.table_name, []);
    colsByTable.get(r.table_name)!.push(r.column_name);
  }

  const tables: Record<string, any[]> = {};
  const counts: Record<string, number> = {};
  const skipped: { table: string; reason: string }[] = [];

  for (const [table, columns] of [...colsByTable.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (EXPORT_SYSTEM_TABLES.has(table)) { skipped.push({ table, reason: 'system table (sessions/reset tokens) — never exported' }); continue; }
    const excluded = EXPORT_COLUMN_EXCLUDES[table] ?? [];
    const selectCols = columns.filter((c) => !excluded.includes(c)).map((c) => `"${c}"`).join(', ');
    let where = '';
    let params: any[] = [];
    if (teamId != null) {
      if (EXPORT_CHILD_JOINS[table]) { where = ` WHERE ${EXPORT_CHILD_JOINS[table]}`; params = [teamId]; }
      else if (columns.includes('team_id')) { where = ' WHERE team_id = $1'; params = [teamId]; }
      else { skipped.push({ table, reason: 'no team link — global table, covered by the Super Admin full-system export' }); continue; }
    }
    // Terms-acceptance records are owner-level compliance data — SA only.
    if (table === 'activity_logs' && !includeOwnerCompliance) {
      where += (where ? ' AND ' : ' WHERE ') + "action NOT IN ('accepted_terms','terms_reset')";
    }
    try {
      const r = await (pool as any).query(`SELECT ${selectCols} FROM "${table}"${where} ORDER BY 1 ASC`, params);
      tables[table] = r.rows;
      counts[table] = r.rows.length;
    } catch (e: any) {
      skipped.push({ table, reason: `query failed: ${String(e?.message ?? e).slice(0, 100)}` });
    }
  }
  return { tables, counts, skipped };
}

export async function buildTeamJsonExport(teamId: number, includeOwnerCompliance = false): Promise<string> {
  const team = await storage.getTeam(teamId);
  const { tables, counts, skipped } = await dumpAllTables(teamId, includeOwnerCompliance);
  return JSON.stringify({
    meta: {
      format: 2,
      scope: 'team',
      teamId,
      teamName: team?.name ?? null,
      exportedAt: new Date().toISOString(),
      note: 'Complete team export. Every database table is discovered automatically at export time; tables without a team link are listed in skippedTables and are covered by the Super Admin full-system export.',
      tableCounts: counts,
      skippedTables: skipped,
      sanitizedColumns: EXPORT_COLUMN_EXCLUDES,
    },
    tables,
  }, null, 2);
}

// Full-system export (Super Admin): every table, every team, plus the global
// tables that have no team link. Same engine, no team filter.
export async function buildSystemJsonExport(): Promise<string> {
  const { tables, counts, skipped } = await dumpAllTables(null, true);
  return JSON.stringify({
    meta: {
      format: 2,
      scope: 'system',
      exportedAt: new Date().toISOString(),
      note: 'Complete system export across all teams. Every database table is discovered automatically at export time.',
      tableCounts: counts,
      skippedTables: skipped,
      sanitizedColumns: EXPORT_COLUMN_EXCLUDES,
    },
    tables,
  }, null, 2);
}

function extractDriveFolderId(urlOrId: string): string {
  // Accept full URL like https://drive.google.com/drive/folders/FOLDER_ID
  // or a bare folder ID
  const m = urlOrId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : urlOrId.trim();
}

// ── Server-side PDF generation (same content as admin "Download PDF" button) ──

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function htmlTable(head: string[], rows: string[][], small = false): string {
  const fs = small ? '6pt' : '7pt';
  const ths = head.map(h => `<th>${esc(h)}</th>`).join('');
  const trs = rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<table style="font-size:${fs}"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function htmlSection(title: string, content: string): string {
  return `<div class="section"><h2>${esc(title)}</h2>${content}</div>`;
}

function buildExportHtml(data: {
  teamName: string; tests: any[]; entriesByTest: Record<number, any[]>;
  weather: any[]; series: any[]; products: any[]; users: any[];
  groups: any[]; athletes: any[]; raceSkis: any[]; raceSkiRegrinds: any[];
  testSkiRegrinds: any[]; grindProfiles: any[]; grindingRecords: any[];
  grindingSheets: any[]; activities: any[]; loginLogs: any[];
  racePreps: any[]; racePrepEntries: any[]; raceUsage?: any[];
  kickSkis?: any[]; kickTests?: any[]; kickEntries?: any[]; kickMixes?: any[]; fleetSkis?: any[];
}): string {
  const productMap     = new Map(data.products.map((p: any)     => [p.id, p]));
  const raceSkiMap     = new Map(data.raceSkis.map((s: any)     => [s.id, s]));
  const seriesMap      = new Map(data.series.map((s: any)       => [s.id, s]));
  const athleteMap     = new Map(data.athletes.map((a: any)     => [a.id, a]));
  const grindProfileMap = new Map(data.grindProfiles.map((gp: any) => [gp.id, gp]));
  const weatherById    = new Map(data.weather.map((w: any)      => [w.id, w]));

  const resolveIds = (raw: string | null | undefined): string => {
    if (!raw) return '';
    if (raw.split(',').some((p: string) => isNaN(Number(p.trim())))) return raw;
    const ids = raw.split(',').map((p: string) => parseInt(p.trim())).filter((n: number) => !isNaN(n));
    const resolved = ids.map((id: number) => { const p = productMap.get(id); return p ? `${p.brand || ''} ${p.name}`.trim() : ''; }).filter(Boolean).join(' + ');
    return resolved || raw;
  };
  // Per-product application: "Brand Name (app) + ...". Falls back to comma-sep IDs.
  const resolveApps = (appsJson: string | null | undefined, idsFallback: string | null | undefined): string => {
    if (appsJson) {
      try {
        const arr = JSON.parse(appsJson);
        if (Array.isArray(arr)) {
          return arr.map((x: any) => {
            const p = productMap.get(x.productId);
            const nm = p ? `${p.brand || ''} ${p.name}`.trim() : '';
            if (!nm) return '';
            return x.application ? `${nm} (${x.application})` : nm;
          }).filter(Boolean).join(' + ');
        }
      } catch {}
    }
    return resolveIds(idsFallback);
  };

  const getProductLabel = (entry: any, forAthleteTest = false): string => {
    if (entry.grindProfileId) {
      const gp = grindProfileMap.get(entry.grindProfileId);
      if (gp) return [gp.name, gp.grindType, gp.stone, gp.pattern].filter(Boolean).join(' · ');
    }
    if (entry.raceSkiId) {
      const ski = raceSkiMap.get(entry.raceSkiId);
      if (ski) return forAthleteTest
        ? `${ski.brand || ''} ${ski.skiId || ''}`.trim()
        : `${ski.athleteName} — ${ski.brand || ''} ${ski.skiId || ''}`.trim();
    }
    const main = productMap.get(entry.productId);
    const parts: string[] = [];
    if (main) parts.push(`${main.brand || ''} ${main.name}`.trim());
    if (entry.freeTextProduct && !main) parts.push(entry.freeTextProduct);
    if (entry.additionalProductIds) {
      try {
        const raw = entry.additionalProductIds;
        const ids = typeof raw === 'string'
          ? (raw.startsWith('[') ? JSON.parse(raw) : raw.split(',').map(Number).filter((n: number) => !isNaN(n)))
          : raw;
        if (Array.isArray(ids)) {
          for (const id of ids) {
            const p = productMap.get(id);
            if (p) parts.push(`${p.brand || ''} ${p.name}`.trim());
          }
        }
      } catch {}
    }
    return parts.join(' + ') || entry.freeTextProduct || '—';
  };

  const renderWeatherLine = (w: any): string => {
    const parts: string[] = [];
    if (w.snowTemperatureC != null) parts.push(`Snow: ${w.snowTemperatureC}°C`);
    if (w.airTemperatureC != null) parts.push(`Air: ${w.airTemperatureC}°C`);
    if (w.snowHumidityPct != null) parts.push(`Snow hum: ${w.snowHumidityPct}%`);
    if (w.airHumidityPct != null) parts.push(`Air hum: ${w.airHumidityPct}%rH`);
    const st = [w.artificialSnow ? `Art. snow: ${w.artificialSnow}` : null, w.naturalSnow ? `Nat. snow: ${w.naturalSnow}` : null].filter(Boolean).join(', ');
    if (st) parts.push(st);
    if (w.trackHardness) parts.push(`Track: ${w.trackHardness}`);
    if (w.grainSize) parts.push(`Grain: ${w.grainSize}`);
    if (w.wind) parts.push(`Wind: ${w.wind}`);
    if (w.clouds != null) parts.push(`Clouds: ${w.clouds}/8`);
    if (w.precipitation) parts.push(`Precip: ${w.precipitation}`);
    if (w.testQuality != null) parts.push(`Quality: ${w.testQuality}/10`);
    return parts.join('  ·  ');
  };

  const getEntryRounds = (entry: any, numRounds: number): { result: any; rank: any }[] => {
    if (entry.results) {
      try {
        const parsed = typeof entry.results === 'string' ? JSON.parse(entry.results) : entry.results;
        if (Array.isArray(parsed)) {
          while (parsed.length < numRounds) parsed.push({ result: null, rank: null });
          return parsed.slice(0, numRounds);
        }
      } catch {}
    }
    const rs = [{ result: entry.result0kmCmBehind ?? entry.result_0km_cm_behind, rank: entry.rank0km ?? entry.rank_0km }];
    if (numRounds > 1) rs.push({ result: entry.resultXkmCmBehind ?? entry.result_xkm_cm_behind, rank: entry.rankXkm ?? entry.rank_xkm });
    while (rs.length < numRounds) rs.push({ result: null, rank: null });
    return rs;
  };

  let body = '';

  // Users
  body += htmlSection(`Users (${data.users.length})`, htmlTable(
    ['Name', 'Email', 'Role', 'Group'],
    data.users.map((u: any) => [u.name, u.email, (u.isAdmin || u.isAdmin === 1) ? 'Super Admin' : (u.isTeamAdmin || u.isTeamAdmin === 1) ? 'Team Admin' : 'Member', u.groupScope || ''])
  ));

  // Groups
  body += htmlSection(`Groups (${data.groups.length})`, htmlTable(
    ['ID', 'Name'],
    data.groups.map((g: any) => [String(g.id), g.name])
  ));

  // Testski series
  body += htmlSection(`Testski Series (${data.series.length})`, htmlTable(
    ['Name', 'Type', 'Brand', 'Ski Type', 'Skis', 'Grind', 'Group'],
    data.series.map((s: any) => [s.name, s.type, s.brand || '', s.skiType || '', String(s.numberOfSkis || ''), s.grind || '', s.groupScope])
  ));

  // Products
  body += htmlSection(`Products (${data.products.length})`, htmlTable(
    ['Brand', 'Name', 'Type', 'Group'],
    data.products.map((p: any) => [p.brand || '', p.name, p.category || '', p.groupScope])
  ));

  // Athletes
  if (data.athletes.length > 0) {
    body += htmlSection(`Athletes (${data.athletes.length})`, htmlTable(
      ['Name', 'Team'],
      data.athletes.map((a: any) => [a.name, a.team || ''])
    ));
  }

  // Race skis
  if (data.raceSkis.length > 0) {
    body += htmlSection(`Raceskis (${data.raceSkis.length})`, htmlTable(
      ['Athlete', 'Ski ID', 'Brand', 'Discipline', 'Construction', 'Mold', 'Base', 'Grind', 'Year'],
      data.raceSkis.map((s: any) => [s.athleteName || '', s.skiId || '', s.brand || '', s.discipline || '', s.construction || '', s.mold || '', s.base || '', s.grind || '', String(s.year || '')]),
      true
    ));
  }

  // Raceski regrinds
  if (data.raceSkiRegrinds.length > 0) {
    body += htmlSection(`Raceski Regrinds (${data.raceSkiRegrinds.length})`, htmlTable(
      ['Athlete', 'Ski ID', 'Brand', 'Date', 'Grind Type', 'Stone', 'Pattern', 'Notes'],
      data.raceSkiRegrinds.map((r: any) => [r.athleteName || '', r.skiId || '', r.brand || '', r.date || '', r.grindType || '', r.stone || '', r.pattern || '', r.notes || ''])
    ));
  }

  // Testski series regrinds
  if (data.testSkiRegrinds.length > 0) {
    body += htmlSection(`Testski Series Regrinds (${data.testSkiRegrinds.length})`, htmlTable(
      ['Series', 'Date', 'Grind Type', 'Stone', 'Pattern', 'Notes'],
      data.testSkiRegrinds.map((r: any) => [r.seriesName || '', r.date || '', r.grindType || '', r.stone || '', r.pattern || '', r.notes || ''])
    ));
  }

  // Tests with entries
  const sortedTests = [...data.tests].sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
  const grindTests  = sortedTests.filter((t: any) => t.testType === 'Grind' || t.testType === 'Grinding');
  const nonGrind    = sortedTests.filter((t: any) => t.testType !== 'Grind' && t.testType !== 'Grinding');
  // Athlete (race-ski) tests are grouped per athlete below; everything else is the flat list.
  const athleteTestsAll = nonGrind.filter((t: any) => t.testSkiSource === 'raceskis' && t.athleteId);
  const otherTests  = nonGrind.filter((t: any) => !(t.testSkiSource === 'raceskis' && t.athleteId));

  const renderTestsHtml = (tests: any[]): string => {
    let html = '';
    for (const test of tests) {
      const entries: any[] = data.entriesByTest[test.id] || [];
      const seriesObj   = seriesMap.get(test.seriesId);
      const athleteObj  = test.athleteId ? athleteMap.get(test.athleteId) : null;
      const isAthleteTest = test.testSkiSource === 'raceskis' && !!athleteObj;
      const isGrind     = test.testType === 'Grind' || test.testType === 'Grinding';
      const sourceName  = isAthleteTest ? athleteObj.name : (seriesObj ? seriesObj.name : '');
      const linkedWeather = test.weatherId ? weatherById.get(test.weatherId) : null;

      let distanceLabels: string[] = [];
      if (test.distanceLabels) {
        try {
          const p = typeof test.distanceLabels === 'string' ? JSON.parse(test.distanceLabels) : test.distanceLabels;
          if (Array.isArray(p) && p.length > 0) distanceLabels = p;
        } catch {}
      }
      if (distanceLabels.length === 0) {
        distanceLabels = [test.distanceLabel0km || '0 km'];
        if (test.distanceLabelXkm) distanceLabels.push(test.distanceLabelXkm);
      }

      const isClassic = test.testType === 'Classic';
      const heading = isAthleteTest
        ? `${esc(test.date)} — ${esc(test.testType)} — ${esc(test.location || '')} — Athlete: ${esc(sourceName)}`
        : `${esc(test.date)} — ${esc(test.testType)} — ${esc(test.location || '')}${sourceName ? ` — ${esc(sourceName)}` : ''}`;

      const metaParts = [`Group: ${test.groupScope}`, test.createdByName ? `Created by: ${test.createdByName}` : null, test.notes ? `Notes: ${test.notes}` : null].filter(Boolean);

      const weatherHtml = linkedWeather
        ? `<div class="test-weather">Weather/Conditions: ${esc(renderWeatherLine(linkedWeather))}</div>`
        : '';

      // Grind parameters inline
      const grindEntries = entries.filter((e: any) => e.grindType || e.grindStone || e.grindPattern || e.grindExtraParams || e.grindProfileId);
      let grindParamsHtml = '';
      if (grindEntries.length > 0) {
        const seen = new Set<string>();
        for (const e of grindEntries) {
          const gp = e.grindProfileId ? grindProfileMap.get(e.grindProfileId) : null;
          const parts = [
            (gp?.grindType || e.grindType) ? `Type: ${gp?.grindType || e.grindType}` : null,
            (gp?.stone || e.grindStone) ? `Stone: ${gp?.stone || e.grindStone}` : null,
            (gp?.pattern || e.grindPattern) ? `Pattern: ${gp?.pattern || e.grindPattern}` : null,
            e.grindExtraParams ? `Extra: ${e.grindExtraParams}` : null,
          ].filter(Boolean).join('  ·  ');
          if (parts && !seen.has(parts)) {
            seen.add(parts);
            grindParamsHtml += `<div class="test-grind">Grind params: ${esc(parts)}</div>`;
          }
        }
      }

      const productColLabel = isGrind ? 'Grind Profile' : (isAthleteTest ? 'Ski (brand/ID)' : 'Product / Raceski');
      const head = ['Rank', 'Ski #', productColLabel, 'Method'];
      for (const lbl of distanceLabels) { head.push(`${lbl} (cm)`); head.push('Rank'); }
      if (isClassic) head.push('Kick');
      head.push('Feeling');

      const rows = entries
        .map((e: any) => { const rounds = getEntryRounds(e, distanceLabels.length); return { e, rounds, firstRank: rounds[0]?.rank ?? 999 }; })
        .sort((a: any, b: any) => a.firstRank - b.firstRank)
        .map(({ e, rounds }: any) => {
          const row: string[] = [rounds[0]?.rank != null ? String(rounds[0].rank) : '—', String(e.skiNumber || ''), getProductLabel(e, isAthleteTest), e.methodology || ''];
          for (const rr of rounds) { row.push(rr.result != null ? String(rr.result) : '—'); row.push(rr.rank != null ? String(rr.rank) : '—'); }
          if (isClassic) row.push(e.kickRank != null ? String(e.kickRank) : '—');
          row.push(
            e.feelingRank != null
              ? String(e.feelingRank) + (e.feelingNote ? ` — ${e.feelingNote}` : '')
              : (e.feelingNote || '—')
          );
          return row;
        });

      html += `<div class="test-block">
        <div class="test-header">${heading}</div>
        <div class="test-meta">${esc(metaParts.join('  |  '))}</div>
        ${weatherHtml}${grindParamsHtml}
        ${entries.length > 0 ? htmlTable(head, rows, true) : '<p class="no-entries">No entries</p>'}
      </div>`;
    }
    return html;
  };

  if (otherTests.length > 0) {
    body += htmlSection(`Tests with Results (${otherTests.length})`, renderTestsHtml(otherTests));
  }

  // Athlete race-ski tests — grouped per athlete, each athlete's tests in
  // chronological order. This is the critical view for a stand-alone backup.
  if (athleteTestsAll.length > 0) {
    const byAthlete = new Map<number, any[]>();
    for (const t of athleteTestsAll) {
      if (!byAthlete.has(t.athleteId)) byAthlete.set(t.athleteId, []);
      byAthlete.get(t.athleteId)!.push(t);
    }
    const orderedAthletes = [...data.athletes].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    // Include any athlete ids present in tests but missing from the athlete list.
    const extraIds = [...byAthlete.keys()].filter((id) => !orderedAthletes.some((a: any) => a.id === id));
    let perAthHtml = '';
    const renderFor = (athId: number, athName: string) => {
      const tests = (byAthlete.get(athId) || []).sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
      if (tests.length === 0) return;
      perAthHtml += `<div class="athlete-sub">${esc(athName)} (${tests.length})</div>` + renderTestsHtml(tests);
    };
    for (const a of orderedAthletes) renderFor(a.id, a.name);
    for (const id of extraIds) renderFor(id, athleteMap.get(id)?.name || `Athlete #${id}`);
    body += htmlSection(`Athlete Race-Ski Tests (by athlete, ${athleteTestsAll.length})`, perAthHtml);
  }

  if (grindTests.length > 0) {
    body += htmlSection(`Grind Tests (${grindTests.length})`, renderTestsHtml(grindTests));
  }

  // Weather
  if (data.weather.length > 0) {
  // ── Kick (skis, tests, mixes) ──────────────────────────────────────────────
  if (data.kickSkis?.length || data.kickTests?.length || data.kickMixes?.length) {
    if (data.kickSkis?.length) {
      body += htmlSection(`Kick Skis (${data.kickSkis.length})`, htmlTable(
        ['Name', 'Brand', 'Grind', 'Heights', 'Type', 'Color', 'Notes', 'Archived'],
        data.kickSkis.map((k: any) => [esc(k.name), esc(k.brand), esc(k.grind), esc(k.heights), esc(k.type_of_ski), esc(k.color), esc(k.notes), k.archived_at ? 'yes' : '']), true));
    }
    if (data.kickTests?.length) {
      const kickSkiName = new Map<number, string>((data.kickSkis ?? []).map((k: any) => [k.id, k.name]));
      let kickHtml = '';
      for (const kt of data.kickTests) {
        const w = kt.weather_id ? weatherById.get(kt.weather_id) : null;
        kickHtml += `<p><strong>${esc(kt.date)} — ${esc(kt.location)}</strong>${kt.test_persons ? ' · ' + esc(kt.test_persons) : ''}${w ? ` · Snow ${esc((w as any).snowTemperatureC)}°C / Air ${esc((w as any).airTemperatureC)}°C` : ''}${kt.notes ? '<br/><em>' + esc(kt.notes) + '</em>' : ''}</p>`;
        const entries = (data.kickEntries ?? []).filter((e: any) => e.kick_test_id === kt.id);
        if (entries.length) {
          kickHtml += htmlTable(['Ski', 'Binder', 'Kick solution', 'Feeling', 'Notes'],
            entries.map((e: any) => [esc(kickSkiName.get(e.kick_ski_id) ?? e.kick_ski_id), esc(e.binder), esc(e.kick_solution), esc(e.feeling_rank), esc(e.feeling_notes)]), true);
        }
      }
      body += htmlSection(`Kick Tests (${data.kickTests.length})`, kickHtml);
    }
    if (data.kickMixes?.length) {
      body += htmlSection(`Kick Mixes (${data.kickMixes.length})`, htmlTable(
        ['Name', 'Type', 'Hardwax', 'Roller temp', 'Products', 'Notes'],
        data.kickMixes.map((m: any) => [esc(m.name), esc(m.mix_type), esc(m.hardwax), esc(m.roller_temperature), esc(m.products), esc(m.notes)]), true));
    }
  }

  // ── Team race fleet (skis not tied to an athlete) ───────────────────────────
  if (data.fleetSkis?.length) {
    body += htmlSection(`Race Fleet — team skis (${data.fleetSkis.length})`, htmlTable(
      ['Ski ID', 'Serial', 'Brand', 'Discipline', 'Construction', 'Mold', 'Base', 'Grind', 'Heights', 'Year', 'Length', 'Type', 'Sitski', 'Archived', 'Notes'],
      data.fleetSkis.map((r: any) => [esc(r.ski_id), esc(r.serial_number), esc(r.brand), esc(r.discipline), esc(r.construction), esc(r.mold), esc(r.base), esc(r.grind), esc(r.heights), esc(r.year), esc(r.length), esc(r.type_of_ski), r.is_sitski ? 'yes' : '', r.archived_at ? 'yes' : '', esc(r.notes)]), true));
  }

    body += htmlSection(`Weather Logs (${data.weather.length})`, htmlTable(
      ['Date', 'Time', 'Location', 'Snow °C', 'Air °C', 'Snow Hum%', 'Air Hum%', 'Clouds', 'Wind', 'Precip.', 'Snow Type', 'Grain', 'Track', 'Group'],
      data.weather.map((w: any) => {
        const st = [w.artificialSnow ? `Art: ${w.artificialSnow}` : null, w.naturalSnow ? `Nat: ${w.naturalSnow}` : null].filter(Boolean).join(', ');
        return [w.date || '', w.time || '', w.location || '', String(w.snowTemperatureC ?? ''), String(w.airTemperatureC ?? ''), String(w.snowHumidityPct ?? ''), String(w.airHumidityPct ?? ''), w.clouds != null ? `${w.clouds}/8` : '', w.wind || '', w.precipitation || '', st || '', w.grainSize || '', w.trackHardness || '', w.groupScope || ''];
      }),
      true
    ));
  }

  // Grind profiles
  if (data.grindProfiles.length > 0) {
    body += htmlSection(`Grind Profiles (${data.grindProfiles.length})`, htmlTable(
      ['ID', 'Name', 'Type', 'Stone', 'Pattern', 'Extra Params', 'Notes', 'Created By'],
      data.grindProfiles.map((gp: any) => {
        let extras = '';
        if (gp.extraParams) {
          try { extras = Object.entries(JSON.parse(gp.extraParams)).map(([k, v]) => `${k}: ${v}`).join(', '); }
          catch { extras = gp.extraParams; }
        }
        return [gp.grindId || String(gp.id), gp.name || '', gp.grindType || '', gp.stone || '', gp.pattern || '', extras, gp.notes || '', gp.createdByName || ''];
      })
    ));
  }

  // Race preps — grouped with entries
  if (data.racePreps.length > 0) {
    const entriesByRpId = new Map<number, any[]>();
    for (const e of data.racePrepEntries) {
      if (!entriesByRpId.has(e.race_prep_id)) entriesByRpId.set(e.race_prep_id, []);
      entriesByRpId.get(e.race_prep_id)!.push(e);
    }
    let rpHtml = '';
    const sortedRps = [...data.racePreps].sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
    for (const rp of sortedRps) {
      const glide   = resolveApps(rp.product_apps, rp.product_ids) || rp.products || '—';
      const struct  = resolveApps(rp.structure_apps, rp.structure_ids) || rp.structure || '—';
      const kick    = resolveIds(rp.kick_product_ids) || '—';
      const rpEntries = entriesByRpId.get(rp.id) || [];
      const isSkating = rp.discipline === 'Skating';
      const linkedWx  = rp.weather_id ? weatherById.get(rp.weather_id) : null;
      const details = [
        `<strong>Glide:</strong> ${esc(glide)}`,
        `<strong>Structure:</strong> ${esc(struct)}`,
        kick !== '—' ? `<strong>Kick:</strong> ${esc(kick)}` : null,
        rp.tette ? `<strong>Binder:</strong> ${esc(rp.tette)}` : null,
        rp.method ? `<strong>Application:</strong> ${esc(rp.method)}` : null,
        rp.notes ? `<strong>Notes:</strong> ${esc(rp.notes)}` : null,
        rp.created_by_name ? `<strong>Created by:</strong> ${esc(rp.created_by_name)}` : null,
        linkedWx ? `<strong>Weather/Conditions:</strong> ${esc(renderWeatherLine(linkedWx))}` : null,
      ].filter(Boolean).join('  ·  ');
      const athleteRows = rpEntries.map((e: any) => [
        e.athlete_name || '—',
        isSkating ? (e.ski_id_skating || e.ski_id || '—') : (e.ski_id_classic || e.ski_id || '—'),
        e.ski_id || '—',
        e.waxer_name || '—',
        e.notes || '',
        [e.athlete_rating, e.athlete_comment].filter(Boolean).join(' — ') || '',
      ]);
      rpHtml += `<div class="test-block">
        <div class="test-header">${esc(rp.date)} — ${esc(rp.location || '—')} — ${esc(rp.race_type || '—')} — ${esc(rp.discipline || '—')}</div>
        <div class="test-meta">${details}</div>
        ${rpEntries.length > 0 ? htmlTable(['Athlete', isSkating ? 'Ski (Skating)' : 'Ski (Classic)', 'Glide Ski', 'Waxer', 'Notes', 'Athlete feedback'], athleteRows, true) : '<p class="no-entries">No athletes registered.</p>'}
      </div>`;
    }
    body += htmlSection(`Race Preparations (${data.racePreps.length})`, rpHtml);
  }

  // Race usage — waxer-logged race-use per ski pair + athlete feedback.
  if (data.raceUsage && data.raceUsage.length > 0) {
    body += htmlSection(`Race Usage (${data.raceUsage.length})`, htmlTable(
      ['Date', 'Athlete', 'Ski ID', 'Brand', 'Discipline', 'Location', 'Result', 'Athlete Rating', 'Athlete Comment', 'Notes'],
      data.raceUsage.map((u: any) => [u.date || '', u.athlete || '', u.ski || '', u.brand || '', u.discipline || '', u.location || '', u.result || '', u.athlete_rating || '', u.athlete_comment || '', u.notes || '']),
      true
    ));
  }

  if (data.grindingRecords.length > 0) {
    body += htmlSection(`Grinding Records (${data.grindingRecords.length})`, htmlTable(
      ['Date', 'Series', 'Type', 'Stone', 'Notes', 'Created By', 'Group'],
      data.grindingRecords.map((r: any) => {
        const series = r.seriesId ? seriesMap.get(r.seriesId) : null;
        return [r.date || '', series?.name || (r.seriesId ? `#${r.seriesId}` : '—'), r.grindType || '', r.stone || '', r.notes || '', r.createdByName || '', r.groupScope || ''];
      })
    ));
  }

  // Grinding sheets
  if (data.grindingSheets.length > 0) {
    body += htmlSection(`Grinding Sheets (${data.grindingSheets.length})`, htmlTable(
      ['Name', 'URL', 'Group'],
      data.grindingSheets.map((s: any) => [s.name || '', s.url || '', s.groupScope || ''])
    ));
  }

  // Activity log
  if (data.activities.length > 0) {
    body += htmlSection(`Activity Log (${Math.min(data.activities.length, 500)})`, htmlTable(
      ['Time', 'User', 'Action', 'Type', 'Details', 'Group'],
      data.activities.slice(0, 500).map((a: any) => [a.createdAt ? new Date(a.createdAt).toLocaleString() : '', a.userName || '', a.action || '', a.entityType || '', a.details || '', a.groupScope || '']),
      true
    ));
  }

  // Login history
  if (data.loginLogs.length > 0) {
    body += htmlSection(`Login History (${data.loginLogs.length})`, htmlTable(
      ['Name', 'Email', 'IP', 'Time'],
      data.loginLogs.map((l: any) => [l.name || '', l.email || '', l.ipAddress || '—', l.loginAt ? new Date(l.loginAt).toLocaleString() : ''])
    ));
  }

  const generatedAt = new Date().toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' });

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<style>
@page { size: A4 landscape; margin: 1cm 1cm 1.2cm 1cm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 8pt; color: #111; }
h1 { font-size: 14pt; margin-bottom: 3pt; }
.subtitle { font-size: 7pt; color: #555; margin-bottom: 14pt; }
.section { margin-bottom: 14pt; }
h2 { font-size: 9.5pt; font-weight: bold; margin-bottom: 3pt; border-bottom: 1px solid #ccc; padding-bottom: 2pt; page-break-after: avoid; }
.athlete-sub { font-size: 8.5pt; font-weight: bold; color: #16a34a; margin: 8pt 0 3pt; padding-bottom: 1pt; border-bottom: 1px dotted #bbb; page-break-after: avoid; }
.test-block { margin-bottom: 8pt; page-break-inside: avoid; }
.test-header { font-size: 7.5pt; font-weight: bold; margin-bottom: 1pt; }
.test-meta { font-size: 6pt; color: #555; margin-bottom: 2pt; }
.test-weather { font-size: 6pt; color: #0e7490; margin-bottom: 2pt; }
.test-grind { font-size: 6pt; color: #555; font-style: italic; margin-bottom: 2pt; }
.no-entries { font-size: 6.5pt; color: #888; font-style: italic; }
table { width: 100%; border-collapse: collapse; margin-top: 2pt; }
th { background: #16a34a; color: white; text-align: left; padding: 2px 4px; }
td { border-bottom: 1px solid #e8e8e8; padding: 2px 4px; }
tr:nth-child(even) td { background: #f9fafb; }
</style>
</head><body>
<h1>Glidr — Full Data Export</h1>
<p class="subtitle">Generated ${generatedAt}  ·  ${esc(data.teamName)}  ·  ${data.tests.length} tests  ·  ${data.weather.length} weather logs</p>
${body}
</body></html>`;
}

export async function buildTeamPdfBuffer(teamId: number): Promise<Buffer> {
  const team = await storage.getTeam(teamId);

  const [
    allGroups, allTests, allWeather, allSeries,
    allProducts, allAthletes, allGrindProfiles,
    allGrindingRecords, allGrindingSheets, allTeamUsers,
    allLoginLogs, allActivities,
  ] = await Promise.all([
    storage.listGroups(teamId),
    storage.listAllTestsForTeam(teamId),
    storage.listAllWeatherForTeam(teamId),
    storage.listSeries('', true, teamId),
    storage.listProducts('', true, teamId),
    storage.listAthletes(0, true, teamId),
    storage.listGrindProfiles(teamId),
    storage.listGrindingRecords('', true, teamId),
    storage.listGrindingSheets('', true, teamId),
    storage.listUsers(teamId),
    storage.listLoginLogs(teamId),
    storage.listActivityLogs(500, teamId),
  ]);

  const testIds = allTests.map((t: any) => t.id);
  const allEntries = testIds.length > 0 ? await storage.listAllEntriesForTests(testIds) : [];
  const entriesByTest: Record<number, any[]> = {};
  for (const e of allEntries) {
    if (!entriesByTest[e.testId]) entriesByTest[e.testId] = [];
    entriesByTest[e.testId].push(e);
  }

  // Kick + team race fleet — so the reference PDF covers every area.
  const { pool: pdfPool } = await import('./db');
  const pq = (sql: string) => (pdfPool as any).query(sql, [teamId]).then((r: any) => r.rows).catch(() => []);
  const [kickSkis, kickTests, kickEntries, kickMixes, fleetSkis] = await Promise.all([
    pq(`SELECT * FROM kick_skis WHERE team_id = $1 ORDER BY name`),
    pq(`SELECT * FROM kick_tests WHERE team_id = $1 ORDER BY date DESC`),
    pq(`SELECT * FROM kick_test_entries WHERE kick_test_id IN (SELECT id FROM kick_tests WHERE team_id = $1)`),
    pq(`SELECT * FROM kick_mixes WHERE team_id = $1 ORDER BY name`),
    pq(`SELECT * FROM race_skis WHERE athlete_id IS NULL AND team_id = $1 ORDER BY ski_id`),
  ]);

  const allRaceSkisNested = await Promise.all(
    allAthletes.map((ath: any) =>
      storage.listAllRaceSkisIncludingArchived(ath.id)
        .then((skis: any[]) => skis.map((s: any) => ({ ...s, athleteName: ath.name })))
        .catch(() => [] as any[])
    )
  );
  const allRaceSkis: any[] = allRaceSkisNested.flat();

  const [raceSkiRegrindsNested, testSkiRegrindsNested] = await Promise.all([
    Promise.all(allRaceSkis.map((ski: any) =>
      storage.listRaceSkiRegrinds(ski.id)
        .then((rs: any[]) => rs.map((r: any) => ({ ...r, skiId: ski.skiId, athleteName: ski.athleteName, brand: ski.brand })))
        .catch(() => [] as any[])
    )),
    Promise.all(allSeries.map((series: any) =>
      storage.listTestSkiRegrinds(series.id)
        .then((rs: any[]) => rs.map((r: any) => ({ ...r, seriesName: series.name })))
        .catch(() => [] as any[])
    )),
  ]);
  const allRaceSkiRegrinds: any[] = raceSkiRegrindsNested.flat();
  const allTestSkiRegrinds: any[] = testSkiRegrindsNested.flat();

  const racePrepsResult = await (pool as any).query(
    `SELECT id, date, start_time, location, race_type, discipline,
            products, method, structure, notes, tette,
            product_ids, structure_ids, kick_product_ids, product_apps, structure_apps,
            weather_id, created_by_name, created_at
     FROM race_preps WHERE team_id = $1 ORDER BY date DESC`,
    [teamId]
  );
  const racePrepEntriesResult = await (pool as any).query(
    `SELECT rpe.id, rpe.race_prep_id, rpe.athlete_name, rpe.ski_id,
            rpe.ski_id_classic, rpe.ski_id_skating,
            rpe.waxer_name, rpe.notes, rpe.athlete_rating, rpe.athlete_comment, rpe.created_at
     FROM race_prep_entries rpe
     JOIN race_preps rp ON rp.id = rpe.race_prep_id
     WHERE rp.team_id = $1 ORDER BY rpe.race_prep_id, rpe.athlete_name`,
    [teamId]
  );
  const raceUsageResult = await (pool as any).query(
    `SELECT su.date, a.name AS athlete, rs.ski_id AS ski, rs.brand, su.discipline, su.location,
            su.result, su.athlete_rating, su.athlete_comment, su.notes, su.created_by_name
     FROM ski_race_usages su
     JOIN race_skis rs ON rs.id = su.ski_id
     JOIN athletes a ON a.id = su.athlete_id
     WHERE su.team_id = $1 ORDER BY su.date DESC NULLS LAST`,
    [teamId]
  ).catch(() => ({ rows: [] as any[] }));

  const html = buildExportHtml({
    kickSkis, kickTests, kickEntries, kickMixes, fleetSkis,
    teamName: team?.name ?? 'Glidr',
    tests: allTests,
    entriesByTest,
    weather: allWeather,
    series: allSeries,
    products: allProducts,
    users: allTeamUsers,
    groups: allGroups,
    athletes: allAthletes,
    raceSkis: allRaceSkis,
    raceSkiRegrinds: allRaceSkiRegrinds,
    testSkiRegrinds: allTestSkiRegrinds,
    grindProfiles: allGrindProfiles,
    grindingRecords: allGrindingRecords,
    grindingSheets: allGrindingSheets,
    activities: allActivities,
    loginLogs: allLoginLogs,
    racePreps: racePrepsResult.rows,
    racePrepEntries: racePrepEntriesResult.rows,
    raceUsage: raceUsageResult.rows,
  });

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
    ],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true, margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function runDriveBackupForTeam(teamId: number): Promise<{ success: boolean; error?: string; pdfError?: string }> {
  const team = await storage.getTeam(teamId);
  if (!team) return { success: false, error: 'Team not found' };
  if (!team.driveFolderId) return { success: false, error: 'No Drive folder configured' };

  const driveClient = getGoogleDriveClient();
  if (!driveClient) return { success: false, error: 'Google Drive not available (service account required)' };

  const { drive } = driveClient;
  const folderId = extractDriveFolderId(team.driveFolderId);
  const teamName = team.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  try {
    // ── Build JSON export using shared builder ─────────────────────────────
    const jsonPayload = await buildTeamJsonExport(teamId);

    const jsonFilename = `glidr-${teamName}-data.json`;
    const pdfFilename = `glidr-${teamName}-backup.pdf`;

    // ── Upload / update JSON ───────────────────────────────────────────────
    // supportsAllDrives: true is required for Shared Drives (service accounts
    // cannot own files in personal My Drive — Shared Drives have no individual owner)
    const { Readable } = await import('stream');

    let jsonFileId = team.driveJsonFileId ?? null;
    if (jsonFileId) {
      await drive.files.update({
        fileId: jsonFileId,
        supportsAllDrives: true,
        media: { mimeType: 'application/json', body: Readable.from([jsonPayload]) },
      });
    } else {
      const created = await drive.files.create({
        supportsAllDrives: true,
        requestBody: { name: jsonFilename, parents: [folderId] },
        media: { mimeType: 'application/json', body: Readable.from([jsonPayload]) },
        fields: 'id',
      });
      jsonFileId = created.data.id!;
    }

    // ── Generate full data PDF (same content as admin "Download PDF" button) ─
    let pdfFileId = team.drivePdfFileId ?? null;
    let pdfError: string | undefined;
    try {
      const pdfBuffer = await buildTeamPdfBuffer(teamId);
      if (pdfFileId) {
        await drive.files.update({
          fileId: pdfFileId,
          supportsAllDrives: true,
          media: { mimeType: 'application/pdf', body: Readable.from([pdfBuffer]) },
        });
      } else {
        const created = await drive.files.create({
          supportsAllDrives: true,
          requestBody: { name: pdfFilename, parents: [folderId] },
          media: { mimeType: 'application/pdf', body: Readable.from([pdfBuffer]) },
          fields: 'id',
        });
        pdfFileId = created.data.id!;
      }
    } catch (pdfErr: any) {
      pdfError = pdfErr?.message || 'PDF generation failed';
      console.error('[DriveBackup] PDF generation error:', pdfErr);
    }

    // ── Save file IDs to DB ────────────────────────────────────────────────
    // A successful Drive backup counts as a successful backup (some teams use
    // only the Drive folder), so it also refreshes the ✓-status and clears errors.
    await storage.updateTeam(teamId, {
      driveJsonFileId: jsonFileId,
      drivePdfFileId: pdfFileId ?? undefined,
      lastBackupAt: new Date().toISOString(),
      lastBackupError: null,
      lastBackupErrorAt: null,
    } as any);

    console.log(`[DriveBackup] Done for team ${teamId} — JSON: ${jsonFileId}, PDF: ${pdfFileId ?? 'failed'}`);
    return { success: true, ...(pdfError ? { pdfError } : {}) };

  } catch (err: any) {
    console.error('[DriveBackup] Error for team', teamId, err);
    const msg = `[Drive] ${(err.message || 'Unknown error')}`.slice(0, 300);
    const wasHealthy = !team.lastBackupError;
    await storage.updateTeam(teamId, { lastBackupError: msg, lastBackupErrorAt: new Date().toISOString() } as any).catch(() => {});
    if (wasHealthy) await notifyBackupFailure(teamId, team.name, msg);
    return { success: false, error: msg };
  }
}

// Notify every active Super Admin (in-app inbox) when a team's backup STARTS
// failing. Only fires on the transition healthy→failing so the 30-min scheduler
// doesn't spam; the status card in Admin → Backup shows the ongoing state.
async function notifyBackupFailure(teamId: number, teamName: string | null | undefined, message: string): Promise<void> {
  try {
    const { pool } = await import('./db');
    const sas = await (pool as any).query(`SELECT id FROM users WHERE is_admin = 1 AND is_active = 1`);
    const now = new Date().toISOString();
    const subject = `⚠ Backup failed${teamName ? ` — ${teamName}` : ''}`;
    const body = `The scheduled backup for ${teamName ?? `team ${teamId}`} failed: ${message}\n\nIt will keep retrying automatically. See Admin → Backup for the current status.`;
    for (const r of sas.rows) {
      await (pool as any).query(
        `INSERT INTO inbox_messages (to_user_id, from_name, subject, body, is_read, created_at, team_name)
         VALUES ($1, 'Glidr System', $2, $3, 0, $4, $5)`,
        [r.id, subject, body, now, teamName ?? null]
      );
    }
  } catch (e) { console.error('[Backup] failure notification failed:', e); }
}

const backupIntervals: Record<number, NodeJS.Timeout> = {};
// JSON+PDF Drive backup runs once daily at 23:59 (Europe/Oslo) — it launches
// headless Chromium (Puppeteer) for the PDF, which is memory-heavy, so it is
// kept separate from the cheap 30-min Google Sheets backup.
const drivePdfIntervals: Record<number, NodeJS.Timeout> = {};

export function startAutoBackup(teamId: number, intervalMs: number = 30 * 60 * 1000) {
  stopAutoBackup(teamId);
  // Cheap Sheets backup every 30 min (no Chromium).
  backupIntervals[teamId] = setInterval(async () => {
    try {
      const team = await storage.getTeam(teamId);
      if (team?.backupSheetUrl) {
        console.log(`[Backup] Auto-backup starting for team ${teamId}`);
        const result = await runBackupForTeam(teamId);
        console.log(`[Backup] Auto-backup result for team ${teamId}:`, result.success ? 'OK' : result.error);
      }
    } catch (err) {
      console.error(`[Backup] Auto-backup failed for team ${teamId}:`, err);
    }
  }, intervalMs);

  // Heavy JSON+PDF Drive backup: once daily AT 23:59 (Europe/Oslo), not on a
  // rolling 24h timer — a rolling timer resets on every deploy and therefore
  // never fired on frequently-deployed servers. Scheduled with setTimeout and
  // re-armed after each run.
  const scheduleDriveDaily = () => {
    drivePdfIntervals[teamId] = setTimeout(async () => {
      try {
        const team = await storage.getTeam(teamId);
        if (team?.driveFolderId) {
          const driveResult = await runDriveBackupForTeam(teamId);
          console.log(`[DriveBackup] Daily 23:59 result for team ${teamId}:`, driveResult.success ? 'OK' : driveResult.error);
        }
      } catch (err) {
        console.error(`[DriveBackup] Daily 23:59 failed for team ${teamId}:`, err);
      } finally {
        scheduleDriveDaily();
      }
    }, msUntilNextOslo2359()) as any;
  };
  scheduleDriveDaily();

  // Catch-up: if the last successful backup is more than ~25h old (e.g. the
  // server was asleep or redeployed over 23:59), run one Drive backup shortly
  // after boot so the daily files are never silently missing.
  (async () => {
    try {
      const team = await storage.getTeam(teamId);
      if (team?.driveFolderId) {
        const last = team.lastBackupAt ? new Date(team.lastBackupAt).getTime() : 0;
        if (Date.now() - last > 25 * 3600 * 1000) {
          setTimeout(async () => {
            try {
              const r = await runDriveBackupForTeam(teamId);
              console.log(`[DriveBackup] Catch-up result for team ${teamId}:`, r.success ? 'OK' : r.error);
            } catch (e) { console.error(`[DriveBackup] Catch-up failed for team ${teamId}:`, e); }
          }, 2 * 60 * 1000);
        }
      }
    } catch {}
  })();
}

// Milliseconds until the next 23:59 in Europe/Oslo (handles CET/CEST).
function msUntilNextOslo2359(): number {
  const now = new Date();
  for (let addDay = 0; addDay <= 1; addDay++) {
    const day = new Date(now.getTime() + addDay * 86400000);
    const osloDate = day.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' }); // YYYY-MM-DD
    for (const offset of ['+01:00', '+02:00']) {
      const candidate = new Date(`${osloDate}T23:59:00${offset}`);
      const check = candidate.toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' });
      if (check.startsWith(`${osloDate} 23:59`) && candidate.getTime() > now.getTime()) {
        return candidate.getTime() - now.getTime();
      }
    }
  }
  return 60 * 60 * 1000; // defensive fallback: an hour
}

export function stopAutoBackup(teamId: number) {
  if (backupIntervals[teamId]) {
    clearInterval(backupIntervals[teamId]);
    delete backupIntervals[teamId];
  }
  if (drivePdfIntervals[teamId]) {
    clearInterval(drivePdfIntervals[teamId]);
    delete drivePdfIntervals[teamId];
  }
}

export function stopAllAutoBackups() {
  for (const teamId of Object.keys(backupIntervals).map(Number)) {
    stopAutoBackup(teamId);
  }
}

export async function initAutoBackups() {
  try {
    const teams = await storage.listTeams();
    for (const team of teams) {
      // Enable the scheduler if EITHER a Sheets backup URL or a Drive folder is
      // set — the Drive folder link alone is enough for daily JSON+PDF backups.
      if (team.backupSheetUrl || team.driveFolderId) {
        startAutoBackup(team.id);
        console.log(`[Backup] Auto-backup enabled for team ${team.id} (${team.name})`);
      }
    }
  } catch (err) {
    console.error('[Backup] Failed to init auto-backups:', err);
  }
}
