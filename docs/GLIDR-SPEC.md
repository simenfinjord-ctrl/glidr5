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
  pull-to-refresh (to terskler: 70px = refetch alt + versjonssjekk, 170px =
  hard reload) og offline-støtte i **IndexedDB** (`idb`, DB `glidr-offline`:
  kø for mutasjoner + cache av alle vellykkede API-svar, pre-fetch av
  whitelist-endepunkter, restaureres inn i React Query når man går offline).
  «Legg til på hjemskjerm»-banner (iOS-veiledning / Android native prompt).
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
- **Garmin-klokkeapp** (Monkey C/Connect IQ, i `garmin-app/`): se egen
  fullspesifikasjon i §6.12b.

---

## 3. Tenancy, roller og tilgang

### 3.1 Lag (teams)
- Alt data eies av et **lag** (`team_id` på alle domenetabeller). En bruker har
  et hjemmelag (`users.team_id`) og kan være medlem av flere lag
  (`user_teams`); aktivt lag ligger i session (`activeTeamId`) og byttes med
  `POST /api/teams/switch` (validerer medlemskap).
- **Parent/child-lag:** et hovedlag kan dele områder — nøyaktig whitelist:
  `tests, products, kick, weather, grinding` — lesbart til barnelag
  (`parent_team_id` + `shared_areas` lagret på BARNET; kun ett nivå; settes av
  SA). Ekskluderinger per post (`child_visibility_exclusions`, kun typene
  test/test_entry/product — vær/kick er alt-eller-ingenting). `grinding` er
  ingen egen deling, den låser bare opp Grind-tester i tests-delingen. Delte
  poster tagges `sharedFromTeam` + `readOnly`; raceski-tester deles ALDRI;
  runsheet_bracket strippes. Delte tester med skjulte rader **reberegnes**:
  beste gjenværende par blir 0-punkt, diffs på nytt (2 desimaler), ranks
  renummereres SEKVENSIELT 1..n (ikke dense), feeling/kick kompakteres —
  urørte tester beholder originaltallene. Foreldre-data ignorerer gruppescope
  (barnet ser alt i delte områder, inkl. mixer). **Parent-TA-unntaket:** en TA
  på forelderlaget kan bytte inn i barnelag uten medlemskap og får full TA
  skrivetilgang der (bevisst unntak fra per-lag-TA-regelen). **Emansipering**
  (SA): barnet frikobles, valgfritt med fysisk kopi av det kuraterte synlige
  settet.
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
- **Athlete access:** `is_athlete_access=1` + `linked_athlete_id` — konto for
  utøveren selv; kan gis flere utøvere (`athlete_access`-rader) og bytte aktiv
  utøver; **per-utøver `can_edit`** (TA-matrise `PUT /api/users/:id/athlete-access`)
  gir raceskis=edit når minst én utøver er redigerbar (`editableAthleteIds` på
  /me); ellers read-only; samme produktredaksjon som blind tester. Kontoer kan
  opprettes inline fra utøversiden.
- **All teams-tilgang:** `users.can_view_all_teams` settes av TA for egne
  brukere (SA for alle); effektiv kun ved medlemskap i ≥2 lag. All
  teams-visningene utelater raceski- og Grind-tester.

### 3.3 Sikkerhetsprinsipper (fra full audit)
- Hvert endepunkt: auth-middleware + team-eierskap (`verifyTeamOwnership` /
  `team_id = $n` / `hasAthleteAccess(athleteId, userId, isScopeAdmin, teamId)`).
- `hasAthleteAccess`, eksakt rekkefølge: team-grense (NULL-team gir ALDRI
  bypass) → transfer-grace (14 d) → aktivt lån → `is_fleet=1` ⇒ true →
  `is_profile_only=1` ⇒ true → admin → skaper → `athlete_access`-rad.
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
- **athlete_access** (delte brukere per utøver; `can_edit` per rad — NB:
  tilgangsdialogen på utøversiden skriver settet uten can_edit),
  **athlete_transfers** (from/to_team_id, accepted_by_id, `strip_products`
  (default true; false ved SA admin-move), `prev_main_waxer_id/name`,
  `grace_until` = aksept + 14 d), **athlete_loans** (owner_team_id/to_team_id/
  status/expires_at/`can_edit` — NB: can_edit lagres men håndheves foreløpig
  ikke; lån gir i praksis full tilgang), **athlete_race_calendar**.
