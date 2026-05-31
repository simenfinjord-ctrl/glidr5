import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Test = {
  id: number;
  date: string;
  location: string;
  testType: string;
  seriesId: number;
  notes: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  distanceLabels: string | null;
  createdByName: string;
  groupScope: string;
};

type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  additionalProductIds: string | null;
  freeTextProduct: string | null;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  resultXkmCmBehind: number | null;
  rankXkm: number | null;
  results: string | null;
  feelingRank: number | null;
  kickRank: number | null;
};

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
};

type Weather = {
  id: number;
  date: string;
  time: string;
  location: string;
  snowTemperatureC: number;
  airTemperatureC: number;
  snowHumidityPct: number;
  airHumidityPct: number;
  clouds: number | null;
  visibility: string | null;
  wind: string | null;
  precipitation: string | null;
  artificialSnow: string | null;
  naturalSnow: string | null;
  grainSize: string | null;
  snowHumidityType: string | null;
  trackHardness: string | null;
  testQuality: number | null;
};

type Series = {
  id: number;
  name: string;
};

type RoundResult = { result: number | null; rank: number | null };
type Lang = "no" | "en";

// ── Translations ─────────────────────────────────────────────
const LABELS: Record<string, Record<Lang, string>> = {
  appTitle:         { en: "GLIDR — Test Report",      no: "GLIDR — Testrapport" },
  generated:        { en: "Generated",                 no: "Generert" },
  group:            { en: "Group",                     no: "Gruppe" },
  date:             { en: "Date",                      no: "Dato" },
  series:           { en: "Series",                    no: "Serie" },
  createdBy:        { en: "Created by",                no: "Opprettet av" },
  notes:            { en: "Notes",                     no: "Notater" },
  weatherTitle:     { en: "Weather Conditions",        no: "Vær- og føreforhold" },
  snowTemp:         { en: "Snow Temp",                 no: "Snøtemp" },
  airTemp:          { en: "Air Temp",                  no: "Lufttemp" },
  snowHumDoser:     { en: "Snow Hum (Doser)",          no: "Snøfukt (Doser)" },
  airHumidity:      { en: "Air Humidity",              no: "Luftfuktighet" },
  clouds:           { en: "Clouds",                    no: "Skyer" },
  visibility:       { en: "Visibility",                no: "Sikt" },
  wind:             { en: "Wind",                      no: "Vind" },
  precipitation:    { en: "Precipitation",             no: "Nedbør" },
  artSnow:          { en: "Art. Snow",                 no: "Kunstsnø" },
  natSnow:          { en: "Nat. Snow",                 no: "Natursnø" },
  grain:            { en: "Grain",                     no: "Kornstørrelse" },
  snowHumType:      { en: "Snow Hum Type",             no: "Snøfukttype" },
  track:            { en: "Track",                     no: "Spor" },
  quality:          { en: "Quality",                   no: "Kvalitet" },
  resultsTitle:     { en: "Results",                   no: "Resultater" },
  colRank:          { en: "Rank",                      no: "Rang" },
  colSki:           { en: "Ski #",                     no: "Ski #" },
  colProduct:       { en: "Product",                   no: "Produkt" },
  colMethod:        { en: "Method",                    no: "Metode" },
  colFeeling:       { en: "Feeling",                   no: "Følelse" },
  colKick:          { en: "Kick",                      no: "Feste" },
  colCm:            { en: "cm",                        no: "cm" },
  exportedBy:       { en: "Exported by",               no: "Eksportert av" },
  confidential:     { en: "This document is intended for team members only.", no: "Dette dokumentet er kun for teammedlemmer." },
  tagline:          { en: "What we did yesterday is not good enough today.",  no: "Det vi gjorde i går, er ikke godt nok i dag." },
};

function tx(key: string, lang: Lang): string {
  return LABELS[key]?.[lang] ?? LABELS[key]?.["en"] ?? key;
}

