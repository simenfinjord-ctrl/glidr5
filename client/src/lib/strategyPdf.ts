// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Generates the confidential Glidr Strategy Document as a clean, print-ready
// HTML document opened in a new tab. Use browser File → Print → Save as PDF.
// Super-Admin only (owner document): strategy, product/system, development,
// commercialization, pricing, IP/rights, exit and risk.

export function generateStrategyPDF(): void {
  const genDate = new Date().toLocaleDateString("nb-NO", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="nb">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Glidr — Strategidokument (Konfidensielt)</title>
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
    <div class="title">Strategidokument</div>
    <div class="sub">Strategi · System · Utvikling · Kommersialisering · Priser · Rettigheter</div>
    <div class="meta">STRENGT KONFIDENSIELT · Kun for eier / Super Admin · Generert ${genDate}</div>
  </div>

  <div class="box box-warning"><strong>Konfidensielt eierdokument.</strong> Dette dokumentet inneholder Glidrs forretningsstrategi, priser og immaterielle rettigheter. Det skal ikke deles med lag, forbund eller tredjeparter. Prisspenn er veiledende utgangspunkt som må valideres i marked og kvalitetssikres av regnskapsfører/advokat før avtaler inngås — de er ikke finansielle råd.</div>

  <div class="section-title"><span class="section-num">TOC</span><h2>Innhold</h2></div>
  <div class="toc-entry"><span>1. Sammendrag &amp; visjon</span><span></span></div>
  <div class="toc-entry"><span>2. Strategi &amp; posisjonering</span><span></span></div>
  <div class="toc-entry"><span>3. Marked &amp; kunder</span><span></span></div>
  <div class="toc-entry"><span>4. Systemet (produkt &amp; teknologi)</span><span></span></div>
  <div class="toc-entry"><span>5. Utvikling &amp; veikart</span><span></span></div>
  <div class="toc-entry"><span>6. Kommersialisering</span><span></span></div>
  <div class="toc-entry"><span>7. Priser</span><span></span></div>
  <div class="toc-entry"><span>8. Rettigheter (IP &amp; juridisk)</span><span></span></div>
  <div class="toc-entry"><span>9. Exit &amp; salgbarhet</span><span></span></div>
  <div class="toc-entry"><span>10. Risiko &amp; tiltak</span><span></span></div>
  <div class="toc-entry"><span>11. Handlingsplan neste 12 måneder</span><span></span></div>

  <!-- 1 -->
  <div class="page-break"></div>
  <div class="section-title"><span class="section-num">1</span><h2>Sammendrag &amp; visjon</h2></div>
  <p>Glidr er et system for ski-testing og smøring som gjør testdata om til trygge, raske beslutninger på renndagen. Det brukes i dag operativt av topp-miljøer (bl.a. det amerikanske skimiljøet) og dekker glidtesting, struktur, slip, kick, race-ski per utøver, værforhold, analyse og race-prep — på tvers av flere lag.</p>
  <h3>Visjon</h3>
  <p>Å være den bransjestandarden elite-smøreteam stoler på: et trygt, effektivt og smart system som gjør hverdagen enklere og hjelper dem å ta riktige valg.</p>
  <h3>Kjerneidé (hvorfor Glidr vinner)</h3>
  <ul>
    <li><strong>Data + referanse er vollgraven.</strong> Verdien ligger i akkumulerte testdata koblet til forhold, og i å være innbakt hos et anerkjent forbund. Det er vanskelig å kopiere.</li>
    <li><strong>Beslutning, ikke bare logg.</strong> Neste steg er å gå fra «logg» til «beslutningsmotor» (anbefaling + konfidens) — det ingen konkurrent har.</li>
    <li><strong>Tillit.</strong> Datatrygghet, sporbarhet, backup og eksport gjør at proffe brukere tør å legge alt inn.</li>
  </ul>

  <!-- 2 -->
  <div class="section-title"><span class="section-num">2</span><h2>Strategi &amp; posisjonering</h2></div>
  <p>Strategien er en <strong>sekvens</strong>, ikke et enten/eller. Rekkefølgen bygger vollgrav før prising:</p>
  <table>
    <tr><th>Fase</th><th>Mål</th><th>Utfall</th></tr>
    <tr><td>1. Pilot (denne vinteren)</td><td>Gi forbundet full tilgang gratis, mot reell bruk</td><td>Herdet produkt, brukerdata, testimonial, referansen «brukt av landslag»</td></tr>
    <tr><td>2. Konverter</td><td>Gjør pilotforbundet til betalende (årlig lisens)</td><td>Første gjentakende inntekt (ARR), varm og bevist</td></tr>
    <tr><td>3. Ekspander</td><td>Selg til andre forbund, landslag, klubber (langrenn, skiskyting, alpint …)</td><td>Voksende ARR, flere referanser</td></tr>
    <tr><td>4. Fordyp</td><td>Beslutningsmotor + integrasjoner øker verdi og innlåsing (positiv: bytting koster)</td><td>Høyere pris + lavere frafall</td></tr>
    <tr><td>5. (Valgfritt) Exit</td><td>Selg hele forretningen til multiplum av ARR</td><td>Stor engangssum <em>i tillegg til</em> inntekten du bygde</td></tr>
  </table>
  <div class="box box-ok"><strong>Posisjonering:</strong> Ikke «enda en app» — et <strong>misjonskritisk fagverktøy</strong> for velfinansierte organisasjoner. Anker verdi mot renn-resultater og kostnaden ved et smøreteam, ikke mot forbrukerpriser.</div>

  <!-- 3 -->
  <div class="section-title"><span class="section-num">3</span><h2>Marked &amp; kunder</h2></div>
  <h3>Hvem betaler (B2B, organisasjoner)</h3>
  <ul>
    <li><strong>Nasjonale forbund / landslag</strong> — primær. Velfinansiert, misjonskritisk behov, årsbudsjett.</li>
    <li><strong>Elite-klubber og team</strong> — sekundær, større volum, lavere pris.</li>
    <li><strong>Tilstøtende idretter</strong> — skiskyting, alpint, kombinert, rulleski; samme kjernebehov.</li>
  </ul>
  <h3>Verdiforslag</h3>
  <p>Raskere ski oftere, færre feilvalg på renndagen, sporbarhet og struktur på et arbeid som i dag ofte lever i hoder og regneark. Ett godt valg kan avgjøre et renn — det er verdiankeret.</p>
  <h3>Konkurranse</h3>
  <p>Regneark og notater (status quo), interne hjemmesnekrede løsninger, og generelle logg-verktøy. Ingen dekker hele kjeden (test → forhold → analyse → anbefaling → race-prep) spesialisert for smøring. Glidrs forsprang er dybde + referanse.</p>

  <!-- 4 -->
  <div class="page-break"></div>
  <div class="section-title"><span class="section-num">4</span><h2>Systemet (produkt &amp; teknologi)</h2></div>
  <h3>Teknisk grunnmur</h3>
  <ul>
    <li><strong>Frontend:</strong> React + TypeScript (Vite), mobil- og PC-vennlig, flerspråklig (NO/EN).</li>
    <li><strong>Backend:</strong> Express + PostgreSQL (Drizzle ORM). Rolle-/lag-basert tilgangskontroll.</li>
    <li><strong>Drift:</strong> Render (web + database). Portabelt oppsett — kan flyttes/selv-hostes.</li>
    <li><strong>Integrasjoner:</strong> Værstasjoner, Google Sheets/Drive-backup, Garmin-klokkeapp, AI-anbefalinger.</li>
  </ul>
  <h3>Funksjonsområder</h3>
  <p>Tester (glid/struktur/slip/kick), produkter &amp; lager, vær &amp; forhold, analyse, race-prep, race-ski per utøver (garasje, slipehistorikk), race fleets (lag-ski), kick, live runsheets, watch-kø, flerlagsstøtte, «Alle lag»-visning, sammenlign tester.</p>
  <h3>Tillit &amp; drift (det som gjør proffe brukere trygge)</h3>
  <ul>
    <li>Rolle-/lag-isolasjon (Super Admin, Team Admin, medlem, utøvertilgang) med per-lag rettigheter.</li>
    <li>Sporbarhet / revisjonslogg med snapshot av slettede poster (chain of custody).</li>
    <li>Daglig backup (JSON + PDF) til Google Drive; kvote-/bruksoversikt per lag.</li>
    <li>Innlogging med enhetssporing (førsteparts, ikke overvåkning) og tvungen utlogging.</li>
  </ul>
  <div class="box box-info"><strong>Prinsipp:</strong> Ingen leverandørinnlåsing. Full dataeksport og portabel kode er både en salgs­fordel <em>og</em> en tillitsfaktor for kundene.</div>

  <!-- 5 -->
  <div class="section-title"><span class="section-num">5</span><h2>Utvikling &amp; veikart</h2></div>
  <h3>Prioritet 1 — Datareliabilitet &amp; bevis (pågår)</h3>
  <ul>
    <li>Papirkurv / soft-delete med gjenoppretting (30 dager) — bygger på sporbarheten.</li>
    <li>Synlig backup-verifisering («Siste vellykkede backup … ✓») med varsel ved feil.</li>
    <li>Ett-klikks full dataeksport (JSON/Excel) — dreper både datafrykt og innlåsings­frykt.</li>
    <li>Utvidet revisjonslogg til endringer (før/etter), ikke bare sletting.</li>
  </ul>
  <h3>Prioritet 2 — Offline som faktisk virker</h3>
  <p>Se alle data og legg inn tester uten dekning, med kø og konfliktsynk. Gjøres i etapper og testes grundig — halvveis offline er verre enn ingen.</p>
  <h3>Deretter — Beslutningsmotor (den store verdien)</h3>
  <ul>
    <li>Signifikans på resultater («klar vinner» vs «for tett»).</li>
    <li>Værvarsel-drevet anbefaling med konfidens og støttende tester.</li>
    <li>Varsel-motor (forhold endret, lavt lager, ski bør slipes, ny pålogging).</li>
  </ul>
  <h3>Utviklingsprinsipper</h3>
  <p>Bygg salgbart fra dag én: ren IP, portabilitet, dokumentasjon, verifiserbar backup. Alt som fjerner en kundes «dealbreaker» øker samtidig salgsverdien.</p>

  <!-- 6 -->
  <div class="section-title"><span class="section-num">6</span><h2>Kommersialisering</h2></div>
  <h3>Modell: abonnement — ikke engangssalg</h3>
  <p>Gjentakende årlig inntekt er det som gjør forretningen verdifull. Å selge hele produktet nå (før inntekt) kapper oppsiden. Selg heller <strong>abonnement</strong>, og vurder å selge <em>forretningen</em> senere til et multiplum av ARR.</p>
  <h3>Pilot-strategi (kritisk)</h3>
  <div class="box box-warning"><strong>Ramm «gratis i vinter» inn som en pilot, ikke en gave.</strong> Skriftlig, med definert slutt og uttalt intensjon om betaling neste sesong. Ellers blir «gratis» ankeret og forbundet vrir seg unna betaling. Til gjengjeld: bruk sesongen til å hente testimonial, bruksdata og referansen.</div>
  <h3>Gå-til-marked</h3>
  <ul>
    <li>Bruk pilotforbundet som referanse for å åpne dører hos andre forbund.</li>
    <li>Årlige kontrakter tilpasset skisesongen (forbund har årsbudsjett).</li>
    <li>Oppsalg via nivåer og tillegg (analyse, watch-app, multi-team, beslutningsmotor).</li>
  </ul>

  <!-- 7 -->
  <div class="page-break"></div>
  <div class="section-title"><span class="section-num">7</span><h2>Priser</h2></div>
  <p class="muted">Verdibasert, ikke kostnadsbasert. Nivådelt lisens per organisasjon, fakturert årlig. Spennene under er <strong>veiledende utgangspunkt å teste</strong> — start høyt, gi heller «grunnleggerrabatt». Valider i marked; ikke finansielle råd.</p>
  <table>
    <tr><th>Plan</th><th>Typisk kunde</th><th>Inkluderer (grovt)</th><th>Veiledende år/organisasjon</th></tr>
    <tr><td><strong>Free / Pilot</strong></td><td>Referanse-/pilotforbund, prøvebruk</td><td>Full tilgang i avtalt periode</td><td>0 (tidsbegrenset, med intensjon om betaling)</td></tr>
    <tr><td><strong>Starter</strong></td><td>Liten klubb / enkeltlag</td><td>Tester, produkter, vær, PDF-eksport</td><td>~ noen hundre – 1–2 k</td></tr>
    <tr><td><strong>Team</strong></td><td>Aktivt lag / mindre program</td><td>+ analyse, slip, forslag, backup, blindtest</td><td>~ 2 k – 6 k</td></tr>
    <tr><td><strong>Pro</strong></td><td>Elite-program / stort lag</td><td>+ race-ski, kick, race-prep, watch, live runsheets</td><td>~ 6 k – 15 k</td></tr>
    <tr><td><strong>Enterprise</strong></td><td>Nasjonalt forbund (flere lag)</td><td>Alt + multi-team, bulk-eksport, egendefinerte grupper, prioritert support</td><td>~ 15 k – 25 k+</td></tr>
  </table>
  <p class="muted">Valuta og nivåer tilpasses marked (NOK/USD/EUR). Prisdrivere: antall smørere/utøvere, antall lag, funksjonsnivå, support-nivå.</p>
  <div class="box box-ok"><strong>Prinsipp:</strong> Riktig pris oppdages, ikke regnes ut. De fleste misjonskritiske B2B-verktøy er <strong>under</strong>priset. Anker mot verdien av ett renn-resultat.</div>

  <!-- 8 -->
  <div class="section-title"><span class="section-num">8</span><h2>Rettigheter (IP &amp; juridisk)</h2></div>
  <h3>Eierskap</h3>
  <p>Glidr (kode, design, datamodell, merkevare, domenet glidr.no) eies i sin helhet av grunnleggeren. Hold eierskapet <strong>rent og udelt</strong>: ingen kode med lisenser som blokkerer salg, ingen medforfattere med rettighetskrav. Dokumentér tredjeparts-avhengigheter og lisenser.</p>
  <h3>Konfidensialitet &amp; konkurransereservasjon</h3>
  <p>Funksjoner, arbeidsflyt og datamodell er proprietære. Interne dokumenter (funksjonsguide, dette dokumentet) er konfidensielle og skal ikke brukes til å bygge et konkurrerende produkt.</p>
  <h3>Kundedata &amp; personvern</h3>
  <ul>
    <li>Data tilhører kunden; Glidr er databehandler. Ha en enkel databehandleravtale klar.</li>
    <li>Kun funksjonelle informasjonskapsler; ingen sporings-/markedsføringskapsler.</li>
    <li>Overføring av kundedata (f.eks. ved salg) krever varsel/samtykke — enkelt når kjøperen er kunden.</li>
  </ul>
  <h3>Vilkår</h3>
  <p>Vilkårene forbeholder retten til å ta betalt / justere pris (fortsatt bruk = aksept) og til å endre/begrense tjenesten. Gratis nå betyr ikke gratis for alltid.</p>

  <!-- 9 -->
  <div class="section-title"><span class="section-num">9</span><h2>Exit &amp; salgbarhet</h2></div>
  <p>Enkleste vei er et <strong>asset-salg</strong> (selg produktet/IP-en), helst til noen som allerede bruker det — forbundet selv. Alternativt aksjesalg hvis Glidr er et AS med inntekt.</p>
  <h3>Salgspakken</h3>
  <p>Kildekode + IP, domene + merkevare, den kjørende tjenesten (kunder/data/kontrakter), tredjeparts-oppsett, og «slik driftes det»-dokumentasjon.</p>
  <h3>Klargjøring (det som gjør salget enkelt)</h3>
  <ul>
    <li>Ren IP, portabel kode, verifiserbar backup, full eksport (alt vi bygger nå).</li>
    <li>Datarom: kode, drifts-doc, kundeliste, inntekter, kostnader.</li>
    <li>Kort overgangsperiode (1–3 mnd) for trygg overtakelse.</li>
  </ul>
  <div class="box box-info"><strong>Verdivurdering (til orientering):</strong> SaaS prises typisk som et multiplum av årlig gjentakende inntekt (ARR). Uten inntekt verdsettes det på kode + kunderelasjoner + strategisk verdi. Å være innbakt hos et anerkjent forbund er stor strategisk verdi. Konkret pris og skatt: bruk advokat/regnskapsfører.</div>

  <!-- 10 -->
  <div class="section-title"><span class="section-num">10</span><h2>Risiko &amp; tiltak</h2></div>
  <table>
    <tr><th>Risiko</th><th>Tiltak</th></tr>
    <tr><td>Datatrygghet (kundens dealbreaker)</td><td>Papirkurv, backup-verifisering, eksport, revisjonslogg (Prioritet 1)</td></tr>
    <tr><td>Offline i felt (dealbreaker)</td><td>Solid offline i etapper, grundig testet (Prioritet 2)</td></tr>
    <tr><td>«Gratis» blir permanent</td><td>Skriftlig pilotavtale med betalingsintensjon</td></tr>
    <tr><td>Leverandøravhengighet (Render, DB)</td><td>Portabel kode, backup, ingen innlåsing</td></tr>
    <tr><td>Nøkkelpersonrisiko (solo-utvikler)</td><td>Dokumentasjon, ren struktur, gjør drift overførbar; vurder partner/støtte</td></tr>
    <tr><td>Underprising</td><td>Verdibasert, start høyt, bruk referanse til å forsvare pris</td></tr>
  </table>

  <!-- 11 -->
  <div class="section-title"><span class="section-num">11</span><h2>Handlingsplan neste 12 måneder</h2></div>
  <ul>
    <li><strong>Vinter:</strong> Kjør gratis pilot (skriftlig, med betalingsintensjon). Fullfør Prioritet 1 (datareliabilitet). Samle testimonial + bruksdata.</li>
    <li><strong>Vår:</strong> Fullfør robust offline (Prioritet 2). Etabler databehandleravtale, prisark og pilot→betalt-plan.</li>
    <li><strong>Sommer:</strong> Konverter pilotforbundet til betalende årsavtale. Start beslutningsmotor (signifikans + anbefaling).</li>
    <li><strong>Høst:</strong> Ekspander til 1–2 nye forbund/lag med referansen. Bygg ARR.</li>
    <li><strong>Gjennomgående:</strong> Hold IP rent og produktet salgbart — så exit alltid er en åpen mulighet, ikke en tvang.</li>
  </ul>

  <div class="divider"></div>
  <p style="text-align:center" class="muted"><strong style="color:var(--dark)">© 2025 Glidr. Med enerett.</strong><br/>Strengt konfidensielt eierdokument. Uautorisert bruk er forbudt.</p>

  <div class="footer no-print">
    <span>Glidr Strategidokument — Konfidensielt</span>
    <span>Generert: ${genDate}</span>
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
