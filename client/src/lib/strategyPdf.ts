// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Generates the confidential Glidr Strategy Document as a clean, print-ready
// HTML document opened in a new tab. Use browser File → Print → Save as PDF.
// Super-Admin only (owner document): strategy, product/system, development,
// commercialization, pricing, IP/rights, exit and risk. English, like all
// documents in the SA Documents tab.

export function generateStrategyPDF(): void {
  const genDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Glidr — Strategy Document (Confidential)</title>
<style>
  :root {
    --violet: #6d28d9; --dark: #111827; --muted: #6b7280; --line: #e5e7eb;
    --bg-soft: #f9fafb; --green: #059669; --amber: #b45309; --red: #b91c1c; --blue: #1d4ed8;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: var(--dark); font-size: 11pt; line-height: 1.55; background: #fff; }
  .doc { max-width: 820px; margin: 0 auto; padding: 28px 32px 60px; }

  h1 { font-size: 22pt; font-weight: 800; letter-spacing: -.01em; }
  h2 { font-size: 15pt; font-weight: 700; color: var(--violet); margin: 0; }
  h3 { font-size: 11.5pt; font-weight: 700; margin: 14px 0 4px; }
  p { margin: 6px 0; }
  ul { margin: 6px 0 6px 20px; }
  li { margin: 3px 0; }
  strong { font-weight: 700; }

  .section-title { display: flex; align-items: baseline; gap: 10px; border-bottom: 2px solid var(--violet); padding-bottom: 5px; margin: 26px 0 8px; }
  .section-num { font-size: 9pt; font-weight: 700; color: #fff; background: var(--violet); border-radius: 5px; padding: 2px 8px; white-space: nowrap; }

  .box { border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 10.5pt; border: 1px solid var(--line); }
  .box-info { background: #eff6ff; border-color: #bfdbfe; }
  .box-warning { background: #fffbeb; border-color: #fde68a; }
  .box-ok { background: #ecfdf5; border-color: #a7f3d0; }

  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
  th, td { border: 1px solid var(--line); padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: var(--bg-soft); font-weight: 700; }

  .toc-entry { display: flex; justify-content: space-between; border-bottom: 1px dotted var(--line); padding: 3px 0; font-size: 10.5pt; }
  .divider { height: 1px; background: var(--line); margin: 20px 0; }
  .muted { color: var(--muted); }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 9pt; color: var(--muted); }

  .cover { text-align: center; padding: 70px 0 40px; border-bottom: 3px solid var(--violet); margin-bottom: 8px; }
  .cover .logo { font-size: 30pt; font-weight: 900; letter-spacing: .06em; color: var(--violet); }
  .cover .title { font-size: 18pt; font-weight: 700; margin-top: 10px; }
  .cover .sub { color: var(--muted); margin-top: 6px; }
  .cover .meta { margin-top: 18px; font-size: 9.5pt; color: var(--muted); }

  @media print {
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    section, .section-block { page-break-inside: avoid; }
    @page { margin: 16mm; size: A4; }
  }
</style>
</head>
<body>
<div class="doc">

  <div class="cover">
    <div class="logo">GLIDR</div>
    <div class="title">Strategy Document</div>
    <div class="sub">Strategy · System · Development · Commercialization · Pricing · Rights</div>
    <div class="meta">STRICTLY CONFIDENTIAL · Owner / Super Admin only · Generated ${genDate}</div>
  </div>

  <div class="box box-warning"><strong>Confidential owner document.</strong> This document contains Glidr's business strategy, pricing and intellectual property. Do not share it with teams, federations or third parties. Pricing ranges are indicative starting points that must be validated in the market and reviewed by an accountant/lawyer before any agreement is signed — they are not financial advice.</div>

  <div class="section-title"><span class="section-num">TOC</span><h2>Contents</h2></div>
  <div class="toc-entry"><span>1. Summary &amp; vision</span><span></span></div>
  <div class="toc-entry"><span>2. Strategy &amp; positioning</span><span></span></div>
  <div class="toc-entry"><span>3. Market &amp; customers</span><span></span></div>
  <div class="toc-entry"><span>4. The system (product &amp; technology)</span><span></span></div>
  <div class="toc-entry"><span>5. Development &amp; roadmap</span><span></span></div>
  <div class="toc-entry"><span>6. Commercialization</span><span></span></div>
  <div class="toc-entry"><span>7. Pricing</span><span></span></div>
  <div class="toc-entry"><span>8. Rights (IP &amp; legal)</span><span></span></div>
  <div class="toc-entry"><span>9. Exit &amp; sellability</span><span></span></div>
  <div class="toc-entry"><span>10. Risks &amp; mitigations</span><span></span></div>
  <div class="toc-entry"><span>11. Action plan — next 12 months</span><span></span></div>

  <!-- 1 -->
  <div class="page-break"></div>
  <div class="section-title"><span class="section-num">1</span><h2>Summary &amp; vision</h2></div>
  <p>Glidr is a ski-testing and waxing system that turns test data into fast, confident race-day decisions. It is used operationally by elite programs (including the U.S. ski community) and covers glide testing, structure, grinding, kick, per-athlete race skis, weather conditions, analytics and race prep — across multiple teams.</p>
  <h3>Vision</h3>
  <p>To be the industry standard elite wax teams rely on: a safe, efficient and smart system that makes their day easier and helps them make the right calls.</p>
  <h3>Core idea (why Glidr wins)</h3>
  <ul>
    <li><strong>Data + reference is the moat.</strong> The value lies in accumulated test data linked to conditions, and in being embedded with a recognised federation. That is hard to copy.</li>
    <li><strong>Decision, not just a logbook.</strong> The next step is moving from "log" to "decision engine" (recommendation + confidence) — something no competitor has.</li>
    <li><strong>Trust.</strong> Data safety, traceability, backup and export make professional users willing to put everything in.</li>
  </ul>

  <!-- 2 -->
  <div class="section-title"><span class="section-num">2</span><h2>Strategy &amp; positioning</h2></div>
  <p>The strategy is a <strong>sequence</strong>, not an either/or. The order builds the moat before pricing:</p>
  <table>
    <tr><th>Phase</th><th>Goal</th><th>Outcome</th></tr>
    <tr><td>1. Pilot (this winter)</td><td>Give the federation full access free of charge, in exchange for real use</td><td>Hardened product, usage data, testimonial, the "used by a national team" reference</td></tr>
    <tr><td>2. Convert</td><td>Turn the pilot federation into a paying customer (annual licence)</td><td>First recurring revenue (ARR), warm and proven</td></tr>
    <tr><td>3. Expand</td><td>Sell to other federations, national teams, clubs (XC, biathlon, alpine …)</td><td>Growing ARR, more references</td></tr>
    <tr><td>4. Deepen</td><td>Decision engine + integrations increase value and switching cost</td><td>Higher price + lower churn</td></tr>
    <tr><td>5. (Optional) Exit</td><td>Sell the whole business at a multiple of ARR</td><td>A large one-off <em>on top of</em> the revenue you built</td></tr>
  </table>
  <div class="box box-ok"><strong>Positioning:</strong> Not "another app" — a <strong>mission-critical professional tool</strong> for well-funded organisations. Anchor value against race results and the cost of a wax team, not against consumer pricing.</div>

  <!-- 3 -->
  <div class="section-title"><span class="section-num">3</span><h2>Market &amp; customers</h2></div>
  <h3>Who pays (B2B, organisations)</h3>
  <ul>
    <li><strong>National federations / national teams</strong> — primary. Well funded, mission-critical need, annual budgets.</li>
    <li><strong>Elite clubs and teams</strong> — secondary, higher volume, lower price point.</li>
    <li><strong>Adjacent sports</strong> — biathlon, alpine, nordic combined, roller ski; same core need.</li>
  </ul>
  <h3>Value proposition</h3>
  <p>Faster skis more often, fewer wrong calls on race day, and traceability and structure for work that today lives in heads and spreadsheets. One good call can decide a race — that is the value anchor.</p>
  <h3>Competition</h3>
  <p>Spreadsheets and notes (status quo), home-grown internal tools, and generic logging apps. Nobody covers the full chain (test → conditions → analytics → recommendation → race prep) specialised for waxing. Glidr's lead is depth + reference.</p>

  <!-- 4 -->
  <div class="page-break"></div>
  <div class="section-title"><span class="section-num">4</span><h2>The system (product &amp; technology)</h2></div>
  <h3>Technical foundation</h3>
  <ul>
    <li><strong>Frontend:</strong> React + TypeScript (Vite), mobile- and desktop-friendly, bilingual (NO/EN).</li>
    <li><strong>Backend:</strong> Express + PostgreSQL (Drizzle ORM). Role- and team-based access control.</li>
    <li><strong>Hosting:</strong> Render (web + database). Portable setup — can be moved or self-hosted.</li>
    <li><strong>Integrations:</strong> Weather stations, Google Sheets/Drive backup, Garmin watch app, AI recommendations.</li>
  </ul>
  <h3>Feature areas</h3>
  <p>Tests (glide/structure/grind/kick), products &amp; stock, weather &amp; conditions, analytics, race prep, per-athlete race skis (garage, regrind history), race fleets (team skis), kick, live runsheets, watch queue, multi-team support, the "All teams" view, and test comparison.</p>
  <h3>Trust &amp; operations (what makes professional users safe)</h3>
  <ul>
    <li>Role/team isolation (Super Admin, Team Admin, member, athlete access) with per-team permissions.</li>
    <li>Traceability / audit log with snapshots of deleted records (chain of custody).</li>
    <li>Daily backup (JSON + PDF) to Google Drive; per-team usage/quota overview.</li>
    <li>Login with first-party device tracking (not surveillance) and forced logout.</li>
    <li>One-time Terms acceptance recorded server-side with timestamp + version, enforced by the API.</li>
  </ul>
  <div class="box box-info"><strong>Principle:</strong> No vendor lock-in. Full data export and portable code are both a sales advantage <em>and</em> a trust factor for customers.</div>

  <!-- 5 -->
  <div class="section-title"><span class="section-num">5</span><h2>Development &amp; roadmap</h2></div>
  <h3>Priority 1 — Data reliability &amp; proof (in progress)</h3>
  <ul>
    <li>Recycle bin / soft delete with restore (30 days) — builds on the audit trail.</li>
    <li>Visible backup verification ("Last successful backup … ✓") with alerts on failure.</li>
    <li>One-click full data export (JSON/Excel) — kills both data fear and lock-in fear.</li>
    <li>Extend the audit log to changes (before/after), not only deletions.</li>
  </ul>
  <h3>Priority 2 — Offline that actually works</h3>
  <p>See all data and enter tests without coverage, with a sync queue and conflict handling. Built in stages and tested thoroughly — half-working offline is worse than none.</p>
  <h3>Then — the decision engine (the big value)</h3>
  <ul>
    <li>Statistical significance on results ("clear winner" vs "too close to call").</li>
    <li>Forecast-driven recommendation with confidence and supporting tests.</li>
    <li>Alert engine (conditions changed, low stock, ski due for regrind, new login).</li>
  </ul>
  <h3>Development principles</h3>
  <p>Build sellable from day one: clean IP, portability, documentation, verifiable backup. Everything that removes a customer's dealbreaker also increases the sale value.</p>

  <!-- 6 -->
  <div class="section-title"><span class="section-num">6</span><h2>Commercialization</h2></div>
  <h3>Model: subscription — not a one-off sale</h3>
  <p>Recurring annual revenue is what makes the business valuable. Selling the whole product now (before revenue) caps the upside. Sell <strong>subscriptions</strong>, and consider selling the <em>business</em> later at a multiple of ARR.</p>
  <h3>Pilot strategy (critical)</h3>
  <div class="box box-warning"><strong>Frame "free this winter" as a pilot, not a gift.</strong> In writing, with a defined end and a stated intention of payment next season. Otherwise "free" becomes the anchor. In return: use the season to collect a testimonial, usage data and the reference.</div>
  <h3>Go-to-market</h3>
  <ul>
    <li>Use the pilot federation as the reference that opens doors at other federations.</li>
    <li>Annual contracts aligned with the ski season (federations run annual budgets).</li>
    <li>Upsell via tiers and add-ons (analytics, watch app, multi-team, decision engine).</li>
  </ul>

  <!-- 7 -->
  <div class="page-break"></div>
  <div class="section-title"><span class="section-num">7</span><h2>Pricing</h2></div>
  <p class="muted">Value-based, not cost-based. Tiered licence per organisation, billed annually. The ranges below are <strong>indicative starting points to test</strong> — start high and give a "founding customer" discount instead. Validate in the market; not financial advice.</p>
  <table>
    <tr><th>Plan</th><th>Typical customer</th><th>Includes (roughly)</th><th>Indicative per year/org</th></tr>
    <tr><td><strong>Free / Pilot</strong></td><td>Reference/pilot federation, trials</td><td>Full access for an agreed period</td><td>0 (time-limited, with stated intention of payment)</td></tr>
    <tr><td><strong>Starter</strong></td><td>Small club / single team</td><td>Tests, products, weather, PDF export</td><td>~ a few hundred – 1–2 k</td></tr>
    <tr><td><strong>Team</strong></td><td>Active team / smaller program</td><td>+ analytics, grinding, suggestions, backup, blind testing</td><td>~ 2 k – 6 k</td></tr>
    <tr><td><strong>Pro</strong></td><td>Elite program / large team</td><td>+ race skis, kick, race prep, watch, live runsheets</td><td>~ 6 k – 15 k</td></tr>
    <tr><td><strong>Enterprise</strong></td><td>National federation (multiple teams)</td><td>Everything + multi-team, bulk export, custom groups, priority support</td><td>~ 15 k – 25 k+</td></tr>
  </table>
  <p class="muted">Currency and tiers adapted per market (NOK/USD/EUR). Price drivers: number of technicians/athletes, number of teams, feature tier, support level.</p>
  <div class="box box-ok"><strong>Principle:</strong> The right price is discovered, not calculated. Most mission-critical B2B tools are <strong>under</strong>priced. Anchor against the value of one race result.</div>

  <!-- 8 -->
  <div class="section-title"><span class="section-num">8</span><h2>Rights (IP &amp; legal)</h2></div>
  <h3>Ownership</h3>
  <p>Glidr (code, design, data model, brand, the glidr.no domain) is wholly owned by the founder. Keep ownership <strong>clean and undivided</strong>: no code under licences that block a sale, no co-authors with claims. Document third-party dependencies and licences.</p>
  <h3>Confidentiality &amp; non-compete reservation</h3>
  <p>Features, workflows and the data model are proprietary. Internal documents (feature guide, this document) are confidential and must not be used to build a competing product.</p>
  <h3>Customer data &amp; privacy</h3>
  <ul>
    <li>Data belongs to the customer; Glidr is the processor. Keep a simple data-processing agreement ready.</li>
    <li>Functional cookies only; no tracking or marketing cookies.</li>
    <li>Transferring customer data (e.g. in a sale) requires notice/consent — simple when the buyer is the customer.</li>
  </ul>
  <h3>Terms</h3>
  <p>The Terms reserve the right to charge / adjust pricing (continued use = acceptance) and to change or limit the service. Every user actively accepts the Terms once in-app; acceptance is recorded server-side with timestamp and version, and mutating API calls are blocked until the current version is accepted. Free now does not mean free forever.</p>

  <!-- 9 -->
  <div class="section-title"><span class="section-num">9</span><h2>Exit &amp; sellability</h2></div>
  <p>The simplest path is an <strong>asset sale</strong> (sell the product/IP), ideally to someone already using it — the federation itself. Alternatively a share sale if Glidr is incorporated with revenue.</p>
  <h3>The sale package</h3>
  <p>Source code + IP, domain + brand, the running service (customers/data/contracts), third-party accounts, and "how to run it" documentation.</p>
  <h3>Preparation (what makes the sale easy)</h3>
  <ul>
    <li>Clean IP, portable code, verifiable backup, full export (everything being built now).</li>
    <li>Data room: code, ops documentation, customer list, revenue, costs.</li>
    <li>A short transition period (1–3 months) for a safe handover.</li>
  </ul>
  <div class="box box-info"><strong>Valuation (for orientation):</strong> SaaS is typically priced as a multiple of annual recurring revenue (ARR). Without revenue it is valued on code + customer relationships + strategic value. Being embedded with a recognised federation is significant strategic value. For the concrete price and tax: use a lawyer/accountant.</div>

  <!-- 10 -->
  <div class="section-title"><span class="section-num">10</span><h2>Risks &amp; mitigations</h2></div>
  <table>
    <tr><th>Risk</th><th>Mitigation</th></tr>
    <tr><td>Data safety (the customer's dealbreaker)</td><td>Recycle bin, backup verification, export, audit log (Priority 1)</td></tr>
    <tr><td>Offline in the field (dealbreaker)</td><td>Solid offline in stages, tested thoroughly (Priority 2)</td></tr>
    <tr><td>"Free" becomes permanent</td><td>Written pilot agreement with stated payment intention</td></tr>
    <tr><td>Vendor dependency (Render, DB)</td><td>Portable code, backups, no lock-in</td></tr>
    <tr><td>Key-person risk (solo developer)</td><td>Documentation, clean structure, transferable operations; consider a partner/support</td></tr>
    <tr><td>Underpricing</td><td>Value-based, start high, use the reference to defend the price</td></tr>
  </table>

  <!-- 11 -->
  <div class="section-title"><span class="section-num">11</span><h2>Action plan — next 12 months</h2></div>
  <ul>
    <li><strong>Winter:</strong> Run the free pilot (in writing, with payment intention). Finish Priority 1 (data reliability). Collect testimonial + usage data.</li>
    <li><strong>Spring:</strong> Finish robust offline (Priority 2). Establish the data-processing agreement, the pricing sheet and the pilot→paid plan.</li>
    <li><strong>Summer:</strong> Convert the pilot federation to a paying annual agreement. Start the decision engine (significance + recommendation).</li>
    <li><strong>Autumn:</strong> Expand to 1–2 new federations/teams using the reference. Build ARR.</li>
    <li><strong>Throughout:</strong> Keep the IP clean and the product sellable — so an exit stays an open option, never a necessity.</li>
  </ul>

  <div class="divider"></div>
  <p style="text-align:center" class="muted"><strong style="color:var(--dark)">© 2025 Glidr. All rights reserved.</strong><br/>Strictly confidential owner document. Unauthorised use is prohibited.</p>

  <div class="footer no-print">
    <span>Glidr Strategy Document — Confidential</span>
    <span>Generated: ${genDate}</span>
  </div>

</div>
<script>
if (window.opener) {
  window.addEventListener('load', () => { setTimeout(() => window.print(), 700); });
}
</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
