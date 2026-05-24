/**
 * Shared PDF / print layout for all Glidr reports.
 * Every export — per-test report, athlete export, analytics report — uses
 * these helpers so the output looks identical.
 */

// ─── Shared CSS ──────────────────────────────────────────────────────────────

export const PDF_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    color: #111827;
    background: #fff;
    padding: 36px 44px;
    max-width: 960px;
    margin: 0 auto;
  }

  /* ── Document header ── */
  .pdf-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 2.5px solid #111827;
    padding-bottom: 14px;
    margin-bottom: 28px;
  }
  .pdf-header-brand {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #111827;
  }
  .pdf-header-brand span {
    color: #2563eb;
  }
  .pdf-header-meta {
    text-align: right;
    font-size: 11px;
    color: #6b7280;
    line-height: 1.6;
  }
  .pdf-title {
    font-size: 22px;
    font-weight: 800;
    color: #111827;
    margin-bottom: 2px;
  }
  .pdf-subtitle {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 24px;
  }

  /* ── Section headings ── */
  h2.pdf-section {
    font-size: 14px;
    font-weight: 700;
    color: #111827;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1.5px solid #e5e7eb;
    padding-bottom: 5px;
    margin: 28px 0 12px;
  }

  /* ── Tables ── */
  table.pdf-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-bottom: 20px;
  }
  table.pdf-table thead tr {
    background: #f3f4f6;
  }
  table.pdf-table th {
    padding: 7px 10px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #374151;
    border: 1px solid #e5e7eb;
    white-space: nowrap;
  }
  table.pdf-table td {
    padding: 6px 10px;
    border: 1px solid #e5e7eb;
    color: #111827;
    vertical-align: top;
  }
  table.pdf-table tr:nth-child(even) td {
    background: #fafafa;
  }
  table.pdf-table tr.highlight td {
    background: #fef9c3;
    font-weight: 600;
  }

  /* ── Summary cards ── */
  .pdf-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }
  .pdf-card {
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 14px;
    text-align: center;
  }
  .pdf-card .value {
    font-size: 26px;
    font-weight: 800;
    color: #111827;
    line-height: 1.1;
  }
  .pdf-card .label {
    font-size: 10px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 3px;
  }

  /* ── Weather block ── */
  .pdf-weather {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 12px;
    margin: 8px 0 14px;
    font-size: 11.5px;
  }
  .pdf-weather-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
    margin-bottom: 8px;
  }
  .pdf-weather-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px 16px;
  }
  .pdf-weather-item .key {
    font-size: 9.5px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .pdf-weather-item .val {
    font-size: 12px;
    font-weight: 500;
    color: #111827;
  }

  /* ── Test block ── */
  .pdf-test-block {
    margin-bottom: 28px;
    page-break-inside: avoid;
  }
  .pdf-test-header {
    font-size: 13px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 2px;
  }
  .pdf-test-meta {
    font-size: 11px;
    color: #6b7280;
    margin-bottom: 6px;
  }

  /* ── Footer ── */
  .pdf-footer {
    margin-top: 40px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    font-size: 10px;
    color: #9ca3af;
    display: flex;
    justify-content: space-between;
  }

  /* ── Print ── */
  @media print {
    body { padding: 0; }
    .page-break { page-break-before: always; }
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function pdfTh(label: string): string {
  return `<th>${esc(label)}</th>`;
}

export function pdfTd(value: string | number | null | undefined, bold = false): string {
  return `<td${bold ? ' style="font-weight:700;"' : ""}>${esc(value)}</td>`;
}

/** Full document wrapper */
export function pdfDocument(title: string, body: string): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("nb-NO", { day: "2-digit", month: "long", year: "numeric" });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(title)}</title>
  <style>${PDF_STYLES}</style>
</head>
<body>
  <div class="pdf-header">
    <div class="pdf-header-brand">Glidr<span>.</span></div>
    <div class="pdf-header-meta">
      <div>${esc(title)}</div>
      <div>${dateStr}</div>
    </div>
  </div>
  ${body}
  <div class="pdf-footer">
    <span>Glidr — ski testing platform</span>
    <span>glidr.no</span>
  </div>
</body>
</html>`;
}

/** Section heading */
export function pdfSection(label: string): string {
  return `<h2 class="pdf-section">${esc(label)}</h2>`;
}

/** Summary stat cards */
export function pdfCards(cards: { value: string | number; label: string }[]): string {
  const inner = cards
    .map(c => `<div class="pdf-card"><div class="value">${esc(c.value)}</div><div class="label">${esc(c.label)}</div></div>`)
    .join("");
  return `<div class="pdf-cards">${inner}</div>`;
}

/** A full table from headers + rows of cells */
export function pdfTable(headers: string[], rows: (string | number | null | undefined)[][], highlightFn?: (row: (string | number | null | undefined)[]) => boolean): string {
  const thead = `<thead><tr>${headers.map(pdfTh).join("")}</tr></thead>`;
  const tbody = rows.map(row => {
    const cls = highlightFn?.(row) ? ' class="highlight"' : "";
    return `<tr${cls}>${row.map(v => pdfTd(v)).join("")}</tr>`;
  }).join("");
  return `<table class="pdf-table">${thead}<tbody>${tbody || `<tr><td colspan="${headers.length}" style="text-align:center;color:#9ca3af;">No data</td></tr>`}</tbody></table>`;
}

/** Weather block — all fields */
export interface WeatherData {
  snowTemperatureC?: number | null;
  airTemperatureC?: number | null;
  snowHumidityPct?: number | null;
  airHumidityPct?: number | null;
  clouds?: number | null;
  visibility?: string | null;
  wind?: string | null;
  precipitation?: string | null;
  snowType?: string | null;
  grainSize?: string | null;
  trackHardness?: string | null;
  testQuality?: number | null;
  artificialSnow?: string | null;
  naturalSnow?: string | null;
  snowHumidityType?: string | null;
  time?: string;
  location?: string;
}

export function pdfWeather(w: WeatherData): string {
  const items: { key: string; val: string | number | null | undefined }[] = [
    { key: "Snow temp",      val: w.snowTemperatureC != null ? `${w.snowTemperatureC} °C` : null },
    { key: "Air temp",       val: w.airTemperatureC != null ? `${w.airTemperatureC} °C` : null },
    { key: "Snow humidity",  val: w.snowHumidityPct != null ? `${w.snowHumidityPct} %` : null },
    { key: "Air humidity",   val: w.airHumidityPct != null ? `${w.airHumidityPct} %` : null },
    { key: "Clouds",         val: w.clouds != null ? `${w.clouds} %` : null },
    { key: "Visibility",     val: w.visibility },
    { key: "Wind",           val: w.wind },
    { key: "Precipitation",  val: w.precipitation },
    { key: "Snow type",      val: w.snowType },
    { key: "Grain size",     val: w.grainSize },
    { key: "Track hardness", val: w.trackHardness },
    { key: "Test quality",   val: w.testQuality != null ? `${w.testQuality} / 10` : null },
    { key: "Artificial snow",val: w.artificialSnow },
    { key: "Natural snow",   val: w.naturalSnow },
    { key: "Snow hum. type", val: w.snowHumidityType },
  ].filter(i => i.val != null && i.val !== "");

  if (items.length === 0) return "";

  const cells = items
    .map(i => `<div class="pdf-weather-item"><div class="key">${esc(i.key)}</div><div class="val">${esc(i.val)}</div></div>`)
    .join("");

  return `<div class="pdf-weather">
    <div class="pdf-weather-title">⛅ Weather Conditions${w.time ? ` · ${esc(w.time)}` : ""}${w.location ? ` · ${esc(w.location)}` : ""}</div>
    <div class="pdf-weather-grid">${cells}</div>
  </div>`;
}

/** Open a new window, write HTML, trigger print */
export function openPdfWindow(html: string, preOpenedWin?: Window | null): void {
  const win = preOpenedWin ?? window.open("", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}
