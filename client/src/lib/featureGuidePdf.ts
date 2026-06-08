// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Generates the Glidr Feature Guide as a print-ready HTML document
// opened in a new tab. Use browser File → Print → Save as PDF.

export function generateFeatureGuidePDF(): void {
  const genDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Glidr Feature Guide</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
/* ── Variables ── */
:root {
  --violet:  #7c3aed;
  --violet2: #8b5cf6;
  --violet3: #a78bfa;
  --violetbg:#ede9fe;
  --violetlg:#f5f3ff;
  --dark:    #0f0f1e;
  --muted:   #6b7280;
  --amber:   #d97706;
  --amberbg: #fffbeb;
  --red:     #dc2626;
  --redbg:   #fef2f2;
  --green:   #16a34a;
  --greenbg: #f0fdf4;
  --radius:  10px;
}

/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 14px; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: #f8f7ff;
  color: var(--dark);
  line-height: 1.65;
}

/* ── Print ── */
@media print {
  body { background: white; font-size: 11pt; }
  .no-print { display: none !important; }
  .page-break { page-break-before: always; }
  .cover { page-break-after: always; }
  section { page-break-inside: avoid; }
  .mockup-screen { border: 1px solid #e5e7eb !important; box-shadow: none !important; }
  * { animation: none !important; transition: none !important; }
  @page { margin: 18mm; size: A4; }
  @page :first { margin: 0; }
}

/* ── Download bar ── */
.download-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: white; border-bottom: 1px solid #e5e7eb;
  padding: 10px 24px;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 1px 6px rgba(0,0,0,.08);
}
.download-bar h1 { font-size: 1rem; font-weight: 600; color: var(--dark); }
.download-bar span { font-size: .78rem; color: var(--muted); margin-left: 8px; }
.btn-print {
  background: linear-gradient(135deg, var(--violet), var(--violet2));
  color: white; border: none; border-radius: 8px;
  padding: 8px 20px; font-family: inherit; font-size: .85rem; font-weight: 600;
  cursor: pointer; display: flex; align-items: center; gap: 6px;
  box-shadow: 0 2px 8px rgba(124,58,237,.35);
  transition: transform .15s, box-shadow .15s;
}
.btn-print:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(124,58,237,.45); }

/* ── Wrapper ── */
.doc { max-width: 860px; margin: 60px auto 80px; padding: 0 24px; }

/* ── COVER ── */
.cover {
  min-height: 100vh; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center;
  background: linear-gradient(160deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%);
  position: relative; overflow: hidden;
  page-break-after: always;
  margin: -60px -24px 0; padding: 80px 40px;
}
.cover::before {
  content: ''; position: absolute; top: -80px; right: -80px;
  width: 360px; height: 360px; border-radius: 50%;
  background: radial-gradient(circle, rgba(124,58,237,.15), transparent 70%);
  animation: pulse 6s ease-in-out infinite;
}
.cover::after {
  content: ''; position: absolute; bottom: -60px; left: -60px;
  width: 280px; height: 280px; border-radius: 50%;
  background: radial-gradient(circle, rgba(139,92,246,.12), transparent 70%);
  animation: pulse 8s ease-in-out infinite reverse;
}
@keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:.7} }

.cover-top-stripe {
  position: absolute; top: 0; left: 0; right: 0; height: 6px;
  background: linear-gradient(90deg, var(--violet), var(--violet2), var(--violet3));
}
.cover-logo {
  font-size: 5.5rem; font-weight: 800; letter-spacing: -.04em;
  background: linear-gradient(135deg, var(--violet), var(--violet2));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: fadeInDown .8s ease both;
  position: relative; z-index: 1;
}
.cover-rule {
  width: 120px; height: 2px; margin: 16px auto;
  background: linear-gradient(90deg, var(--violet), transparent);
  animation: expandRule .8s .2s ease both;
}
@keyframes expandRule { from{width:0;opacity:0} to{width:120px;opacity:1} }
.cover-title {
  font-size: 1.7rem; font-weight: 600; color: var(--dark);
  animation: fadeInUp .8s .3s ease both;
  position: relative; z-index: 1;
}
.cover-sub {
  font-size: .95rem; color: var(--muted); margin-top: 8px;
  max-width: 440px;
  animation: fadeInUp .8s .45s ease both;
  position: relative; z-index: 1;
}
@keyframes fadeInDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeInUp   { from{opacity:0;transform:translateY(20px)}  to{opacity:1;transform:translateY(0)} }

.cover-conf-box {
  margin: 40px auto 0; max-width: 480px;
  background: white; border: 1.5px solid var(--violet);
  border-radius: var(--radius); padding: 20px 24px;
  animation: fadeInUp .8s .6s ease both;
  position: relative; z-index: 1;
}
.cover-conf-box h3 {
  font-size: .78rem; font-weight: 700; letter-spacing: .1em;
  color: var(--violet); text-transform: uppercase; margin-bottom: 8px;
}
.cover-conf-box p { font-size: .8rem; color: var(--muted); line-height: 1.6; }

.cover-footer {
  margin-top: 48px; font-size: .8rem; color: var(--muted);
  animation: fadeInUp .8s .75s ease both;
  position: relative; z-index: 1;
}
.cover-footer strong { color: var(--dark); }

/* ── Page header ── */
.page-header {
  padding: 40px 0 8px;
  border-bottom: 2px solid var(--violetbg);
  margin-bottom: 32px;
}
.page-header:not(:first-child) { page-break-before: always; }

/* ── Section title ── */
.section-title {
  display: flex; align-items: center; gap: 10px;
  background: var(--violetlg);
  border-left: 4px solid var(--violet);
  border-radius: 0 8px 8px 0;
  padding: 10px 16px; margin: 36px 0 16px;
  animation: slideIn .5s ease both;
}
@keyframes slideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
.section-title h2 {
  font-size: 1.05rem; font-weight: 700; color: var(--violet);
}
.section-title .section-num {
  font-size: .78rem; font-weight: 700; color: var(--violet3);
  background: var(--violetbg); border-radius: 6px;
  padding: 2px 8px; flex-shrink: 0;
}

