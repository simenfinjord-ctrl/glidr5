# FastSki — US Ski Team Testing & Documentation

## Overview
Full-stack React web application for the US Ski Team to manage ski testing and documentation. Features role-based access control (Admin, World Cup, U23, Biathlon groups), databases for TestSkis series, Products (glide/topping/structure tools), DailyWeather, and Tests with live-ranking entry.

## Architecture
- **Frontend**: React 19 + Vite + TanStack Query + wouter routing + shadcn/ui + Tailwind CSS v4
- **Backend**: Express 5 + session-based auth (passport-local) + Drizzle ORM
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Design**: Space Grotesk (display) + Inter (UI), glassmorphic cards with backdrop blur, dark theme

## Key Files
- `shared/schema.ts` — Drizzle schema: users, test_ski_series, products, daily_weather, tests, test_entries
- `server/db.ts` — PostgreSQL connection pool
- `server/storage.ts` — DatabaseStorage class (IStorage interface with full CRUD)
- `server/auth.ts` — Passport-local session auth setup
- `server/routes.ts` — All API routes under /api
- `server/seed.ts` — Seeds demo users + data on first run
- `client/src/lib/auth.ts` — useAuth() hook (TanStack Query)
- `client/src/lib/queryClient.ts` — API request helpers
- `client/src/App.tsx` — Router with auth guard
- `client/src/components/app-shell.tsx` — Layout with nav
- `client/src/pages/test-detail.tsx` — Test detail view with results table, CSV export, Hide/Show toggle
- `client/src/pages/dashboard.tsx` — Dashboard with stats, top products, recent tests
- `client/src/pages/` — All page components
- `client/public/logo.png` — US Ski Team logo

## Seeded Accounts
| Email | Password | Group | Admin |
|---|---|---|---|
| admin@fastski.local | password | Admin | Yes |
| u23@fastski.local | password | U23 | No |
| wc@fastski.local | password | World Cup | No |
| biathlon@fastski.local | password | Biathlon | No |

## API Endpoints
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Current user
- `GET/POST /api/groups` — List/create groups
- `PUT /api/groups/:id` — Rename group (admin only)
- `DELETE /api/groups/:id` — Delete group (admin only)
- `GET/POST /api/series` — List/create series
- `PUT /api/series/:id` — Update series
- `GET/POST /api/products` — List/create products
- `PUT /api/products/:id` — Update product (admin only, for moving between groups)
- `GET/POST /api/weather` — List/create weather
- `PUT /api/weather/:id` — Update weather
- `GET /api/weather/find?date=&location=` — Find weather
- `GET /api/tests/:id` — Get single test
- `GET/POST /api/tests` — List/create tests (with entries)
- `GET /api/tests/:id/entries` — List test entries (scope-checked)
- `GET/POST /api/users` — List/create users (admin only)
- `PUT /api/users/:id` — Update user (admin only)
- `DELETE /api/users/:id` — Delete user (admin only)
- `POST /api/users/:id/reset-password` — Reset password (admin only)

## Weather Data Model
The daily_weather table stores comprehensive snow and weather conditions:
- **Core**: date, time, location, groupScope
- **Temperature/Humidity**: snowTemperatureC, airTemperatureC, snowHumidityPct (ref. Doser), airHumidityPct (%rH)
- **Weather**: clouds (0-8 oktas), visibility, wind, precipitation
- **Snow type**: artificialSnow + naturalSnow (both can be set simultaneously): Falling new, New, Irreg. dir. new, Irreg. dir. transf., Transformed
- **Snow characteristics**: grainSize (Extra fine → Very coarse), snowHumidityType (Dry → Slush), trackHardness (Very soft → Ice)
- **Quality**: testQuality (1-10 scale)
- Old `snowType` field retained as nullable for backward compatibility

## User Preferences
- Table-first workflow for fast on-snow data entry
- Ranking auto-calculates live (dense ranking: 0cm = rank 1)
- "lane" field removed from data model
- Product autocomplete filters by test type (Glide shows Glide+Topping; Structure shows Structure tool)
- Weather auto-links to tests by matching date + location + groupScope
- Tests list shows winner badge with product name
- Tests can be filtered by type, product, snow type, location, air/snow temp, air/snow humidity
- Test detail page shows full results table with winner highlighting
- Test detail page has Hide/Show button to toggle product and methodology columns
- Tests can be edited and deleted (with cascade deletion of entries)
- Admin can create/edit/delete users and reset passwords
- Admin can manage groups (add, rename, delete) — groups are stored in database
- Users can belong to multiple groups (comma-separated groupScope, multi-checkbox in admin UI)
- Admin can see products from all groups, filtered by group, and move products between groups
- Scope filtering supports multi-group users (data from all assigned groups is visible)
