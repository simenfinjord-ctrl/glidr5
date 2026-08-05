# GLIDR — Komplett produktspesifikasjon («Oppskriften»)

> Dette dokumentet beskriver hele Glidr slik det fungerer i dag (per august 2026),
> detaljert nok til at applikasjonen kan gjenskapes fra bunnen av. Last det opp
> til en KI sammen med instruksjonen «bygg dette», så skal alle funksjoner,
> regler og datamodeller komme med.

---

## 1. Hva Glidr er

Glidr (glidr.no) er en SaaS for **skismøreteam** i langrenn/para-langrenn:
strukturert testing av ski og smøreprodukter, skiparkforvaltning, værlogging,
renn-forberedelse og analyse. Pilotkunder: US Ski Team (US XC) og US Para.
Produkteier: Simen Finjord. Språk: engelsk UI med norsk oversettelse (i18n,
`L("norsk","english")`-mønster); brukervalgt språk per konto.

**Kjerneidé:** Alt et smøreteam gjør — glidtester, feltvalg, smøring, vær,
rennbruk — logges én gang og gjenbrukes overalt: analyse, forslag, historikk.

---

## 2. Teknisk arkitektur

- **Klient:** React 18 + TypeScript, Vite, wouter (routing), TanStack Query
  (server-state), shadcn/ui + Tailwind, Recharts (grafer). PWA med
  pull-to-refresh og offline-kø (mutasjoner køes i localStorage når offline og
  spilles av ved reconnect; feltbruk uten dekning er et hovedscenario).
- **Server:** Node/Express + TypeScript i én stor `server/routes.ts` (~14k
  linjer), Passport (lokal + Google OAuth), express-session med Postgres
  session-store, drizzle-orm mot **PostgreSQL** (Neon/Render). Migrasjoner:
  additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + `CREATE TABLE IF NOT
  EXISTS` i en oppstarts-SQL-blokk; datamigrasjoner som idempotente async IIFE-er.
- **Hosting:** Render (web service) + GitHub (`simenfinjord-ctrl/glidr5`, main
  = produksjon, auto-deploy).
- **Filer:** Cloudflare R2 for testvedlegg (bilder/PDF), legacy base64 i DB.
- **E-post:** transaksjonsmail (velkomst, invitasjon, passord-reset).
- **AI:** OpenAI (gpt-4o-mini e.l.) for bildeskanning av testark; Groq som
  fallback med modell-kandidatliste (env-override → maverick → scout).
- **Garmin-klokkeapp** (Monkey C, i `garmin-app/`): kobler til via 4-sifrede
  koder/PIN (se §14).

---

## 3. Tenancy, roller og tilgang

### 3.1 Lag (teams)
- Alt data eies av et **lag** (`team_id` på alle domenetabeller). En bruker har
  et hjemmelag (`users.team_id`) og kan være medlem av flere lag
  (`user_teams`); aktivt lag ligger i session (`activeTeamId`) og byttes med
  `POST /api/teams/switch` (validerer medlemskap).
- **Parent/child-lag:** et hovedlag kan dele områder (tests, products, kick,
  grinding …) lesbart til barnelag (`parent_team_id`, `shared_areas`), med
  ekskluderinger per post (`child_visibility_exclusions`). Delte tester
  reberegnes/kurateres før visning hos barnet.
- **Lagfunksjoner** (`teams.enabled_areas`, styres av Super Admin): navigasjons-
  områder + featureflagg — bl.a. `para_team` (Race fleets + My athletes +
  sportsklasse), `time_tests` (fotocelle-tid), `blind_tester`, `garmin_watch`,
  `offline_mode`, `us_grind`, `multi_team`, `commercialization`-relaterte
  (plass/abonnement vises kun når kommersialisering er på).

### 3.2 Roller
- **Super Admin (SA):** `users.is_admin=1`. Global. Styrer lag, features,
  planer, registreringer.
- **Team Admin (TA):** hjemmelag via `users.is_team_admin=1`; på ANDRE lag kun
  via per-lag-flagget i session (`activeTeamIsAdmin`, satt fra
  `user_team_permissions`). **Viktig sikkerhetsregel:** TA-status skal ALLTID
  løses mot aktivt lag (`canManageTeam`/`getEffectiveIsTeamAdmin`) — TA hjemme
  gir ingenting på andre lag.
