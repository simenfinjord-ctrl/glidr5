// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Generates a DRAFT Letter of Intent (pilot collaboration) as a print-ready
// HTML document opened in a new tab. Use browser File → Print → Save as PDF.
//
// This is a non-binding draft template for discussion only — it is NOT legal
// advice and must be reviewed by qualified counsel before use.

export function generateLetterOfIntentPDF(): void {
  const genDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Glidr — Letter of Intent (Draft)</title>
<style>
  :root { --violet:#6d28d9; --dark:#111827; --muted:#6b7280; --line:#e5e7eb; --bg-soft:#f9fafb; --amber:#b45309; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif; color:var(--dark); font-size:11pt; line-height:1.6; background:#fff; }
  .doc { max-width:800px; margin:0 auto; padding:28px 34px 60px; }
  h1 { font-size:20pt; font-weight:800; letter-spacing:-.01em; }
  h2 { font-size:12.5pt; font-weight:700; color:var(--violet); margin:20px 0 4px; }
  p { margin:7px 0; }
  ol { margin:6px 0 6px 20px; } ul { margin:6px 0 6px 22px; }
  li { margin:5px 0; }
  strong { font-weight:700; }
  .muted { color:var(--muted); }
  .box { border-radius:8px; padding:10px 14px; margin:14px 0; font-size:10pt; border:1px solid var(--line); }
  .box-warning { background:#fffbeb; border-color:#fde68a; }
  .box-info { background:#eff6ff; border-color:#bfdbfe; }
  .head { border-bottom:3px solid var(--violet); padding-bottom:14px; margin-bottom:14px; }
  .logo { font-size:22pt; font-weight:900; letter-spacing:.06em; color:var(--violet); }
  .meta { font-size:9.5pt; color:var(--muted); margin-top:4px; }
  .parties { display:flex; gap:24px; margin:14px 0; }
  .party { flex:1; border:1px solid var(--line); border-radius:8px; padding:10px 12px; font-size:10pt; }
  .party .role { font-size:8.5pt; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); font-weight:700; }
  .fill { color:var(--muted); font-style:italic; }
  .sig { display:flex; gap:40px; margin-top:36px; }
  .sig .col { flex:1; }
  .sig .line { border-top:1px solid var(--dark); margin-top:40px; padding-top:5px; font-size:9.5pt; color:var(--muted); }
  .footer { margin-top:34px; padding-top:10px; border-top:1px solid var(--line); display:flex; justify-content:space-between; font-size:9pt; color:var(--muted); }
  @media print { .no-print{display:none!important} @page{ margin:18mm; size:A4; } }
</style>
</head>
<body>
<div class="doc">

  <div class="head">
    <div class="logo">GLIDR</div>
    <h1 style="margin-top:8px">Letter of Intent — Pilot Collaboration</h1>
    <div class="meta">Draft for discussion · Non-binding · ${genDate}</div>
  </div>

  <div class="box box-warning"><strong>DRAFT — not legal advice.</strong> This template is provided to structure a good-faith conversation. It must be reviewed and adapted by qualified legal counsel (and verified against the counterparty's contracting rules) before signing. Bracketed [fields] are to be completed.</div>

  <p>This Letter of Intent (the "LOI") records the mutual intent of the parties below to collaborate on a pilot of the Glidr platform during the upcoming season.</p>

  <div class="parties">
    <div class="party">
      <div class="role">Provider</div>
      <strong>Glidr</strong> (the "Provider")<br/>
      Owner: Simen Finjord<br/>
      <span class="fill">[Business/registration details]</span><br/>
      <span class="fill">[Address, email]</span>
    </div>
    <div class="party">
      <div class="role">Pilot Partner</div>
      <strong>U.S. Ski Team</strong> (the "Partner")<br/>
      <span class="fill">[Legal entity / department]</span><br/>
      <span class="fill">[Authorised contact]</span><br/>
      <span class="fill">[Address, email]</span>
    </div>
  </div>

  <h2>1. Purpose</h2>
  <p>The Provider will give the Partner access to the Glidr platform for the upcoming season so the Partner can use it operationally, and in return the Partner will provide feedback that helps develop and harden the product. Both parties intend, in good faith, to transition to a paid arrangement thereafter.</p>

  <h2>2. Pilot period</h2>
  <p>The pilot runs from <span class="fill">[start date]</span> to <span class="fill">[end date / end of the season]</span> (the "Pilot Period"), unless extended in writing by both parties.</p>

  <h2>3. Access &amp; scope (during the Pilot Period)</h2>
  <ul>
    <li>The Provider grants the Partner full access to the agreed Glidr features <strong>at no charge</strong> for the Pilot Period.</li>
    <li>Access is for the Partner's internal use by its authorised staff and athletes.</li>
    <li>The Provider will make reasonable efforts to keep the service available and to address issues, but provides it on an "as is" pilot basis without warranties or uptime guarantees.</li>
  </ul>

  <h2>4. Partner's contribution</h2>
  <ul>
    <li>Use the platform in real conditions during the season and provide practical feedback (issues, needs, improvements).</li>
    <li>Nominate a point of contact for feedback and, where possible, allow a reference/testimonial about the collaboration (subject to the Partner's approval of any public wording).</li>
  </ul>

  <h2>5. Commercial terms after the pilot (expected costs)</h2>
  <ul>
    <li>The parties acknowledge that Glidr is a commercial product and that <strong>costs are to be expected after the Pilot Period</strong>. From the following season the product will be available on a paid basis (behind a paywall).</li>
    <li>Pricing, plan and scope for the paid period will be agreed in a separate definitive agreement. The Provider will present indicative pricing in good time before the Pilot Period ends.</li>
    <li>Continuing to use the paid product after the Pilot Period constitutes acceptance of the then-agreed commercial terms.</li>
  </ul>

  <h2>6. Data ownership &amp; portability (no lock-in)</h2>
  <ul>
    <li>All data the Partner enters remains the Partner's property. The Provider acts as processor of that data on the Partner's behalf.</li>
    <li>If the Partner chooses not to continue after the Pilot Period, the Partner may <strong>export all of its data</strong> (including data from the pilot season) in a portable format at no charge.</li>
    <li>On written request after termination, the Provider will delete the Partner's data (subject to any minimal retention required by law), and confirm deletion.</li>
  </ul>

  <h2>7. Intellectual property</h2>
  <p>The Glidr platform — including its software, design, data model and brand — is and remains the exclusive property of the Provider. Nothing in this LOI transfers any ownership of the platform to the Partner. The Partner receives only a limited right to use the service during the Pilot Period.</p>

  <h2>8. Confidentiality</h2>
  <p>Each party will keep the other's non-public information (including pricing, product internals and the Partner's operational data) confidential and use it only for the purpose of this collaboration.</p>

  <h2>9. Nature of this letter</h2>
  <p>This LOI reflects the parties' current intentions and is <strong>non-binding</strong>, except for Sections 6 (data portability), 7 (IP) and 8 (Confidentiality), which the parties intend to be binding. A binding relationship for the paid period will arise only under a separate, signed definitive agreement. Either party may end the pilot on <span class="fill">[e.g. 14]</span> days' written notice.</p>

  <h2>10. Governing law</h2>
  <p>The parties will discuss and agree governing law and dispute resolution in the definitive agreement <span class="fill">[e.g. law of [jurisdiction]]</span>.</p>

  <div class="sig">
    <div class="col">
      <div class="line">Provider — Glidr (Simen Finjord)</div>
      <p class="muted" style="margin-top:6px">Name / Date</p>
    </div>
    <div class="col">
      <div class="line">Pilot Partner — U.S. Ski Team</div>
      <p class="muted" style="margin-top:6px">Name / Title / Date</p>
    </div>
  </div>

  <div class="box box-info" style="margin-top:26px"><strong>Reminder:</strong> This is a starting point, not a finished contract. Have counsel confirm structure, the binding/non-binding split, data-protection wording, and the counterparty's required terms before sending.</div>

  <div class="footer no-print">
    <span>Glidr — Letter of Intent (Draft)</span>
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