- **teams** har også sync-kolonner: product_sheet_url + product_sheet_group,
  backup_sheet_url, drive_folder_id/json/pdf-file-id, last_backup_rows/error,
  feedback_sheet_url/enabled; **users.can_view_all_teams**.
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
- **Navigasjon/utseende:** venstremenyen er låst mot scrolling, kollapsbar,
  dra-justerbar bredde (180–360px, persistert) med seksjons-grupper; hele
  naven kan byttes til **toppmeny-layout**. Per bruker: mørk/lys modus,
  8 aksentfarger, valgfri **mobil bunn-nav** med «Mer»-ark. Per lag (SA):
  **nasjonstema** (14 nasjoner — aksentfarge + flaggbånd i skallet).
  **Cmd/Ctrl+K kommandopalett**: globalt søk på tester, produkter, fleets,
  utøvere, slipprofiler og vær med gruppert resultatliste. Bredere dialoger
  på PC der det trengs. Konfigurerbar Feedback-knapp i menyen (ekstern
  Google-form-URL per lag). Watch-kø-badge i nav.

---

### 5.1 Globale mekanismer (app-skallet)
- **Vedlikeholdsmodus** (SA): polles hvert 30. sek; fullskjerm «Under
  vedlikehold» for alle ikke-SA, med valgfritt gjenåpningstidspunkt.
- **Broadcast-banner** (SA): mykt «oppdateringer pågår»-varsel, separat fra
  vedlikeholdsmodus. **«What's new»-popup**: SA publiserer release-notis
  (feature/fix/update); vises én gang per notis, kan dempes.
- **Vilkårsport**: engangs blokkerende aksept av Terms & Policy (versjon +
  tidsstempel server-side; mutasjoner blokkeres til akseptert; SA kan
  nullstille en brukers aksept).
- **Tester-konto** (`is_tester`): låses til `/watch-queue` fra alle ruter.
- **SA-moduser:** «admin mode» (localStorage-flagg; `/` → `/overview`),
  **stealth** (read-only kryssvisning uten logging) og **incognito**
  (handlinger logges ikke). SA som ser et lag de ikke er medlem av (uten
  stealth) redirectes fra datasider til `/admin`.
- **Onboarding-veiviser** (ikke-admin, til `onboarding_completed`) +
  engangs **produkt-tur** for alle.

## 6. Sider og funksjoner

### 6.1 Dashboard
**Tilpassbart widget-dashbord** («Tilpass dashbord», 11 av/på-widgets):
Needs Attention, Stats Overview, Today's Tests, Watch Queue (feature-gated),
Quick Actions (med fjernbare snarveier), Recent Results, Recent Weather,
Products, Top Products, Athlete Recent Tests (per-utøver-multivalg),
Team Activity (kun admin), skigarasje-oversikt. Tidsavhengig hilsen +
deterministisk dagssitat.
**Attention-kortet** teller: tester uten vær / uten resultater (+ athlete-ski-
variantene), fleets som trenger sliping, produkter tomme på lager, produkter i
bestilling, og team-tilgangsforespørsler — med **deep-links som åpner nøyaktig
de telte testene** (attention-modus bypasser sidefiltre); hvert varsel kan
**avvises** med antall-hukommelse. Synlighetsscopet per bruker.
**Team-join-forespørsler** vises som accept/decline-kort (avsender ser og kan
kansellere sine i My Team; mottaker varsles på dashbord, inbox og e-post).

### 6.2 Tests (testfleet-tester)
- New test: dato/tid/sted (autocomplete), testtype (Glide/Structure/Grind),
  serie, vær (auto-match på dato+sted eller manuelt/`ManualWeatherDialog`),
  produkter per par (hovedprodukt + tilleggsprodukter + fritekst),
  application-parametre (redigerbare kolonner), flere runder, gruppescope.
- Testliste med **fire visningsmoduser** (kort → to-kolonners kort → tabell →
  **kalender** (månedsgrid med år/måned-navigasjon), sykles med én knapp,
  persistert), sesong/dato/type/sted-filtre, «quick day select», kolonnevelger,
  gull-chip for vinnerprodukt, blind-tester vis/skjul-toggle, og et **fullt
  vær-områdefilter**: min/maks på luft-/snøtemp, luft-/snøfukt og skydekke +
  sporhardhet, snøfukttype, kornstørrelse, kunst-/natursnø, nedbør, vind, sikt.
