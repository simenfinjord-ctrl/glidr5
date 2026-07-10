// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Generates the Glidr Feature Guide as a clean, print-ready HTML document
// opened in a new tab. Use browser File → Print → Save as PDF.
//
// #42: text-only — no decorative mockups/screenshots or animations — and kept
// thorough and up to date with the current feature set.

export function generateFeatureGuidePDF(): void {
  const genDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });
  // Faithful HTML recreations of the core screens (print-safe, always current
  // with the described feature set — no stale screenshots).
  const row = (rank: string, name: string, dist: string, hl = false) =>
    `<div style="display:flex;gap:8px;align-items:center;border-radius:6px;padding:4px 8px;background:${hl ? "#fffbeb" : "#f9fafb"};margin:3px 0;font-size:9pt;">
      <strong style="width:14px;color:${hl ? "#b45309" : "#9ca3af"}">${rank}</strong>
      <span style="flex:1;color:#374151">${name}</span>
      <span style="font-family:monospace;color:#6b7280">${dist}</span>
    </div>`;
  const bar = (label: string, pct: number, rank: string, best = false) =>
    `<div style="display:flex;gap:8px;align-items:center;margin:4px 0;font-size:8.5pt;">
      <span style="width:58px;color:#9ca3af">${label}</span>
      <span style="flex:1;height:9px;border-radius:4px;background:#f3f4f6;overflow:hidden;display:block"><span style="display:block;height:100%;width:${pct}%;border-radius:4px;background:${best ? "#0ea5e9" : "#a78bfa"}"></span></span>
      <strong style="width:22px;text-align:right;color:${best ? "#b45309" : "#9ca3af"}">${rank}</strong>
    </div>`;
  const shotsHtml = `
    <figure class="shot"><div style="padding:10px 12px;">
      <div style="display:flex;justify-content:space-between;font-size:9pt;margin-bottom:6px;"><strong>Glide Test · Sognefjell · 5 km</strong><span style="color:#059669;font-weight:700;">8 pairs</span></div>
      ${row("1", "Swix PS6 &nbsp;× 2", "0 cm", true)}${row("2", "Rode R30", "+4 cm")}${row("3", "Toko HF Blue", "+9 cm")}${row("4", "Rex G21", "+13 cm")}
    </div><figcaption>Tests — live ranking of every ski pair, with product and application</figcaption></figure>
    <figure class="shot"><div style="padding:10px 12px;">
      <div style="display:flex;justify-content:space-between;font-size:9pt;margin-bottom:6px;"><strong>Swix PS6 · Snow temperature</strong><span style="color:#059669;font-weight:700;">Best: &lt; −10°C</span></div>
      ${bar("&lt; −10°C", 30, "1.2", true)}${bar("−10 – −5", 45, "1.8")}${bar("−5 – 0", 60, "2.4")}${bar("&gt; 0°C", 78, "3.1")}
    </div><figcaption>Analytics — average rank per condition bracket</figcaption></figure>
    <figure class="shot"><div style="padding:10px 12px;">
      <div style="display:flex;justify-content:space-between;font-size:9pt;margin-bottom:6px;"><strong>Athlete Skis · garage</strong><span style="color:#1d4ed8;font-weight:700;">14 pairs</span></div>
      ${row("003", "Madshus · OLY9", "Wins ×4", true)}${row("320", "Madshus · M61F", "Reground 12 Jan")}${row("117", "Fischer · C12-7", "Cold")}
    </div><figcaption>Athlete Skis — the full garage with grind and regrind history</figcaption></figure>
    <figure class="shot"><div style="padding:10px 12px;">
      <div style="font-size:9pt;margin-bottom:6px;"><strong>Weather · pulled from station 11:42</strong></div>
      ${row("❄", "Snow −6.2°C · Air −3.8°C", "74% RH")}${row("⛸", "Fine grain · Track medium", "Wind light NW")}
    </div><figcaption>Weather — logged manually or pulled from your own station</figcaption></figure>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Glidr — Feature Guide</title>
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
  .sub-title { font-weight: 700; color: var(--dark); margin: 12px 0 3px; font-size: 11.5pt; }

  .badge { display: inline-block; font-size: 8pt; font-weight: 700; border-radius: 4px; padding: 1px 6px; vertical-align: middle; }
  .badge-ta { background: #ede9fe; color: var(--violet); }
  .badge-sa { background: #fef3c7; color: var(--amber); }

  .box { border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 10.5pt; border: 1px solid var(--line); }
  .box-info { background: #eff6ff; border-color: #bfdbfe; }
  .box-warning { background: #fffbeb; border-color: #fde68a; }
  .box-danger { background: #fef2f2; border-color: #fecaca; }
  .box-ok { background: #ecfdf5; border-color: #a7f3d0; }

  .toc-entry { display: flex; justify-content: space-between; border-bottom: 1px dotted var(--line); padding: 3px 0; font-size: 10.5pt; }
  .toc-indent { padding-left: 18px; color: var(--muted); }

  .divider { height: 1px; background: var(--line); margin: 20px 0; }
  .muted { color: var(--muted); }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 9pt; color: var(--muted); }

  .cover { text-align: center; padding: 70px 0 40px; border-bottom: 3px solid var(--violet); margin-bottom: 8px; }
  .cover .logo { font-size: 30pt; font-weight: 900; letter-spacing: .06em; color: var(--violet); }
  .cover .title { font-size: 18pt; font-weight: 700; margin-top: 10px; }
  .cover .sub { color: var(--muted); margin-top: 6px; }
  .cover .meta { margin-top: 18px; font-size: 9.5pt; color: var(--muted); }

  .shot { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; margin: 10px 0; page-break-inside: avoid; }
  .shot img { display: block; width: 100%; }
  .shot figcaption { padding: 6px 10px; font-size: 9pt; color: var(--muted); border-top: 1px solid var(--line); background: var(--bg-soft); }
  .shot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

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

  <!-- COVER -->
  <div class="cover">
    <div class="logo">GLIDR</div>
    <div class="title">Feature Guide</div>
    <div class="sub">Complete reference for every feature, role &amp; permission</div>
    <div class="meta">Confidential · For authorised users only · Generated ${genDate}</div>
  </div>

  <!-- LEGAL NOTICE -->
  <div class="section-title"><span class="section-num">Legal</span><h2>Legal Notice &amp; Intellectual Property</h2></div>
  <h3>Confidentiality</h3>
  <p>This document is the exclusive property of Glidr and is provided solely for the internal use of authorised users. It may not be copied, distributed, published, or disclosed to any third party without the prior written consent of Glidr.</p>
  <h3>Competitive Use Prohibition</h3>
  <p>This document describes proprietary features, workflows, data models, and user-experience patterns developed by Glidr. Any use of this document — in whole or in part — to design, develop, or improve a competing ski-testing, wax-management, or athlete-performance platform is expressly prohibited.</p>
  <h3>Access &amp; Permissions</h3>
  <p>Access to the features described here depends on your account role and the permissions configured for your team. Features marked <span class="badge badge-ta">★ Team Admin</span> require Team Admin privileges; features marked <span class="badge badge-sa">◆ Super Admin</span> are exclusive to Super Admins.</p>
  <div class="box box-warning"><strong>Super Admin access:</strong> Super Admins manage the platform but do not have direct access to an individual team's test data, products, or internal records. They rely on team feedback when investigating issues.</div>
  <p class="muted">© 2025 Glidr. All rights reserved.</p>

  <!-- PRODUCT IN ACTION -->
  <div class="page-break"></div>
  <div class="section-title"><span class="section-num">Shots</span><h2>The Product in Action</h2></div>
  <p class="muted">Representative views of the core workflows described in this guide.</p>
  <div class="shot-grid">
${shotsHtml}
  </div>

  <!-- CONTENTS -->
  <div class="page-break"></div>
  <div class="section-title"><span class="section-num">TOC</span><h2>Contents</h2></div>
  <div class="toc-entry"><span>1. Introduction &amp; Roles</span><span></span></div>
  <div class="toc-entry"><span>2. Tests</span><span></span></div>
  <div class="toc-entry"><span>3. Products</span><span></span></div>
  <div class="toc-entry"><span>4. Weather &amp; Conditions</span><span></span></div>
  <div class="toc-entry"><span>5. Analytics</span><span></span></div>
  <div class="toc-entry"><span>6. Race Preparations</span><span></span></div>
  <div class="toc-entry"><span>7. Athlete Skis (Race Skis)</span><span></span></div>
  <div class="toc-entry"><span>8. Testfleets</span><span></span></div>
  <div class="toc-entry"><span>9. Grinding</span><span></span></div>
  <div class="toc-entry"><span>10. Garmin Watch &amp; Live Runsheets</span><span></span></div>
  <div class="toc-entry"><span>11. Offline Mode</span><span></span></div>
  <div class="toc-entry"><span>12. My Account</span><span></span></div>
  <div class="toc-entry"><span>13. Team Admin Features <span class="badge badge-ta">★</span></span><span></span></div>
  <div class="toc-entry"><span>14. Backups &amp; Data Safety</span><span></span></div>
  <div class="toc-entry"><span>15. Permission System</span><span></span></div>
  <div class="toc-entry"><span>16. Competitive Reservation &amp; Legal</span><span></span></div>

  <!-- 1 INTRODUCTION -->
  <div class="section-title"><span class="section-num">1</span><h2>Introduction &amp; Roles</h2></div>
  <p>Glidr is a professional ski-testing and wax-management platform for elite cross-country teams. It brings test data, products, athlete skis, race preparation, grinding and analytics into one system, usable on any device — in the field or in the wax cabin. The interface follows your chosen language (Norwegian or English) throughout.</p>
  <div class="sub-title">Three role levels</div>
  <ul>
    <li><strong>Member</strong> — works within the areas and groups the Team Admin has granted (e.g. tests, products, race skis).</li>
    <li><strong>Team Admin <span class="badge badge-ta">★</span></strong> — manages the team: users, groups, permissions, integrations, backups and settings.</li>
    <li><strong>Super Admin <span class="badge badge-sa">◆</span></strong> — manages the platform across teams, without direct access to a team's private data.</li>
  </ul>
  <p>Every action is governed by your role plus the per-area permissions (view / edit / none) and the groups you belong to.</p>

  <!-- 2 TESTS -->
  <div class="section-title"><span class="section-num">2</span><h2>Tests</h2></div>
  <p>A test records how ski pairs or products performed under specific conditions. Each test has a date, location, type (Glide, Classic, Skating, Double Poling, Structure or Grind), an optional linked weather record, and one row per ski pair.</p>
  <ul>
    <li><strong>Per-pair entry:</strong> product(s) and application, result (cm behind) per round/distance, rank, feeling and (for classic) kick.</li>
    <li><strong>Free-text product:</strong> enter a borrowed product as free text — it is recorded but excluded from analytics.</li>
    <li><strong>AI photo entry:</strong> photograph a completed test sheet and let Glidr extract ski numbers, products, results and ranks for review before saving.</li>
    <li><strong>Runsheets:</strong> generate a head-to-head bracket and apply results automatically.</li>
    <li><strong>Blind testing:</strong> hide product names while testing to remove bias.</li>
    <li><strong>“Do not add weather”:</strong> when no weather is available, tick this to grey out the weather field; such tests are not counted as “missing weather”.</li>
    <li><strong>Location suggestions:</strong> the location field and filters suggest places from existing tests, weather and race preps.</li>
    <li><strong>Mobile:</strong> all test actions are available from a single “Options” menu so nothing overflows the screen.</li>
  </ul>

  <!-- 3 PRODUCTS -->
  <div class="section-title"><span class="section-num">3</span><h2>Products</h2></div>
  <p>The product catalogue holds every wax, powder, block and structure tool the team uses, with stock levels and usage history.</p>
  <ul>
    <li><strong>Categories (tags):</strong> Paraffin, Liquid, Block and Structure Tool. Filter and tag by these everywhere.</li>
    <li><strong>Google Sheet sync <span class="badge badge-ta">★</span>:</strong> connect a Google Sheet of products. New rows are imported automatically every 5 minutes (or on demand) into the connecting group; the category column is interpreted into the correct tag. Sync is additive — products are never deleted from Glidr.</li>
    <li><strong>Stock &amp; history:</strong> track quantities and see every stock change.</li>
    <li><strong>Compare:</strong> compare product performance across shared tests and conditions.</li>
    <li><strong>Archive:</strong> archive instead of delete; select all to archive, restore or delete in bulk.</li>
  </ul>

  <!-- 4 WEATHER -->
  <div class="section-title"><span class="section-num">4</span><h2>Weather &amp; Conditions</h2></div>
  <p>Log snow and air temperature, humidity, snow type, track hardness, grain size, wind, clouds, precipitation and visibility. Weather records can be linked to tests and race preps, or entered manually on the fly. Team Admins can connect a weather station to auto-fill readings.</p>

  <!-- 5 ANALYTICS -->
  <div class="section-title"><span class="section-num">5</span><h2>Analytics</h2></div>
  <p>Analytics turn raw tests into insight: average rank, best rank, win rate and feeling per product or ski pair, filtered by season, type, conditions and group. Product comparison highlights the strongest options for given conditions.</p>

  <!-- 6 RACE PREP -->
  <div class="section-title"><span class="section-num">6</span><h2>Race Preparations</h2></div>
  <p>A race prep is the plan for a specific race: the start list of athletes, the chosen glide/structure/kick products and application, linked weather, and per-athlete ski assignment.</p>
  <ul>
    <li><strong>Ski assignment:</strong> register each athlete's ski pair (auto-completes from their garage); parameters resolve from the ski.</li>
    <li><strong>Borrow skis:</strong> assign a pair borrowed from another athlete — the row is marked “Borrowed” and parameters come from the owner's garage.</li>
    <li><strong>Waxer comments:</strong> private notes per waxer.</li>
    <li><strong>Report:</strong> download a full race-prep report.</li>
  </ul>

  <!-- 7 ATHLETE SKIS -->
  <div class="section-title"><span class="section-num">7</span><h2>Athlete Skis (Race Skis)</h2></div>
  <p>Each athlete has a profile, a ski garage, a test history and a race-prep history. Athlete tests live entirely under Athlete Skis — never in the general Tests list.</p>
  <div class="sub-title">Athlete profile</div>
  <p>Name, team, default ski brand, height, weight, pole height, binding position and free-text ski-service preferences — shown on the athlete page and the overview.</p>
  <div class="sub-title">Ski garage</div>
  <ul>
    <li>Per-pair parameters (serial, brand, construction, mould, base, grind, heights, year, length, ski type, where received), colour tag, notes and a training-ski flag.</li>
    <li>List view shows every parameter as sortable, toggleable columns; free-text/custom values sort naturally.</li>
    <li>Colour palette and sort order: White, Green, Blue, Purple, Red, Yellow, Grey.</li>
    <li><strong>Current grind = latest regrind:</strong> the garage always shows the most recent grind. Regrind history is newest-first.</li>
    <li><strong>Times raced</strong> per pair (from race-use logs and race preps).</li>
  </ul>
  <div class="sub-title">Race-use logging &amp; feedback</div>
  <ul>
    <li>Waxers log race use on a pair without an admin race prep (date optional).</li>
    <li><strong>Feedback link:</strong> a per-athlete open link (no login) where the athlete rates skis (Competitive ±) and comments per race; responses appear on the ski pairs and race-prep cards.</li>
  </ul>
  <div class="sub-title">Race-ski tests</div>
  <ul>
    <li>Pairs are shown by <strong>Ski-ID</strong> (not 1…n); the linked grind is shown.</li>
    <li><strong>Feeling test:</strong> drag-rank pairs 1…N with a comment each; feeling notes can be entered inline next to the rank.</li>
    <li><strong>Kick solution</strong> per pair on classic tests, with “Same for every pair”.</li>
    <li><strong>Rank by diff / Rank by feel</strong> when both exist (diff-rank always drives analytics).</li>
    <li>Sortable result columns, remembered per waxer; feeling notes are a toggleable column.</li>
    <li><strong>Analytics:</strong> Glide, Feeling and Total performance overviews, plus an automatic interpreted summary of a pair's feeling notes.</li>
  </ul>

  <!-- 8 TESTFLEETS -->
  <div class="section-title"><span class="section-num">8</span><h2>Testfleets</h2></div>
  <p>Testfleets are the glide test-ski series. Each fleet shows its current grind clearly and a full regrind history (newest first), the same as race skis. An <strong>Action status</strong> per fleet — Need regrind, In for regrind (with location), Grinded, In use — is colour-coded for quick overview.</p>

  <!-- 9 GRINDING -->
  <div class="section-title"><span class="section-num">9</span><h2>Grinding</h2></div>
  <p>Maintain grind profiles (type, stone, pattern, extra parameters) and grinding records. Mark a profile as <strong>US-Grind</strong> to show a badge and filter to only those.</p>

  <!-- 10 WATCH / RUNSHEETS -->
  <div class="section-title"><span class="section-num">10</span><h2>Garmin Watch &amp; Live Runsheets</h2></div>
  <p>Run head-to-head sessions live from a Garmin watch and review results back in Glidr. Live Runsheets coordinate on-snow testing in real time.</p>

  <!-- 11 OFFLINE -->
  <div class="section-title"><span class="section-num">11</span><h2>Offline Mode</h2></div>
  <p>Glidr works offline in the field: key data is cached, changes are saved locally and synced automatically when you reconnect. Status messages follow your language.</p>

  <!-- 12 MY ACCOUNT -->
  <div class="section-title"><span class="section-num">12</span><h2>My Account</h2></div>
  <p>Manage your name, username, password, two-factor authentication, language, date format and display preferences. “Remember me” keeps you signed in for 30 days.</p>

  <!-- 13 TEAM ADMIN -->
  <div class="section-title"><span class="section-num">13</span><h2>Team Admin Features <span class="badge badge-ta">★</span></h2></div>
  <ul>
    <li><strong>Users &amp; permissions:</strong> invite users, set roles, and grant per-area access. View a user's logins and activity.</li>
    <li><strong>Groups:</strong> segment data by group; control who sees what.</li>
    <li><strong>Activity log:</strong> full history with a filter by action. Login history shows only logins.</li>
    <li><strong>Backups:</strong> Google Sheets backup (every 30 min) plus JSON + PDF to Google Drive (every 2 hours).</li>
    <li><strong>Product Google Sheet</strong> and <strong>Feedback button</strong> (toggle + Google link, shown above the search bar) configured here.</li>
    <li><strong>Weather station</strong> integration and <strong>data management</strong> tools.</li>
  </ul>

  <!-- 14 BACKUPS -->
  <div class="section-title"><span class="section-num">14</span><h2>Backups &amp; Data Safety</h2></div>
  <div class="box box-ok"><strong>Your data is safe across restarts and deploys.</strong> All data lives in a managed PostgreSQL database, separate from the app. App restarts never lose data.</div>
  <p>Three independent safety nets keep a complete, restorable copy of your team's data:</p>
  <ul>
    <li><strong>JSON export</strong> — the complete, canonical restore source: tests &amp; entries, weather, products (incl. archived), athletes &amp; access, race skis, race-use &amp; feedback, race preps &amp; comments, grinds, users and more.</li>
    <li><strong>Google Sheets</strong> — human-readable, per-area sheets including each athlete's tests in chronological order with all notes.</li>
    <li><strong>PDF</strong> — a printable snapshot for offline reference.</li>
  </ul>
  <p class="muted">If Glidr were ever unavailable, the JSON backup alone is enough to reconstruct your team's records.</p>

  <!-- 15 PERMISSIONS -->
  <div class="section-title"><span class="section-num">15</span><h2>Permission System</h2></div>
  <p>Permissions are set per area (Tests, Products, Weather, Analytics, Grinding, Race Skis, Race Prep, Suggestions, Live Runsheets) at view or edit level, and combined with group membership. Team Admins manage these under Admin → Users; changes take effect on the user's next page load.</p>

  <!-- 16 LEGAL -->
  <div class="page-break"></div>
  <div class="section-title"><span class="section-num">16</span><h2>Competitive Reservation &amp; Legal</h2></div>
  <div class="box box-danger"><strong>Restricted use.</strong> The features, workflows and data models described here are proprietary to Glidr. Reading this document grants no licence to reproduce, replicate, or be inspired by these concepts in a competing product.</div>
  <h3>Prohibited uses</h3>
  <p>Without Glidr's express written consent, the following are strictly prohibited:</p>
  <ul>
    <li>Using this document as a reference or specification for a competing platform.</li>
    <li>Sharing it with anyone developing competitive software.</li>
    <li>Reproducing feature descriptions, workflows or data models in any specification.</li>
    <li>Training any AI/ML model on this document's content.</li>
    <li>Disclosing its contents to any competitor of Glidr.</li>
  </ul>
  <h3>Enforcement</h3>
  <p>Glidr reserves all rights to seek injunctive relief, damages and other remedies against any party violating these terms. If you received this document without authorisation, contact Glidr immediately and destroy all copies.</p>

  <div class="divider"></div>
  <p style="text-align:center" class="muted"><strong style="color:var(--dark)">© 2025 Glidr. All rights reserved.</strong><br/>Proprietary and confidential. Unauthorised use is prohibited.</p>

  <div class="footer no-print">
    <span>Glidr Feature Guide — Confidential</span>
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
