# Glidr — Ski Testing & Documentation

## Overview
Glidr is a full-stack React web application designed to manage ski testing and documentation. It supports a multi-team/multi-tenant architecture with role-based access control (Super Admin, Team Admin, Members) and group-based data scoping. The platform facilitates the management of TestSkis series, Products (glide, topping, structure tools), DailyWeather, and Tests with live-ranking entry. The project aims to provide a robust solution for ski testing, enhancing efficiency and data analysis for ski teams.

## User Preferences
- Table-first workflow for fast on-snow data entry
- Ranking auto-calculates live (competition ranking: ties skip next numbers, e.g., 1-1-3)
- Rank badges use gold (1st), silver (2nd), bronze (3rd) medal colors
- Admin menu hidden from non-admin users
- Test series can be sorted alphabetically (A-Z toggle)
- Product autocomplete filters by test type (Glide shows Glide+Topping; Structure shows Structure tool)
- Series dropdown filters by test type (only shows series matching selected Glide/Structure)
- Weather auto-links to tests by matching date + location + groupScope
- Tests list shows winner badge with product name
- Tests can be filtered by type, product, snow type, location, air/snow temp, air/snow humidity
- Test detail page shows full results table with winner highlighting
- Test detail page has Hide/Show button to toggle product and methodology columns
- Tests can be duplicated (copies ski pairs, products, methodology, series, test type — results/date/location left blank for new entry)
- Tests can be edited and deleted (with cascade deletion of entries)
- Admin can create/edit/delete users and reset passwords
- Admin can manage groups (add, rename, delete) — groups are stored in database
- Users can belong to multiple groups (comma-separated groupScope, multi-checkbox in admin UI)
- Admin can see products from all groups, filtered by group, and move products between groups
- Scope filtering supports multi-group users (data from all assigned groups is visible)
- Login page has "Remember me" checkbox (extends session to 30 days)
- Admin page shows login history (who logged in, when, and from which IP address)
- Admin page has "Download PDF" button to export all app data via dedicated bulk endpoint (users, groups, series, products, tests with entries, weather with full fields, athletes, race skis, race ski regrinds, test ski regrinds, grinding records, grinding sheets, activity logs, login history)
- PDF export uses /api/admin/full-export endpoint for reliable bulk data retrieval (no N+1 queries); includes race ski regrinds, test ski series regrinds, grinding sheets, and activity logs
- CSV export available for tests, weather, and products in spreadsheet-friendly format
- Tests support dynamic rounds (unlimited distance measurements via + Round button)
- Distance labels and results stored as JSON (distanceLabels on tests, results on test_entries)
- Legacy 2-field format (distanceLabel0km/Xkm, result0km/Xkm) auto-converted on load
- Test entries support feeling rank (subjective ski pair ranking column)
- Test entries support kick rank (only shown for Classic test type, orange badge styling)
- Test types include Glide, Structure, Classic, Skating, and Grind
- Race ski tests only allow Classic and Skating test types (Glide/Structure/Grind removed from race ski dropdown)
- Classic/Skating test types filter series by skiType (matching discipline)
- Kick column included in CSV and PDF exports for Classic tests
- Test entries support multiple products per line (inline + button, additionalProductIds field)
- Combined products displayed with "+" separator between names (e.g., "Brand A + Brand B")
- Hide/Show on test detail blanks Product/Method cells instead of removing columns
- Brand and product name displayed with space separator (no em dash)
- Test ski series have optional Brand and Ski type fields
- Weather logs can be deleted (with confirmation dialog)
- Weather form has group selector for multi-group users (persists last-used group to localStorage)
- Series detail page (/testskis/:id) shows all tests for a series with results tables
- Tests page has date dropdown filter listing unique test dates (newest first) with "All dates" option
- Tests page has sort dropdown: Date ↑, Date ↓ (default), Location A-Z, Location Z-A
- Offline mode: data entry works without internet, changes queue locally and sync when reconnected
- Service worker caches app shell for offline access
- IndexedDB stores pending mutations and cached reference data
- Header shows online/offline status indicator and pending sync count
- Analytics page (/analytics) with recharts: product wins over time, avg rank by product, tests per month, snow temp vs rank scatter
- Analytics page has Glide/Structure/All filter
- Analytics page has product search combobox with detailed stats: total tests, wins, avg rank, win rate, methodology breakdown, performance-over-time chart, and test history table
- Analytics page has product comparison tool: select 2+ products to compare side-by-side with summary table, avg rank over time chart, and head-to-head results in shared tests
- PDF report generation on test detail page (jsPDF + autoTable): includes test info, weather, full results table
- Test detail page has CSV, PDF, and Hide/Show export buttons
- Series form has group selector (shown for multi-group users, defaults to first group)
- New test form has group selector that defaults to selected series' group; location field starts empty (no auto-fill from weather)
- Edit test form has group selector that updates when series changes
- Group selector hidden for single-group users (auto-assigned)
- Grinding page has two tabs: Records (grinding log) and Spreadsheets (embedded Google Sheets)
- Multiple Google Sheets can be added, with a selector to switch between them
- Sheets are embedded via iframe using Google Sheets HTML export URL
- Sheet URLs auto-converted to embed format (extracts spreadsheet ID and gid)
- Each sheet has name, URL, edit, and delete controls
- "Open in Google Sheets" link for direct access to the original spreadsheet
- Dark mode toggle (sun/moon icon) in header and login page, persisted to localStorage
- Granular permission system: 9 areas (dashboard, tests, testskis, products, weather, analytics, grinding, raceskis, suggestions) x 3 levels (none, view, edit)
- Permissions stored as JSON text column on users table, parsed via parsePermissions helper
- Server-side permission enforcement via requirePermission(area, level) middleware on all API routes
- Client-side can(area, level) helper in useAuth hook for nav filtering and UI controls
- Admin UI has permission matrix editor for managing per-user access levels
- sanitizePermissions validates JSON on user create/update (only allows known areas and levels)
- Grind tests require grinding permission (server-side + client-side filtering)
- Grind parameters (type, stone, pattern) configurable per entry, not per test
- Race Skis module: athlete profiles with access control, ski inventory (serial, skiId, brand, discipline, construction, mold, base, grind, heights, year), regrind history
- Race ski testing: testSkiSource field on tests ("series"|"raceskis"), raceSkiId on entries
- Race ski test entries validated server-side against user's allowed athlete/ski access
- All users with athlete access can view AND edit tests associated with that athlete (not just creator), regardless of group scope or tests permission level
- Race ski test endpoints (list, view, edit, delete, entries) grant access based on athlete access, independent of tests permission — users with raceskis permission but tests:none can still access raceski tests
- Athlete access sharing via athlete_access join table (creator always has access, admin has full access)
- Race ski regrinds auto-update ski's current grind field
- Race ski test entry has "Edit Parameters" button: configure which ski columns (Brand, Base, Grind, Heights, Construction, Mold, Serial, Year) are visible and their order; persisted to localStorage
- Language feature removed: no I18nProvider, no language selector, English-only
- AI Suggestions page: weather parameter form → OpenAI-powered product recommendations based on historical test data (DB-only, group-scoped)
- Test ski regrind tracking archive per series
- Multi-team/multi-tenant architecture: teams table sits above groups, all data tables have teamId column
- Three role levels: Super Admin (cross-team access), Team Admin (full access within their team), Member (granular permissions)
- Super Admin can switch between teams via team switcher dropdown in header (activeTeamId)
- Team Admin has full permissions within their team (treated like admin for permission checks)
- All data queries scoped by teamId for complete data isolation between teams/organizations
- Teams CRUD API: GET/POST/PUT/DELETE /api/teams, POST /api/teams/switch
- Admin page has Teams tab (super admin only) for managing teams
- User create/edit forms include Team Admin role option
- Existing data migrated to teamId=1 (default team)
- Groups.name unique constraint removed to allow same group names across different teams
- Admin page has Data Management tab: database overview (all table counts + active sessions), export tools (PDF + CSV)
- Admin page has Danger Zone tab: purge old activity/login logs (30/90+ days), force logout all users
- Admin overview stats include Athletes and Race Skis counts

