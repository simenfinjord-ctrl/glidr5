import OpenAI from "openai";
import { storage, parseGroupScopes } from "./storage";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface ColumnMapping {
  csvColumn: string;
  appField: string | null;
  sampleValues: string[];
}

export interface ImportMapping {
  mappings: ColumnMapping[];
  targetType: "tests" | "products" | "weather" | "series";
  previewRows: Record<string, string>[];
}

const APP_FIELDS: Record<string, string[]> = {
  tests: [
    "date", "location", "testType", "seriesName", "notes",
    "skiNumber", "productBrand", "productName", "methodology",
    "result", "feelingRank",
  ],
  products: [
    "category", "brand", "name",
  ],
  weather: [
    "date", "time", "location",
    "snowTemperatureC", "airTemperatureC",
    "snowHumidityPct", "airHumidityPct",
    "clouds", "visibility", "wind", "precipitation",
    "artificialSnow", "naturalSnow",
    "grainSize", "snowHumidityType", "trackHardness", "testQuality",
  ],
  series: [
    "name", "type", "brand", "skiType", "grind", "numberOfSkis",
  ],
};

export async function analyzeCSV(
  csvText: string,
  targetType: string,
): Promise<ImportMapping> {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter);
  const dataRows = lines.slice(1, Math.min(6, lines.length)).map((l) => parseCSVLine(l, delimiter));

  const sampleData: Record<string, string[]> = {};
  for (let i = 0; i < headers.length; i++) {
    sampleData[headers[i]] = dataRows.map((r) => r[i] || "");
  }

  const validTarget = APP_FIELDS[targetType] ? targetType : "tests";
  const fields = APP_FIELDS[validTarget];

  const prompt = `You are a data mapping assistant for a ski testing application called Glidr.
Given CSV column headers and sample data, map each CSV column to the most appropriate application field.

Application fields for "${validTarget}":
${fields.map((f) => `- ${f}`).join("\n")}

CSV columns with sample values:
${headers.map((h) => `- "${h}": [${sampleData[h].map((v) => `"${v}"`).join(", ")}]`).join("\n")}

Rules:
- Map each CSV column to exactly one app field, or null if no good match exists
- For test imports: "date" maps to date, locations/venues map to location, "Glide"/"Structure" maps to testType
- Product brand/name columns should be recognized even with varied naming
- Temperature columns with negative values are likely snowTemperatureC or airTemperatureC
- Humidity percentage columns map to snowHumidityPct or airHumidityPct
- Be smart about abbreviations and alternative names (e.g., "Temp" = temperature, "Hum" = humidity)
- If a column clearly contains ski pair numbers (1,2,3...), map to skiNumber
- If a column has measurement values (distances, times), map to result

Respond with ONLY a JSON array of objects, each with:
- "csvColumn": the original CSV header
- "appField": the matched app field name or null

Example: [{"csvColumn": "Date", "appField": "date"}, {"csvColumn": "Notes", "appField": null}]`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content || "[]";
  let aiMappings: Array<{ csvColumn: string; appField: string | null }>;
  try {
    const cleaned = content.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    aiMappings = JSON.parse(cleaned);
  } catch {
    aiMappings = headers.map((h) => ({ csvColumn: h, appField: null }));
  }

  const mappings: ColumnMapping[] = headers.map((h) => {
    const match = aiMappings.find((m) => m.csvColumn === h);
    return {
      csvColumn: h,
      appField: match?.appField || null,
      sampleValues: sampleData[h] || [],
    };
  });

  const previewRows = dataRows.slice(0, 5).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || "";
    });
    return obj;
  });

  return {
    mappings,
    targetType: validTarget as ImportMapping["targetType"],
    previewRows,
  };
}

