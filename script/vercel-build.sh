#!/bin/bash
set -e

echo "Building client with Vite..."
npx vite build --config vite.config.ts

echo "Bundling API serverless function..."
npx esbuild api/index.ts \
  --bundle \
  --platform=node \
  --format=cjs \
  --outfile=api/index.js \
  --alias:@shared=./shared \
  --external:pg-native \
  --define:process.env.NODE_ENV=\"production\" \
  --minify

echo "Build complete!"
