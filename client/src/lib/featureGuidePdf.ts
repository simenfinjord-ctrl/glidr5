import jsPDF from "jspdf";

// ── Style constants ──────────────────────────────────────────────────────────
const PRIMARY:   [number, number, number] = [124,  58, 237];
const SECONDARY: [number, number, number] = [139,  92, 246];
const DARK:      [number, number, number] = [ 15,  15,  30];
const MUTED:     [number, number, number] = [100, 100, 120];
const LIGHT_BG:  [number, number, number] = [247, 245, 255];
const SECTION_BG:[number, number, number] = [237, 233, 254];

const PAGE_W  = 210;
const PAGE_H  = 297;
const ML      = 18;
const MR      = 18;
const MT      = 20;
const MB      = 20;
const CONTENT_W = PAGE_W - ML - MR;

// ── State ────────────────────────────────────────────────────────────────────
let _totalPages = 0;

// ── Helper: add page & reset y ───────────────────────────────────────────────
function addPage(doc: jsPDF): number {
  doc.addPage("a4");
  return MT + 5;
}

// ── Helper: check if we need a new page ──────────────────────────────────────
function checkY(doc: jsPDF, y: number, needed: number = 20): number {
  if (y + needed > PAGE_H - MB - 15) {
    return addPage(doc);
  }
  return y;
}

// ── Helper: section title band ───────────────────────────────────────────────
function sectionTitle(doc: jsPDF, title: string, y: number): number {
  y = checkY(doc, y, 14);
  doc.setFillColor(...SECTION_BG);
  doc.rect(ML, y - 4, CONTENT_W, 12, "F");
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(ML, y - 4, ML, y + 8);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text(title, ML + 4, y + 4);
  doc.setFont("helvetica", "normal");
  return y + 16;
}

// ── Helper: sub-section title ────────────────────────────────────────────────
function subSection(doc: jsPDF, title: string, y: number): number {
  y = checkY(doc, y, 10);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(title, ML, y);
  doc.setFont("helvetica", "normal");
  return y + 7;
}

// ── Helper: wrapped body text ────────────────────────────────────────────────
function bodyText(doc: jsPDF, text: string, y: number, indent: number = 0): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  const maxW = CONTENT_W - indent;
  const lines = doc.splitTextToSize(text, maxW) as string[];
  for (const line of lines) {
    y = checkY(doc, y, 6);
    doc.text(line, ML + indent, y);
    y += 5;
  }
  return y + 1;
}

// ── Helper: bullet list ───────────────────────────────────────────────────────
function bulletList(doc: jsPDF, items: string[], y: number, indent: number = 0): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  const bx = ML + indent + 2;
  const tx = ML + indent + 6;
  const maxW = CONTENT_W - indent - 6;
  for (const item of items) {
    y = checkY(doc, y, 6);
    doc.setFillColor(...PRIMARY);
    doc.circle(bx, y - 1.5, 0.8, "F");
    const lines = doc.splitTextToSize(item, maxW) as string[];
    doc.text(lines[0], tx, y);
    y += 5;
    for (let i = 1; i < lines.length; i++) {
      y = checkY(doc, y, 5);
      doc.text(lines[i], tx, y);
      y += 5;
    }
  }
  return y + 1;
}

// ── Helper: ★ Team Admin badge ────────────────────────────────────────────────
function taTag(doc: jsPDF, x: number, y: number): void {
  doc.setFillColor(...SECTION_BG);
  doc.roundedRect(x, y - 4, 24, 6, 1.5, 1.5, "F");
  doc.setDrawColor(...SECONDARY);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y - 4, 24, 6, 1.5, 1.5, "S");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("★ Team Admin", x + 12, y - 0.5, { align: "center" });
}

// ── Helper: ◆ Super Admin badge ───────────────────────────────────────────────
function saTag(doc: jsPDF, x: number, y: number): void {
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(x, y - 4, 26, 6, 1.5, 1.5, "F");
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y - 4, 26, 6, 1.5, 1.5, "S");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 90, 0);
  doc.text("◆ Super Admin", x + 13, y - 0.5, { align: "center" });
}