- Test-detalj (gjelder både testfleet- og raceski-tester; tilbake-lenke og nav
  følger kilden — «Back to athlete»/«Back to Race fleets»): resultatliste per
  runde, **Rank-kolonnen er dropdown** (runde eller Average),
  relativisering-toggle, «Rank by diff»/«Rank by feel»-bryter og
  **Feeling test-modus** (dra-og-slipp-rangering av par etter følelse),
  forrige/neste test-navigasjon, «Add to watch queue», foto-vedlegg med
  dra-og-slipp, kolonnevelger + sortering, kommentarer med mentions,
  **child-team-synlighetsdialog** (skjul hele testen eller enkeltpar for
  barnelag), deling via offentlig lenke (share_token; TA-oversikt over aktive
  lenker), PDF-utskrift, dupliser, rediger (stampes).
- **Compare tests**: fritt multivalg med søk (sted/navn/dato), fjern per test,
  tøm alle. **Cross-team** («All teams», se 6.13).

### 6.3 Bildeskanning av testark (OpenAI)
Last opp foto av håndskrevne/pre-printede testark (US-blokkark):
- Flere tester per ark → hver blir separat test, enkeltvis mulig å hoppe over.
- Bruk KUN «cm total»-kolonnen som resultat (aldri summer runs; blank forblir
  blank). Merkekoder: SWX=Swix, MPL=Maplus, REX=Rex, STA/STR=Star, TOK=Toko,
  HWK literal. Kategori: Powder som default, «liq.» ⇒ Liquid.
- **Modellen lærer:** korreksjoner lagres i `scan_corrections` per lag og slås
  opp (exact-recall) før fuzzy-matching neste gang.
- Skanningen leser også **værdata fra arket** (temp/fukt/snøtype/korn/spor/
  vind/nedbør/sikt/skydekke/kunst-natursnø) med opt-out «vær legges inn
  manuelt senere».
- Review-UI speiler «New test» (én linje per par), produkter kan opprettes
  underveis, produktkategori vises i velgere. Skann havner alltid i fleeten
  «From picture - no series available». Klientside-nedskalering av bildet
  (2200px JPEG) før opplasting. UI-tekst: «analyserer bildet» (aldri «AI»).

### 6.4 Testfleets (testskis)
Serier av nummererte testpar (pair_labels), regrind-historikk per par (mønster,
stein/verktøy, dato, notat, «Current»/«Latest»-markering, sletting),
**fleet-slipestatus** («hvor er skiene til sliping?»), lim-inn-liste av
ski-ID-er (tak 120), arkiverte serier med gjenoppretting og permanent sletting,
seriedetaljside med tester og slip.

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
  - Tilgangsstyring per utøver (deling til brukere; share-view read-only-konto
    kan **opprettes inline**), feedback-lenke, **konfigurerbar PDF-eksport**
    (velg seksjoner: inventar/tester/slip/sammendrag + per-parameter-kolonner
    inkl. custom params), overføring/lån (permanent overføring; utlån med
    valgfritt utløp; **SA-hurtigflytting uten karantene**; historikk-dialog
    over alle overføringer/lån; duplikat-sammenslåing ved kollisjon).
    **Hovedsmører-regel:** bytte av hovedsmører beholder forrige smørers
    delte tilgang. Rennkalender-oppføringer kan redigeres/slettes; renntyper:
    Classic, Skating, Skiathlon, Sprint classic, Sprint skating.
  - Faner totalt: garage / tests / **races (Race use)** / analytics /
    suggestions (+ athletes på fleet). Garasjekolonner inkluderer Times raced;
    15 sorteringsvalg.
- `/raceskis`-listen: kort/liste, arkiverte utøvere med gjenoppretting,
  **innkommende lån/overføringer med Accept/Decline og «End loan»**,
  lag-standard skimerke (prefylles på nye par).

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
Værobservasjoner (alle felter i §4), gruppert per dag, kort/tabell-visning
(tett sorterbar tabell m/ korn/kvalitet/kunstsnø/lagt-inn-av), koblet til
tester/bruk; **værstasjon-integrasjon** (config per lag + «Hent»-knapp som
fyller skjemaet live); offline-lagring; «missing weather»-side med både
«Add weather» og «Skip / marker som uten vær» per test.