function getDistanceLabels(test: Test): string[] {
  if (test.distanceLabels) {
    try {
      const parsed = JSON.parse(test.distanceLabels);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  const labels: string[] = [test.distanceLabel0km || "0 km"];
  if (test.distanceLabelXkm) labels.push(test.distanceLabelXkm);
  return labels;
}

function getEntryRounds(entry: TestEntry, numRounds: number): RoundResult[] {
  if (entry.results) {
    try {
      const parsed = JSON.parse(entry.results);
      if (Array.isArray(parsed)) {
        while (parsed.length < numRounds) parsed.push({ result: null, rank: null });
        return parsed.slice(0, numRounds);
      }
    } catch {}
  }
  const results: RoundResult[] = [{ result: entry.result0kmCmBehind, rank: entry.rank0km }];
  if (numRounds > 1) results.push({ result: entry.resultXkmCmBehind, rank: entry.rankXkm });
  while (results.length < numRounds) results.push({ result: null, rank: null });
  return results;
}

function applyExportFooter(doc: jsPDF, exportedBy: string, lang: Lang, teamName?: string) {
  const pageCount = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : 1;
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const dateStr = new Date().toLocaleString(lang === "no" ? "nb-NO" : "en-GB");
  for (let pg = 1; pg <= pageCount; pg++) {
    doc.setPage(pg);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130, 130, 130);
    // Line above footer
    doc.setDrawColor(200, 200, 200);
    doc.line(14, ph - 9, pw - 14, ph - 9);
    // Left: who exported + date
    doc.text(`${tx("exportedBy", lang)}: ${exportedBy}${teamName ? `  ·  ${teamName}` : ""}  ·  ${dateStr}`, 14, ph - 5);
    // Right: confidentiality notice
    doc.text(tx("confidential", lang), pw - 14, ph - 5, { align: "right" });
    // Reset
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
  }
}

export function generateTestPDF(
  test: Test,
  entries: TestEntry[],
  productsById: Map<number, Product>,
  seriesById: Map<number, Series>,
  weather: Weather | null,
  exportedBy: string = "Unknown",
  teamName?: string,
  lang: Lang = "en",
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ──
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(tx("appTitle", lang), 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `${tx("generated", lang)} ${new Date().toLocaleDateString(lang === "no" ? "nb-NO" : "en-GB")} ${new Date().toLocaleTimeString(lang === "no" ? "nb-NO" : "en-GB", { hour: "2-digit", minute: "2-digit" })}`,
    14, 24,
  );
  doc.text(`${tx("group", lang)}: ${test.groupScope}`, pageWidth - 14, 18, { align: "right" });

  // Tagline — development platform branding
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(160, 160, 160);
  doc.text(tx("tagline", lang), pageWidth - 14, 24, { align: "right" });

  doc.setDrawColor(200);
  doc.line(14, 27, pageWidth - 14, 27);

  let y = 34;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(`${test.location} — ${test.testType} Test`, 14, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  const series = seriesById.get(test.seriesId);
  doc.text(
    `${tx("date", lang)}: ${test.date}  |  ${tx("series", lang)}: ${series?.name ?? "—"}  |  ${tx("createdBy", lang)}: ${test.createdByName}`,
    14, y,
  );
  y += 5;

  if (test.notes) {
    doc.text(`${tx("notes", lang)}: ${test.notes}`, 14, y);
    y += 5;
  }

  // ── Weather ──
  if (weather) {
    y += 3;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(tx("weatherTitle", lang), 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);

    const weatherRows: string[][] = [
      [tx("snowTemp", lang), `${weather.snowTemperatureC}°C`, tx("airTemp", lang), `${weather.airTemperatureC}°C`],
      [tx("snowHumDoser", lang), `${weather.snowHumidityPct}%`, tx("airHumidity", lang), `${weather.airHumidityPct}%rH`],
    ];

    const extras: string[] = [];
    if (weather.clouds != null) extras.push(`${tx("clouds", lang)}: ${weather.clouds}/8`);
    if (weather.visibility) extras.push(`${tx("visibility", lang)}: ${weather.visibility}`);
    if (weather.wind) extras.push(`${tx("wind", lang)}: ${weather.wind}`);
    if (weather.precipitation) extras.push(`${tx("precipitation", lang)}: ${weather.precipitation}`);
    if (weather.artificialSnow) extras.push(`${tx("artSnow", lang)}: ${weather.artificialSnow}`);
    if (weather.naturalSnow) extras.push(`${tx("natSnow", lang)}: ${weather.naturalSnow}`);
    if (weather.grainSize) extras.push(`${tx("grain", lang)}: ${weather.grainSize}`);
    if (weather.snowHumidityType) extras.push(`${tx("snowHumType", lang)}: ${weather.snowHumidityType}`);
    if (weather.trackHardness) extras.push(`${tx("track", lang)}: ${weather.trackHardness}`);
    if (weather.testQuality != null) extras.push(`${tx("quality", lang)}: ${weather.testQuality}/10`);

    autoTable(doc, {
      startY: y,
      head: [],
      body: weatherRows,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { fontStyle: "bold", cellWidth: 35 },
        3: { cellWidth: 30 },
      },
      margin: { left: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 2;

    if (extras.length > 0) {
      doc.setFontSize(8);
      doc.text(extras.join("  |  "), 14, y);
      y += 5;
    }
  }

  // ── Results table ──
  y += 4;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(tx("resultsTitle", lang), 14, y);
  y += 2;

  const distLabels = getDistanceLabels(test);

  const sortedEntries = [...entries].sort((a, b) => {
    const aRounds = getEntryRounds(a, distLabels.length);
    const bRounds = getEntryRounds(b, distLabels.length);
    const aRank = aRounds[0]?.rank;
    const bRank = bRounds[0]?.rank;
    if (aRank == null && bRank == null) return 0;
    if (aRank == null) return 1;
    if (bRank == null) return -1;
    return aRank - bRank;
  });

  const headers = [
    tx("colRank", lang),
    tx("colSki", lang),
    tx("colProduct", lang),
    tx("colMethod", lang),
  ];
  for (const label of distLabels) {
    headers.push(`${label || "Round"} (${tx("colCm", lang)})`);
    headers.push(tx("colRank", lang));
  }
  headers.push(tx("colFeeling", lang));
  const isClassic = test.testType === "Classic";
  if (isClassic) headers.push(tx("colKick", lang));

  const body = sortedEntries.map((entry) => {
    const prod = entry.productId ? productsById.get(entry.productId) : null;
    const additionalIds = entry.additionalProductIds
      ? entry.additionalProductIds.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
      : [];
    const allProducts = [
      prod ? `${prod.brand} ${prod.name}` : (entry.freeTextProduct || null),
      ...additionalIds.map((aid) => {
        const p = productsById.get(aid);
        return p ? `${p.brand} ${p.name}` : null;
      }),
    ].filter(Boolean);

    const rounds = getEntryRounds(entry, distLabels.length);
    const row: (string | number)[] = [
      rounds[0]?.rank ?? "—",
      entry.skiNumber,
      allProducts.join(" + ") || "—",
      entry.methodology || "—",
    ];
    for (const rr of rounds) {
      row.push(rr.result != null ? String(rr.result) : "—");
      row.push(rr.rank != null ? String(rr.rank) : "—");
    }
    row.push(entry.feelingRank != null ? String(entry.feelingRank) : "—");
    if (isClassic) row.push(entry.kickRank != null ? String(entry.kickRank) : "—");
    return row;
  });

  autoTable(doc, {
    startY: y,
    head: [headers],
    body,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const rank = data.cell.raw;
        if (rank === 1) {
          data.cell.styles.textColor = [16, 185, 129];
          data.cell.styles.fontStyle = "bold";
        } else if (rank === 2) {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = "bold";
        } else if (rank === 3) {
          data.cell.styles.textColor = [245, 158, 11];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  applyExportFooter(doc, exportedBy, lang, teamName);

  doc.save(`glidr-test-${test.location}-${test.date}.pdf`);
}
