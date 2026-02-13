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

export function generateTestPDF(
  test: Test,
  entries: TestEntry[],
  productsById: Map<number, Product>,
  seriesById: Map<number, Series>,
  weather: Weather | null,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("GLIDR — Test Report", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, 14, 24);
  doc.text(`Group: ${test.groupScope}`, pageWidth - 14, 18, { align: "right" });

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
  doc.text(`Date: ${test.date}  |  Series: ${series?.name ?? "—"}  |  Created by: ${test.createdByName}`, 14, y);
  y += 5;

  if (test.notes) {
    doc.text(`Notes: ${test.notes}`, 14, y);
    y += 5;
  }

  if (weather) {
    y += 3;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Weather Conditions", 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);

    const weatherRows: string[][] = [
      ["Snow Temp", `${weather.snowTemperatureC}°C`, "Air Temp", `${weather.airTemperatureC}°C`],
      ["Snow Hum (Doser)", `${weather.snowHumidityPct}%`, "Air Humidity", `${weather.airHumidityPct}%rH`],
    ];

    const extras: string[] = [];
    if (weather.clouds != null) extras.push(`Clouds: ${weather.clouds}/8`);
    if (weather.visibility) extras.push(`Visibility: ${weather.visibility}`);
    if (weather.wind) extras.push(`Wind: ${weather.wind}`);
    if (weather.precipitation) extras.push(`Precipitation: ${weather.precipitation}`);
    if (weather.artificialSnow) extras.push(`Art. Snow: ${weather.artificialSnow}`);
    if (weather.naturalSnow) extras.push(`Nat. Snow: ${weather.naturalSnow}`);
    if (weather.grainSize) extras.push(`Grain: ${weather.grainSize}`);
    if (weather.snowHumidityType) extras.push(`Snow Hum Type: ${weather.snowHumidityType}`);
    if (weather.trackHardness) extras.push(`Track: ${weather.trackHardness}`);
    if (weather.testQuality != null) extras.push(`Quality: ${weather.testQuality}/10`);

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

  y += 4;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Results", 14, y);
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

  const headers = ["Rank", "Ski #", "Product", "Method"];
  for (const label of distLabels) {
    headers.push(`${label || "Round"} (cm)`);
    headers.push(`Rank`);
  }
  headers.push("Feeling");

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
          data.cell.styles.textColor = [59, 130, 246];
          data.cell.styles.fontStyle = "bold";
        } else if (rank === 3) {
          data.cell.styles.textColor = [245, 158, 11];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text("Glidr — US Ski Team Testing Platform", 14, finalY);
  doc.text(`Page 1`, pageWidth - 14, finalY, { align: "right" });

  doc.save(`glidr-test-${test.location}-${test.date}.pdf`);
}
