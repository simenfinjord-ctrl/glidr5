import { getUncachableGoogleSheetClient } from './googleSheets';
import { storage } from './storage';

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
  if (existing) {
    return existing.properties.sheetId;
  }
  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
  return resp.data.replies[0].addSheet.properties.sheetId;
}

async function clearAndWrite(sheets: any, spreadsheetId: string, sheetTitle: string, rows: any[][]) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${sheetTitle}'!A:ZZ`,
  });
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetTitle}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
  }
}

function parseResults(resultsJson: string | null): Record<string, number | null> {
  if (!resultsJson) return {};
  try { return JSON.parse(resultsJson); } catch { return {}; }
}

function parseDistanceLabels(labelsJson: string | null): string[] {
  if (!labelsJson) return [];
  try { return JSON.parse(labelsJson); } catch { return []; }
}

export async function runBackupForTeam(teamId: number): Promise<{ success: boolean; error?: string }> {
  const team = await storage.getTeam(teamId);
  if (!team) return { success: false, error: 'Team not found' };
  if (!team.backupSheetUrl) return { success: false, error: 'No backup sheet URL configured' };

  const spreadsheetId = extractSpreadsheetId(team.backupSheetUrl);
  if (!spreadsheetId) return { success: false, error: 'Invalid Google Sheets URL' };

  try {
    const sheets = await getUncachableGoogleSheetClient();

    const [allGroups, allTests, allWeather, allSeries, allProducts, allAthletes] = await Promise.all([
      storage.listGroups(teamId),
      storage.listAllTestsForTeam(teamId),
      storage.listAllWeatherForTeam(teamId),
      storage.listSeries('', true, teamId),
      storage.listProducts('', true, teamId),
      storage.listAthletes(0, true, teamId),
    ]);

    const testIds = allTests.map((t: any) => t.id);
    const allEntries = await storage.listAllEntriesForTests(testIds);
    const entriesByTest: Record<number, any[]> = {};
    for (const e of allEntries) {
      if (!entriesByTest[e.testId]) entriesByTest[e.testId] = [];
      entriesByTest[e.testId].push(e);
    }

    const productsById: Record<number, any> = {};
    for (const p of allProducts) productsById[p.id] = p;

    const seriesById: Record<number, any> = {};
    for (const s of allSeries) seriesById[s.id] = s;

    const allRaceSkis: any[] = [];
    for (const ath of allAthletes) {
      const skis = await storage.listAllRaceSkisIncludingArchived(ath.id);
      allRaceSkis.push(...skis.map(s => ({ ...s, athleteName: ath.name })));
    }

    const raceSkiRegrinds: Record<number, any[]> = {};
    for (const ski of allRaceSkis) {
      const regrinds = await storage.listRaceSkiRegrinds(ski.id);
      raceSkiRegrinds[ski.id] = regrinds;
    }

    let groupNames = allGroups.map(g => g.name);
    if (groupNames.length === 0) {
      const scopeSet = new Set<string>();
      for (const t of allTests) if ((t as any).groupScope) scopeSet.add((t as any).groupScope);
      for (const p of allProducts) if ((p as any).groupScope) scopeSet.add((p as any).groupScope);
      for (const w of allWeather) if ((w as any).groupScope) scopeSet.add((w as any).groupScope);
      for (const s of allSeries) if ((s as any).groupScope) scopeSet.add((s as any).groupScope);
      groupNames = scopeSet.size > 0 ? Array.from(scopeSet) : ['default'];
    }

    for (const groupName of groupNames) {
      const sheetTitle = sanitizeSheetTitle(`${groupName}`);
      await ensureSheet(sheets, spreadsheetId, sheetTitle);

      const groupTests = allTests.filter((t: any) => t.groupScope === groupName);
      const groupWeather = allWeather.filter((w: any) => w.groupScope === groupName);
      const groupSeries = allSeries.filter((s: any) => s.groupScope === groupName);
      const groupProducts = allProducts.filter((p: any) => p.groupScope === groupName);

      const rows: any[][] = [];

      rows.push(['GLIDR BACKUP — ' + team.name + ' — ' + groupName]);
      rows.push(['Generated: ' + new Date().toISOString()]);
      rows.push([]);

      rows.push(['=== PRODUCTS ===']);
      rows.push(['ID', 'Category', 'Brand', 'Name', 'Stock']);
      for (const p of groupProducts) {
        rows.push([p.id, p.category, p.brand, p.name, p.stockQuantity ?? 0]);
      }
      rows.push([]);

      rows.push(['=== TEST SKI SERIES ===']);
      rows.push(['ID', 'Name', 'Type', 'Brand', 'Ski Type', 'Grind', 'Num Skis', 'Last Regrind', 'Archived']);
      for (const s of groupSeries) {
        rows.push([s.id, s.name, s.type, s.brand || '', s.skiType || '', s.grind || '', s.numberOfSkis, s.lastRegrind || '', s.archivedAt ? 'Yes' : '']);
      }
      rows.push([]);

      rows.push(['=== WEATHER ===']);
      rows.push(['ID', 'Date', 'Time', 'Location', 'Snow Temp °C', 'Air Temp °C', 'Snow Humidity %', 'Air Humidity %', 'Clouds', 'Visibility', 'Wind', 'Precipitation', 'Snow Type', 'Artificial Snow', 'Natural Snow', 'Grain Size', 'Snow Humidity Type', 'Track Hardness', 'Test Quality']);
      for (const w of groupWeather) {
        rows.push([w.id, w.date, w.time, w.location, w.snowTemperatureC, w.airTemperatureC, w.snowHumidityPct, w.airHumidityPct, w.clouds ?? '', w.visibility ?? '', w.wind ?? '', w.precipitation ?? '', w.snowType ?? '', w.artificialSnow ?? '', w.naturalSnow ?? '', w.grainSize ?? '', w.snowHumidityType ?? '', w.trackHardness ?? '', w.testQuality ?? '']);
      }
      rows.push([]);

      rows.push(['=== TESTS ===']);
      for (const test of groupTests) {
        const entries = entriesByTest[test.id] || [];
        const distLabels = parseDistanceLabels(test.distanceLabels);
        const seriesName = test.seriesId && seriesById[test.seriesId] ? seriesById[test.seriesId].name : '';

        rows.push([`--- Test #${test.id}: ${test.testName || test.location} ---`]);
        rows.push(['Date', test.date, 'Location', test.location, 'Type', test.testType, 'Source', test.testSkiSource, 'Series', seriesName]);
        if (test.notes) rows.push(['Notes', test.notes]);

        const headerRow = ['Ski #', 'Product', 'Methodology', 'Feeling Rank'];
        if (test.testType === 'Classic') headerRow.push('Kick Rank');
        if (distLabels.length > 0) {
          for (const label of distLabels) {
            headerRow.push(`Result ${label}`);
            headerRow.push(`Rank ${label}`);
          }
        } else {
          if (test.distanceLabel0km) { headerRow.push(`Result ${test.distanceLabel0km}`); headerRow.push(`Rank ${test.distanceLabel0km}`); }
          if (test.distanceLabelXkm) { headerRow.push(`Result ${test.distanceLabelXkm}`); headerRow.push(`Rank ${test.distanceLabelXkm}`); }
        }
        rows.push(headerRow);

        for (const entry of entries) {
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
                if (productsById[aid]) {
                  productName += ` + ${productsById[aid].brand} ${productsById[aid].name}`;
                }
              }
            } catch {}
          }

          const row: any[] = [entry.skiNumber, productName, entry.methodology || '', entry.feelingRank ?? ''];
          if (test.testType === 'Classic') row.push(entry.kickRank ?? '');

          if (distLabels.length > 0) {
            const results = parseResults(entry.results);
            for (const label of distLabels) {
              row.push(results[`result_${label}`] ?? '');
              row.push(results[`rank_${label}`] ?? '');
            }
          } else {
            row.push(entry.result0kmCmBehind ?? '');
            row.push(entry.rank0km ?? '');
            row.push(entry.resultXkmCmBehind ?? '');
            row.push(entry.rankXkm ?? '');
          }
          rows.push(row);
        }
        rows.push([]);
      }

      await clearAndWrite(sheets, spreadsheetId, sheetTitle, rows);
    }

    for (const athlete of allAthletes) {
      const sheetTitle = sanitizeSheetTitle(`Athlete - ${athlete.name} (${athlete.id})`);
      await ensureSheet(sheets, spreadsheetId, sheetTitle);

      const athleteSkis = allRaceSkis.filter(s => s.athleteId === athlete.id);
      const athleteTests = allTests.filter((t: any) => t.testSkiSource === 'raceskis' && t.athleteId === athlete.id);

      const rows: any[][] = [];
      rows.push([`ATHLETE: ${athlete.name}`]);
      rows.push(['Team', athlete.team || '', 'Created', athlete.createdAt]);
      rows.push([]);

      rows.push(['=== RACE SKIS ===']);
      rows.push(['ID', 'Ski ID', 'Serial', 'Brand', 'Discipline', 'Construction', 'Mold', 'Base', 'Grind', 'Heights', 'Year', 'Archived']);
      for (const ski of athleteSkis) {
        rows.push([ski.id, ski.skiId, ski.serialNumber || '', ski.brand || '', ski.discipline, ski.construction || '', ski.mold || '', ski.base || '', ski.grind || '', ski.heights || '', ski.year || '', ski.archivedAt ? 'Yes' : '']);
      }
      rows.push([]);

      rows.push(['=== REGRIND HISTORY ===']);
      rows.push(['Ski ID', 'Date', 'Grind Type', 'Stone', 'Pattern', 'Notes']);
      for (const ski of athleteSkis) {
        const regrinds = raceSkiRegrinds[ski.id] || [];
        for (const r of regrinds) {
          rows.push([ski.skiId, r.date, r.grindType, r.stone || '', r.pattern || '', r.notes || '']);
        }
      }
      rows.push([]);

      rows.push(['=== RACE SKI TESTS ===']);
      for (const test of athleteTests) {
        const entries = entriesByTest[test.id] || [];
        const distLabels = parseDistanceLabels(test.distanceLabels);

        rows.push([`--- Test #${test.id}: ${test.testName || test.location} ---`]);
        rows.push(['Date', test.date, 'Location', test.location, 'Type', test.testType]);

        const headerRow = ['Ski #', 'Race Ski ID', 'Feeling Rank'];
        if (test.testType === 'Classic') headerRow.push('Kick Rank');
        if (distLabels.length > 0) {
          for (const label of distLabels) {
            headerRow.push(`Result ${label}`);
            headerRow.push(`Rank ${label}`);
          }
        } else {
          if (test.distanceLabel0km) { headerRow.push(`Result ${test.distanceLabel0km}`); headerRow.push(`Rank ${test.distanceLabel0km}`); }
          if (test.distanceLabelXkm) { headerRow.push(`Result ${test.distanceLabelXkm}`); headerRow.push(`Rank ${test.distanceLabelXkm}`); }
        }
        rows.push(headerRow);

        for (const entry of entries) {
          let skiLabel = '';
          if (entry.raceSkiId) {
            const rs = allRaceSkis.find(s => s.id === entry.raceSkiId);
            if (rs) skiLabel = `${rs.skiId} (${rs.brand || ''} ${rs.grind || ''})`;
          }
          const row: any[] = [entry.skiNumber, skiLabel, entry.feelingRank ?? ''];
          if (test.testType === 'Classic') row.push(entry.kickRank ?? '');
          if (distLabels.length > 0) {
            const results = parseResults(entry.results);
            for (const label of distLabels) {
              row.push(results[`result_${label}`] ?? '');
              row.push(results[`rank_${label}`] ?? '');
            }
          } else {
            row.push(entry.result0kmCmBehind ?? '');
            row.push(entry.rank0km ?? '');
            row.push(entry.resultXkmCmBehind ?? '');
            row.push(entry.rankXkm ?? '');
          }
          rows.push(row);
        }
        rows.push([]);
      }

      await clearAndWrite(sheets, spreadsheetId, sheetTitle, rows);
    }

    const overviewTitle = 'Overview';
    await ensureSheet(sheets, spreadsheetId, overviewTitle);
    const overviewRows: any[][] = [
      ['GLIDR BACKUP OVERVIEW'],
      ['Team', team.name],
      ['Last backup', new Date().toISOString()],
      [],
      ['Groups', groupNames.join(', ')],
      ['Total tests', allTests.length],
      ['Total weather logs', allWeather.length],
      ['Total products', allProducts.length],
      ['Total series', allSeries.length],
      ['Total athletes', allAthletes.length],
      ['Total race skis', allRaceSkis.length],
      [],
      ['=== SHEETS IN THIS WORKBOOK ==='],
    ];
    for (const g of groupNames) {
      overviewRows.push([`Group: ${g}`]);
    }
    for (const a of allAthletes) {
      overviewRows.push([`Athlete: ${a.name}`]);
    }
    await clearAndWrite(sheets, spreadsheetId, overviewTitle, overviewRows);

    await storage.updateTeam(teamId, { lastBackupAt: new Date().toISOString() });

    return { success: true };
  } catch (err: any) {
    console.error('[Backup] Error for team', teamId, err);
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