/* ── Sub-section ── */
.sub-title {
  font-size: .92rem; font-weight: 600; color: var(--dark);
  margin: 20px 0 6px;
}

/* ── Body text ── */
p { font-size: .9rem; color: #374151; margin: 6px 0 10px; }

/* ── Bullet list ── */
ul.feat-list { list-style: none; margin: 8px 0 12px; padding: 0; }
ul.feat-list li {
  display: flex; gap: 8px; font-size: .88rem; color: #374151;
  padding: 4px 0; align-items: flex-start; line-height: 1.55;
}
ul.feat-list li::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%;
  background: var(--violet2); flex-shrink: 0; margin-top: 7px;
}

/* ── Badges ── */
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: .72rem; font-weight: 600; border-radius: 999px;
  padding: 2px 10px; vertical-align: middle; margin-left: 4px;
}
.badge-ta  { background: var(--violetbg); color: var(--violet); border: 1px solid var(--violet3); }
.badge-sa  { background: var(--amberbg);  color: var(--amber);  border: 1px solid #fcd34d; }
.badge-free{ background: var(--greenbg);  color: var(--green);  border: 1px solid #86efac; }

/* ── Warning / info boxes ── */
.box {
  border-radius: var(--radius); padding: 14px 16px; margin: 14px 0;
  font-size: .85rem; line-height: 1.6;
}
.box-info    { background: var(--violetlg); border-left: 3px solid var(--violet2); color: #3730a3; }
.box-warning { background: var(--amberbg);  border-left: 3px solid var(--amber);   color: #92400e; }
.box-danger  { background: var(--redbg);    border-left: 3px solid var(--red);     color: #991b1b; }
.box strong  { font-weight: 700; }

/* ── Table of contents ── */
.toc { margin: 8px 0; }
.toc-entry {
  display: flex; align-items: baseline; padding: 4px 0;
  font-size: .9rem; color: var(--dark);
  border-bottom: 1px dotted #d1d5db;
}
.toc-entry.toc-indent { padding-left: 20px; font-size: .85rem; color: var(--muted); }
.toc-label { flex: 1; font-weight: 500; }
.toc-entry.toc-indent .toc-label { font-weight: 400; }
.toc-page { font-weight: 600; color: var(--violet); min-width: 30px; text-align: right; }

/* ── Permission table ── */
.perm-table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: .85rem; }
.perm-table th {
  background: var(--violetlg); color: var(--violet);
  font-weight: 700; text-align: left; padding: 8px 12px;
  border-bottom: 2px solid var(--violetbg);
}
.perm-table td { padding: 7px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
.perm-table tr:hover td { background: #faf9ff; }
.perm-on  { color: var(--green); font-weight: 600; }
.perm-off { color: #d1d5db; }

/* ── UI Mockup ── */
.mockup-wrap { margin: 18px 0 24px; }
.mockup-label {
  font-size: .75rem; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px;
}
.mockup-screen {
  background: white; border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 24px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.04);
  overflow: hidden;
}
.mockup-titlebar {
  background: linear-gradient(135deg, var(--violet), var(--violet2));
  color: white; padding: 8px 14px;
  display: flex; align-items: center; gap: 8px; font-size: .78rem; font-weight: 600;
}
.mockup-titlebar .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.4); }
.mockup-body { padding: 12px 14px; }
.mockup-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; border-radius: 6px; margin: 3px 0;
  font-size: .78rem;
  transition: background .15s;
}
.mockup-row:hover { background: var(--violetlg); }
.mockup-row.header { background: var(--violetlg); font-weight: 600; color: var(--violet); font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; }
.mockup-num  { width: 28px; text-align: center; font-weight: 700; color: var(--violet2); }
.mockup-prod { flex: 1; color: var(--dark); font-weight: 500; }
.mockup-meth { flex: 1; color: var(--muted); font-size: .75rem; }
.mockup-rank { width: 40px; text-align: center; }
.mockup-res  { width: 55px; text-align: right; font-weight: 600; color: var(--green); font-size: .8rem; }
.mockup-badge { background: var(--violetbg); color: var(--violet); border-radius: 4px; padding: 1px 7px; font-size: .72rem; font-weight: 600; }
.mockup-weather-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  padding: 10px 14px;
}
.mockup-weather-cell {
  background: var(--violetlg); border-radius: 6px; padding: 8px;
  text-align: center;
}
.mockup-weather-cell .val { font-size: 1.1rem; font-weight: 700; color: var(--violet); }
.mockup-weather-cell .lbl { font-size: .68rem; color: var(--muted); margin-top: 2px; }
.mockup-analytics-bar {
  display: flex; align-items: flex-end; gap: 6px; height: 60px;
  padding: 8px 14px 0;
}
.m-bar { border-radius: 4px 4px 0 0; background: var(--violet2); opacity: .8; flex: 1; transition: opacity .15s; }
.m-bar:hover { opacity: 1; }
.m-bar-label { display: flex; gap: 6px; padding: 4px 14px 10px; }
.m-bar-label span { flex: 1; font-size: .65rem; color: var(--muted); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Station chips ── */
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 14px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--violetlg); border: 1px solid var(--violetbg);
  border-radius: 999px; padding: 4px 12px; font-size: .78rem;
  font-weight: 500; color: var(--violet);
}
.chip .chip-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--violet); }

