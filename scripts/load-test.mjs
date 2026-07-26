#!/usr/bin/env node
// Glidr load test — simulates N concurrent users hammering the heaviest read
// endpoints. Run from your Mac against production (or a test deploy):
//
//   node scripts/load-test.mjs https://glidr.no <session-cookie> [users] [seconds]
//
// Get the cookie: log in as a normal user in the browser → DevTools →
// Application → Cookies → copy the connect.sid value ("connect.sid=s%3A...").
// Use a TEST user on a TEST team, and run it off-hours the first time.
const [base, cookie, usersArg, secondsArg] = process.argv.slice(2);
if (!base || !cookie) {
  console.log("Usage: node scripts/load-test.mjs <baseUrl> <cookie> [users=50] [seconds=30]");
  process.exit(1);
}
const USERS = parseInt(usersArg || "50");
const SECONDS = parseInt(secondsArg || "30");
const ENDPOINTS = [
  "/api/tests", "/api/products", "/api/weather", "/api/series",
  "/api/auth/me", "/api/watch/queue", "/api/kick-tests", "/api/user/teams",
];
const stats = { ok: 0, fail: 0, total: 0, times: [] };
async function user(id) {
  const end = Date.now() + SECONDS * 1000;
  while (Date.now() < end) {
    const ep = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
    const t0 = Date.now();
    try {
      const r = await fetch(base + ep, { headers: { cookie } });
      const ms = Date.now() - t0;
      stats.times.push(ms); stats.total++;
      if (r.ok) stats.ok++; else { stats.fail++; if (stats.fail < 10) console.log(`  ${r.status} ${ep}`); }
    } catch (e) { stats.fail++; stats.total++; }
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 800)); // human-ish pacing
  }
}
console.log(`Load test: ${USERS} users × ${SECONDS}s against ${base}`);
const t0 = Date.now();
await Promise.all(Array.from({ length: USERS }, (_, i) => user(i)));
stats.times.sort((a, b) => a - b);
const p = (q) => stats.times[Math.floor(stats.times.length * q)] ?? 0;
console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`Requests: ${stats.total}  OK: ${stats.ok}  Failed: ${stats.fail} (${((stats.fail / Math.max(1, stats.total)) * 100).toFixed(1)}%)`);
console.log(`Latency  p50: ${p(0.5)}ms  p90: ${p(0.9)}ms  p99: ${p(0.99)}ms  max: ${stats.times.at(-1)}ms`);
console.log(stats.fail === 0 ? "\n✅ No failures — holds this load." : "\n⚠️  Failures detected — check Render logs/metrics.");