export async function executeImport(
  csvText: string,
  mappings: ColumnMapping[],
  targetType: string,
  userId: number,
  userName: string,
  groupScope: string,
): Promise<{ imported: number; errors: string[] }> {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, errors: ["No data rows"] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter);
  const dataRows = lines.slice(1).map((l) => parseCSVLine(l, delimiter));

  const fieldMap: Record<string, number> = {};
  for (const m of mappings) {
    if (m.appField) {
      const idx = headers.indexOf(m.csvColumn);
      if (idx >= 0) fieldMap[m.appField] = idx;
    }
  }

  const now = new Date().toISOString();
  let imported = 0;
  const errors: string[] = [];

  if (targetType === "products") {
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const row = dataRows[i];
        const category = getVal(row, fieldMap, "category") || "Glide";
        const brand = getVal(row, fieldMap, "brand") || "";
        const name = getVal(row, fieldMap, "name") || "";
        if (!brand && !name) {
          errors.push(`Row ${i + 2}: missing brand and name`);
          continue;
        }
        await storage.createProduct({
          category,
          brand: brand || "Unknown",
          name: name || brand,
          createdAt: now,
          createdById: userId,
          createdByName: userName,
          groupScope,
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 2}: ${e.message}`);
      }
    }
  } else if (targetType === "series") {
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const row = dataRows[i];
        const name = getVal(row, fieldMap, "name") || "";
        const type = getVal(row, fieldMap, "type") || "Glide";
        if (!name) {
          errors.push(`Row ${i + 2}: missing name`);
          continue;
        }
        await storage.createSeries({
          name,
          type: type === "Structure" ? "Structure" : "Glide",
          brand: getVal(row, fieldMap, "brand") || null,
          skiType: getVal(row, fieldMap, "skiType") || null,
          grind: getVal(row, fieldMap, "grind") || null,
          numberOfSkis: parseInt(getVal(row, fieldMap, "numberOfSkis") || "8") || 8,
          lastRegrind: null,
          createdAt: now,
          createdById: userId,
          createdByName: userName,
          groupScope,
          archivedAt: null,
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 2}: ${e.message}`);
      }
    }
  } else if (targetType === "weather") {
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const row = dataRows[i];
        const date = getVal(row, fieldMap, "date") || "";
        const location = getVal(row, fieldMap, "location") || "";
        if (!date || !location) {
          errors.push(`Row ${i + 2}: missing date or location`);
          continue;
        }
        await storage.createWeather({
          date,
          time: getVal(row, fieldMap, "time") || "12:00",
          location,
          snowTemperatureC: parseFloat(getVal(row, fieldMap, "snowTemperatureC") || "0") || 0,
          airTemperatureC: parseFloat(getVal(row, fieldMap, "airTemperatureC") || "0") || 0,
          snowHumidityPct: parseFloat(getVal(row, fieldMap, "snowHumidityPct") || "0") || 0,
          airHumidityPct: parseFloat(getVal(row, fieldMap, "airHumidityPct") || "0") || 0,
          clouds: parseInt(getVal(row, fieldMap, "clouds") || "") || null,
          visibility: getVal(row, fieldMap, "visibility") || null,
          wind: getVal(row, fieldMap, "wind") || null,
          precipitation: getVal(row, fieldMap, "precipitation") || null,
          artificialSnow: getVal(row, fieldMap, "artificialSnow") || null,
          naturalSnow: getVal(row, fieldMap, "naturalSnow") || null,
          grainSize: getVal(row, fieldMap, "grainSize") || null,
          snowHumidityType: getVal(row, fieldMap, "snowHumidityType") || null,
          trackHardness: getVal(row, fieldMap, "trackHardness") || null,
          testQuality: parseInt(getVal(row, fieldMap, "testQuality") || "") || null,
          snowType: null,
          createdAt: now,
          createdById: userId,
          createdByName: userName,
          groupScope,
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${i + 2}: ${e.message}`);
      }
    }
  } else if (targetType === "tests") {
    const allProducts = await storage.listProducts(groupScope, true);
    const allSeries = await storage.listSeries(groupScope, true);

    const testsByKey: Record<string, { test: any; entries: any[] }> = {};

    for (let i = 0; i < dataRows.length; i++) {
      try {
        const row = dataRows[i];
        const date = getVal(row, fieldMap, "date") || "";
        const location = getVal(row, fieldMap, "location") || "";
        const testType = getVal(row, fieldMap, "testType") || "Glide";
        const seriesName = getVal(row, fieldMap, "seriesName") || "";

        if (!date) {
          errors.push(`Row ${i + 2}: missing date`);
          continue;
        }

        const series = allSeries.find(
          (s) => s.name.toLowerCase() === seriesName.toLowerCase(),
        );

        const testKey = `${date}|${location}|${testType}|${seriesName}`;

        if (!testsByKey[testKey]) {
          testsByKey[testKey] = {
            test: {
              date,
              location: location || "Unknown",
              testType: testType === "Structure" ? "Structure" : "Glide",
              seriesId: series?.id || 0,
              seriesName,
              notes: getVal(row, fieldMap, "notes") || null,
            },
            entries: [],
          };
        }

        const productBrand = getVal(row, fieldMap, "productBrand") || "";
        const productName = getVal(row, fieldMap, "productName") || "";
        const product = allProducts.find(
          (p) =>
            (p.brand.toLowerCase() === productBrand.toLowerCase() &&
              p.name.toLowerCase() === productName.toLowerCase()) ||
            (productName &&
              p.name.toLowerCase() === productName.toLowerCase()),
        );

        const skiNumber =
          parseInt(getVal(row, fieldMap, "skiNumber") || "") ||
          testsByKey[testKey].entries.length + 1;

        const resultVal = getVal(row, fieldMap, "result") || "";
        const feelingRank =
          parseInt(getVal(row, fieldMap, "feelingRank") || "") || null;

        testsByKey[testKey].entries.push({
          skiNumber,
          productId: product?.id || null,
          freeTextProduct:
            !product && (productBrand || productName)
              ? `${productBrand} ${productName}`.trim()
              : null,
          methodology: getVal(row, fieldMap, "methodology") || "",
          result0kmCmBehind: parseFloat(resultVal) || null,
          rank0km: null,
          resultXkmCmBehind: null,
          rankXkm: null,
          results: null,
          feelingRank,
          additionalProductIds: null,
        });
      } catch (e: any) {
        errors.push(`Row ${i + 2}: ${e.message}`);
      }
    }

    for (const key of Object.keys(testsByKey)) {
      const { test: testData, entries } = testsByKey[key];
      try {
        if (!testData.seriesId) {
          const matchedSeries = allSeries.find(
            (s) => s.name.toLowerCase() === (testData.seriesName || "").toLowerCase(),
          );
          if (matchedSeries) {
            testData.seriesId = matchedSeries.id;
          } else if (allSeries.length > 0) {
            testData.seriesId = allSeries[0].id;
          } else {
            errors.push(`Test "${key}": no series found, skipping`);
            continue;
          }
        }

        const test = await storage.createTest({
          date: testData.date,
          location: testData.location,
          weatherId: null,
          testType: testData.testType,
          seriesId: testData.seriesId,
          notes: testData.notes,
          distanceLabel0km: null,
          distanceLabelXkm: null,
          distanceLabels: null,
          createdAt: now,
          createdById: userId,
          createdByName: userName,
          groupScope,
        });

        for (const entry of entries) {
          await storage.createEntry({
            testId: test.id,
            skiNumber: entry.skiNumber,
            productId: entry.productId,
            freeTextProduct: entry.freeTextProduct,
            additionalProductIds: entry.additionalProductIds,
            methodology: entry.methodology,
            result0kmCmBehind: entry.result0kmCmBehind,
            rank0km: entry.rank0km,
            resultXkmCmBehind: entry.resultXkmCmBehind,
            rankXkm: entry.rankXkm,
            results: entry.results,
            feelingRank: entry.feelingRank,
            createdAt: now,
            createdById: userId,
            createdByName: userName,
            groupScope,
          });
        }
        imported++;
      } catch (e: any) {
        errors.push(`Test "${key}": ${e.message}`);
      }
    }
  }

  return { imported, errors };
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return "\t";
  if (semicolons > commas) return ";";
  return ",";
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function getVal(
  row: string[],
  fieldMap: Record<string, number>,
  field: string,
): string {
  const idx = fieldMap[field];
  if (idx === undefined || idx >= row.length) return "";
  return row[idx] || "";
}