## System Architecture
The application follows a client-server architecture. The frontend is built with React 19, Vite, TanStack Query for data fetching, wouter for routing, shadcn/ui for UI components, and Tailwind CSS v4 for styling. The design prioritizes a clean, light theme with a professional color palette and uses Space Grotesk and Inter fonts.

The backend is powered by Express 5, utilizing session-based authentication with `passport-local` and `connect-pg-simple` for PostgreSQL session storage. Drizzle ORM is used for database interactions. Data is stored in a PostgreSQL database.

Core features include:
- **Authentication**: Session-based with `passport-local`, supporting login, logout, and user session management.
- **Authorization**: Role-based access control (Super Admin, Team Admin, Member) and granular permissions managed via a JSON text column in the `users` table, enforced both server-side and client-side.
- **Multi-tenancy**: A `teamId` column scopes all data, ensuring isolation between different teams/organizations. Super Admins can manage and switch between teams.
- **Data Models**: Comprehensive Drizzle schemas for various entities including `teams`, `users`, `test_ski_series`, `products`, `daily_weather`, `tests`, `test_entries`, `athletes`, `race_skis`, and `regrinds`.
- **API Design**: A RESTful API (`/api/*`) handles all data operations, with dedicated endpoints for authentication, user management, data CRUD for various entities, and administrative tasks.
- **UI/UX**: Focus on a streamlined user experience with features like live ranking, intelligent filtering for products and series, offline data entry capabilities, and analytical dashboards.
- **Data Export**: Support for CSV and PDF exports of various datasets, including a bulk data export for administrators.
- **AI Integration**: A dedicated page for AI-powered product recommendations based on historical test data.
- **Grinding Module**: Functionality to log grinding records and embed Google Sheets for grinding management.

## External Dependencies
- **PostgreSQL**: Primary database for all application data, with Neon-backed hosting via Replit.
- **OpenAI**: Used for generating AI-powered product recommendations.
- **Google Sheets**: Integrated for embedding grinding spreadsheets via iframes.
- **jsPDF + autoTable**: Used for client-side PDF report generation.
- **Recharts**: Utilized for data visualization and analytics on the dashboard.