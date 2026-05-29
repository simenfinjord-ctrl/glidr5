/**
 * Puppeteer configuration.
 * Sets a project-local cache directory so the Chrome binary installed
 * during 'npx puppeteer browsers install chrome' (build step) is found
 * at the same path when the server starts (runtime).
 * Without this, Render clears ~/.cache between build and runtime.
 */
const { join } = require('path');

/** @type {import("puppeteer").Configuration} */
module.exports = {
  cacheDirectory: join(__dirname, '.puppeteer-cache'),
};