/* ── Feature card grid ── */
.feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; }
.feature-card {
  background: white; border-radius: 10px; padding: 14px;
  border: 1px solid #e5e7eb;
  transition: box-shadow .2s, transform .2s;
}
.feature-card:hover { box-shadow: 0 6px 20px rgba(124,58,237,.1); transform: translateY(-2px); }
.feature-card h4 { font-size: .85rem; font-weight: 700; color: var(--dark); margin-bottom: 4px; }
.feature-card p  { font-size: .78rem; color: var(--muted); margin: 0; line-height: 1.5; }
.feature-card .fc-icon {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--violetlg); margin-bottom: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem;
}

/* ── Roles table ── */
.roles-table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: .85rem; }
.roles-table th {
  text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--violetbg);
  color: var(--muted); font-weight: 600; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em;
}
.roles-table td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
.roles-table tr:hover td { background: #faf9ff; }

/* ── Footer ── */
.doc-footer {
  margin-top: 60px; padding-top: 16px;
  border-top: 1px solid var(--violetbg);
  display: flex; justify-content: space-between; align-items: center;
  font-size: .75rem; color: var(--muted);
}

/* ── Divider ── */
.divider { height: 1px; background: var(--violetbg); margin: 32px 0; }

/* ── Legal section ── */
.legal-block { margin: 16px 0; }
.legal-block h3 { font-size: .9rem; font-weight: 700; color: var(--dark); margin-bottom: 6px; }
.legal-block p  { font-size: .87rem; color: #374151; }
</style>
</head>
<body>

<!-- Download bar (hidden in print) -->
<div class="download-bar no-print">
  <div>
    <h1>Glidr Feature Guide</h1>
    <span>Generated ${genDate}</span>
  </div>
  <button class="btn-print" onclick="window.print()">
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path d="M12 16l-4-4h3V4h2v8h3l-4 4z"/>
      <path d="M20 18H4v-2h16v2z"/>
    </svg>
    Download PDF
  </button>
</div>

<div class="doc">

<!-- ══════════════════════════════════════════════════════════ COVER -->
<div class="cover">
  <div class="cover-top-stripe"></div>
  <div class="cover-logo">GLIDR</div>
  <div class="cover-rule"></div>
  <div class="cover-title">Platform Feature Guide</div>
  <div class="cover-sub">Complete reference for all platform capabilities, roles &amp; permissions</div>
  <div class="cover-conf-box">
    <h3>⚠ Confidential Document</h3>
    <p>This document contains proprietary information about Glidr's features and internal architecture. Unauthorised distribution, reproduction, or use of this document to develop competing software is strictly prohibited and may constitute a violation of trade secret law and intellectual property rights.</p>
  </div>
  <div class="cover-footer">
    <strong>© 2025 Glidr. All rights reserved.</strong><br/>
    Proprietary and confidential. Unauthorised use is prohibited.<br/>
    Generated: ${genDate}
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════ PAGE 2: LEGAL -->
<div class="page-break"></div>

<div class="section-title"><span class="section-num">Legal</span><h2>Legal Notice &amp; Intellectual Property</h2></div>

<div class="legal-block">
  <h3>Confidentiality</h3>
  <p>This document is the exclusive property of Glidr and is provided solely for the internal use of authorised users. It may not be copied, distributed, published, or disclosed to any third party without the prior written consent of Glidr.</p>
</div>

<div class="legal-block">
  <h3>Competitive Use Prohibition</h3>
  <p>This document describes proprietary features, workflows, data models, and user experience patterns developed by Glidr. Any use of this document — in whole or in part — to design, develop, or improve a competing ski testing, wax management, or athlete performance platform is expressly prohibited. Glidr reserves the right to pursue legal remedies against any party found to have misappropriated these proprietary concepts.</p>
</div>

<div class="legal-block">
  <h3>Access &amp; Permissions</h3>
  <p>Access to features described in this document depends on your account role and the permissions configured for your team. Features marked <span class="badge badge-ta">★ Team Admin</span> require Team Admin privileges. Features marked <span class="badge badge-sa">◆ Super Admin</span> are exclusive to Super Admins. Features may be disabled for your team by a Team Admin or Super Admin.</p>
</div>

<div class="box box-warning">
  <strong>Note on Super Admin access:</strong> Super Admins manage the platform but do not have direct access to individual team's test data, products, or internal records. They rely on team feedback when investigating or resolving issues specific to a team's data.
</div>

<div class="legal-block">
  <h3>Copyright</h3>
  <p>© 2025 Glidr. All rights reserved. The Glidr name, logo, and all associated product names, features, and interfaces are proprietary to Glidr. Unauthorised reproduction or use constitutes infringement.</p>
</div>

<!-- ══════════════════════════════════════════════════════════ PAGE 3: TOC -->
<div class="page-break"></div>

<div class="section-title"><span class="section-num">TOC</span><h2>Contents</h2></div>

<div class="toc">
  <div class="toc-entry"><span class="toc-label">1. Introduction</span><span class="toc-page">3</span></div>
  <div class="toc-entry"><span class="toc-label">2. Tests</span><span class="toc-page">4</span></div>
  <div class="toc-entry"><span class="toc-label">3. Products</span><span class="toc-page">5</span></div>
  <div class="toc-entry"><span class="toc-label">4. Weather &amp; Conditions</span><span class="toc-page">6</span></div>
  <div class="toc-entry"><span class="toc-label">5. Analytics</span><span class="toc-page">7</span></div>
  <div class="toc-entry"><span class="toc-label">6. Race Preparations</span><span class="toc-page">8</span></div>
  <div class="toc-entry"><span class="toc-label">7. Athletes &amp; Race Skis</span><span class="toc-page">9</span></div>
  <div class="toc-entry"><span class="toc-label">8. Grinding</span><span class="toc-page">10</span></div>
  <div class="toc-entry"><span class="toc-label">9. Garmin Watch Integration</span><span class="toc-page">10</span></div>
  <div class="toc-entry"><span class="toc-label">10. Offline Mode</span><span class="toc-page">11</span></div>
  <div class="toc-entry"><span class="toc-label">11. My Account</span><span class="toc-page">11</span></div>
  <div class="toc-entry"><span class="toc-label">12. Team Admin Features <span class="badge badge-ta">★ Team Admin</span></span><span class="toc-page">12</span></div>
  <div class="toc-entry toc-indent"><span class="toc-label">12.1 User Management</span><span class="toc-page">12</span></div>
  <div class="toc-entry toc-indent"><span class="toc-label">12.2 Group Management</span><span class="toc-page">13</span></div>
  <div class="toc-entry toc-indent"><span class="toc-label">12.3 Team Settings</span><span class="toc-page">13</span></div>
  <div class="toc-entry toc-indent"><span class="toc-label">12.4 Google Sheets Backup</span><span class="toc-page">14</span></div>
  <div class="toc-entry toc-indent"><span class="toc-label">12.5 Weather Station Integration</span><span class="toc-page">15</span></div>
  <div class="toc-entry toc-indent"><span class="toc-label">12.6 Activity &amp; Audit Log</span><span class="toc-page">15</span></div>
  <div class="toc-entry toc-indent"><span class="toc-label">12.7 Data Management</span><span class="toc-page">16</span></div>
  <div class="toc-entry"><span class="toc-label">13. Permission System</span><span class="toc-page">16</span></div>
  <div class="toc-entry"><span class="toc-label">14. Competitive Reservation</span><span class="toc-page">17</span></div>
</div>

<div class="box box-info" style="margin-top:24px">
  <strong>★ Team Admin</strong> — features available to users with Team Admin or Super Admin role.<br/>
  All other features are available to standard members, subject to the permissions set by the Team Admin.
</div>

<!-- ══════════════════════════════════════════════════════════ S1: INTRO -->
<div class="page-break"></div>

<div class="section-title"><span class="section-num">1</span><h2>Introduction</h2></div>

<p>Glidr is a professional ski testing and wax management platform designed for elite and competitive cross-country ski teams. It centralises test data, product management, athlete ski tracking, race preparation, and grinding records into a single integrated system — accessible from any device, in the field or in the wax cabin.</p>

<div class="sub-title">Roles &amp; Access</div>
<p>Every action in Glidr is governed by the user's role and the permissions configured by the Team Admin. There are three role levels:</p>

<table class="roles-table">
  <thead><tr><th>Role</th><th>Access Level</th><th>Who assigns it</th></tr></thead>
  <tbody>
    <tr><td><strong>Member</strong></td><td>Standard platform access — create tests, log weather, browse products, view analytics, manage own account.</td><td>Team Admin</td></tr>
    <tr><td><strong>Team Admin <span class="badge badge-ta">★</span></strong></td><td>All member capabilities, plus: user management, team settings, backup, groups, weather station, data management.</td><td>Super Admin</td></tr>
    <tr><td><strong>Super Admin <span class="badge badge-sa">◆</span></strong></td><td>Full platform management across all teams: create/pause/delete teams, manage billing, system security, maintenance mode. <em>Does not have access to individual team test data — relies on team feedback for data-specific issues.</em></td><td>Glidr</td></tr>
  </tbody>
</table>

<div class="box box-info">
  <strong>Feature access depends on team configuration.</strong> A Team Admin can enable or disable specific feature areas (e.g. hide the Grinds module for teams that don't use it), and grant or restrict individual user access per area. If a feature described here is not visible in your account, it may be disabled for your team.
</div>

<!-- ══════════════════════════════════════════════════════════ S2: TESTS -->
<div class="page-break"></div>

<div class="section-title"><span class="section-num">2</span><h2>Tests</h2></div>

<p>The Tests module is the core of Glidr. It allows teams to create, manage, and analyse ski tests across multiple disciplines and test types — from field glide tests to structured grind evaluations.</p>

<div class="sub-title">2.1 Test Types</div>
<div class="feature-grid">
  <div class="feature-card"><div class="fc-icon">🎿</div><h4>Glide</h4><p>Standard glide wax comparison. Products are compared head-to-head on flat or rolling terrain.</p></div>
  <div class="feature-card"><div class="fc-icon">📐</div><h4>Structure</h4><p>Compares ski base structures. Products refer to the structure tool, stone, or grind used.</p></div>
  <div class="feature-card"><div class="fc-icon">🏃</div><h4>Classic</h4><p>Classic skiing tests. Includes kick wax ranking alongside glide performance per ski.</p></div>
  <div class="feature-card"><div class="fc-icon">⛸️</div><h4>Skating</h4><p>Skating technique glide tests with standard performance ranking per ski.</p></div>
  <div class="feature-card"><div class="fc-icon">💪</div><h4>Double Poling</h4><p>Performance tests focused specifically on the double poling technique.</p></div>
  <div class="feature-card"><div class="fc-icon">⚙️</div><h4>Grind</h4><p>Evaluates base grind quality under specific conditions. Optionally linked to a grind profile.</p></div>
</div>

<div class="sub-title">2.2 Creating a Test</div>
<ul class="feat-list">
  <li>Set date, location, test name, test type, and ski source (test ski series or race skis).</li>
  <li>Link a weather/conditions log to provide full context for interpreting results.</li>
  <li>Link a ski series (test ski set) so ski numbers remain consistent across tests.</li>
  <li>Configure multiple distance rounds with custom labels (e.g. 0 km, 5 km, 10 km).</li>
  <li>Add optional free-text notes for the test as a whole.</li>
</ul>

<div class="sub-title">2.3 Test Entries — one per ski</div>
<ul class="feat-list">
  <li>Ski number (from the linked series).</li>
  <li>Product used — selected from the product catalogue, or entered as free text. Supports combination products (multiple products applied on one ski, tracked together).</li>
  <li>Application / method description (e.g. "2 layers, corked, iron 120°").</li>
  <li>Feeling rank — subjective quality rating by the tester.</li>
  <li>Kick rank — Classic tests only.</li>
  <li>Measured results and rank per distance round.</li>
</ul>

<!-- Mockup: test entry table -->
<div class="mockup-wrap">
  <div class="mockup-label">Glidr — Test Entry View · Ruka World Cup, Finland</div>
  <div class="mockup-screen">
    <div class="mockup-titlebar"><div class="dot"></div><div class="dot"></div>Test #38 — Ruka, Finland · 27 Nov 2025 · Glide · Jessie Diggins / Ben Ogden</div>
    <div class="mockup-body">
      <div class="mockup-row header"><span class="mockup-num">#</span><span class="mockup-prod">Product</span><span class="mockup-meth">Application</span><span class="mockup-rank">Feel</span><span class="mockup-res">0 km</span><span class="mockup-res">5 km</span></div>
      <div class="mockup-row"><span class="mockup-num">1</span><span class="mockup-prod">Swix PS6</span><span class="mockup-meth">2 layers, iron 120°</span><span class="mockup-rank">⭐⭐⭐⭐</span><span class="mockup-res">+0.0</span><span class="mockup-res">+0.2</span></div>
      <div class="mockup-row"><span class="mockup-num">2</span><span class="mockup-prod">HWK C9</span><span class="mockup-meth">1 layer, iron</span><span class="mockup-rank">⭐⭐⭐</span><span class="mockup-res">+0.5</span><span class="mockup-res">+0.8</span></div>
      <div class="mockup-row"><span class="mockup-num">3</span><span class="mockup-prod">Swix PS6 + Swix CG-250202</span><span class="mockup-meth">2+1 layers, cork</span><span class="mockup-rank">⭐⭐⭐⭐⭐</span><span class="mockup-res" style="color:var(--violet)">−0.4</span><span class="mockup-res" style="color:var(--violet)">−0.5</span></div>
      <div class="mockup-row"><span class="mockup-num">4</span><span class="mockup-prod">Toko Jet Liquid Black</span><span class="mockup-meth">2 layers, cork</span><span class="mockup-rank">⭐⭐⭐</span><span class="mockup-res">+0.3</span><span class="mockup-res">+0.6</span></div>
    </div>
  </div>
</div>

<div class="sub-title">2.4 AI Photo Entry</div>
<p>Photograph a completed test sheet in the field. Glidr's AI analyses the image and automatically extracts ski numbers, products, results, and rankings — dramatically reducing manual data entry time. Review and confirm the extracted data before saving.</p>

<div class="sub-title">2.5 Blind Testing</div>
<p>Users with Blind Tester mode enabled see ski numbers during testing but not product names, preventing confirmation bias. Product names are revealed after submission.</p>

<div class="sub-title">2.6 Garmin Watch Live Feed</div>
<p>Test results stream live to compatible Garmin devices during a session. Testers see incoming rankings in real time on their watch without needing to check a phone or laptop.</p>

<!-- ══════════════════════════════════════════════════════════ S3: PRODUCTS -->
<div class="section-title" style="margin-top:40px"><span class="section-num">3</span><h2>Products</h2></div>

<p>The Products module is the centralised catalogue of all wax, structure, and treatment products used by the team — both current and archived.</p>

<div class="sub-title">3.1 Product Catalogue</div>
<ul class="feat-list">
  <li>Each product has a category (Glide Wax, Kick Wax, Structure, Fluoro Overlay, etc.), brand, and name.</li>
  <li>Products can be archived when no longer in use, while retaining full historical test data.</li>
  <li>Stock quantity tracking: record how many units remain for each product.</li>
  <li>Stock change log: every stock adjustment is timestamped and attributed to a user.</li>
</ul>

<div class="sub-title">3.2 Compare Products</div>
<p>The Compare tab provides a side-by-side performance comparison of selected products across all tests they share. Select any number of products and review their relative rankings and results in context.</p>

<!-- Mockup: analytics bar chart -->
<div class="mockup-wrap">
  <div class="mockup-label">Glidr — Product Compare (Analytics) · US Ski Team — Ruka &amp; Falun 2025</div>
  <div class="mockup-screen">
    <div class="mockup-titlebar"><div class="dot"></div><div class="dot"></div>Compare Products · 18 shared tests · Cold &amp; Transformed Snow</div>
    <div class="mockup-analytics-bar">
      <div class="m-bar" style="height:85%"></div>
      <div class="m-bar" style="height:55%;background:var(--violet3)"></div>
      <div class="m-bar" style="height:98%"></div>
      <div class="m-bar" style="height:42%;background:var(--violet3)"></div>
      <div class="m-bar" style="height:72%"></div>
    </div>
    <div class="m-bar-label">
      <span>Swix PS6</span><span>HWK C9</span><span>PS6+CG-250202</span><span>Toko Jet Black</span><span>HWK UHX Warm</span>
    </div>
  </div>
</div>

<div class="sub-title">3.3 Combination Search</div>
<p>Find all tests where a specific combination of N products were used together on the same test. Add products one by one with the + button. Results link directly to the relevant test detail page.</p>

<!-- ══════════════════════════════════════════════════════════ S4: WEATHER -->
<div class="page-break"></div>

<div class="section-title"><span class="section-num">4</span><h2>Weather &amp; Conditions</h2></div>

<p>Accurate snow and air conditions are critical for interpreting test results. The Weather module provides a structured conditions log for every testing session, with 15 distinct fields covering the full range of relevant parameters.</p>

<!-- Mockup: weather grid -->
<div class="mockup-wrap">
  <div class="mockup-label">Glidr — Weather Entry · Ruka World Cup</div>
  <div class="mockup-screen">
    <div class="mockup-titlebar"><div class="dot"></div><div class="dot"></div>Ruka, Finland · 27 Nov 2025 · 08:45</div>
    <div class="mockup-weather-grid">
      <div class="mockup-weather-cell"><div class="val">−12°C</div><div class="lbl">Snow Temp</div></div>
      <div class="mockup-weather-cell"><div class="val">−8°C</div><div class="lbl">Air Temp</div></div>
      <div class="mockup-weather-cell"><div class="val">44%</div><div class="lbl">Snow Hum.</div></div>
      <div class="mockup-weather-cell"><div class="val">63%</div><div class="lbl">Air Hum.</div></div>
      <div class="mockup-weather-cell"><div class="val" style="font-size:.85rem">Transf.</div><div class="lbl">Snow Type</div></div>
      <div class="mockup-weather-cell"><div class="val" style="font-size:.85rem">Dry</div><div class="lbl">Hum. Type</div></div>
      <div class="mockup-weather-cell"><div class="val" style="font-size:.85rem">Hard</div><div class="lbl">Track</div></div>
      <div class="mockup-weather-cell"><div class="val">2/8</div><div class="lbl">Clouds</div></div>
    </div>
  </div>
</div>

<div class="sub-title">4.1 All 15 Conditions Fields</div>
<ul class="feat-list">
  <li><strong>Snow Temperature (°C)</strong> — measured at track level.</li>
  <li><strong>Air Temperature (°C)</strong> — ambient air temperature.</li>
  <li><strong>Snow Humidity (%)</strong> — moisture content in snow.</li>
  <li><strong>Air Humidity (%)</strong> — relative humidity.</li>
  <li><strong>Snow Type</strong> — Falling new / New / Irreg. dir. new / Irreg. dir. transf. / Transformed.</li>
  <li><strong>Snow Humidity Type</strong> — Dry / Moist / Wet / Very wet / Slush.</li>
  <li><strong>Track Hardness</strong> — Very soft / Soft / Medium hard / Hard / Very hard / Ice.</li>
  <li><strong>Grain Size</strong> — Extra fine / Very fine / Fine / Average / Coarse / Very coarse.</li>
  <li><strong>Cloud Cover</strong> — 0–8 oktas.</li>
  <li><strong>Wind</strong> — description or measured speed.</li>
  <li><strong>Precipitation</strong> — type and intensity.</li>
  <li><strong>Visibility</strong> — clear / reduced / poor.</li>
  <li><strong>Artificial Snow</strong> — proportion / notes.</li>
  <li><strong>Natural Snow</strong> — proportion / notes.</li>
  <li><strong>Test Quality</strong> — subjective overall rating 1–10.</li>
</ul>

<div class="sub-title">4.2 ★ Weather Station Integration <span class="badge badge-ta">Team Admin</span></div>
<p>Team Admins can connect a physical weather station. When creating a weather entry, a <em>Fetch from station</em> button retrieves and fills conditions data automatically for the selected date and time. Seven station types are supported:</p>
<div class="chip-row">
  <div class="chip"><div class="chip-dot"></div>Netatmo</div>
  <div class="chip"><div class="chip-dot"></div>Davis WeatherLink</div>
  <div class="chip"><div class="chip-dot"></div>Ambient Weather</div>
  <div class="chip"><div class="chip-dot"></div>Ecowitt</div>
  <div class="chip"><div class="chip-dot"></div>Weather Underground</div>
  <div class="chip"><div class="chip-dot"></div>Open-Meteo <span class="badge badge-free" style="margin-left:2px;padding:1px 6px;font-size:.65rem">Free</span></div>
  <div class="chip"><div class="chip-dot"></div>Generic HTTP</div>
</div>

<!-- ══════════════════════════════════════════════════════════ S5: ANALYTICS -->
<div class="section-title" style="margin-top:40px"><span class="section-num">5</span><h2>Analytics</h2></div>

<ul class="feat-list">
  <li><strong>Performance Overview</strong> — aggregated results per product, filterable by group, date range, test type, snow conditions, and temperature.</li>
  <li><strong>Combination Search</strong> — find all tests where N products were used together. Results link to each test detail page.</li>
  <li><strong>Compare Products</strong> — side-by-side rankings and results for selected products across all shared tests.</li>
  <li><strong>Raced Products</strong> — view products used in race preparations alongside the conditions recorded for each event.</li>
</ul>

<!-- ══════════════════════════════════════════════════════════ S6: RACE PREPS -->
<div class="section-title" style="margin-top:40px"><span class="section-num">6</span><h2>Race Preparations</h2></div>

<p>The Race Preps module records the final wax and equipment decisions made before a race, including full product details and per-athlete ski assignments.</p>

<div class="sub-title">6.1 Race Prep Contents</div>
<ul class="feat-list">
  <li>Race date, start time, location.</li>
  <li>Race type (Sprint / Distance / Skiathlon / etc.) and discipline (Classic / Skating / Free).</li>
  <li>Glide products, structure, and kick products — displayed as resolved product names.</li>
  <li>Application method and preparation notes.</li>
  <li>Grunning (binder) — kick zone notes.</li>
  <li>Linked weather/conditions log with full 15-field conditions display.</li>
</ul>

<div class="sub-title">6.2 Per-Athlete Entries</div>
<ul class="feat-list">
  <li>Each athlete's assigned ski(s) — glide, classic, and/or skating.</li>
  <li>Assigned waxer name.</li>
  <li>Individual notes per athlete.</li>
</ul>

<!-- ══════════════════════════════════════════════════════════ S7: ATHLETES -->
<div class="page-break"></div>

<div class="section-title"><span class="section-num">7</span><h2>Athletes &amp; Race Skis</h2></div>

<div class="sub-title">7.1 Athlete Profiles</div>
<p>Manage the athlete roster. Each athlete has a name, team affiliation, and a full personal race ski inventory.</p>

<div class="sub-title">7.2 Race Ski Inventory</div>
<ul class="feat-list">
  <li>Ski ID (custom label), serial number, brand, discipline.</li>
  <li>Construction type, mold, base material, grind.</li>
  <li>Height measurements, year of purchase.</li>
  <li>Archive retired skis while preserving all historical data.</li>
</ul>

<div class="sub-title">7.3 Regrind History</div>
<p>Log every base grind per ski: date, grind type, stone specification, pattern, and notes. Full history is preserved across the ski's lifetime.</p>

<div class="sub-title">7.4 Race Ski Tests</div>
<p>Tests run using race skis (rather than test ski series) are tracked per athlete. Provides a complete testing history linked to each individual ski.</p>

<!-- ══════════════════════════════════════════════════════════ S8: GRINDS -->
<div class="section-title" style="margin-top:40px"><span class="section-num">8</span><h2>Grinding</h2></div>

<ul class="feat-list">
  <li><strong>Grind Profiles</strong> — define and name base grind profiles: type, stone, pattern, extra parameters. Used as reference when logging regrind history.</li>
  <li><strong>Grinding Records</strong> — log grinding sessions with date, group scope, grind type, stone, and notes.</li>
  <li><strong>Linked Grinding Sheets</strong> — link external Google Sheets containing detailed grinding records for reference within Glidr and inclusion in backups.</li>
  <li><strong>Grind Tests</strong> — tests of type Grind evaluate base grind quality. Appear separately in analytics and backup, linked to relevant grind profiles.</li>
</ul>

<!-- ══════════════════════════════════════════════════════════ S9: GARMIN -->
<div class="section-title" style="margin-top:40px"><span class="section-num">9</span><h2>Garmin Watch Integration</h2></div>

<ul class="feat-list">
  <li>Native Garmin application that streams live test results to compatible Garmin devices.</li>
  <li>Testers wearing Garmin watches see incoming ski rankings in real time during a test session.</li>
  <li>The ski queue is managed from the test interface on any device.</li>
  <li>A Watch PIN authenticates the device to the correct team session.</li>
  <li>Watch operator name is recorded for each session.</li>
  <li>Compatible with Garmin devices supporting Connect IQ.</li>
</ul>

<!-- ══════════════════════════════════════════════════════════ S10: OFFLINE -->
<div class="section-title" style="margin-top:40px"><span class="section-num">10</span><h2>Offline Mode</h2></div>

<p>Glidr is built for use in the field, where internet connectivity is not always reliable. Core data entry works fully offline — tests, weather logs, and product entries are queued locally and synchronised automatically when the device reconnects. Offline status is clearly indicated throughout the interface.</p>

<!-- ══════════════════════════════════════════════════════════ S11: ACCOUNT -->
<div class="section-title" style="margin-top:40px"><span class="section-num">11</span><h2>My Account</h2></div>

<ul class="feat-list">
  <li>Update name and email address.</li>
  <li>Change account password (minimum 8 characters).</li>
  <li>Select interface language: English or Norwegian.</li>
  <li>Choose a personal accent colour for the interface.</li>
  <li>Team Watch — access the team's Garmin live feed.</li>
  <li>Team ID — reference number for support.</li>
  <li>Download my data — GDPR-compliant personal data export (JSON).</li>
</ul>

<!-- ══════════════════════════════════════════════════════════ S12: TA -->
<div class="page-break"></div>

<div class="section-title"><span class="section-num">12</span><h2>Team Admin Features <span class="badge badge-ta">★ Team Admin</span></h2></div>

<div class="box box-info">
  The features in this section are available exclusively to users with <strong>Team Admin</strong> or <strong>Super Admin</strong> role. They extend the standard member experience with team management capabilities.
</div>

<div class="sub-title">12.1 User Management <span class="badge badge-ta">★</span></div>
<ul class="feat-list">
  <li>View all team members: roles, active status, last login.</li>
  <li>Add and remove team members.</li>
  <li>Assign roles: Member or Team Admin.</li>
  <li>Enable or disable Blind Tester mode per user.</li>
  <li>Enable or disable Garmin watch access per user.</li>
  <li>Lock or unlock accounts (e.g. after repeated failed logins).</li>
  <li>Reset passwords.</li>
  <li>Assign group scope — which group(s) the user belongs to.</li>
  <li>Configure per-user feature access (see Section 13).</li>
</ul>

<div class="sub-title">12.2 Group Management <span class="badge badge-ta">★</span></div>
<ul class="feat-list">
  <li>Create and name groups (subteams within the organisation, e.g. by discipline or age group).</li>
  <li>All data — tests, products, weather logs, series — is scoped per group so each group sees its own data.</li>
  <li>Assign users to one or more groups.</li>
  <li>Multiple groups each receive their own dedicated sheet in the Google Sheets backup.</li>
</ul>

<div class="sub-title">12.3 Team Settings <span class="badge badge-ta">★</span></div>
<ul class="feat-list">
  <li>Team name.</li>
  <li>Enable or disable individual feature areas: Tests, Products, Weather, Analytics, Race Preps, Athletes, Grinds, Watch.</li>
  <li>Watch PIN — set or regenerate the PIN used to authenticate Garmin devices.</li>
</ul>

<div class="sub-title">12.4 Google Sheets Backup <span class="badge badge-ta">★</span></div>
<p>Glidr automatically backs up all team data to a linked Google Sheet every 30 minutes. The backup is structured to serve as a standalone database — accessible even if Glidr were unavailable:</p>
<ul class="feat-list">
  <li><strong>📋 Overview</strong> — summary counts, sheet index, per-group statistics.</li>
  <li><strong>👥 Team Members</strong> — all users, roles, and account settings.</li>
  <li><strong>📂 [Group]</strong> — one sheet per group: products, test ski series, weather logs.</li>
  <li><strong>🧪 Product Tests</strong> — all Glide / Classic / Skating / Double Poling tests as a flat table with all 15 conditions fields. Each test has a bold header row for clear navigation.</li>
  <li><strong>📐 Structure Tests</strong> — all Structure tests in the same flat format.</li>
  <li><strong>⛷️ Grind Tests</strong> — all Grind tests in the same flat format.</li>
  <li><strong>🏁 Race Preps</strong> — race preps with resolved product names, application method, conditions, and per-athlete entries.</li>
  <li><strong>🏃 [Athlete]</strong> — one sheet per athlete: race skis, regrind history, race ski tests.</li>
  <li><strong>⚙️ Grinds</strong> — grind profiles, grinding records, linked external sheets.</li>
  <li><strong>📦 Stock Changes</strong> — full product stock change history.</li>
</ul>

<div class="sub-title">12.5 Weather Station Integration <span class="badge badge-ta">★</span></div>
<p>Connect a physical weather station to enable automatic weather data fill-in when creating entries. See Section 4.2 for supported station types. Configuration is stored server-side — API credentials are never exposed to the browser.</p>

<div class="sub-title">12.6 Activity &amp; Audit Log <span class="badge badge-ta">★</span></div>
<ul class="feat-list">
  <li>Full log of team activity: who created, edited, or deleted data and when.</li>
  <li>Login history with timestamps.</li>
  <li>Stock change audit trail (also visible to members with stock access).</li>
</ul>

<div class="sub-title">12.7 Data Management <span class="badge badge-ta">★</span></div>
<ul class="feat-list">
  <li>Export complete team dataset as PDF or spreadsheet.</li>
  <li>Selective data deletion with confirmation dialogs.</li>
  <li>Archive management across all modules.</li>
</ul>

<!-- ══════════════════════════════════════════════════════════ S13: PERMISSIONS -->
<div class="page-break"></div>

<div class="section-title"><span class="section-num">13</span><h2>Permission System</h2></div>

<p>Team Admins can control which feature areas each member can access. Access is binary: a user either has access to a feature area, or they do not.</p>

<div class="sub-title">13.1 Feature Areas</div>
<p>Permissions can be toggled individually for each of the following areas per user:</p>

<table class="perm-table">
  <thead><tr><th>Feature Area</th><th>What it covers</th></tr></thead>
  <tbody>
    <tr><td><strong>Tests</strong></td><td>Create, view, and manage all test types and entries.</td></tr>
    <tr><td><strong>Products</strong></td><td>Browse and manage the product catalogue and stock.</td></tr>
    <tr><td><strong>Weather</strong></td><td>Log and view weather/conditions entries.</td></tr>
    <tr><td><strong>Analytics</strong></td><td>Access the analytics module, combination search, and product compare.</td></tr>
    <tr><td><strong>Race Preparations</strong></td><td>View and create race prep entries.</td></tr>
    <tr><td><strong>Athletes</strong></td><td>Manage athlete profiles and race ski inventories.</td></tr>
    <tr><td><strong>Grinding</strong></td><td>Manage grind profiles, records, and linked sheets.</td></tr>
    <tr><td><strong>Watch</strong></td><td>Access the Garmin watch live feed.</td></tr>
  </tbody>
</table>

<div class="box box-warning">
  <strong>Access is all-or-nothing per area.</strong> A user either has full access to a feature area or none at all. A Team Admin can also disable an entire feature area for the whole team via Team Settings.
</div>

<div class="sub-title">13.2 How to Configure</div>
<p>Team Admins manage permissions from the Admin → Users section. Select a user and toggle access per area. Changes take effect immediately on the user's next page load.</p>

<!-- ══════════════════════════════════════════════════════════ S14: LEGAL -->
<div class="page-break"></div>

<div class="section-title"><span class="section-num">14</span><h2>Competitive Reservation &amp; Legal</h2></div>

<div class="box box-danger">
  <strong>⚠ Restricted use.</strong> The features, workflows, and data models described in this document are proprietary to Glidr. Reading this document does not grant any licence to reproduce, replicate, or be inspired by these concepts in a competing product.
</div>

<div class="legal-block">
  <h3>14.1 Trade Secrets</h3>
  <p>The specific combination of features, data models, user workflows, and integration patterns described in this document constitutes a trade secret of Glidr. This includes, but is not limited to: the test entry model with multi-product combination tracking, the AI photo entry workflow, the integrated Garmin live-feed architecture, the per-athlete race ski assignment model, the Google Sheets backup schema, the weather station auto-fill integration, and the blind testing workflow.</p>
</div>

<div class="legal-block">
  <h3>14.2 Prohibited Uses</h3>
  <p>Without the express written consent of Glidr, the following are strictly prohibited:</p>
  <ul class="feat-list">
    <li>Using this document as a reference or specification for designing a competing ski testing, wax management, or performance tracking platform.</li>
    <li>Sharing this document with any person or organisation developing competitive software.</li>
    <li>Reproducing feature descriptions, workflows, or data models in any public or private technical specification.</li>
    <li>Training any artificial intelligence or machine learning model using this document's content.</li>
    <li>Disclosing the existence or contents of this document to any competitor of Glidr.</li>
  </ul>
</div>

<div class="legal-block">
  <h3>14.3 Enforcement</h3>
  <p>Glidr reserves all rights to seek injunctive relief, damages, and any other available legal remedies against any party found to have violated these terms. If you have received this document without authorisation, please contact Glidr immediately and destroy all copies.</p>
</div>

<div class="divider"></div>
<p style="text-align:center;font-size:.85rem;color:var(--muted)"><strong style="color:var(--dark)">© 2025 Glidr. All rights reserved.</strong><br/>Proprietary and confidential. Unauthorised use is prohibited.</p>

<!-- Footer -->
<div class="doc-footer no-print">
  <span>Glidr Feature Guide — Confidential</span>
  <span>Generated: ${genDate}</span>
</div>

</div><!-- /doc -->

<script>
// Auto-trigger print if opened from Download button
if (window.opener) {
  window.addEventListener('load', () => {
    setTimeout(() => window.print(), 800);
  });
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
