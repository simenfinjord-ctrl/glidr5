import jsPDF from "jspdf";

// ─── Color palette ────────────────────────────────────────────────────────────
const ZINC_900: [number, number, number] = [24, 24, 27];
const ZINC_800: [number, number, number] = [39, 39, 42];
const EMERALD: [number, number, number] = [16, 185, 129];
const EMERALD_DARK: [number, number, number] = [5, 150, 105];
const EMERALD_DEEP: [number, number, number] = [6, 78, 59];
const SLATE_50: [number, number, number] = [248, 250, 252];
const SLATE_100: [number, number, number] = [241, 245, 249];
const SLATE_200: [number, number, number] = [226, 232, 240];
const TEXT_DARK: [number, number, number] = [15, 23, 42];
const TEXT_MID: [number, number, number] = [71, 85, 105];
const TEXT_LIGHT: [number, number, number] = [148, 163, 184];
const BLUE_400: [number, number, number] = [96, 165, 250];
const ORANGE_400: [number, number, number] = [251, 146, 60];
const RED_500: [number, number, number] = [239, 68, 68];
const AMBER_500: [number, number, number] = [245, 158, 11];

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const UW = PAGE_W - MARGIN * 2; // usable width = 178

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setFill(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setTextColor(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setDrawColor(doc: jsPDF, color: [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function rRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: [number, number, number]
) {
  setFill(doc, fill);
  doc.roundedRect(x, y, w, h, r, r, "F");
}

function filledRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: [number, number, number]
) {
  setFill(doc, fill);
  doc.rect(x, y, w, h, "F");
}

function circle(doc: jsPDF, x: number, y: number, r: number, fill: [number, number, number]) {
  setFill(doc, fill);
  doc.circle(x, y, r, "F");
}

function text(
  doc: jsPDF,
  content: string,
  x: number,
  y: number,
  color: [number, number, number],
  size: number,
  bold: boolean,
  align: "left" | "center" | "right" = "left"
) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  setTextColor(doc, color);
  doc.text(content, x, y, { align });
}

function multilineText(
  doc: jsPDF,
  content: string,
  x: number,
  y: number,
  color: [number, number, number],
  size: number,
  bold: boolean,
  maxWidth: number,
  lineHeight = 4.5
): number {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  setTextColor(doc, color);
  const lines = doc.splitTextToSize(content, maxWidth) as string[];
  lines.forEach((line: string, i: number) => {
    doc.text(line, x, y + i * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function addPageFooter(doc: jsPDF, lang: "no" | "en", pageNum: number) {
  const footerY = PAGE_H - 10;
  setDrawColor(doc, SLATE_200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footerY - 2, PAGE_W - MARGIN, footerY - 2);
  text(doc, "Glidr · glidr.no · simen@glidr.no", MARGIN, footerY, TEXT_LIGHT, 7, false);
  text(doc, String(pageNum), PAGE_W - MARGIN, footerY, TEXT_LIGHT, 7, false, "right");
}

// ─── Page 1 — Cover ───────────────────────────────────────────────────────────
function drawCover(doc: jsPDF, lang: "no" | "en") {
  // Dark background
  filledRect(doc, 0, 0, PAGE_W, PAGE_H, ZINC_900);
  // Top-right subtle tint
  filledRect(doc, 130, 0, 80, 110, [20, 50, 40]);

  // "Glidr"
  text(doc, "Glidr", MARGIN, 58, [255, 255, 255], 48, true);
  // Emerald dot after name
  circle(doc, MARGIN + 58, 52, 3, EMERALD);

  // Tagline
  const [line1, line2] =
    lang === "no"
      ? ["Det vi gjorde i går,", "er ikke godt nok i dag."]
      : ["What we did yesterday", "is not good enough today."];
  text(doc, line1, MARGIN, 96, [255, 255, 255], 26, true);
  text(doc, line2, MARGIN, 109, [255, 255, 255], 26, true);

  // Subtitle
  const subtitle =
    lang === "no"
      ? "En utviklingsplattform for slipeteam og skismøringsteam."
      : "A development platform for wax and grinding teams.";
  multilineText(doc, subtitle, MARGIN, 126, TEXT_LIGHT, 12, false, UW);

  // Emerald line
  setDrawColor(doc, EMERALD);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, 136, 76, 136);

  // Bullet points
  const bullets =
    lang === "no"
      ? [
          "Strukturert testregistrering",
          "Slipe- og produktanalyse",
          "Betingelsesbasert beslutningsstøtte",
          "Institusjonell hukommelse på tvers av sesonger",
          "Sikker dataisolasjon per team",
        ]
      : [
          "Structured test logging",
          "Grinding & product analytics",
          "Condition-based decision support",
          "Institutional memory across seasons",
          "Secure per-team data isolation",
        ];

  bullets.forEach((bullet, i) => {
    const bY = 146 + i * 9;
    circle(doc, 19, bY - 1.5, 1.2, EMERALD);
    text(doc, bullet, 24, bY, TEXT_LIGHT, 9, false);
  });

  // Footer
  const dateStr = "2026";
  text(
    doc,
    "© 2026 Glidr · simen@glidr.no · glidr.no",
    MARGIN,
    PAGE_H - 8,
    TEXT_LIGHT,
    8,
    false
  );
  text(doc, dateStr, PAGE_W - MARGIN, PAGE_H - 8, TEXT_LIGHT, 8, false, "right");
}

// ─── Page 2 — The challenge ───────────────────────────────────────────────────
function drawChallenge(doc: jsPDF, lang: "no" | "en") {
  filledRect(doc, 0, 0, PAGE_W, PAGE_H, SLATE_50);

  // Label
  const label = lang === "no" ? "Situasjonsanalyse" : "The challenge";
  text(doc, label.toUpperCase(), MARGIN, 22, EMERALD_DARK, 8, true);

  // Title
  const title = lang === "no" ? "Kjenner du deg igjen?" : "Does this sound familiar?";
  text(doc, title, MARGIN, 34, TEXT_DARK, 24, true);

  // Subtitle
  const subtitle =
    lang === "no"
      ? "Mange team sliter med de samme utfordringene — manuell dataregistrering, kunnskap som forsvinner og beslutninger basert på magefølelse."
      : "Many teams struggle with the same challenges — manual data entry, knowledge that disappears and decisions based on gut feeling.";
  multilineText(doc, subtitle, MARGIN, 44, TEXT_MID, 10, false, UW, 5);

  // Pain point cards
  const cardW = (UW - 6) / 2; // ~86mm
  const cardH = 50;
  const painPoints =
    lang === "no"
      ? [
          {
            title: "📋 Notater på papir og Excel",
            desc: "Testresultater spres over regneark, notisblokker og minnepinner. Ingenting er søkbart. Neste sesong er det borte.",
          },
          {
            title: "🧠 Kunnskap forsvinner",
            desc: "Når en slipertekniker slutter, forsvinner alt vedkommende har lært. Det nye laget starter fra null.",
          },
          {
            title: "🎲 Magefølelse styrer beslutningene",
            desc: "Uten data er det umulig å si med sikkerhet hva som fungerte sist gang — og hva som vil fungere i morgen.",
          },
          {
            title: "🔁 Ingen systematisk forbedring",
            desc: "Teamet gjentar de samme feilene sesong etter sesong, fordi det ikke finnes noe system for å lære av dem.",
          },
        ]
      : [
          {
            title: "📋 Paper notes and Excel",
            desc: "Test results spread across spreadsheets, notepads and USB drives. Nothing is searchable. Next season it's gone.",
          },
          {
            title: "🧠 Knowledge disappears",
            desc: "When a grinding technician leaves, everything they learned goes with them. The new team starts from zero.",
          },
          {
            title: "🎲 Gut feeling drives decisions",
            desc: "Without data it's impossible to say with certainty what worked last time — and what will work tomorrow.",
          },
          {
            title: "🔁 No systematic improvement",
            desc: "The team repeats the same mistakes season after season, because there's no system for learning from them.",
          },
        ];

  painPoints.forEach((pp, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = MARGIN + col * (cardW + 6);
    const cy = 64 + row * (cardH + 5);

    // Card white bg
    rRect(doc, cx, cy, cardW, cardH, 3, [255, 255, 255]);
    // Red left accent
    filledRect(doc, cx, cy + 3, 3, cardH - 6, RED_500);

    // Title
    text(doc, pp.title, cx + 7, cy + 10, TEXT_DARK, 10, true);
    // Description
    multilineText(doc, pp.desc, cx + 7, cy + 18, TEXT_MID, 8.5, false, cardW - 12, 4.5);
  });

  // Bottom banner
  const bannerY = 64 + 2 * (cardH + 5) + 5;
  rRect(doc, MARGIN, bannerY, UW, 18, 3, EMERALD_DARK);
  const bannerText =
    lang === "no"
      ? "Glidr er svaret. En plattform bygget for å gjøre teamet ditt bedre — test for test."
      : "Glidr is the answer. A platform built to make your team better — test by test.";
  text(doc, bannerText, PAGE_W / 2, bannerY + 11, [255, 255, 255], 9.5, true, "center");

  addPageFooter(doc, lang, 2);
}

// ─── Page 3 — How it works ────────────────────────────────────────────────────
function drawHowItWorks(doc: jsPDF, lang: "no" | "en") {
  filledRect(doc, 0, 0, PAGE_W, PAGE_H, [255, 255, 255]);

  // Label
  const label = lang === "no" ? "Slik fungerer det" : "How it works";
  text(doc, label.toUpperCase(), MARGIN, 22, EMERALD_DARK, 8, true);

  // Title — two lines
  const [titleLine1, titleLine2] =
    lang === "no"
      ? ["Fra test til forbedring —", "hvert steg er registrert."]
      : ["From test to improvement —", "every step is documented."];
  text(doc, titleLine1, MARGIN, 34, TEXT_DARK, 24, true);
  text(doc, titleLine2, MARGIN, 46, EMERALD_DARK, 24, true);

  // Workflow steps
  const steps =
    lang === "no"
      ? [
          {
            num: "1",
            title: "Forbered",
            sublabel: "OPPRETT TEST",
            desc: "Sett dato, lokasjon, testtype og serie. Koble til vær- og føreregistrering. Definer antall runder og distanser.",
            color: [30, 41, 59] as [number, number, number],
          },
          {
            num: "2",
            title: "Gjennomfør",
            sublabel: "REGISTRER RESULTATER",
            desc: "Tabelldrevet grensesnitt optimalisert for fart på snø. Automatisk rangering med konkurranseregler. Støtte for Garmin-klokke.",
            color: EMERALD,
          },
          {
            num: "3",
            title: "Analyser",
            sublabel: "FINN MØNSTRE",
            desc: "Betingelsesanalyse, slipesammenligning, head-to-head. Se hvem som presterer best i hvilke forhold — og hvorfor.",
            color: [59, 130, 246] as [number, number, number],
          },
          {
            num: "4",
            title: "Forbedre",
            sublabel: "BYGG VIDERE",
            desc: "Beslutninger basert på data, ikke magefølelse. Institusjonell hukommelse på tvers av sesonger og personellskifter.",
            color: AMBER_500,
          },
        ]
      : [
          {
            num: "1",
            title: "Prepare",
            sublabel: "CREATE TEST",
            desc: "Set date, location, test type and series. Connect to weather and condition logging. Define number of rounds and distances.",
            color: [30, 41, 59] as [number, number, number],
          },
          {
            num: "2",
            title: "Execute",
            sublabel: "LOG RESULTS",
            desc: "Table-driven interface optimised for speed on snow. Automatic ranking with competition rules. Garmin watch support.",
            color: EMERALD,
          },
          {
            num: "3",
            title: "Analyse",
            sublabel: "FIND PATTERNS",
            desc: "Condition analysis, grinding comparison, head-to-head. See who performs best in which conditions — and why.",
            color: [59, 130, 246] as [number, number, number],
          },
          {
            num: "4",
            title: "Improve",
            sublabel: "BUILD ON IT",
            desc: "Decisions based on data, not gut feeling. Institutional memory across seasons and personnel changes.",
            color: AMBER_500,
          },
        ];

  steps.forEach((step, i) => {
    const stepH = 42;
    const sy = 58 + i * stepH;
    const circleX = MARGIN + 8;
    const circleY = sy + 10;

    // Colored circle
    circle(doc, circleX, circleY, 6, step.color);
    // Step number
    text(doc, step.num, circleX, circleY + 3.5, [255, 255, 255], 10, true, "center");

    // Title
    text(doc, step.title, MARGIN + 20, sy + 8, TEXT_DARK, 13, true);
    // Sub-label
    text(doc, step.sublabel, MARGIN + 20, sy + 15, step.color, 8, true);
    // Description
    multilineText(doc, step.desc, MARGIN + 20, sy + 22, TEXT_MID, 8.5, false, UW - 24, 4.5);
  });

  addPageFooter(doc, lang, 3);
}

// ─── Page 4 — Key features ────────────────────────────────────────────────────
function drawFeatures(doc: jsPDF, lang: "no" | "en") {
  filledRect(doc, 0, 0, PAGE_W, PAGE_H, SLATE_50);

  // Label
  const label = lang === "no" ? "Funksjoner" : "Features";
  text(doc, label.toUpperCase(), MARGIN, 22, EMERALD_DARK, 8, true);

  // Title
  const title = lang === "no" ? "Alt teamet ditt trenger." : "Everything your team needs.";
  text(doc, title, MARGIN, 34, TEXT_DARK, 24, true);

  const cardW = (UW - 6) / 2; // ~86mm
  const cardH = 42;

  const features =
    lang === "no"
      ? [
          {
            title: "Slipe- og produktanalyse",
            color: EMERALD,
            desc: "Sammenlign slipere og produkter på tvers av tester. Head-to-head, betingelsesanalyse og beste resultater — alt i én oversikt.",
          },
          {
            title: "Garmin-klokke kontroll",
            color: [59, 130, 246] as [number, number, number],
            desc: "Kjør hele runsheet-brackets hands-free med Forerunner eller Fenix. 4-sifret kode, opp/ned for vinner, cm-gap.",
          },
          {
            title: "Komplett runsheet",
            color: [139, 92, 246] as [number, number, number],
            desc: "Single-elimination bracket for head-to-head skipar-testing. Vinnere avanserer automatisk med cascading diff-beregninger.",
          },
          {
            title: "Vær- og føredokumentasjon",
            color: [14, 165, 233] as [number, number, number],
            desc: "Logg snø- og luftforhold automatisk koblet til tester. Suggestion-motoren anbefaler produkter fra historiske data.",
          },
          {
            title: "Sikker dataisolasjon",
            color: RED_500,
            desc: "Hvert team ser kun sine egne data. Granulert tilgangskontroll, blind-tester-modus og GDPR-kompatibel norsk drift.",
          },
          {
            title: "PDF- og Excel-eksport",
            color: AMBER_500,
            desc: "Last ned profesjonelle testrapporter på norsk eller engelsk med ett klikk. Automatisk backup til Google Sheets.",
          },
        ]
      : [
          {
            title: "Grinding & product analytics",
            color: EMERALD,
            desc: "Compare grinders and products across tests. Head-to-head, condition analysis and best results — all in one overview.",
          },
          {
            title: "Garmin watch control",
            color: [59, 130, 246] as [number, number, number],
            desc: "Run complete runsheet brackets hands-free with Forerunner or Fenix. 4-digit code, up/down for winner, cm-gap.",
          },
          {
            title: "Complete runsheet",
            color: [139, 92, 246] as [number, number, number],
            desc: "Single-elimination bracket for head-to-head ski pair testing. Winners advance automatically with cascading diff calculations.",
          },
          {
            title: "Weather & condition logging",
            color: [14, 165, 233] as [number, number, number],
            desc: "Log snow and air conditions automatically linked to tests. The suggestion engine recommends products from historical data.",
          },
          {
            title: "Secure data isolation",
            color: RED_500,
            desc: "Each team sees only their own data. Granular access control, blind-test mode and GDPR-compliant Norwegian operations.",
          },
          {
            title: "PDF & Excel export",
            color: AMBER_500,
            desc: "Download professional test reports in Norwegian or English with one click. Automatic backup to Google Sheets.",
          },
        ];

  features.forEach((feat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = MARGIN + col * (cardW + 6);
    const cy = 44 + row * (cardH + 5);

    rRect(doc, cx, cy, cardW, cardH, 3, [255, 255, 255]);
    filledRect(doc, cx, cy + 3, 3, cardH - 6, feat.color);

    text(doc, feat.title, cx + 7, cy + 11, TEXT_DARK, 10, true);
    multilineText(doc, feat.desc, cx + 7, cy + 18, TEXT_MID, 8, false, cardW - 12, 4.2);
  });

  addPageFooter(doc, lang, 4);
}

// ─── Page 5 — Analytics deep-dive ────────────────────────────────────────────
function drawAnalytics(doc: jsPDF, lang: "no" | "en") {
  filledRect(doc, 0, 0, PAGE_W, PAGE_H, [255, 255, 255]);

  // Label
  const label = lang === "no" ? "Nøkkeldifferensiator" : "Key differentiator";
  text(doc, label.toUpperCase(), MARGIN, 22, EMERALD_DARK, 8, true);

  // Title
  const title =
    lang === "no" ? "Slipe- og produktanalyse" : "Grinding & product analytics";
  text(doc, title, MARGIN, 33, TEXT_DARK, 20, true);

  // Subtitle
  const subtitle =
    lang === "no"
      ? "Se hvem og hva som presterer best — på tvers av tester, sesonger og betingelser."
      : "See who and what performs best — across tests, seasons and conditions.";
  multilineText(doc, subtitle, MARGIN, 42, TEXT_MID, 9.5, false, UW, 4.5);

  // Profile cards
  const profileCardW = (UW - 5) / 2; // ~86.5mm
  const profileCardH = 56;
  const cardY = 54;

  // Card 1 — Fischer Diamond
  rRect(doc, MARGIN, cardY, profileCardW, profileCardH, 3, ZINC_900);
  text(
    doc,
    "Fischer Diamond",
    MARGIN + 6,
    cardY + 11,
    BLUE_400,
    11,
    true
  );
  const tests1 = lang === "no" ? "27 tester · 2022–2025" : "27 tests · 2022–2025";
  text(doc, tests1, MARGIN + 6, cardY + 18, TEXT_LIGHT, 8, false);

  // Stats card 1
  const stats1 = [
    { label: lang === "no" ? "Snitt rang" : "Avg rank", value: "1.8" },
    { label: lang === "no" ? "Seierrate" : "Win rate", value: "41%" },
    { label: lang === "no" ? "Beste rang" : "Best rank", value: "#1" },
    { label: lang === "no" ? "Pallrate" : "Top-3", value: "74%" },
  ];
  stats1.forEach((stat, i) => {
    const sx = MARGIN + 6 + i * (profileCardW / 4);
    text(doc, stat.value, sx, cardY + 30, BLUE_400, 12, true);
    text(doc, stat.label, sx, cardY + 36, TEXT_LIGHT, 7, false);
  });

  // Green pill card 1
  rRect(doc, MARGIN + 4, cardY + 42, profileCardW - 8, 9, 2, EMERALD_DEEP);
  const pill1 =
    lang === "no"
      ? "★ Best i: −10 til −5°C · Nypudersnø"
      : "★ Best in: −10 to −5°C · New powder";
  text(
    doc,
    pill1,
    MARGIN + profileCardW / 2,
    cardY + 48,
    [52, 211, 153],
    7.5,
    true,
    "center"
  );

  // Card 2 — Rossignol Race
  const card2X = MARGIN + profileCardW + 5;
  rRect(doc, card2X, cardY, profileCardW, profileCardH, 3, ZINC_800);
  text(doc, "Rossignol Race", card2X + 6, cardY + 11, ORANGE_400, 11, true);
  text(doc, tests1.replace("27", "24"), card2X + 6, cardY + 18, TEXT_LIGHT, 8, false);

  const stats2 = [
    { label: lang === "no" ? "Snitt rang" : "Avg rank", value: "2.3" },
    { label: lang === "no" ? "Seierrate" : "Win rate", value: "26%" },
    { label: lang === "no" ? "Beste rang" : "Best rank", value: "#1" },
    { label: lang === "no" ? "Pallrate" : "Top-3", value: "61%" },
  ];
  stats2.forEach((stat, i) => {
    const sx = card2X + 6 + i * (profileCardW / 4);
    text(doc, stat.value, sx, cardY + 30, ORANGE_400, 12, true);
    text(doc, stat.label, sx, cardY + 36, TEXT_LIGHT, 7, false);
  });

  rRect(doc, card2X + 4, cardY + 42, profileCardW - 8, 9, 2, [120, 53, 15]);
  const pill2 =
    lang === "no"
      ? "★ Best i: 0 til −3°C · Vått spor"
      : "★ Best in: 0 to −3°C · Wet track";
  text(
    doc,
    pill2,
    card2X + profileCardW / 2,
    cardY + 48,
    ORANGE_400,
    7.5,
    true,
    "center"
  );

  // Head-to-head bar
  const h2hY = cardY + profileCardH + 5;
  rRect(doc, MARGIN, h2hY, UW, 18, 3, ZINC_900);

  const h2hTitle =
    lang === "no" ? "Head-to-head (11 delte tester)" : "Head-to-head (11 shared tests)";
  text(doc, h2hTitle, MARGIN + 6, h2hY + 7, [255, 255, 255], 9, true);

  // Segmented bar
  const barX = MARGIN + 6;
  const barY = h2hY + 10;
  const barW = UW - 12;
  const barH = 4;
  const fischerW = (7 / 11) * barW;
  filledRect(doc, barX, barY, fischerW, barH, BLUE_400);
  filledRect(doc, barX + fischerW, barY, barW - fischerW, barH, ORANGE_400);

  text(doc, "Fischer 7", barX, barY + barH + 4, BLUE_400, 7.5, true);
  text(
    doc,
    "Rossignol 4",
    MARGIN + UW - 6,
    barY + barH + 4,
    ORANGE_400,
    7.5,
    true,
    "right"
  );

  // Three analytics pillars
  const pillarY = h2hY + 22;
  const pillarLabels =
    lang === "no"
      ? ["Oversikt", "Betingelser", "Sammenligning"]
      : ["Overview", "Conditions", "Comparison"];
  const pillarDescs =
    lang === "no"
      ? [
          "Alle produkter og slipere rangert etter snitt, seierrate og pallrate.",
          "Finn de betingelsene der hvert produkt presterer best.",
          "Sammenlign to profiler direkte — hvem vinner flest delte tester?",
        ]
      : [
          "All products and grinders ranked by average, win rate and podium rate.",
          "Find the conditions where each product performs best.",
          "Compare two profiles directly — who wins the most shared tests?",
        ];

  const pillarW = (UW - 10) / 3;
  pillarLabels.forEach((label, i) => {
    const px = MARGIN + i * (pillarW + 5);
    rRect(doc, px, pillarY, pillarW, 30, 3, SLATE_100);
    filledRect(doc, px, pillarY, pillarW, 3, EMERALD);
    text(doc, label, px + 6, pillarY + 12, TEXT_DARK, 9, true);
    multilineText(
      doc,
      pillarDescs[i],
      px + 6,
      pillarY + 19,
      TEXT_MID,
      7.5,
      false,
      pillarW - 10,
      4
    );
  });

  addPageFooter(doc, lang, 5);
}

// ─── Page 6 — Development platform ───────────────────────────────────────────
function drawPlatform(doc: jsPDF, lang: "no" | "en") {
  filledRect(doc, 0, 0, PAGE_W, PAGE_H, ZINC_900);
  filledRect(doc, 130, 0, 80, 110, [20, 50, 40]);

  // Label
  const label =
    lang === "no" ? "Glidr er en utviklingsplattform" : "Glidr is a development platform";
  text(doc, label.toUpperCase(), MARGIN, 22, EMERALD, 8, true);

  // Big quote
  const [q1, q2] =
    lang === "no"
      ? ["Det vi gjorde i går,", "er ikke godt nok i dag."]
      : ["What we did yesterday", "is not good enough today."];
  text(doc, q1, MARGIN, 36, [255, 255, 255], 26, true);
  text(doc, q2, MARGIN, 49, [255, 255, 255], 26, true);

  // Subtitle
  const subtitle =
    lang === "no"
      ? "Glidr gir teamet ditt en systematisk måte å lære og forbedre seg på — sesong etter sesong."
      : "Glidr gives your team a systematic way to learn and improve — season after season.";
  multilineText(doc, subtitle, MARGIN, 62, TEXT_LIGHT, 10, false, UW, 5);

  // Three dark cards
  const cardH = 62;
  const cards =
    lang === "no"
      ? [
          {
            title: "Institusjonell hukommelse",
            body: "Ingenting glemmes. Alle tester, alle betingelser, alle beslutninger er søkbare og tilgjengelige — selv etter at folk slutter på laget.",
            arrow: "→ Det sliperteamet lærte i 2022, er tilgjengelig i 2026.",
          },
          {
            title: "Slipeanalyse som utvikling",
            body: "Sammenlign slipere på tvers av tester og sesonger. Se hvem som presterer best — og lær av det til neste gang.",
            arrow: "→ Fra magefølelse til systematisk forbedring.",
          },
          {
            title: "Mønstre på tvers av sesonger",
            body: "Hva fungerer i −12°C tørr nysnø? Hvilken struktur vinner alltid i sporet? Svarene finnes i dataene.",
            arrow: "→ Gjentakbar suksess, ikke tilfeldige seire.",
          },
        ]
      : [
          {
            title: "Institutional memory",
            body: "Nothing is forgotten. All tests, all conditions, all decisions are searchable and available — even after people leave the team.",
            arrow: "→ What the grinding team learned in 2022 is available in 2026.",
          },
          {
            title: "Grinding analysis as development",
            body: "Compare grinders across tests and seasons. See who performs best — and learn from it for next time.",
            arrow: "→ From gut feeling to systematic improvement.",
          },
          {
            title: "Patterns across seasons",
            body: "What works in −12°C dry new snow? Which structure always wins in the track? The answers are in the data.",
            arrow: "→ Repeatable success, not random victories.",
          },
        ];

  cards.forEach((card, i) => {
    const cy = 78 + i * (cardH + 5);
    rRect(doc, MARGIN, cy, UW, cardH, 3, ZINC_800);
    filledRect(doc, MARGIN, cy + 3, 3, cardH - 6, EMERALD);

    text(doc, card.title, MARGIN + 7, cy + 13, [255, 255, 255], 11, true);
    multilineText(doc, card.body, MARGIN + 7, cy + 21, TEXT_LIGHT, 8.5, false, UW - 14, 4.5);

    // Arrow pill
    const pillY = cy + cardH - 11;
    rRect(doc, MARGIN + 7, pillY - 5, UW - 14, 8, 2, EMERALD_DEEP);
    text(doc, card.arrow, MARGIN + 12, pillY, EMERALD, 8, true);
  });

  // Bottom emerald banner
  const bannerY = 78 + 3 * (cardH + 5) + 3;
  if (bannerY + 12 < PAGE_H - 14) {
    rRect(doc, MARGIN, bannerY, UW, 14, 3, EMERALD_DARK);
    const bannerText =
      lang === "no"
        ? "Vinnerteam er lærende team. Glidr gjør det mulig å lære systematisk."
        : "Winning teams are learning teams. Glidr makes systematic learning possible.";
    text(doc, bannerText, PAGE_W / 2, bannerY + 9, [255, 255, 255], 9, true, "center");
  }

  addPageFooter(doc, lang, 6);
}

// ─── Page 7 — CTA ─────────────────────────────────────────────────────────────
function drawCTA(doc: jsPDF, lang: "no" | "en") {
  filledRect(doc, 0, 0, PAGE_W, PAGE_H, ZINC_900);

  // Top band
  filledRect(doc, 0, 0, PAGE_W, 85, [20, 50, 40]);

  // Glidr logotype
  text(doc, "Glidr", MARGIN, 42, [255, 255, 255], 34, true);
  circle(doc, MARGIN + 48, 36, 3, EMERALD);

  // Subheading
  const subheading =
    lang === "no"
      ? "Start jobben med å bli bedre i dag. Ikke neste sesong."
      : "Start the work of getting better today. Not next season.";
  multilineText(doc, subheading, MARGIN, 58, TEXT_LIGHT, 13, false, UW, 6);

  // Pricing plans
  const planY = 92;
  const planW = (UW - 15) / 4; // ~40.75mm
  const planH = 40;

  const plans =
    lang === "no"
      ? [
          { name: "Gratis", price: "Kr 0", desc: "Enkeltbruker, begrenset lagring", highlight: false },
          { name: "Starter", price: "Kr 490/mnd", desc: "Opptil 3 brukere, alle funksjoner", highlight: false },
          { name: "Team", price: "Kr 790/mnd", desc: "Ubegrenset brukere, prioritert støtte", highlight: true },
          { name: "Pro", price: "Kr 1490/mnd", desc: "Multi-team, API-tilgang, dedikert støtte", highlight: false },
        ]
      : [
          { name: "Free", price: "Kr 0", desc: "Single user, limited storage", highlight: false },
          { name: "Starter", price: "Kr 490/mo", desc: "Up to 3 users, all features", highlight: false },
          { name: "Team", price: "Kr 790/mo", desc: "Unlimited users, priority support", highlight: true },
          { name: "Pro", price: "Kr 1490/mo", desc: "Multi-team, API access, dedicated support", highlight: false },
        ];

  plans.forEach((plan, i) => {
    const px = MARGIN + i * (planW + 5);
    const bg = plan.highlight ? EMERALD_DARK : ZINC_800;
    rRect(doc, px, planY, planW, planH, 3, bg);

    text(doc, plan.name, px + planW / 2, planY + 10, [255, 255, 255], 9, true, "center");
    const priceColor = plan.highlight ? ([255, 255, 255] as [number, number, number]) : TEXT_LIGHT;
    text(doc, plan.price, px + planW / 2, planY + 20, priceColor, 11, true, "center");
    multilineText(
      doc,
      plan.desc,
      px + 4,
      planY + 28,
      TEXT_LIGHT,
      7.5,
      false,
      planW - 8,
      4
    );
  });

  // 14-day trial banner
  const trialY = planY + planH + 7;
  rRect(doc, MARGIN, trialY, UW, 14, 3, EMERALD_DARK);
  const trialText =
    lang === "no"
      ? "14 dagers gratis prøveperiode på alle planer. Ingen kredittkort påkrevd."
      : "14-day free trial on all plans. No credit card required.";
  text(doc, trialText, PAGE_W / 2, trialY + 9, [255, 255, 255], 10, true, "center");

  // Contact section
  const contactY = trialY + 22;
  const contactLabel = lang === "no" ? "Kontakt" : "Contact";
  text(doc, contactLabel.toUpperCase(), MARGIN, contactY, EMERALD, 8, true);

  const contactRows = [
    { label: "Email", value: "simen@glidr.no" },
    { label: lang === "no" ? "Nettside" : "Website", value: "glidr.no" },
    {
      label: lang === "no" ? "Prøveperiode" : "Trial",
      value: lang === "no" ? "Fullt tilgang · Ingen binding" : "Full access · No lock-in",
    },
  ];

  contactRows.forEach((row, i) => {
    const ry = contactY + 8 + i * 14;
    rRect(doc, MARGIN, ry, UW, 11, 2, ZINC_800);
    text(doc, row.label, MARGIN + 5, ry + 7.5, TEXT_LIGHT, 8, false);
    text(doc, row.value, MARGIN + UW - 5, ry + 7.5, [255, 255, 255], 8, true, "right");
  });

  // Final tagline
  const finalTagline =
    lang === "no" ? "Test bedre. Ski raskere. Vinn mer." : "Test better. Ski faster. Win more.";
  text(doc, finalTagline, PAGE_W / 2, PAGE_H - 18, EMERALD, 12, true, "center");

  // Copyright
  text(
    doc,
    "© 2026 Glidr · simen@glidr.no · glidr.no",
    PAGE_W / 2,
    PAGE_H - 10,
    TEXT_LIGHT,
    8,
    false,
    "center"
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function generateSalesPDF(lang: "no" | "en" = "en") {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Page 1 — Cover
  drawCover(doc, lang);

  // Page 2 — Challenge
  doc.addPage();
  drawChallenge(doc, lang);

  // Page 3 — How it works
  doc.addPage();
  drawHowItWorks(doc, lang);

  // Page 4 — Features
  doc.addPage();
  drawFeatures(doc, lang);

  // Page 5 — Analytics
  doc.addPage();
  drawAnalytics(doc, lang);

  // Page 6 — Platform
  doc.addPage();
  drawPlatform(doc, lang);

  // Page 7 — CTA
  doc.addPage();
  drawCTA(doc, lang);

  const filename = lang === "no" ? "glidr-salgsbrosjyre.pdf" : "glidr-sales-brochure.pdf";
  doc.save(filename);
}
