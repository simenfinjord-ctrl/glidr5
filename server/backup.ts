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
      valueInputOption: 'USER_ENTERED',
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
    // Append any sheets not in our ordered list at the end
    for (const [title, sheetId] of sheetMap.entries()) {
      if (!orderedTitles.includes(title)) {
        requests.push({ updateSheetProperties: { properties: { sheetId, index }, fields: 'index' } });
        index++;
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
              product_ids, structure_ids, kick_product_ids,
              weather_id, created_by_name, created_at
       FROM race_preps WHERE team_id = $1 ORDER BY date DESC`,
      [teamId]
    );
    const allRacePreps = racePrepsResult.rows;

    // Race prep entries per prep
    const racePrepEntriesResult = await (pool as any).query(
      `SELECT rpe.id, rpe.race_prep_id, rpe.athlete_name, rpe.ski_id,
              rpe.ski_id_classic, rpe.ski_id_skating,
              rpe.waxer_name, rpe.notes, rpe.created_at
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
    const GRINDS_TITLE = '⚙️ Grinds';
    const STOCK_TITLE = '📦 Stock Changes';
    const groupSheetTitles = groupNames.map(g => `📂 ${sanitizeSheetTitle(g)}`);
    const athleteSheetTitles = allAthletes.map((a: any) => sanitizeSheetTitle(`🏃 ${a.name}`));

    // Logical sheet order
    const orderedTitles = [
      OVERVIEW_TITLE,
      TEAM_TITLE,
      ...groupSheetTitles,
      PRODUCT_TESTS_TITLE,
      STRUCTURE_TESTS_TITLE,
      GRIND_TESTS_TITLE,
      RACE_PREPS_TITLE,
      ...athleteSheetTitles,
      GRINDS_TITLE,
      STOCK_TITLE,
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

    // Helper: build flat entry rows for a list of tests
    // Each test gets a bold header row, then one entry row per ski entry.
    // All 15 weather/conditions fields are included on every row.
    const FLAT_COL_HEADER = [
      // Test metadata
      'Test ID', 'Date', 'Location', 'Test Name', 'Group', 'Series', 'Type', 'Notes',
      // Entry data
      'Ski #', 'Product', 'Application / Method', 'Feeling Rank', 'Kick Rank',
      'Result 1', 'Rank 1', 'Result 2', 'Rank 2',
      // Weather / conditions (all fields)
      'Snow Temp °C', 'Air Temp °C', 'Snow Humidity %', 'Air Humidity %',
      'Snow Type', 'Snow Humidity Type', 'Track Hardness',
      'Artificial Snow', 'Natural Snow', 'Grain Size',
      'Clouds (x/8)', 'Visibility', 'Wind', 'Precipitation', 'Test Quality',
    ];

    const buildFlatTestRows = (tests: any[]): { rows: any[][], boldIndices: number[] } => {
      const rows: any[][] = [];
      const boldIndices: number[] = [];

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
          '', '', '', '', '', '', '', '', '',
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
          rows.push([
            test.id, test.date, test.location,
            (test as any).testName || '', (test as any).groupScope || '', seriesName, (test as any).testType,
            (test as any).notes || '',
            entry.skiNumber, productName, entry.methodology || '',
            entry.feelingRank ?? '', entry.kickRank ?? '',
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

      return { rows, boldIndices };
    };

    // 🧪 Product Tests — all tests that are NOT Structure and NOT Grind
    const productTestsFiltered = allTests.filter((t: any) => !['Structure', 'Grind'].includes((t as any).testType));
    await ensureSheet(sheets, spreadsheetId, PRODUCT_TESTS_TITLE);
    {
      const { rows: ptRows, boldIndices: ptBolds } = buildFlatTestRows(productTestsFiltered);
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
      if (ptSheetId !== undefined) await boldRows(sheets, spreadsheetId, ptSheetId, [0, ...shiftedBolds]).catch(() => {});
    }

    // 📐 Structure Tests
    const structureTests = allTests.filter((t: any) => (t as any).testType === 'Structure');
    await ensureSheet(sheets, spreadsheetId, STRUCTURE_TESTS_TITLE);
    {
      const { rows: stRows, boldIndices: stBolds } = buildFlatTestRows(structureTests);
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
      if (stSheetId !== undefined) await boldRows(sheets, spreadsheetId, stSheetId, [0, ...shiftedBolds]).catch(() => {});
    }

    // ⛷️ Grind Tests
    const grindTestsList = allTests.filter((t: any) => (t as any).testType === 'Grind');
    await ensureSheet(sheets, spreadsheetId, GRIND_TESTS_TITLE);
    {
      const { rows: gtRows, boldIndices: gtBolds } = buildFlatTestRows(grindTestsList);
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
      if (gtSheetId !== undefined) await boldRows(sheets, spreadsheetId, gtSheetId, [0, ...shiftedBolds]).catch(() => {});
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
      const glideNames = resolveProductIds(rp.product_ids) || rp.products || '';
      const structureNames = resolveProductIds(rp.structure_ids) || rp.structure || '';
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
        rpRows.push(['  Athlete', 'Ski ID (Glide)', 'Ski ID (Classic)', 'Ski ID (Skating)', 'Waxer', 'Notes']);
        for (const e of entries) {
          rpRows.push([`  ${e.athlete_name}`, e.ski_id || '', e.ski_id_classic || '', e.ski_id_skating || '', e.waxer_name || '', e.notes || '']);
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

    // ── 5. ATHLETE SHEETS ─────────────────────────────────────────────────────
    for (let ai = 0; ai < allAthletes.length; ai++) {
      const athlete = allAthletes[ai];
      const sheetTitle = athleteSheetTitles[ai];

      const athleteSkis = allRaceSkis.filter(s => s.athleteId === athlete.id);
      const athleteTests = allTests.filter((t: any) => t.testSkiSource === 'raceskis' && t.athleteId === athlete.id);

      const rows: any[][] = [];
      const bolds: number[] = [];
      const h = (label: string) => { bolds.push(rows.length); rows.push([label]); };
      const cols = (...headers: string[]) => { bolds.push(rows.length); rows.push(headers); };

      rows.push([`ATHLETE: ${athlete.name}`]);
      rows.push(['Team', athlete.team || '', 'Created', athlete.createdAt || '']);
      rows.push([]);

      h('=== RACE SKIS ===');
      cols('ID', 'Ski ID', 'Serial', 'Brand', 'Discipline', 'Construction', 'Mold', 'Base', 'Grind', 'Heights', 'Year', 'Archived');
      for (const ski of athleteSkis) {
        rows.push([ski.id, ski.skiId, ski.serialNumber || '', ski.brand || '', ski.discipline,
          ski.construction || '', ski.mold || '', ski.base || '', ski.grind || '',
          ski.heights || '', ski.year || '', ski.archivedAt ? 'Yes' : '']);
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

        const headerRow = ['Ski #', 'Race Ski ID', 'Feeling Rank'];
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
          const row: any[] = [entry.skiNumber, skiLabel, entry.feelingRank ?? ''];
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
      [PRODUCT_TESTS_TITLE, `All product tests (Glide, Classic, Skating, Double Poling) — flat table, ${productTestsFiltered.length} tests`],
      [STRUCTURE_TESTS_TITLE, `All structure tests — flat table, ${structureTests.length} tests`],
      [GRIND_TESTS_TITLE, `All grind tests — flat table, ${grindTestsList.length} tests`],
      [RACE_PREPS_TITLE, 'All race preps with products, application, weather and per-athlete entries'],
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

    await storage.updateTeam(teamId, { lastBackupAt: now });
    return { success: true };

  } catch (err: any) {
    console.error('[Backup] Error for team', teamId, err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// ── Google Drive backup ───────────────────────────────────────────────────────

// ── Shared JSON export builder (used by Drive backup + download route) ───────

export async function buildTeamJsonExport(teamId: number): Promise<string> {
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
    storage.listActivityLogs(5000, teamId),
  ]);

  const testIds = allTests.map((t: any) => t.id);
  const allEntries = testIds.length > 0 ? await storage.listAllEntriesForTests(testIds) : [];
  const entriesByTest: Record<number, any[]> = {};
  for (const e of allEntries) {
    if (!entriesByTest[(e as any).testId]) entriesByTest[(e as any).testId] = [];
    entriesByTest[(e as any).testId].push(e);
  }

  const allRaceSkis: any[] = [];
  for (const ath of allAthletes) {
    try {
      const skis = await storage.listAllRaceSkisIncludingArchived(ath.id);
      allRaceSkis.push(...skis.map((s: any) => ({ ...s, athleteName: ath.name })));
    } catch {}
  }
  const allRaceSkiRegrinds: any[] = [];
  for (const ski of allRaceSkis) {
    try {
      const rr = await storage.listRaceSkiRegrinds(ski.id);
      allRaceSkiRegrinds.push(...rr.map((r: any) => ({ ...r, skiId: ski.skiId, athleteName: ski.athleteName, brand: ski.brand })));
    } catch {}
  }
  const allTestSkiRegrinds: any[] = [];
  for (const series of allSeries) {
    try {
      const rr = await storage.listTestSkiRegrinds(series.id);
      allTestSkiRegrinds.push(...rr.map((r: any) => ({ ...r, seriesName: series.name })));
    } catch {}
  }

  const racePrepsResult = await (pool as any).query(
    `SELECT id, date, start_time, location, race_type, discipline,
            products, method, structure, notes, tette,
            product_ids, structure_ids, kick_product_ids,
            weather_id, created_by_name, created_at
     FROM race_preps WHERE team_id = $1 ORDER BY date DESC`,
    [teamId]
  );
  const racePrepEntriesResult = await (pool as any).query(
    `SELECT rpe.id, rpe.race_prep_id, rpe.athlete_name, rpe.ski_id,
            rpe.ski_id_classic, rpe.ski_id_skating,
            rpe.waxer_name, rpe.notes, rpe.created_at
     FROM race_prep_entries rpe
     JOIN race_preps rp ON rp.id = rpe.race_prep_id
     WHERE rp.team_id = $1 ORDER BY rpe.race_prep_id, rpe.athlete_name`,
    [teamId]
  );

  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    team: { id: team?.id, name: team?.name },
    tests: allTests,
    entriesByTest,
    weather: allWeather,
    series: allSeries,
    products: allProducts,
    users: allTeamUsers.map(({ password, ...rest }: any) => rest),
    groups: allGroups,
    loginLogs: allLoginLogs,
    activities: allActivities,
    athletes: allAthletes,
    raceSkis: allRaceSkis,
    grindingRecords: allGrindingRecords,
    grindingSheets: allGrindingSheets,
    raceSkiRegrinds: allRaceSkiRegrinds,
    testSkiRegrinds: allTestSkiRegrinds,
    grindProfiles: allGrindProfiles,
    racePreps: racePrepsResult.rows,
    racePrepEntries: racePrepEntriesResult.rows,
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
  racePreps: any[]; racePrepEntries: any[];
}): string {
  const productMap = new Map(data.products.map((p: any) => [p.id, p]));
  const raceSkiMap = new Map(data.raceSkis.map((s: any) => [s.id, s]));
  const seriesMap  = new Map(data.series.map((s: any)  => [s.id, s]));
  const athleteMap = new Map(data.athletes.map((a: any) => [a.id, a]));

  const getProductLabel = (entry: any): string => {
    if (entry.raceSkiId) {
      const ski = raceSkiMap.get(entry.raceSkiId);
      if (ski) return `${ski.athleteName} — ${ski.brand || ''} ${ski.skiId || ''}`.trim();
    }
    const main = productMap.get(entry.productId);
    const parts: string[] = [];
    if (main) parts.push(`${main.brand || ''} ${main.name}`.trim());
    if (entry.additionalProductIds) {
      try {
        const ids = typeof entry.additionalProductIds === 'string'
          ? JSON.parse(entry.additionalProductIds) : entry.additionalProductIds;
        if (Array.isArray(ids)) {
          for (const id of ids) {
            const p = productMap.get(id);
            if (p) parts.push(`${p.brand || ''} ${p.name}`.trim());
          }
        }
      } catch {}
    }
    return parts.join(' + ') || '—';
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
  let testsHtml = '';
  for (const test of sortedTests) {
    const entries: any[] = data.entriesByTest[test.id] || [];
    const seriesObj = seriesMap.get(test.seriesId);
    const athleteObj = test.athleteId ? athleteMap.get(test.athleteId) : null;
    const sourceName = test.testSkiSource === 'raceskis'
      ? (athleteObj ? `Athlete: ${athleteObj.name}` : 'Raceskis')
      : (seriesObj ? seriesObj.name : '');

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
    const meta = [test.location ? `Location: ${test.location}` : null, test.notes ? `Notes: ${test.notes}` : null, `Group: ${test.groupScope}`].filter(Boolean).join('  ·  ');

    const head = ['Rank', 'Ski', 'Product / Raceski', 'Method'];
    for (const lbl of distanceLabels) { head.push(`${lbl} (cm)`); head.push('Rank'); }
    if (isClassic) head.push('Kick');
    head.push('Feeling');

    const rows = entries
      .map((e: any) => { const rounds = getEntryRounds(e, distanceLabels.length); return { e, rounds, firstRank: rounds[0]?.rank ?? 999 }; })
      .sort((a: any, b: any) => a.firstRank - b.firstRank)
      .map(({ e, rounds }: any) => {
        const row: string[] = [rounds[0]?.rank != null ? String(rounds[0].rank) : '—', String(e.skiNumber || ''), getProductLabel(e), e.methodology || ''];
        for (const rr of rounds) { row.push(rr.result != null ? String(rr.result) : '—'); row.push(rr.rank != null ? String(rr.rank) : '—'); }
        if (isClassic) row.push(e.kickRank != null ? String(e.kickRank) : '—');
        row.push(e.feelingRank != null ? String(e.feelingRank) : '—');
        return row;
      });

    testsHtml += `<div class="test-block">
      <div class="test-header">${esc(test.date)} — ${esc(test.testType)} — ${esc(sourceName)}</div>
      <div class="test-meta">${esc(meta)}</div>
      ${entries.length > 0 ? htmlTable(head, rows, true) : '<p class="no-entries">No entries</p>'}
    </div>`;
  }
  body += htmlSection(`Tests with Results (${data.tests.length})`, testsHtml);

  // Weather
  if (data.weather.length > 0) {
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
      ['Name', 'Type', 'Stone', 'Pattern', 'Extra Params'],
      data.grindProfiles.map((gp: any) => [gp.name || '', gp.grindType || '', gp.stone || '', gp.pattern || '', gp.extraParams || ''])
    ));
  }

  // Grinding records
  // Race preps
  if (data.racePreps.length > 0) {
    body += htmlSection(`Race Preps (${data.racePreps.length})`, htmlTable(
      ['Date', 'Start Time', 'Location', 'Race Type', 'Discipline', 'Glide Products', 'Structure', 'Method', 'Notes', 'Created By'],
      data.racePreps.map((rp: any) => [
        rp.date || '', rp.start_time || '', rp.location || '', rp.race_type || '',
        rp.discipline || '', rp.products || '', rp.structure || '', rp.method || '',
        rp.notes || '', rp.created_by_name || '',
      ])
    ));
  }

  // Race prep entries
  if (data.racePrepEntries.length > 0) {
    body += htmlSection(`Race Prep Entries (${data.racePrepEntries.length})`, htmlTable(
      ['Race Prep ID', 'Athlete', 'Ski ID (Glide)', 'Ski ID (Classic)', 'Ski ID (Skating)', 'Waxer', 'Notes'],
      data.racePrepEntries.map((e: any) => [
        String(e.race_prep_id || ''), e.athlete_name || '', e.ski_id || '',
        e.ski_id_classic || '', e.ski_id_skating || '', e.waxer_name || '', e.notes || '',
      ])
    ));
  }

  if (data.grindingRecords.length > 0) {
    body += htmlSection(`Grinding Records (${data.grindingRecords.length})`, htmlTable(
      ['Date', 'Type', 'Stone', 'Notes', 'Group'],
      data.grindingRecords.map((r: any) => [r.date || '', r.grindType || '', r.stone || '', r.notes || '', r.groupScope || ''])
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
.test-block { margin-bottom: 8pt; page-break-inside: avoid; }
.test-header { font-size: 7.5pt; font-weight: bold; margin-bottom: 1pt; }
.test-meta { font-size: 6pt; color: #555; margin-bottom: 2pt; }
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

  const allRaceSkis: any[] = [];
  for (const ath of allAthletes) {
    try {
      const skis = await storage.listAllRaceSkisIncludingArchived(ath.id);
      allRaceSkis.push(...skis.map((s: any) => ({ ...s, athleteName: ath.name })));
    } catch {}
  }
  const allRaceSkiRegrinds: any[] = [];
  for (const ski of allRaceSkis) {
    try {
      const rr = await storage.listRaceSkiRegrinds(ski.id);
      allRaceSkiRegrinds.push(...rr.map((r: any) => ({ ...r, skiId: ski.skiId, athleteName: ski.athleteName, brand: ski.brand })));
    } catch {}
  }
  const allTestSkiRegrinds: any[] = [];
  for (const series of allSeries) {
    try {
      const rr = await storage.listTestSkiRegrinds(series.id);
      allTestSkiRegrinds.push(...rr.map((r: any) => ({ ...r, seriesName: series.name })));
    } catch {}
  }

  const racePrepsResult = await (pool as any).query(
    `SELECT id, date, start_time, location, race_type, discipline,
            products, method, structure, notes, tette,
            product_ids, structure_ids, kick_product_ids,
            weather_id, created_by_name, created_at
     FROM race_preps WHERE team_id = $1 ORDER BY date DESC`,
    [teamId]
  );
  const racePrepEntriesResult = await (pool as any).query(
    `SELECT rpe.id, rpe.race_prep_id, rpe.athlete_name, rpe.ski_id,
            rpe.ski_id_classic, rpe.ski_id_skating,
            rpe.waxer_name, rpe.notes, rpe.created_at
     FROM race_prep_entries rpe
     JOIN race_preps rp ON rp.id = rpe.race_prep_id
     WHERE rp.team_id = $1 ORDER BY rpe.race_prep_id, rpe.athlete_name`,
    [teamId]
  );

  const html = buildExportHtml({
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
      '--single-process',
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
    await storage.updateTeam(teamId, {
      driveJsonFileId: jsonFileId,
      drivePdfFileId: pdfFileId ?? undefined,
    } as any);

    console.log(`[DriveBackup] Done for team ${teamId} — JSON: ${jsonFileId}, PDF: ${pdfFileId ?? 'failed'}`);
    return { success: true, ...(pdfError ? { pdfError } : {}) };

  } catch (err: any) {
    console.error('[DriveBackup] Error for team', teamId, err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

const backupIntervals: Record<number, NodeJS.Timeout> = {};

export function startAutoBackup(teamId: number, intervalMs: number = 30 * 60 * 1000) {
  stopAutoBackup(teamId);
  backupIntervals[teamId] = setInterval(async () => {
    try {
      const team = await storage.getTeam(teamId);
      if (team?.backupSheetUrl) {
        console.log(`[Backup] Auto-backup starting for team ${teamId}`);
        const result = await runBackupForTeam(teamId);
        console.log(`[Backup] Auto-backup result for team ${teamId}:`, result.success ? 'OK' : result.error);
        // Drive backup runs after Sheets so the PDF reflects the latest Sheet
        if (team.driveFolderId) {
          const driveResult = await runDriveBackupForTeam(teamId);
          console.log(`[DriveBackup] Auto result for team ${teamId}:`, driveResult.success ? 'OK' : driveResult.error);
        }
      }
    } catch (err) {
      console.error(`[Backup] Auto-backup failed for team ${teamId}:`, err);
    }
  }, intervalMs);
}

export function stopAutoBackup(teamId: number) {
  if (backupIntervals[teamId]) {
    clearInterval(backupIntervals[teamId]);
    delete backupIntervals[teamId];
  }
}

export async function initAutoBackups() {
  try {
    const teams = await storage.listTeams();
    for (const team of teams) {
      if (team.backupSheetUrl) {
        startAutoBackup(team.id);
        console.log(`[Backup] Auto-backup enabled for team ${team.id} (${team.name})`);
      }
    }
  } catch (err) {
    console.error('[Backup] Failed to init auto-backups:', err);
  }
}