### 6.9 Products
Produktregister m/ kategorier og **fire visninger**: Products, Lager/stock,
Arkiv, **Compare products** (ytelsessammenligning over valgte tester).
**Bulk-operasjoner:** multivalg med gruppe-tilordning, arkiver/gjenopprett,
og **del til andre lag** med mållagsgruppe per lag. **Glide-mixer** som egne
produktentiteter (i tillegg til kick-mixer). Bestillingsflyt med antall per
produkt og **ordrestatus per merke**. Google Sheets-sync (push/pull, med
mål-importgruppe per lag). **Produktside:** statistikk-kort (tester, #1,
snittrang, testtyper, ganger i renn), testhistorikk med egen rad uthevet og
resultat/rank i rette kolonner, Application Insights (per applikasjon: antall,
snittrang, beste, typiske forhold).

### 6.10 Grinding & Kick
- Grinding, tre faner: Tests, Grinds (profiler) og **Analytics**;
  **bulk-import av slipprofiler** fra limt tekst med forhåndsvisning.
  Grinding sheets (US-format ved `us_grind`); grind-tester (testType Grind,
  egen permission).
- Kick, fire seksjoner: Test skis (m/ farge, høyder, binder, dupliser),
  Kick tests (binder + kick solution + feeling per ski), Mixes
  (rulletemperatur), og **Analysis/rapport** som aggregerer kick-løsninger på
  tvers av tester med forhold og tekstlige innsikter. Deles fra parent-lag.

### 6.11 Race Prep
Renndag-oppsett per renn: dato/starttid/sted/renntype/disiplin (inkl. Skiathlon
= dobbel skislot, og Mix), glid-/struktur-/kick-produkter med
applikasjonsmåter, tette, metode, vær. **Entries per utøver** (TA setter opp
startlisten): ski-ID per slot m/ autocomplete fra utøverens garasje +
lånemuligheter fra andre garasjer og fleet («Borrowed»); waxer per utøver;
athlete-feedback (rating/kommentar, også via offentlig feedback-lenke);
forfatter-private kommentarer (admin ser alle); **bulk-dialog «legg til
utøvere i startlisten»** med søk; **PDF-eksport/nedlastbar rapport** per prep.
Race-prep-bruk teller som løpsbruk på paret og vises i utøverens Race use.

### 6.12 Live Runsheets / Watch Queue / Garmin
- Runsheet per test: heat-basert kjøring (bracket i `runsheet_bracket`),
  progress-lagring, mobilvisning.
- **Watch-økter:** 4-sifret sesjonskode (kollisjonssjekket); klokka kjører heats
  og resultater skrives tilbake i testen (diff/rank).
- **Watch Queue:** kø av tester for klokka med Aktiv/Arkiv-faner (fjern,
  gjenopprett, auto-arkiv ved fullføring); lag-PIN (4 siffer, regenererbar) +
  personlige 4-sifrede brukerkoder (refresh + kopier); Garmin-appen henter
  kø/starter/fullfører via PIN. Uautentiserte PIN-endepunkter er rate-limitet
  (120/5min/IP). **«Run on phone»**: mobil runsheet som kjører heatene uten
  klokke. Live Runsheets har vis/skjul produktnavn per par (blindtest-støtte)
  og kolonner for kilde/testtype/oppdatert.

### 6.12b Garmin-klokkeappen «Glidr Runsheet» (fullspesifikasjon)

**Formål:** smøreren står ved sporet og kjører glidtest-heats rett fra klokka —
velger vinner av hvert heat og taster taperens cm bak; resultatene skrives live
inn i testens bracket og resultatliste i webappen. Ingen telefon nødvendig.

**Plattform:** Connect IQ watch-app (Monkey C, minSdk 3.0), ~2000 linjer i
`garmin-app/source/`. Støttede enheter: Forerunner 945/945LTE/955/965/970,
265/265s, 255-familien, 165-familien, Fenix 6/7/8-familiene (full produktliste
i `manifest.xml`). Server-URL hardkodes i `ServerConfig.mc`
(`BASE_URL = "https://glidr.onrender.com"`). Bygges med `monkeyc` +
utviklernøkkel (`deploy.sh`); sideloades til `GARMIN/Apps` eller distribueres
via Connect IQ Store.