- **Medlem:** per-område-rettigheter `none|view|edit` i JSON
  (`users.permissions`, per-lag-overstyring i `user_team_permissions`).
  Områder: dashboard, tests, testskis, products, weather, analytics, grinding,
  raceskis, kick, raceprep, raceprepGlide, suggestions, liverunsheets.
  Rettighetene skal være konsistente på tvers av alle redigeringsmenyer (én
  post per bruker+lag); gis TA et sted ⇒ alle områder settes til edit
  (begrenset til områdene laget har).
- **Gruppescope:** brukere kan begrenses til navngitte grupper (komma-liste);
  poster bærer `group_scope`. Admin ser alt. Effektivt scope løses per aktivt
  lag.
- **Blind tester:** `is_blind_tester=1` — ser ALDRI produkt↔resultat-koblingen:
  productId/navn/methodology/freeTextProduct redigeres bort i alle test-lesende
  endepunkter (entries, PDF, compare, cross-team, produkthistorikk).
- **Athlete access:** `is_athlete_access=1` + `linked_athlete_id` — lesekonto
  for én utøver (deling til utøveren selv); read-only, samme redaksjon.

### 3.3 Sikkerhetsprinsipper (fra full audit)
- Hvert endepunkt: auth-middleware + team-eierskap (`verifyTeamOwnership` /
  `team_id = $n` / `hasAthleteAccess(athleteId, userId, isScopeAdmin, teamId)`).
- `hasAthleteAccess`: team-grense FØRST (med unntak: 14 dagers grace etter
  overføring, aktive lån), deretter fleet/profilåpning, admin, skaper,
  `athlete_access`-rad.
- Ingen SQL-interpolering av brukerinput (alltid parametre); identifikatorer
  kun fra whitelists.
- Session-regenerering ved alle innloggingsveier (lokal, Google, 2FA,
  invitasjonsaksept). Google-login håndhever også konto-lås og pauset lag.
- Sensitive svar (auth, watch-koder) logges ikke.

---

## 4. Datamodell (PostgreSQL)

Kjernetabeller (kolonnenavn i snake_case; tekst-datoer ISO):

- **users**: email, name, password(hash), team_id, is_admin, is_team_admin,
  permissions(JSON), group_scope, is_active, is_blind_tester, is_tester,
  is_athlete_access, linked_athlete_id, garmin_watch, watch_code(4 siffer),
  language, phone, totp_enabled/secret, failed_attempts, login_locked,
  onboarding_completed, created_at.
- **teams**: name, enabled_areas(JSON), shared_areas, parent_team_id, plan,
  is_paused, watch_pin(4 siffer), billing-felter.
- **user_teams** (medlemskap), **user_team_permissions** (per-lag rettigheter +
  per-lag TA-flagg + effektivt gruppescope), **groups** (navngitte grupper per
  lag), **invitations** (token, e-post, utløp), **team_join_requests**.
- **athletes**: name, team, default_ski_brand, height_cm, weight_kg,
  pole_height (klassisk), pole_height_skate, binding_position,
  ski_service_preferences (smørepreferanser), sport_class (para), main_waxer_id/
  name, created_*, team_id, archived, **is_fleet** (lagets skjulte «Race
  fleets»-utøver), **is_profile_only** (profil uten egen garasje, fra «My
  athletes», para-gated).
- **athlete_access** (delte brukere per utøver), **athlete_transfers**
  (flytting mellom lag, aksept via e-post, 14 dagers grace for avsender),
  **athlete_loans** (utlån med utløp, evt. skrivetilgang),
  **athlete_race_calendar** (rennkalender per utøver).
- **race_skis** (konkurranseski/utøverski): athlete_id, ski_id(label),
  serial_number, brand, discipline(Classic/Skating), construction, mold, base,
  grind, heights, year, length, type_of_ski, where_received, notes,
  is_training_ski, **is_sitski**, **fleet_group** (serienavn for fleet-par),
  custom_params(JSON, inkl. _color), archived_at, team_id, created_*/updated_*.
- **race_ski_regrinds** (slipehistorikk per par), **ski_race_usages** (manuell
  løpsbruk: dato, sted, disiplin, weather_id ELLER manual_weather(JSON),
  result, notes, **used_by_athlete_id**, **wax_notes**, athlete_rating/comment).
- **test_ski_series** («Testfleets»: serier av testpar, pair_labels),
  **test_ski_regrinds**.