// ── Helper: page footer ───────────────────────────────────────────────────────
function drawFooter(doc: jsPDF, pageNum: number, total: number): void {
  const fy = PAGE_H - 10;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Glidr Feature Guide — Confidential", ML, fy);
  doc.text(`Page ${pageNum} of ${total}`, PAGE_W - MR, fy, { align: "right" });
}

// ── Main export ───────────────────────────────────────────────────────────────
export function generateFeatureGuidePDF(): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // ── PAGE 1: COVER ──────────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Decorative top stripe
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, PAGE_W, 8, "F");

  // GLIDR heading
  doc.setFontSize(52);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("GLIDR", PAGE_W / 2, 60, { align: "center" });

  // Horizontal rule
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  doc.line(ML + 20, 80, PAGE_W - MR - 20, 80);

  // Subtitle
  doc.setFontSize(22);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.text("Platform Feature Guide", PAGE_W / 2, 92, { align: "center" });

  // Tagline
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(
    "Complete reference for all platform capabilities, roles & permissions",
    PAGE_W / 2, 105, { align: "center" }
  );

  // Confidential box
  const bx = ML + 15, bw = CONTENT_W - 30, bh = 52;
  const by = 130;
  doc.setFillColor(...SECTION_BG);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.roundedRect(bx, by, bw, bh, 3, 3, "FD");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("CONFIDENTIAL DOCUMENT", PAGE_W / 2, by + 9, { align: "center" });

  const confLines = [
    "This document contains proprietary information about Glidr's",
    "features and internal architecture. Unauthorised distribution,",
    "reproduction, or use of this document to develop competing",
    "software is strictly prohibited and may constitute a violation",
    "of trade secret law and intellectual property rights.",
  ];
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  confLines.forEach((line, i) => {
    doc.text(line, PAGE_W / 2, by + 17 + i * 6, { align: "center" });
  });

  // Footer lines on cover
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("© 2025 Glidr. All rights reserved.", PAGE_W / 2, 220, { align: "center" });
  doc.text("Proprietary and confidential. Unauthorised use is prohibited.", PAGE_W / 2, 228, { align: "center" });

  const genDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(`Generated: ${genDate}`, PAGE_W / 2, 255, { align: "center" });

  // Bottom stripe
  doc.setFillColor(...PRIMARY);
  doc.rect(0, PAGE_H - 8, PAGE_W, 8, "F");

  // ── PAGE 2: LEGAL NOTICE ───────────────────────────────────────────────────
  doc.addPage("a4");
  let y = MT;

  y = sectionTitle(doc, "Legal Notice & Intellectual Property", y);
  y += 2;

  y = subSection(doc, "Confidentiality", y);
  y = bodyText(doc, "This document is the exclusive property of Glidr and is provided solely for the internal use of authorised users. It may not be copied, distributed, published, or disclosed to any third party without the prior written consent of Glidr.", y);
  y += 3;

  y = subSection(doc, "Competitive Use Prohibition", y);
  y = bodyText(doc, "This document describes proprietary features, workflows, data models, and user experience patterns developed by Glidr. Any use of this document — in whole or in part — to design, develop, or improve a competing ski testing, wax management, or athlete performance platform is expressly prohibited. Glidr reserves the right to pursue legal remedies against any party found to have misappropriated these proprietary concepts.", y);
  y += 3;

  y = subSection(doc, "Access & Permission", y);
  y = bodyText(doc, "Access to specific features described in this document depends on your account role and the feature permissions granted to your team by a Super Admin. Features marked ★ require Team Admin privileges. Features marked ◆ are exclusive to Super Admins. Features not listed for your account may be disabled for your team or not included in your current plan.", y);
  y += 3;

  y = subSection(doc, "Copyright", y);
  y = bodyText(doc, "© 2025 Glidr. All rights reserved. The Glidr name, logo, and all associated product names, features, and interfaces are proprietary to Glidr. Unauthorised reproduction or use constitutes infringement.", y);

  // ── PAGE 3: TABLE OF CONTENTS ──────────────────────────────────────────────
  doc.addPage("a4");
  y = MT;

  y = sectionTitle(doc, "Contents", y);
  y += 4;

  const tocEntries: [string, string][] = [
    ["1. Introduction", "4"],
    ["2. Tests", "5"],
    ["3. Products", "6"],
    ["4. Weather & Conditions", "7"],
    ["5. Analytics", "8"],
    ["6. Race Preparations", "9"],
    ["7. Athletes & Race Skis", "10"],
    ["8. Grinding", "11"],
    ["9. Garmin Watch Integration", "12"],
    ["10. Offline Mode", "12"],
    ["11. My Account", "13"],
    ["12. Team Admin Features", "14"],
    ["    12.1 User Management", "14"],
    ["    12.2 Group Management", "15"],
    ["    12.3 Team Settings", "15"],
    ["    12.4 Google Sheets Backup", "16"],
    ["    12.5 Weather Station", "17"],
    ["    12.6 Activity & Audit Log", "17"],
    ["    12.7 Data Management", "18"],
    ["13. Permission System", "18"],
    ["14. Competitive Reservation", "19"],
  ];

  for (const [label, page] of tocEntries) {
    y = checkY(doc, y, 7);
    const isIndented = label.startsWith("    ");
    const xL = ML + (isIndented ? 6 : 0);
    const xR = PAGE_W - MR;
    const labelText = label.trimStart();

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(labelText, xL, y);

    // dots
    doc.setTextColor(...MUTED);
    const labelWidth = doc.getTextWidth(labelText);
    const pageWidth = doc.getTextWidth(page);
    const dotsStart = xL + labelWidth + 2;
    const dotsEnd = xR - pageWidth - 2;
    if (dotsEnd > dotsStart) {
      const dotStr = ".".repeat(Math.floor((dotsEnd - dotsStart) / doc.getTextWidth(".")));
      doc.text(dotStr, dotsStart, y);
    }
    doc.setTextColor(...DARK);
    doc.text(page, xR, y, { align: "right" });
    y += 6;
  }

  y += 6;
  y = checkY(doc, y, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...MUTED);
  doc.text(
    "★ = Team Admin feature  ◆ = Super Admin only  All other features are available to standard members (subject to team permissions).",
    ML, y
  );

  // ─────────────────────────────────────────────────────────────────────────
  // CONTENT PAGES
  // ─────────────────────────────────────────────────────────────────────────

  // ── SECTION 1: Introduction ───────────────────────────────────────────────
  doc.addPage("a4");
  y = MT;

  y = sectionTitle(doc, "1. Introduction", y);
  y = bodyText(doc, "Glidr is a professional ski testing and wax management platform designed for elite and competitive cross-country ski teams. It centralises test data, product management, athlete ski tracking, race preparation, and grinding records into a single integrated system.", y);
  y += 4;

  y = subSection(doc, "Role-Based Access", y);
  y = bodyText(doc, "Access to features in Glidr is governed by your account role and the permissions configured for your team. There are three role levels:", y);
  y = bulletList(doc, [
    "Member — Standard access. Can create and view tests, log weather, browse products and analytics, and manage personal settings.",
    "Team Admin (★) — All member capabilities plus team management: users, groups, backup, settings, and advanced features.",
    "Super Admin (◆) — Full platform access including all teams, system settings, security, and billing.",
  ], y);
  y += 2;
  y = bodyText(doc, "In addition to roles, a Team Admin can restrict or expand access per member using the granular permission system (see Section 13). Some feature areas can be disabled entirely for a team.", y);

  // ── SECTION 2: Tests ──────────────────────────────────────────────────────
  y = checkY(doc, y, 20);
  y = sectionTitle(doc, "2. Tests", y);
  y = bodyText(doc, "The Tests module is the core of Glidr. It allows teams to create, manage, and analyse ski tests across multiple disciplines and test types.", y);
  y += 3;

  y = subSection(doc, "2.1 Test Types", y);
  y = bulletList(doc, [
    "Glide — Standard glide wax comparison on flat or rolling terrain.",
    "Structure — Compares ski base structures; products refer to the structure tool or stone grind used.",
    "Classic — Classic skiing tests including kick wax ranking alongside glide performance.",
    "Skating — Skating technique glide tests.",
    "Double Poling — Specific double poling performance tests.",
    "Grind — Tests specifically evaluating base grind quality, optionally linked to a grind profile.",
  ], y);
  y += 2;

  y = subSection(doc, "2.2 Creating a Test", y);
  y = bulletList(doc, [
    "Set date, location, test name, test type, and ski source (test skis or race skis).",
    "Link a weather/conditions log to the test.",
    "Link a ski series (test ski set) for consistent reference.",
    "Add multiple distance rounds with custom labels (e.g. 0km, 5km, 10km).",
    "Optional test notes.",
  ], y);
  y += 2;

  y = subSection(doc, "2.3 Test Entries", y);
  y = bodyText(doc, "Each test contains one entry per ski tested. Each entry records:", y);
  y = bulletList(doc, [
    "Ski number (from the series).",
    "Product used (from catalogue or free-text entry). Supports combination products (multiple products on one ski).",
    "Application / method description (e.g. '2 layers, corked').",
    "Feeling rank — subjective quality rating.",
    "Kick rank (Classic tests only).",
    "Results and ranks per distance round.",
  ], y);
  y += 2;

  y = subSection(doc, "2.4 AI Photo Entry", y);
  y = bodyText(doc, "Photograph a completed test sheet in the field. Glidr's AI analyses the image and automatically extracts ski numbers, products, results, and rankings — dramatically reducing manual data entry time. Review and confirm the extracted data before saving.", y);
  y += 2;

  y = subSection(doc, "2.5 Blind Testing", y);
  y = bodyText(doc, "Users with Blind Tester mode enabled see ski numbers but not product names during testing, preventing bias. Results are revealed after submission.", y);
  y += 2;

  y = subSection(doc, "2.6 Garmin Watch Live Feed", y);
  y = bodyText(doc, "Test results can be streamed live to compatible Garmin devices during a test session. Testers see incoming rankings in real time on their watch.", y);

  // ── SECTION 3: Products ───────────────────────────────────────────────────
  doc.addPage("a4");
  y = MT;

  y = sectionTitle(doc, "3. Products", y);
  y = bodyText(doc, "The Products module is a centralised catalogue of all wax, structure, and treatment products used by the team.", y);
  y += 3;

  y = subSection(doc, "3.1 Product Catalogue", y);
  y = bulletList(doc, [
    "Each product has a category (Glide Wax, Kick Wax, Structure, Fluoro Overlay, etc.), brand, and name.",
    "Products can be archived when no longer in use, while retaining full historical data.",
    "Stock quantity tracking: record how many units remain.",
    "Stock change log: every stock adjustment is timestamped and attributed to a user.",
  ], y);
  y += 2;

  y = subSection(doc, "3.2 Search & Filter", y);
  y = bulletList(doc, [
    "Full-text search across brand and name.",
    "Filter by category, group scope, or archived status.",
    "View products used in specific tests via the Analytics module.",
  ], y);
  y += 2;

  y = subSection(doc, "3.3 Compare Products", y);
  y = bodyText(doc, "The Compare tab provides a side-by-side performance comparison of multiple products across all shared tests. Select products to compare and review their relative rankings and results in context.", y);
  y += 2;

  y = subSection(doc, "3.4 Combination Search", y);
  y = bodyText(doc, "Find all tests where a specific combination of N products were used together on the same test. Add products one by one with the + button. Results link directly to the relevant test detail page.", y);

  // ── SECTION 4: Weather & Conditions ───────────────────────────────────────
  y = checkY(doc, y, 20);
  y = sectionTitle(doc, "4. Weather & Conditions", y);
  y = bodyText(doc, "Accurate snow and air conditions are critical for interpreting test results. The Weather module provides a full conditions log for every testing session.", y);
  y += 3;

  y = subSection(doc, "4.1 Conditions Fields", y);
  y = bulletList(doc, [
    "Snow Temperature (°C) — measured at track level.",
    "Air Temperature (°C) — ambient air temperature.",
    "Snow Humidity (%) — percentage moisture in snow.",
    "Air Humidity (%) — relative air humidity.",
    "Snow Type — Falling new / New / Irreg. dir. new / Irreg. dir. transf. / Transformed.",
    "Snow Humidity Type — Dry / Moist / Wet / Very wet / Slush.",
    "Track Hardness — Very soft / Soft / Medium hard / Hard / Very hard / Ice.",
    "Grain Size — Extra fine / Very fine / Fine / Average / Coarse / Very coarse.",
    "Cloud Cover — 0–8 oktas.",
    "Wind — description or speed.",
    "Precipitation — type and intensity.",
    "Visibility — clear/reduced/poor.",
    "Artificial Snow — proportion of artificial snow on track.",
    "Natural Snow — proportion of natural snow.",
    "Test Quality — subjective rating 1–10.",
  ], y);
  y += 2;

  y = subSection(doc, "4.2 Linking to Tests & Race Preps", y);
  y = bodyText(doc, "Any weather log can be linked to one or more tests or race preparations. This allows analytics to filter by conditions and makes it easy to find what worked in specific snow types.", y);
  y += 2;

  y = subSection(doc, "4.3 Weather Station Integration  ★", y);
  y = bodyText(doc, "Team Admins can connect a physical weather station to Glidr. When creating a weather entry, a 'Fetch from station' button automatically retrieves and fills in the conditions data for the selected date and time.", y);
  y = bulletList(doc, [
    "Netatmo (OAuth2 API)",
    "Davis WeatherLink v2 (HMAC-signed REST API)",
    "Ambient Weather (REST API)",
    "Ecowitt (REST API)",
    "Weather Underground Personal Weather Station (PWS API)",
    "Open-Meteo — free, location-based historical weather (no API key required)",
    "Generic HTTP — any REST endpoint with custom URL template and field mapping",
  ], y);

  // ── SECTION 5: Analytics ──────────────────────────────────────────────────
  doc.addPage("a4");
  y = MT;

  y = sectionTitle(doc, "5. Analytics", y);
  y = bodyText(doc, "The Analytics module provides tools for making sense of accumulated test data across products, conditions, and time.", y);
  y += 3;

  y = subSection(doc, "5.1 Performance Overview", y);
  y = bodyText(doc, "View aggregated test results per product. Filter by group, date range, test type, snow conditions, and temperature interval to identify patterns.", y);
  y += 2;

  y = subSection(doc, "5.2 Combination Search", y);
  y = bodyText(doc, "Identify all tests where a specific combination of products was tested together. Supports N products (add more with the + button). Results show test date, location, conditions summary, and a link to the full test.", y);
  y += 2;

  y = subSection(doc, "5.3 Compare Products", y);
  y = bodyText(doc, "Side-by-side comparison of selected products. View how each product has performed across all tests they share, with ranking distribution and result trends.", y);
  y += 2;

  y = subSection(doc, "5.4 Raced Products", y);
  y = bodyText(doc, "View the products selected for each race preparation, alongside the conditions recorded for that event. Tracks what was used in competition vs. what was tested.", y);

  // ── SECTION 6: Race Preparations ─────────────────────────────────────────
  y = checkY(doc, y, 20);
  y = sectionTitle(doc, "6. Race Preparations", y);
  y = bodyText(doc, "The Race Preps module is used to record the final wax and equipment decisions made before a race.", y);
  y += 3;

  y = subSection(doc, "6.1 Race Prep Contents", y);
  y = bulletList(doc, [
    "Race date, start time, location.",
    "Race type (Sprint / Distance / Skiathlon / etc.) and discipline (Classic / Skating / Free).",
    "Glide products, structure, and kick products — resolved to product names from the catalogue.",
    "Application method and notes.",
    "Tette (boot tightness / kick zone notes).",
    "Linked weather/conditions log with full conditions display.",
  ], y);
  y += 2;

  y = subSection(doc, "6.2 Per-Athlete Entries", y);
  y = bodyText(doc, "Each race prep can include individual entries for each athlete, specifying:", y);
  y = bulletList(doc, [
    "Assigned ski ID (glide, classic, and/or skating skis).",
    "Assigned waxer.",
    "Individual notes per athlete.",
  ], y);

  // ── SECTION 7: Athletes & Race Skis ───────────────────────────────────────
  doc.addPage("a4");
  y = MT;

  y = sectionTitle(doc, "7. Athletes & Race Skis", y);
  y += 2;

  y = subSection(doc, "7.1 Athlete Profiles", y);
  y = bodyText(doc, "Manage the roster of athletes. Each athlete has a name, team affiliation, and a personal race ski inventory.", y);
  y += 2;

  y = subSection(doc, "7.2 Race Ski Inventory", y);
  y = bodyText(doc, "For each athlete, maintain a detailed ski inventory:", y);
  y = bulletList(doc, [
    "Ski ID (custom label), serial number, brand, discipline.",
    "Construction, mold, base material, grind.",
    "Height measurements.",
    "Year of purchase.",
    "Archive skis that are retired, preserving historical data.",
  ], y);
  y += 2;

  y = subSection(doc, "7.3 Regrind History", y);
  y = bodyText(doc, "Log every base grind for each ski: date, grind type, stone, pattern, and notes. Full history is preserved.", y);
  y += 2;

  y = subSection(doc, "7.4 Race Ski Tests", y);
  y = bodyText(doc, "Tests run with race skis (as opposed to test skis) are tracked separately per athlete, providing a complete testing history for each individual ski.", y);

  // ── SECTION 8: Grinding ───────────────────────────────────────────────────
  y = checkY(doc, y, 20);
  y = sectionTitle(doc, "8. Grinding", y);
  y += 2;

  y = subSection(doc, "8.1 Grind Profiles", y);
  y = bodyText(doc, "Define and manage base grind profiles:", y);
  y = bulletList(doc, [
    "Profile name, grind type, stone specification.",
    "Pattern description and extra parameters.",
    "Used as reference when logging regrind history.",
  ], y);
  y += 2;

  y = subSection(doc, "8.2 Grinding Records", y);
  y = bodyText(doc, "Log grinding sessions: date, group scope, grind type, stone used, and notes. Provides a team-wide grind history.", y);
  y += 2;

  y = subSection(doc, "8.3 Linked Grinding Sheets", y);
  y = bodyText(doc, "Link external Google Sheets containing detailed grinding records. These are referenced within Glidr and included in the backup.", y);
  y += 2;

  y = subSection(doc, "8.4 Grind Tests", y);
  y = bodyText(doc, "Tests of type 'Grind' evaluate base grind quality under specific conditions. They appear separately in Analytics and backup, linked to the relevant grind profiles.", y);

  // ── SECTION 9: Garmin Watch Integration ──────────────────────────────────
  doc.addPage("a4");
  y = MT;

  y = sectionTitle(doc, "9. Garmin Watch Integration", y);
  y = bodyText(doc, "Glidr includes a native Garmin application that streams live test data to compatible Garmin devices.", y);
  y = bulletList(doc, [
    "Testers wearing Garmin watches see incoming ski results in real time during a test session.",
    "The ski queue is managed from the test interface.",
    "A Watch PIN authenticates the device to the correct team session.",
    "Watch operator name is recorded for each session.",
    "Compatible with Garmin devices supporting Connect IQ.",
  ], y);

  // ── SECTION 10: Offline Mode ──────────────────────────────────────────────
  y = checkY(doc, y, 20);
  y = sectionTitle(doc, "10. Offline Mode", y);
  y = bodyText(doc, "Glidr is designed for use in the field, where internet connectivity is not always guaranteed.", y);
  y = bulletList(doc, [
    "Core data entry (tests, weather, products) works fully offline.",
    "Queued actions are automatically synced when the device reconnects.",
    "Offline status is clearly indicated in the interface.",
  ], y);

  // ── SECTION 11: My Account ────────────────────────────────────────────────
  y = checkY(doc, y, 20);
  y = sectionTitle(doc, "11. My Account", y);
  y = bulletList(doc, [
    "Update name and email address.",
    "Change account password.",
    "Select interface language (English / Norwegian).",
    "Choose a personal accent colour for the interface.",
    "View Team Watch — access the team's Garmin watch feed.",
    "View Team ID for reference.",
    "Download my data — GDPR-compliant personal data export.",
  ], y);

  // ── SECTION 12: Team Admin Features ──────────────────────────────────────
  doc.addPage("a4");
  y = MT;

  y = sectionTitle(doc, "12. Team Admin Features  ★", y);
  y = bodyText(doc, "The following features are available exclusively to users with Team Admin (or Super Admin) privileges. They are presented here as additional capabilities beyond the standard member feature set.", y);
  y += 4;

  y = subSection(doc, "12.1 User Management  ★", y);
  y = bulletList(doc, [
    "View all team members, roles, status, and activity.",
    "Add and remove team members.",
    "Assign roles: Member or Team Admin.",
    "Enable/disable Blind Tester mode per user.",
    "Enable/disable Garmin watch access per user.",
    "Lock or unlock accounts.",
    "Reset passwords.",
    "Assign group scope (which group(s) a user belongs to).",
    "Configure granular permissions per user (see Section 13).",
  ], y);
  y += 2;

  y = subSection(doc, "12.2 Group Management  ★", y);
  y = bulletList(doc, [
    "Create and name groups (subteams within the organisation).",
    "Groups scope all data (tests, products, weather, series) so different groups see their own data.",
    "Assign users to one or more groups.",
    "Multiple groups each get their own dedicated sheet in the Google Sheets backup.",
  ], y);
  y += 2;

  y = subSection(doc, "12.3 Team Settings  ★", y);
  y = bulletList(doc, [
    "Team name.",
    "Enable or disable feature areas (Tests, Products, Weather, Analytics, Race Preps, Athletes, Grinds, Watch).",
    "Watch PIN management.",
  ], y);
  y += 2;

  y = subSection(doc, "12.4 Google Sheets Backup  ★", y);
  y = bodyText(doc, "Glidr automatically backs up all team data to a linked Google Sheet every 30 minutes. The backup covers the complete dataset:", y);
  y = bulletList(doc, [
    "Overview — summary counts and sheet index.",
    "Team Members — all users, roles, and settings.",
    "[Group] — one sheet per group: products, test ski series, weather logs.",
    "Product Tests — all Glide/Classic/Skating/Double Poling tests as a flat table with all conditions fields. Each test is marked with a bold header row for easy navigation.",
    "Structure Tests — all Structure tests in the same flat format.",
    "Grind Tests — all Grind tests in the same flat format.",
    "Race Preps — all race preparations with product names (resolved from IDs), application method, conditions, and per-athlete entries.",
    "[Athlete] — one sheet per athlete: race skis, regrind history, race ski tests.",
    "Grinds — grind profiles, grinding records, linked external sheets.",
    "Stock Changes — full product stock change history.",
  ], y);
  y += 2;
  y = bodyText(doc, "The backup is designed to function as a standalone database: if Glidr were unavailable, all historical data would remain accessible in the Google Sheet.", y);

  y = checkY(doc, y, 20);
  y = subSection(doc, "12.5 Weather Station Connection  ★", y);
  y = bodyText(doc, "Connect a physical weather station (see Section 4.3). Configuration is stored per team and secured server-side — API credentials are never exposed to the client.", y);
  y += 2;

  y = subSection(doc, "12.6 Activity & Audit Log  ★", y);
  y = bulletList(doc, [
    "Full log of team activity: who did what and when.",
    "Login history with timestamps and IP information.",
    "Stock change audit trail (also visible to members).",
  ], y);
  y += 2;

  y = subSection(doc, "12.7 Data Management  ★", y);
  y = bulletList(doc, [
    "Export complete team dataset as PDF or spreadsheet.",
    "Selective data deletion (with confirmation).",
    "Archive management.",
  ], y);

  // ── SECTION 13: Permission System ─────────────────────────────────────────
  doc.addPage("a4");
  y = MT;

  y = sectionTitle(doc, "13. Permission System", y);
  y = bodyText(doc, "Glidr uses a granular permission system that allows Team Admins to customise what each member can see and do.", y);
  y += 4;

  y = subSection(doc, "13.1 Permission Levels per Area", y);
  y = bodyText(doc, "Each feature area can be set to one of:", y);
  y = bulletList(doc, [
    "None — User cannot see this area.",
    "View — User can see data but cannot create, edit, or delete.",
    "Edit — User can create and edit but not delete.",
    "Full — Complete access including deletion.",
  ], y);
  y += 2;

  y = subSection(doc, "13.2 Feature Areas", y);
  y = bodyText(doc, "Permissions can be configured individually for: Tests, Products, Weather, Analytics, Race Preparations, Athletes, Grinding, Watch. In addition, Team Admins can restrict the entire area from being visible to specific users.", y);
  y += 2;

  y = subSection(doc, "13.3 Role Presets", y);
  y = bodyText(doc, "For convenience, Team Admins can apply preset permission profiles: Member (standard), View-Only, Tester (test entry only), and Full Access. These can be further customised per user after applying.", y);

  // ── SECTION 14: Competitive Reservation ───────────────────────────────────
  y = checkY(doc, y, 20);
  y = sectionTitle(doc, "14. Competitive Reservation & Legal", y);
  y = bodyText(doc, "This section explicitly reserves Glidr's intellectual property rights with respect to the features and workflows described in this document.", y);
  y += 4;

  y = subSection(doc, "14.1 Trade Secrets", y);
  y = bodyText(doc, "The specific combination of features, data models, user workflows, and integration patterns described in this document constitutes a trade secret of Glidr. This includes, but is not limited to: the test entry model with multi-product combination tracking, the AI photo entry workflow, the integrated Garmin live-feed architecture, the per-athlete race ski assignment model, the Google Sheets backup schema, and the weather station auto-fill integration.", y);
  y += 2;

  y = subSection(doc, "14.2 Prohibited Uses", y);
  y = bodyText(doc, "Without the express written consent of Glidr, the following uses of this document are strictly prohibited:", y);
  y = bulletList(doc, [
    "Using this document as a reference or specification for designing a competing ski testing, wax management, or performance tracking platform.",
    "Sharing this document with any person or organisation developing competitive software.",
    "Reproducing feature descriptions, workflows, or data models in any public or private technical specification.",
    "Training any artificial intelligence or machine learning model using this document's content.",
  ], y);
  y += 2;

  y = subSection(doc, "14.3 Enforcement", y);
  y = bodyText(doc, "Glidr reserves all rights to seek injunctive relief, damages, and any other available legal remedies against any party found to have violated these terms. If you have received this document without authorisation, please contact Glidr immediately and destroy all copies.", y);
  y += 3;
  y = bodyText(doc, "© 2025 Glidr. All rights reserved.", y);

  // ── FOOTERS on all pages except cover ────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i - 1, total - 1);
  }

  doc.save("Glidr-Feature-Guide.pdf");
}