**Onboarding (førstegang):**
1. **PIN-oppsett** (`PinSetupView`): tast lagets 4-sifrede watch-PIN
   (UP/DOWN per siffer, SELECT neste/bekreft, BACK tilbake) →
   `GET /api/watch/resolve/:pin` → lagnavn lagres i Storage.
2. **Personlig kode** (`PersonalCodeView`): tast din personlige 4-sifrede
   watch-kode (fra My Account / Watch Queue-siden) →
   `POST /api/watch/auth` validerer PIN+kode sammen → brukernavn lagres og
   vises i headeren; koden identifiserer operatøren på resultater.

**Hovedmeny** (`MainMenuView`, viser GLIDR + lagnavn + brukernavn):
- **From List** — «Tests queued from app»: `GET /api/watch/list/:pin` henter
  lagets aktive Watch Queue (test-/serienavn, hvem som la dem til).
  Velg en test → `POST /api/watch/list/:pin/start/:itemId` → serveren
  auto-oppretter en watch-sesjon fra testens entries (ski-labels =
  serienummer for raceski / pair_labels for serier) og returnerer
  sesjonskoden; klokka går rett i heat-kjøring.
- **From Code** — «Enter 4-digit session code» (`CodeEntryView`): tast koden
  som webappen viser når man trykker «Watch» i Complete Runsheet →
  `GET /api/runsheet/watch/:code` henter bracketen.
- **Archive** — «Last 10 completed»: `GET /api/watch/archive/:pin`, fullførte
  køelementer; kan gjenåpnes/startes på nytt.
- **Settings** (`SettingsView`): Vibrate på/av, tastelyder på/av, vis min
  kode, bytt PIN, logg ut (tømmer Storage).

**Heat-kjøring** (`HeatView`, fase-basert):
1. Viser rundenavn + «Par A vs Par B» (ekte ski-labels). **UP** = øverste par
   vinner, **DOWN** = nederste.
2. Avstandsskjerm: UP/DOWN justerer taperens avstand (±10 cm-steg),
   SELECT bekrefter, BACK angrer vinnervalget.
3. `POST /api/runsheet/watch/:code/result` sender {heat, vinner, diff};
   serveren oppdaterer bracketen (`watch_sessions`), regner diffs/ranks over
   alle heats og går til neste heat. Vibrasjon/lyd som kvittering (kan slås av).
4. Når alle heats er ferdige: «Apply» → `POST /api/runsheet/sessions/:code/apply`
   skriver endelige resultater inn i testens `test_entries`
   (result/rank per par) og `tests.runsheet_bracket`; køelementet
   auto-arkiveres (`POST /api/watch/list/:pin/complete/:itemId`).
   Webappens bracket-visning oppdateres live underveis (polling).

**Web-siden av protokollen:** watch-PIN per lag (regenererbar av TA),
personlige koder per bruker (regenererbare), Watch Queue-siden med
Aktiv/Arkiv, «Run on phone» som alternativ uten klokke. Sesjonskoder er
4-sifrede med kollisjonssjekk; PIN-endepunktene er uautentiserte men
rate-limitet (120/5min/IP); resultat-/apply-endepunktene autentiseres av
selve sesjonskoden. `hasGarminWatchAccess` (feature `garmin_watch` +
`users.garmin_watch=1`) styrer hvem som ser Watch Queue og kodene.

**Viktig for gjenoppbygging:** klokkas UI forventer NØYAKTIG 4 siffer for
PIN, personlig kode og sesjonskode (tegnebredde og tastelogikk er hardkodet
for 4 bokser i `LayoutHelper.mc`) — endre aldri kodelengden på serversiden
uten å endre klokkeappen samtidig.

### 6.13 All teams (multi-team)
For brukere med tilgang til flere lag — tre faner: **Tests** (m/ kort/liste-
toggle), **Analytics** og **Suggestions**, alle på tvers av valgte lag
(lag-checkboxes). Analytics: produkter på tvers av lagene, beste produkter per
snøtemperatur (bånd ≥0, −1..−4, −5..−9, −10..−14, <−15), snøtype og
**Test venues**-oversikt. Suggestions med full filtrering som ellers.
Enkelttest åpnes read-only på tvers.

