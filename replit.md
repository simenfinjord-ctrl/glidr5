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
- `client/src/pages/test-detail.tsx` — Test detail view with results table
- `client/src/pages/` — All page components

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
- `GET/POST /api/series` — List/create series
- `PUT /api/series/:id` — Update series
- `GET/POST /api/products` — List/create products
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

## User Preferences
- Table-first workflow for fast on-snow data entry
- Ranking auto-calculates live (dense ranking: 0cm = rank 1)
- "lane" field removed from data model
- Product autocomplete filters by test type (Glide shows Glide+Topping; Structure shows Structure tool)
- Weather auto-links to tests by matching date + location + groupScope
- Tests list shows winner badge with product name
- Tests can be filtered by type, product, snow type, location
- Test detail page shows full results table with winner highlighting
- Admin can create/edit/delete users and reset passwords
