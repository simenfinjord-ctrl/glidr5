#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  ./node_modules/.bin/drizzle-kit push --force || echo "Warning: Migration failed, server will start anyway"
else
  echo "Warning: DATABASE_URL not set, skipping migrations"
fi

echo "Starting server..."
exec node dist/index.cjs