### 6.14 Suggestions & Analytics (per lag)
Forslagsmotor: match dagens forhold (vær) mot historiske tester → rangerte
produkter/ski med antall matchende tester. **Test analytics, åtte faner:**
Overview, Products, Compare, Conditions, **Durability** (klassifiserer
produkter som bedre/dårligere over distanse fra flerrunde-tester),
**Raced Products**, **Raced Skis**, **Brand stats** — pluss head-to-head-
matrise, kombinasjonssøk («beste combo-partner»), formkurve og beste
applikasjon per produkt. **Export Report som PDF** (inkl. topp produkter
etter win rate).

### 6.15 My Team
Medlemsliste i tre visninger (liste/grid/kompakt) med grupper, kontaktinfo
(alle ser all kontaktinfo), testCount (alle), lastSeen (kun TA),
plass/abonnement (kun TA og kun ved kommersialisering), eksterne medlemmer
merket med **hjemmelaget sitt** (aldri Admin/Member), filtre på rolle, egne
grupper + eksternes hjemmelag, rettighetsredigering (én post per bruker+lag,
TA-eskalering setter alt til edit), **deaktiver medlem** (gjenopprettes i
Admin) og **fjern fra laget** (to-stegs bekreftelse), utgående
team-join-forespørsler med kansellering.

### 6.16 Admin (SA + TA)
Kontrollrom med **søkbar funksjonssidebar** (hopp-til-funksjon, Enter åpner
første treff; gruppert dropdown på mobil). Grupper: Overview / People / Logs /
Data / System; SA-only-faner er badget «SA».
- **People:** brukeradmin med fanedelt redigeringsdialog (Profil / Rettigheter /
  Lag m/ medlemskapsteller / Annet) + egen «Access on this team»-dialog; roller
  Member, Team Admin, Super Admin (SA) og Athlete Access; legg eksisterende
  bruker til lag via e-post; lås opp konto; per-bruker force-logout; kun eget
  lags brukere for TA. Invitasjoner (e-post m/ token), grupper,
  **registreringer** (SA: interesse-liste, rediger, **opprett lag direkte fra
  registrering**).
- **Logs:** aktivitetslogg = **aktivitet + papirkurv** (kategorisert, snapshot
  + gjenoppretting via restore; purge før dato), login-logg (slett enkeltvis /
  per lag), **Security-fane (SA):** vedlikeholdsmodus m/ gjenåpningstid,
  broadcast-banner, What's new-publisering, emergency lockdown per lag,
  nullstill vilkårsaksept per bruker, force-logout-all (lag-scopet).
- **Data:** eksport/backup (JSON selektiv m/ merking, Google Sheets/Drive,
  Excel), import-v2 med per-område-valg, legacy-import, **fjern duplikate
  produkter**, system-dump til konfigurert Drive-mappe, eksport-logging,
  team-usage, klientfeil-logg.
- **System (SA):** per-lag-grenser (maks brukere/grupper/tester/produkter),
  parent/child-dialog med per-område-deling, **emansiper barnelag** (valgfri
  datakopi), lagnotater, planhistorikk, standardlag, slett lag, per-lag-backup,
  **Accounting** (billing-CRUD, planpriser, **plan-builder-prising** — brukere/
  grupper inkludert + pris per ekstra, valutakurser, neste fakturadato),
  watch-app-publisering, **Dokumenter**: Feature Guide, strategidokument,
  Letter of Intent-utkast og salgsdeck-PDF (NO+EN).
- **Team plan-fane (TA selvbetjening):** kun ved kommersialisering; redigerbar
  bare for «custom»-planer; setter også lagets **tidssone**.