- **tests**: date, location, test_type (Glide/Structure/Grind | raceski:
  Classic/Skating/Double Poling/**Mix**), test_ski_source('series'|'raceskis'),
  series_id, athlete_id, weather_id/no_weather, notes, test_name, start_time,
  distance_labels(JSON – rundenavn), **result_unit('cm'|'time')**, group_scope,
  runsheet_bracket(JSON), share_token (offentlig delingslenke), created_*/
  updated_* (stampEdit på 12 muteringsveier → «Sist endret av»).
- **test_entries**: test_id, ski_number, race_ski_id, product_id,
  additional_product_ids, free_text_product, methodology, application-felter,
  result_0km_cm_behind + rank_0km (runde 1), **results(JSON: [{result,rank}]
  per runde)**, feeling_rank/note, kick_rank/solution, grind-felter.
- **test_attachments** (R2/base64), **test_comments** (med @-mentions),
  **runsheets**, **runsheet_progress**, **watch_sessions** (bracket-kjøring),
  **watch_queue**.
- **daily_weather**: date, time, location, snø/luft-temp og -fuktighet,
  snow_type, grain_size, snow_humidity_type, track_hardness,
  artificial/natural_snow, wind, clouds(0–8), precipitation, visibility,
  test_quality, group_scope.
- **products**: brand, name, category (Paraffin, Powder, Liquid, Klister,
  Topping, Structure tool …), team_id, group_scope, archived_at, stock-felter,
  sheet-sync-felter. **product_orders**, deling til andre lag (kopi uten
  statistikk; mixer forblir hjemme; logges begge steder).
- **grinding**: grind_profiles, grinding_records, grinding_sheets (US grind).
- **kick**: kick_skis, kick_tests, kick_test_entries, kick_mixes.
- **race_preps**: date, start_time, location, race_type, discipline (Classic/
  Skating/Skiathlon/**Mix**), product_ids/structure_ids/kick_product_ids (+
  *_apps applikasjonsmåter), tette, method, weather_id, notes.
  **race_prep_entries**: athlete_id/navn, ski_id + ski_id_classic +
  ski_id_skating (tekstlabels), borrowed_athlete_id (+ _classic/_skating =
  eier-utøver ved lånte par, inkl. fleet), waxer, notes, athlete_rating/comment.
  **race_prep_comments** (forfatter-private; admin ser alle).
- **feedback_links** (offentlig token per utøver → utøveren melder rating/
  kommentar på løpsbruk/prep uten innlogging).
- **scan_corrections** (team_id, scanned UNIQUE, brand, name, hits) — læring
  for bildeskanning.
- **activity_logs** (audit m/ snapshots + restore), **login_logs**,
  **inbox_messages**, **client_errors**, **app_settings**, **billing_records**,
  **plan_change_log**, **interest_registrations**, **password_reset_tokens**
  (SHA-256, engangs, 1t).

---

## 5. Gjennomgående regler

- **Sesong = 1. mai–30. april.** Alle sesongfiltre bruker: måned ≥ mai →
  `ÅÅÅÅ/ÅÅÅÅ+1`.
- **Resultat/rangering:** En test har 1..n runder (distance_labels). ALLE
  beregninger (snitt, diff, median, relativisering, forhåndsvisning, rank)
  bruker **snittet av samtlige runder** — aldri bare runde 1. Rank = dense
  (1,1,3), lavest vinner. Server reberegner ranks for tidstester
  (`applyAvgRanks`) ved create/edit.
- **Tidstester** (`time_tests`-feature, per lag av SA): resultat i sekunder
  (opptil 3 desimaler) i stedet for cm, i både testfleet- og raceski-tester.
  Ingen «km»-etiketter i tidsmodus; analytics bruker kun rank (enhets-agnostisk).
  Valgfri relativisering 0–1 (vinner 0, taper 1).
- **Datoer/klokkeslett i skjema:** starter BLANKE. Datofelt åpner kalender ved
  klikk + tynn «I dag»-lenke under; klokkeslett starter 00:00 + «Akkurat
  nå»-lenke. Visning følger brukerens systemformat (`fmtDate`).
- **Tomme-tilstander:** vis alltid «Laster …» til spørringene har svart; aldri
  «finnes ikke»-melding mens data er underveis.
- **Produktnavn:** kategori vises som hale i navnet («Swix PS6 Paraffin»)
  overalt (delt `productLabel()`-helper; unntak structure tools) — ingen egen
  kategorikolonne i tabeller.
- **«Sist endret av»**: updated_at/by på poster, vises via `LastEdited`-
  komponent; «Lagt inn av X · tidspunkt» på skipar.
- **Desktop:** venstremeny er låst (scroller ikke med innholdet). Bredere
  dialoger på PC der det trengs.

---

## 6. Sider og funksjoner

### 6.1 Dashboard
Nøkkeltall (tester denne sesongen m.m.), siste aktivitet, og **Attention-kort**:
teller ting som venter (tester uten vær, uten resultater, athlete-ski-tester
osv.) med **deep-links som åpner nøyaktig de telte testene** (attention-modus
bypasser sidefiltre); hvert varsel kan **avvises** med antall-hukommelse
(dukker opp igjen når antallet endres). Synlighetsscopet per bruker.

### 6.2 Tests (testfleet-tester)
- New test: dato/tid/sted (autocomplete), testtype (Glide/Structure/Grind),
  serie, vær (auto-match på dato+sted eller manuelt/`ManualWeatherDialog`),
  produkter per par (hovedprodukt + tilleggsprodukter + fritekst),
  application-parametre (redigerbare kolonner), flere runder, gruppescope.
- Testliste med sesong/dato/type/sted/vær-filtre, «quick day select»,
  kolonnevelger, kort/liste-visning, gull-chip for vinnerprodukt.
- Test-detalj: resultatliste per runde, **Rank-kolonnen er dropdown** (velg
  runde eller Average), relativisering-toggle, vedlegg, kommentarer med
  mentions, deling via offentlig lenke (share_token; TA-oversikt over aktive
  lenker), PDF-utskrift, dupliser, rediger (stampes).
- **Compare tests** (inntil 4), **cross-team** («All teams», se 6.13).

### 6.3 Bildeskanning av testark (OpenAI)
Last opp foto av håndskrevne/pre-printede testark (US-blokkark):
- Flere tester per ark → hver blir separat test, enkeltvis mulig å hoppe over.
- Bruk KUN «cm total»-kolonnen som resultat (aldri summer runs; blank forblir
  blank). Merkekoder: SWX=Swix, MPL=Maplus, REX=Rex, STA/STR=Star, TOK=Toko,
  HWK literal. Kategori: Powder som default, «liq.» ⇒ Liquid.
- **Modellen lærer:** korreksjoner lagres i `scan_corrections` per lag og slås
  opp (exact-recall) før fuzzy-matching neste gang.
- Review-UI speiler «New test» (én linje per par), produkter kan opprettes
  underveis, produktkategori vises i velgere. Skann havner alltid i fleeten
  «From picture - no series available». Klientside-nedskalering av bildet
  (2200px JPEG) før opplasting. UI-tekst: «analyserer bildet» (aldri «AI»).

### 6.4 Testfleets (testskis)
Serier av nummererte testpar (pair_labels), regrind-historikk per par,
lim-inn-liste av ski-ID-er (tak 120), serdetaljside med tester og slip.

### 6.5 Athlete Skis (utøverski)
- Utøverliste (kort/tabell), arkivering, «Legg til utøver» (navn, klubb,
  høyde/vekt, stavhøyder klassisk+skøyting, bindingsposisjon, skimerke,
  smørepreferanser, sportsklasse ved para, hovedsmører).
- **Utøverside** med faner:
  - **Garage:** skipar med alle parametre + custom params + farge; kort/tabell;
    filtre (chips: Alle/Klassisk/Skøyte/Sitski(fleet)/Trening + stilart, merke,
    år, slip, RA-verdi, farge); kolonnevelger m/ sortering; regrind; arkiv;
    CSV-import; «Vis tester»-knapp per par (grå til paret har tester).
  - **Tests:** testkort (utvidbare, med vær og resultat/rank basert på snitt)
    eller listevisning; inline «New Raceski Test»-skjema: dato/sted/type
    (Classic/Skating/Double Poling; + Mix på fleet)/vær/enhet cm-tid; skivelger
    med søk + seriefilter-chips (fleet); resultattabell med flere runder,
    radrekkefølge (pil opp/ned), **«Legg til par»-linje** nederst (skriv
    ski-ID, forslag etter testtype og tekst, valg haker av i velgeren).
  - **Race use** (før «Race Prep»): «Logget løpsbruk»-seksjon (alle manuelle
    løpsbruk med par, serie, vær-chips, wax-notes) + Race Prep-historikk
    (TA legger inn utøvere i Race Prep; smører kobler skipar, også LÅNTE par
    fra andre garasjer/fleet med «Lånt · eier»-badge; feltet faller tilbake
    gjennom alle tre label-kolonner). Rennkalender med vær-filtre.
  - **Analytics:** per-par statistikk (glide/feeling/begge), sammenlign par,
    beste temperaturområde; **Suggestions:** forslagsmotor med værmatch.
  - Tilgangsstyring per utøver (deling til brukere), share-view (read-only),
    feedback-lenke, Export PDF, overføring/lån til andre lag.

### 6.6 Race fleets (para-feature)
**Arkitektur: fleeten ER en utøver.** Hvert lag har en skjult
`is_fleet=1`-utøver «Race fleets» som eier lagets konkurransski-park;
`/race-fleet` resolver (lazily oppretter) denne og redirecter til utøversiden.
Alt over (6.5) gjelder identisk, pluss fleet-ekstraer:
- **Serier (fleet_group):** Gruppe/serie-felt med ett-trykks forslag;
  garasjen grupperes per serie — kortvisning med kollapsbare seksjoner og
  luft mellom serier, tabellvisning med kollapsbare serie-headerrader;
  serie-badges overalt; seriefilter i testskjemaets skivelger.
- **Sitski-toggle** per par; sitski-filter.
- **Mix-testtype:** viser ALLE par uavhengig av stilart.
- Gruppe-mot-gruppe-testing (ett par fra hver serie) for dagens serievalg.
- **My athletes** (fane, para-gated): personregister — opprett profil-utøvere
  (is_profile_only, uten egen garasje/side) ELLER se vanlige utøvere (samme
  post begge steder, redigerbar begge veier, «Åpne side»-lenke). Utvidet kort:
  profildata, smørepreferanser, og alle skipar personen har brukt (med serie,
  forhold, wax-notes; manuelt + Race Prep, badge for kilde).
- **Løpsbruk-kobling:** «Logg løpsbruk»-dialogen har «Brukt av (utøver)»-søk +
  Wax-notes (para-gated); lagres på både par og person. Race Prep-oppføringer
  telles automatisk som bruk på paret (Times raced) og vises begge steder.
- Ingen persondeling/overføring/tilgangskort på fleet-utøveren; åpen for hele
  laget (`hasAthleteAccess` → true innen laget).

### 6.7 Skipar-side (`/ski/:id`)
For alle race-ski: header m/ serie/sitski/trening-badges, statistikk (tester,
førsteplasser, snittrang, ganger i renn), **Testhistorikk** — alle tester paret
deltok i, egen rad uthevet, snitt+rank i to rette kolonner, ALLE værdata som
chips med **på/av-togglere** øverst (kun felter som finnes, alle på som
default). Nås fra «Vis tester» og fra Analytics/Suggestions-tabellene.

### 6.8 Weather
Værobservasjoner (alle felter i §4), gruppert per dag, koblet til tester/bruk;
værstasjon-integrasjon (config per lag); «missing weather»-side.

### 6.9 Products
Produktregister m/ kategorier, lager (product_stock), bestillinger, Google
Sheets-sync (push/pull), deling til andre lag (TA begge sider, kopi uten
statistikk), arkiv. **Produktside:** statistikk-kort (tester, #1, snittrang,
testtyper, ganger i renn), testhistorikk med egen rad uthevet, Application
Insights (per applikasjon: antall, snittrang, beste, typiske forhold).

### 6.10 Grinding & Kick
- Grinding: slipprofiler, sliperecords, grinding sheets (US-format ved
  `us_grind`), grind-tester (testType Grind, egen permission).
- Kick: kick-ski, kick-tester (binder + kick solution + feeling per ski),
  kick-mixer (blandinger m/ rulletemperatur). Deles fra parent-lag.

### 6.11 Race Prep
Renndag-oppsett per renn: dato/starttid/sted/renntype/disiplin (inkl. Skiathlon
= dobbel skislot, og Mix), glid-/struktur-/kick-produkter med
applikasjonsmåter, tette, metode, vær. **Entries per utøver** (TA setter opp
startlisten): ski-ID per slot m/ autocomplete fra utøverens garasje +
lånemuligheter fra andre garasjer og fleet («Borrowed»); waxer per utøver;
athlete-feedback (rating/kommentar, også via offentlig feedback-lenke);
forfatter-private kommentarer (admin ser alle). Race-prep-bruk teller som
løpsbruk på paret og vises i utøverens Race use.

### 6.12 Live Runsheets / Watch Queue / Garmin
- Runsheet per test: heat-basert kjøring (bracket i `runsheet_bracket`),
  progress-lagring, mobilvisning.
- **Watch-økter:** 4-sifret sesjonskode (kollisjonssjekket); klokka kjører heats
  og resultater skrives tilbake i testen (diff/rank).
- **Watch Queue:** kø av tester for klokka; lag-PIN (4 siffer) + personlige
  4-sifrede brukerkoder; Garmin-appen henter kø/starter/fullfører via PIN.
  Uautentiserte PIN-endepunkter er rate-limitet (120/5min/IP).

### 6.13 All teams (multi-team)
For brukere med tilgang til flere lag: samlet testliste, **Analytics-motor** og
**Suggestions-motor** på tvers av valgte lag (lag-checkboxes), temperaturbånd
(≥0, −1..−4, −5..−9, −10..−14, <−15 på snøtemp), snøtype, venues, full
filtrering som Suggestions ellers. Enkelttest åpnes read-only på tvers.

### 6.14 Suggestions & Analytics (per lag)
Forslagsmotor: match dagens forhold (vær) mot historiske tester → rangerte
produkter/ski med antall matchende tester. Test analytics: merkeanalyse,
buckets, trender.

### 6.15 My Team
Medlemsliste med grupper, kontaktinfo (alle ser all kontaktinfo), testCount
(alle), lastSeen (kun TA), plass/abonnement (kun TA og kun ved
kommersialisering), eksterne medlemmer merket med **hjemmelaget sitt** (aldri
Admin/Member), filter på egne grupper + eksternes hjemmelag,
rettighetsredigering (én post per bruker+lag, TA-eskalering setter alt til
edit).

### 6.16 Admin (SA + TA)
Brukeradmin (opprett/rediger/reset passord/deaktiver/slett — kun eget lags
brukere for TA), invitasjoner (e-post m/ token), grupper, laginnstillinger,
features (SA), planer/billing (Stripe checkout/portal, TA), aktivitetslogg med
snapshots + gjenoppretting, login-logg, force-logout (lag-scopet),
emergency lockdown (SA), eksport/backup (JSON selektiv m/ merking,
Google Sheets, Excel), import-v2, team-usage, klientfeil-logg.

### 6.17 Konto & auth
Login (lockout etter feilforsøk, 2FA TOTP, Google OAuth m/ samme sperrer),
passord-reset (engangs-token), invitasjonsaksept (passordpolicy +
session-regenerering), «husk meg» (forlenget session), språkvalg, watch-kode,
GDPR-sletting (anonymisering), inbox/varsler.

### 6.18 Offentlige sider
what-is-glidr, pricing (planer fra app_settings), get-started/demo,
interest-registrering, legal/DPA/contact, status, delt test (`/share/test/:token`),
feedback-side (`/feedback/:token`).

---

## 7. Klient-konvensjoner

- Query-nøkler er URL-er (default queryFn fetcher nøkkelen); 401 gir ikke
  global utlogging (transient ved redeploy).
- `useAuth()` gir user, `can(area, level?)` (også featuresjekk som
  `can("time_tests")` via `teamEnabledAreas`), `canManage`.
- AppShell med activeNav-overstyring (fleet-sider markerer «Race fleets»).
- Delte komponenter: `DateField`/`TimeField` (blank + I dag/Akkurat nå),
  `LastEdited`, `productLabel()`, `LocationAutocomplete`, `RaceskiCombobox`
  (fleet-først + team-søk), `ManualWeatherDialog`, PDF-layout-helpers.
- i18n: alle strenger `L("no","en")` eller t()-nøkler.

## 8. Ikke-funksjonelle krav

- Mobil-først (smørere står i felt med hansker — store trykkflater), PWA,
  offline-kø, rask lasting, ingen «tomt»-blink.
- Ytelse: bulk-endepunkter for entries; indekser på fremmednøkler.
- Alle destruktive handlinger bekreftes; arkiv fremfor sletting der mulig.
- Audit-logg på alt vesentlig, inkl. snapshots for restore.

---

*Generert fra kildekoden i `glidr5` (commit-historikken er fasit). Ved
gjenoppbygging: følg §3 (sikkerhet) og §5 (regler) strengt — det er der
djevelen bor.*