### 6.17 Konto & auth (My Account)
Login (lockout etter feilforsøk, 2FA TOTP **med backup-koder**, Google OAuth
m/ samme sperrer), passord-reset (engangs-token), invitasjonsaksept
(passordpolicy + session-regenerering), «husk meg» (forlenget session).
My Account: **avatar** (opplasting m/ størrelsesgrense + forhåndsvalg),
**brukernavn** separat fra e-post (kan brukes til login), språk,
**temperaturenhet °C/°F per bruker** (lagres alltid i °C; inputfelter forblir
°C), aksentfarge, nav-layout, mobil-nav-toggle, **aktive økter** med
per-økt-utlogging og «denne enheten»-markør, watch-kode + lag-PIN m/
regenerering, inviter medlemmer direkte (TA), **be om planbytte**-dialog +
gjeldende plan/pris (mnd/år), SA admin-mode-toggle, GDPR-sletting
(anonymisering). **Inbox** (`/inbox`, SA/TA): meldingstyper reset_password
(m/ inline ny-midlertidig-passord-handling), test_comment (@-mention) og
athlete_feedback; uleste-tellere, merk alle lest, slett.

### 6.18 Offentlige og interne spesialsider
- what-is-glidr, pricing (planer fra app_settings), legal/DPA/contact.
- **`/get-started`**, tre moduser: **selvbetjent plan-bygger** (komponer plan
  fra plan-builder-prisingen, mnd/år, opprett lag umiddelbart),
  interesse-skjema, direkte kontakt. **`/demo`**: skriptet animert
  funksjonsgjennomgang (markedsføring).
- **`/status`**: offentlig helse-side som poller `/api/health` hvert 30. sek
  med latens og sist-sjekket.
- Delt test (`/share/test/:token`), feedback (`/feedback/:token`).
- **`/overview`** (SA): global oversikt — lag/brukere/tester/produkter,
  kommersialiseringsstatus, aktive økter, siste innlogginger, siste tester på
  tvers, suspenderte lag; SA-landingsside i admin mode.
- **`/test-protocol`** (SA): stegvis verifiseringssjekkliste for plattformen
  (auth/vilkår/sikkerhet, brukere & tilgang, …), hvert steg OK/flagget med
  notat, persistert server-side.
- `/logo-preview` (internt designverktøy). `pages/runsheets.tsx` og
  `pages/profile.tsx` er døde filer (skal ikke gjenskapes; `/profile`
  redirecter til `/my-account`).

---

## 6b. Deling av data — komplett katalog

1. **Parent/child-speiling** (se §3.1) — live read-only nedover; parent-TA har
   skrivetilgang oppover-unntak; emansipering m/ valgfri kopi.
2. **Produktdeling til andre lag** (kopi): TA på kilde + TA på HVERT mållag;
   kun kategori/merke/navn + valgt mållagsgruppe krysser (ikke lager/ordre/
   statistikk/arkiv); dedupe på normalisert merke|navn; mixer nektes
   (`mixesSkipped`); activity_log begge steder (`products_shared_out/in`);
   ingen «angre» — kopien er en selvstendig rad.
3. **SA test-kopi** (`POST /api/tests/:id/share`): SA deep-kopierer én test til
   valgte lag — produkter matches (merke+navn+kategori) eller opprettes, vær
   dupliseres, entries gjenskapes, kreditert «Shared by <navn>», havner i
   mållagets første gruppe.
4. **Utøveroverføring:** TA→TA via e-post; aksepterende TA må ha byttet til
   mottakerlaget; flytter utøver + garasje + løpsbruk + kalender + tester;
   `stripProducts` (default på) nuller produktreferanser i testene (gjen-
   opprettes IKKE ved angring); mottaker-TA blir hovedsmører; 14 dagers grace
   for avsenderlaget; angre innen grace reverserer alt annet. **SA admin-move**:
   umiddelbart, uten grace, stripProducts default av.
5. **Utøverlån:** TA→TA, valgfritt utløp; utøveren blir hjemme; låntakerlag
   får tilgang via hasAthleteAccess så lenge lånet er aktivt; «End loan» når
   som helst fra eierlaget; badges i UI.
6. **Per-utøver brukertilgang** + share-view-kontoer (se §3.2).
7. **Offentlig feedback-lenke per utøver:** UUID-token, én aktiv per
   utøver+lag, ingen utløp; GET (uinnlogget) viser utøverens KOMPLETTE
   løpsbruk- og prep-historikk; POST skriver rating/kommentar og inbokser alle
   med tilgang; revoke setter revoked=1.
8. **Offentlig test-lenke** (`share_token`): 20 bytes hex, ingen utløp;
   offentlig side viser dato/sted/navn/type/notater/skaper + per par: ranks/
   resultater (runde 1 + xkm-kolonnene, ikke results-JSON), feeling/kick,
   metode og produkt (merke/navn/kategori). Opprettelse krever kun innlogget
   lagmedlem; oversikten over aktive lenker krever tests:view; sletting
   tests:edit; begge logges.
9. **All teams** (se §3.2/6.13).
10. **Team join requests:** TA inviterer eksisterende bruker fra annet lag;
    brukeren aksepterer selv → medlemskap + per-lag-rettigheter satt til
    **alt=edit** (begrenset til lagets områder), TA=nei, tomt gruppescope;
    varsles på dashbord/inbox/e-post; kanselleres av avsender.
11. **Invitasjoner** (nye kontoer): token i klartekst, **48 t utløp**, én aktiv
    per lag+e-post; aksept oppretter konto m/ standardrettigheter.
12. **Google Sheets/Drive:** produkt-sync BEGGE veier men asymmetrisk — pull
    (ark→Glidr) er kun additiv (sletter aldri), auto hvert 5. min; push
    (Glidr→ark) skriver KUN lager/ordre tilbake (eller appender ny rad).
    Team-backup-ark (grupper, tester+entries, vær, serier, produkter, utøvere,
    slip, brukere, lagerendringer, race preps) hvert 30. min + nattlig
    Drive-jobb (JSON+PDF); **datatap-vakt**: auto-backup nekter å overskrive
    hvis radtallet falt under 20 % av forrige (SA inbokses; manuell kjøring
    tvinger). SA-konfigurert **system-dump** (alle tabeller/kolonner inkl.
    hasher) til privat Drive-mappe. Felles service-konto; laget deler arket
    med service-kontoens e-post.
13. **JSON/Excel-eksport + import-v2:** full-export skjuler vilkårsfelter for
    ikke-SA; Excel bygges klientside og logges; import-v2 lander alltid i
    KALLERENS aktive lag, 24 tabellspesifikasjoner i avhengighetsrekkefølge,
    dedupe på naturlige nøkler, returnerer `notRestored`-liste. NB: importerte
    feedback_links blir aktive igjen. GDPR-selveksport for egen bruker.
14. **Inbox/mentions:** per PERSON (to_user_id), følger brukeren på tvers av
    lagbytte (bevisst — det er slik overførings-/lånevarsler virker);
    @-mentions i testkommentarer matches på eksakt navn innen laget.

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

## Vedlegg A — Klientruter (komplett)

/login, /forgot-password, /reset-password, /invite/:token,
/share/test/:token, /feedback/:token (offentlige) · / → /dashboard ·
/dashboard · /tests · /tests/new · /tests/:id · /tests/:id/edit ·
/tests/compare · /all-teams-tests · /tests/cross/:id · /testskis ·
/testskis/:id · /products · /products/:id · /weather · /weather/missing ·
/analytics · /grinding · /raceskis · /raceskis/:id · /race-fleet · /ski/:id ·
/kick · /raceprep · /live-runsheets · /watch-queue · /suggestions ·
/my-account (/profile redirecter hit) · /my-team · /admin · /inbox ·
/overview (SA) · /test-protocol (SA) · /status · /pricing · /contact ·
/get-started · /demo · /what-is-glidr · /legal · /dpa · /logo-preview ·
404-fallback.

## Vedlegg B — API-omfang

Serveren eksponerer ~380 endepunkter under `/api/*` (GET/POST/PUT/PATCH/
DELETE) gruppert etter områdene i §6. Fullstendig maskinuttrukket liste kan
regenereres med:
`grep -oE 'app\.(get|post|put|patch|delete)\("(/api/[^"]*)"' server/routes.ts server/auth.ts`
— bruk kildekoden som fasit for eksakte stier og payloads ved gjenoppbygging.

---

*Generert fra kildekoden i `glidr5` (commit-historikken er fasit) og
verifisert mot en systematisk gjennomgang av alle klientsider og alle
delingsmekanismer. Ved gjenoppbygging: følg §3 (sikkerhet), §5 (regler) og
§6b (deling) strengt — det er der djevelen bor. Dokumentet beskriver
funksjonell atferd, ikke piksel-nøyaktig layout; koden + database-backup er
den endelige fasiten.*
